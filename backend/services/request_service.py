from datetime import datetime, timezone
from bson import ObjectId
from config import Config
from database.connection import get_db, serialize_doc
from services.matching_service import (
    find_matched_donors_for_request,
    find_nearby_donors,
    validate_gps_coordinates,
    make_geojson_point,
    haversine_distance_km,
)
from services.blood_compatibility import is_donor_compatible
from services.notification_service import create_notification
from services.email_service import send_emergency_request_email, send_donation_status_email
from services.realtime_service import emit_realtime_event

def create_blood_request(user_doc: dict, data: dict):
    db = get_db()
    now = datetime.now(timezone.utc)
    urgency = (data.get("urgency") or "NORMAL").strip().upper()
    role = user_doc.get("role", "REQUESTER")

    hospital = None
    # If role is HOSPITAL, verify that the hospital has been approved by admin
    if role == "HOSPITAL":
        hospital = db.hospitals.find_one({"userId": str(user_doc["_id"])})
        if hospital and not hospital.get("isVerified", False):
            return None, "Hospital account is pending administrative verification. Verified status is required to issue official hospital blood requests."

    blood_group = (data.get("bloodGroup") or "").strip().upper()
    valid_bgs = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
    if blood_group not in valid_bgs:
        return None, f"Invalid blood group '{blood_group}'. Must be one of: {', '.join(valid_bgs)}."

    try:
        raw_units = data.get("unitsRequired") if data.get("unitsRequired") is not None else data.get("units", 1)
        units = int(raw_units)
        if units < 1 or units > 50:
            return None, "Units required must be between 1 and 50 units."
    except (ValueError, TypeError):
        return None, "Units required must be a valid positive number."

    hospital_name = (data.get("hospitalName") or (hospital.get("hospitalName") if hospital else "") or "").strip()
    if not hospital_name:
        return None, "Hospital or clinical facility name is required."

    city = (data.get("city") or (hospital.get("city") if hospital else "") or "").strip()
    if not city:
        return None, "City is required."

    raw_lat = data.get("lat") if data.get("lat") is not None else data.get("latitude")
    raw_lng = data.get("lng") if data.get("lng") is not None else data.get("longitude")
    if (raw_lat is None or raw_lng is None) and hospital:
        raw_lat = hospital.get("lat")
        raw_lng = hospital.get("lng")

    req_lat, req_lng = None, None
    if raw_lat is not None or raw_lng is not None:
        lat_f, lng_f, gps_err = validate_gps_coordinates(raw_lat, raw_lng)
        if gps_err:
            return None, gps_err
        req_lat, req_lng = lat_f, lng_f
        # Persist hospital GPS coordinates on hospital profile if missing
        if hospital and (hospital.get("lat") is None or hospital.get("lng") is None):
            db.hospitals.update_one(
                {"_id": hospital["_id"]},
                {"$set": {"lat": lat_f, "lng": lng_f, "location": make_geojson_point(lat_f, lng_f), "updatedAt": now}},
            )

    try:
        search_radius_km = int(data.get("searchRadiusKm") or Config.DEFAULT_SEARCH_RADIUS_KM)
    except (TypeError, ValueError):
        search_radius_km = Config.DEFAULT_SEARCH_RADIUS_KM

    contact_number = (data.get("contactNumber") or data.get("contactPhone") or user_doc.get("phone") or "").strip()
    additional_msg = (data.get("additionalMessage") or data.get("notes") or "").strip()

    req_doc = {
        "requesterId": str(user_doc["_id"]),
        "requesterRole": role,
        "hospitalId": str(hospital["_id"]) if hospital else None,
        "requesterName": user_doc["name"],
        "requesterEmail": user_doc["email"],
        "requesterPhone": user_doc.get("phone", ""),
        "patientName": (data.get("patientName") or "Patient In Need").strip(),
        "bloodGroup": blood_group,
        "unitsRequired": units,
        "hospitalName": hospital_name,
        "hospitalAddress": (data.get("hospitalAddress") or (hospital.get("address") if hospital else "") or "").strip(),
        "city": city,
        "state": (data.get("state") or (hospital.get("state") if hospital else "") or "").strip(),
        "pinCode": (data.get("pinCode") or "").strip(),
        "contactNumber": contact_number,
        "requiredDate": data.get("requiredDate") or now.strftime("%Y-%m-%d"),
        "urgency": urgency,
        "lat": req_lat,
        "lng": req_lng,
        "searchRadiusKm": search_radius_km,
        "additionalMessage": additional_msg,
        "status": "OPEN",
        "matchedDonorIds": [],
        "acceptedDonorId": None,
        "acceptedDonorName": None,
        "acceptedDonorPhone": None,
        "createdAt": now,
        "updatedAt": now
    }
    if req_lat is not None and req_lng is not None:
        req_doc["location"] = make_geojson_point(req_lat, req_lng)

    result = db.blood_requests.insert_one(req_doc)
    req_id = result.inserted_id
    req_doc["_id"] = req_id

    # Automatic matching step: combine live GeoJSON nearby search + broad compatibility fallback
    live_nearby = None
    if req_lat is not None and req_lng is not None:
        live_nearby, _ = find_nearby_donors(
            req_lat,
            req_lng,
            patient_blood_group=blood_group,
            radius_km=search_radius_km,
            only_verified=(role == "HOSPITAL"),
            require_live_sharing=True,
            request_city=city,
            request_state=req_doc["state"],
            request_id=str(req_id),
        )

    match_data = find_matched_donors_for_request(req_doc, only_verified=False)
    matched_donors = (live_nearby.get("donors") if live_nearby and live_nearby.get("donors") else None) or match_data.get("matches", [])
    matched_ids = [d["id"] for d in matched_donors[:10]] # top 10

    # If donors found, update status to MATCHED and store ids
    if matched_ids:
        db.blood_requests.update_one(
            {"_id": req_id},
            {"$set": {"status": "MATCHED", "matchedDonorIds": matched_ids, "updatedAt": now}}
        )
        req_doc["status"] = "MATCHED"
        req_doc["matchedDonorIds"] = matched_ids

    # Send notifications, create invitation records, and send emergency emails
    location_label = f"{req_doc['city']}, {req_doc['state']}" if req_doc.get("state") else req_doc["city"]
    matched_user_ids = []
    for donor in matched_donors[:10]:
        donor_user_id = donor.get("userId")
        donor_email = donor.get("email")
        if donor_user_id:
            matched_user_ids.append(str(donor_user_id))
            # Create invitation tracking record if emergency or hospital live-matched
            if urgency == "EMERGENCY" or (live_nearby and live_nearby.get("donors")):
                db.request_invitations.update_one(
                    {"requestId": str(req_id), "donorId": str(donor.get("id"))},
                    {
                        "$set": {
                            "donorUserId": str(donor_user_id),
                            "donorName": donor.get("name", "Donor"),
                            "bloodGroup": donor.get("bloodGroup", ""),
                            "hospitalId": str(user_doc["_id"]),
                            "distanceKm": donor.get("distanceKm"),
                            "status": "PENDING",
                            "updatedAt": now,
                        },
                        "$setOnInsert": {"createdAt": now},
                    },
                    upsert=True,
                )
            dist_txt = f" (~{donor.get('distanceKm')} km away)" if donor.get("distanceKm") is not None else ""
            create_notification(
                recipient_id=donor_user_id,
                recipient_email=donor_email,
                title=f"{'🚨 EMERGENCY: ' if urgency == 'EMERGENCY' else 'New Blood Request: '}{req_doc['bloodGroup']} Needed",
                message=f"{req_doc['unitsRequired']} unit(s) of {req_doc['bloodGroup']} needed at {req_doc['hospitalName']}, {location_label}{dist_txt}.",
                notif_type="EMERGENCY" if urgency == "EMERGENCY" else "REQUEST",
                related_id=req_id
            )
            # If emergency, send direct email alert
            if urgency == "EMERGENCY":
                try:
                    send_emergency_request_email(donor_email, donor.get("name", "Donor"), req_doc)
                except Exception as e:
                    print(f"[RequestService] Non-critical email send notice: {e}")

    # Notify requester
    create_notification(
        recipient_id=user_doc["_id"],
        recipient_email=user_doc["email"],
        title="Blood Request Registered",
        message=f"Your request for {req_doc['unitsRequired']} units of {req_doc['bloodGroup']} is active with {len(matched_donors)} compatible donors matched.",
        notif_type="SYSTEM",
        related_id=req_id
    )

    serialized = serialize_doc(req_doc)
    serialized["matchedDonors"] = matched_donors
    serialized["matchingSummary"] = {
        "totalMatches": len(matched_donors),
        "liveRadiusMatches": len(live_nearby.get("donors", [])) if live_nearby else 0,
        "radiusKm": search_radius_km,
        "disclaimer": match_data.get("disclaimer")
    }

    emit_realtime_event(
        "blood_request_created",
        {
            "requestId": str(req_id),
            "bloodGroup": req_doc["bloodGroup"],
            "unitsRequired": req_doc["unitsRequired"],
            "urgency": req_doc["urgency"],
            "hospitalName": req_doc["hospitalName"],
            "city": req_doc["city"],
            "state": req_doc["state"],
            "status": req_doc["status"],
            "matchedCount": len(matched_donors),
            "createdAt": now.isoformat(),
        },
        target_users=[str(user_doc["_id"]), *matched_user_ids],
        target_roles=["ADMIN"],
    )

    return serialized, None

def get_blood_requests(filters: dict):
    db = get_db()
    query = {}

    blood_group = filters.get("bloodGroup")
    if blood_group:
        query["bloodGroup"] = blood_group.strip().upper()

    state = filters.get("state")
    if state:
        query["state"] = {"$regex": f"^{state.strip()}$", "$options": "i"}

    city = filters.get("city")
    if city:
        query["city"] = {"$regex": f"^{city.strip()}$", "$options": "i"}

    urgency = filters.get("urgency")
    if urgency:
        query["urgency"] = urgency.strip().upper()

    status = filters.get("status")
    if status:
        query["status"] = status.strip().upper()

    requester_id = filters.get("requesterId")
    if requester_id:
        query["requesterId"] = str(requester_id)

    # Sort EMERGENCY requests to the top, then by createdAt descending
    requests = list(db.blood_requests.find(query).sort([
        ("urgency", 1), # Sort emergency (alphabetically E, but we can do a secondary sort)
        ("createdAt", -1)
    ]).limit(100))

    # Priority sort in Python: EMERGENCY first, then HIGH, NORMAL, LOW
    urgency_weight = {"EMERGENCY": 4, "HIGH": 3, "NORMAL": 2, "LOW": 1}
    requests.sort(key=lambda r: (urgency_weight.get(r.get("urgency", "NORMAL"), 0)), reverse=True)

    return serialize_doc(requests)

def get_request_by_id(request_id: str):
    db = get_db()
    try:
        req = db.blood_requests.find_one({"_id": ObjectId(request_id)})
        return serialize_doc(req)
    except Exception:
        return None

def update_request_status(request_id: str, new_status: str, user_doc: dict):
    db = get_db()
    req = db.blood_requests.find_one({"_id": ObjectId(request_id)})
    if not req:
        return None, "Blood request not found."

    # Check permission: Requester or Admin or Hospital
    is_admin = user_doc.get("role") == "ADMIN"
    user_id_str = str(user_doc.get("id") or user_doc.get("_id") or "")
    is_owner = (
        str(req.get("requesterId", "")) == user_id_str
        or (req.get("hospitalId") and str(req.get("hospitalId")) == user_id_str)
    )
    if not (is_admin or is_owner):
        return None, "Not authorized to update this blood request status."

    # Allowed status lifecycle
    allowed_statuses = [
        "PENDING_VERIFICATION", "PENDING", "APPROVED", "OPEN", "MATCHED", "DONOR_CONTACTED",
        "DONOR_RESPONDED", "ACCEPTED", "SCREENING_SUBMITTED", "SCHEDULED",
        "DONATION_COMPLETED", "FULFILLED", "CANCELLED", "EXPIRED", "CLOSED"
    ]
    if new_status not in allowed_statuses:
        return None, f"Invalid status '{new_status}'."

    # Prevent non-admin from modifying already fulfilled requests
    current_status = req.get("status", "OPEN")
    if current_status in ["DONATION_COMPLETED", "FULFILLED"] and not is_admin:
        return None, "This blood request has already been fulfilled and cannot be reopened."

    now = datetime.now(timezone.utc)
    update_fields = {"status": new_status, "updatedAt": now}

    # Cancelled or expired requests must no longer generate new donor invitations
    if new_status in ["CANCELLED", "EXPIRED"]:
        update_fields["matchedDonorIds"] = []

    db.blood_requests.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": update_fields}
    )

    # If scheduled or completed/fulfilled, create donation or update
    if new_status in ["DONATION_COMPLETED", "FULFILLED"] and req.get("acceptedDonorId"):
        # Auto record donation if not exists
        donor_id = req["acceptedDonorId"]
        donor = db.donors.find_one({"_id": ObjectId(donor_id)})
        if donor:
            from services.donation_service import record_donation
            record_donation({
                "donorId": donor_id,
                "donorName": donor.get("name"),
                "donorEmail": donor.get("email"),
                "donorPhone": donor.get("phone"),
                "bloodGroup": req.get("bloodGroup"),
                "requestId": request_id,
                "patientName": req.get("patientName"),
                "hospitalName": req.get("hospitalName"),
                "hospitalAddress": req.get("hospitalAddress"),
                "city": req.get("city"),
                "state": req.get("state"),
                "units": req.get("unitsRequired", 1),
                "donationDate": now.isoformat(),
                "status": "COMPLETED",
                "notes": "Completed via Blood Request flow."
            })

    # Notify requester & donor
    create_notification(
        recipient_id=req["requesterId"],
        recipient_email=req.get("requesterEmail"),
        title=f"Request Status: {new_status.replace('_', ' ').title()}",
        message=f"Blood request for {req['patientName']} is now {new_status.replace('_', ' ').lower()}.",
        notif_type="SYSTEM",
        related_id=request_id
    )
    if req.get("acceptedDonorUserId"):
        create_notification(
            recipient_id=req["acceptedDonorUserId"],
            recipient_email="",
            title=f"Request Update: {new_status.replace('_', ' ').title()}",
            message=f"Blood request at {req.get('hospitalName', 'hospital')} is now {new_status.replace('_', ' ').lower()}.",
            notif_type="SYSTEM",
            related_id=request_id,
        )

    emit_realtime_event(
        "request_status_updated",
        {
            "requestId": str(request_id),
            "status": new_status,
            "hospitalName": req.get("hospitalName"),
            "bloodGroup": req.get("bloodGroup"),
            "updatedAt": now.isoformat(),
        },
        target_users=[req.get("requesterId"), req.get("acceptedDonorUserId")],
        target_roles=["ADMIN"],
    )

    updated_req = db.blood_requests.find_one({"_id": ObjectId(request_id)})
    return serialize_doc(updated_req), None


def invite_donors_to_request(
    request_id: str,
    actor_user: dict,
    donor_ids: list = None,
    radius_km: int = 25,
    top_n: int = 10,
):
    """Allows Hospital owner or Admin to invite selected or top nearby compatible donors."""
    db = get_db()
    if not ObjectId.is_valid(request_id):
        return None, "Invalid request ID.", 400
    req = db.blood_requests.find_one({"_id": ObjectId(request_id)})
    if not req:
        return None, "Blood request not found.", 404

    is_admin = actor_user.get("role") == "ADMIN"
    actor_id = str(actor_user.get("id") or actor_user.get("_id"))
    if not is_admin and str(req.get("requesterId")) != actor_id:
        return None, "Not authorized to invite donors for this request.", 403

    if req.get("status") in ["CANCELLED", "EXPIRED", "DONATION_COMPLETED", "FULFILLED"]:
        return None, f"Cannot invite donors while request is {req.get('status')}.", 400

    now = datetime.now(timezone.utc)
    req_lat = req.get("lat") or req.get("latitude")
    req_lng = req.get("lng") or req.get("longitude")
    target_donors = []

    if donor_ids:
        for did in donor_ids:
            if not ObjectId.is_valid(str(did)):
                continue
            d = db.donors.find_one({"_id": ObjectId(str(did))})
            if not d:
                d = db.donors.find_one({"userId": str(did)})
            if not d or not d.get("availability", True):
                continue
            if not is_donor_compatible(d.get("bloodGroup", ""), req.get("bloodGroup", "")):
                continue
            d_lat = d.get("lat")
            d_lng = d.get("lng")
            if (d_lat is None or d_lng is None) and isinstance(d.get("location"), dict):
                coords = d["location"].get("coordinates") or []
                if len(coords) == 2:
                    d_lng, d_lat = coords[0], coords[1]
            dist_km = haversine_distance_km(d_lat, d_lng, req_lat, req_lng)
            target_donors.append((d, dist_km))
    else:
        if req_lat is not None and req_lng is not None:
            nearby_res, _ = find_nearby_donors(
                req_lat,
                req_lng,
                patient_blood_group=req.get("bloodGroup"),
                radius_km=radius_km,
                only_verified=True,
                require_live_sharing=True,
                request_city=req.get("city"),
                request_state=req.get("state"),
                request_id=request_id,
            )
            for item in (nearby_res or {}).get("donors", [])[:top_n]:
                d = db.donors.find_one({"_id": ObjectId(item["id"])})
                if d:
                    target_donors.append((d, item.get("distanceKm")))
        if not target_donors:
            fallback = find_matched_donors_for_request(req, only_verified=True)
            for item in fallback.get("matches", [])[:top_n]:
                d = db.donors.find_one({"_id": ObjectId(item["id"])})
                if d:
                    target_donors.append((d, item.get("distanceKm")))

    if not target_donors:
        return None, "No eligible compatible donors available to invite.", 404

    invited_records = []
    invited_user_ids = []
    existing_matched = set(str(x) for x in (req.get("matchedDonorIds") or []))

    for d, dist_km in target_donors:
        did_str = str(d["_id"])
        duid_str = str(d.get("userId", ""))
        existing_matched.add(did_str)
        inv_doc = {
            "requestId": str(request_id),
            "donorId": did_str,
            "donorUserId": duid_str,
            "donorName": d.get("name", "Donor"),
            "bloodGroup": d.get("bloodGroup", ""),
            "hospitalId": str(req.get("requesterId", "")),
            "hospitalName": req.get("hospitalName", ""),
            "distanceKm": dist_km,
            "urgency": req.get("urgency", "NORMAL"),
            "unitsRequired": req.get("unitsRequired", 1),
            "status": "PENDING",
            "invitedBy": actor_id,
            "updatedAt": now,
        }
        db.request_invitations.update_one(
            {"requestId": str(request_id), "donorId": did_str},
            {"$set": inv_doc, "$setOnInsert": {"createdAt": now}},
            upsert=True,
        )
        if duid_str:
            invited_user_ids.append(duid_str)
            dist_txt = f" (~{dist_km} km away)" if dist_km is not None else ""
            create_notification(
                recipient_id=duid_str,
                recipient_email=d.get("email"),
                title=f"{'🚨 EMERGENCY INVITE: ' if req.get('urgency') == 'EMERGENCY' else 'Blood Donation Invitation: '}{req.get('bloodGroup')} Needed",
                message=f"{req.get('hospitalName')} ({req.get('city')}) urgently invited you to donate {req.get('unitsRequired', 1)} unit(s) of {req.get('bloodGroup')}{dist_txt}.",
                notif_type="EMERGENCY" if req.get("urgency") == "EMERGENCY" else "REQUEST",
                related_id=request_id,
            )
            emit_realtime_event(
                "donor_invited",
                {
                    "requestId": str(request_id),
                    "hospitalName": req.get("hospitalName"),
                    "city": req.get("city"),
                    "bloodGroup": req.get("bloodGroup"),
                    "unitsRequired": req.get("unitsRequired", 1),
                    "urgency": req.get("urgency", "NORMAL"),
                    "approximateDistanceKm": dist_km,
                    "invitedAt": now.isoformat(),
                },
                target_users=[duid_str],
            )
        invited_records.append({
            "donorId": did_str,
            "donorUserId": duid_str,
            "donorName": d.get("name"),
            "bloodGroup": d.get("bloodGroup"),
            "distanceKm": dist_km,
            "status": "PENDING",
        })

    new_status = "DONOR_CONTACTED" if req.get("status") in ["OPEN", "PENDING", "MATCHED"] else req.get("status")
    db.blood_requests.update_one(
        {"_id": ObjectId(request_id)},
        {
            "$set": {
                "status": new_status,
                "matchedDonorIds": list(existing_matched),
                "updatedAt": now,
            }
        },
    )

    emit_realtime_event(
        "request_status_updated",
        {
            "requestId": str(request_id),
            "status": new_status,
            "invitedCount": len(invited_records),
            "updatedAt": now.isoformat(),
        },
        target_users=[str(req.get("requesterId")), *invited_user_ids],
        target_roles=["ADMIN"],
    )

    return {
        "requestId": str(request_id),
        "status": new_status,
        "invitedCount": len(invited_records),
        "invitations": invited_records,
    }, None, 200


def get_request_invitations(request_id: str):
    db = get_db()
    invs = list(db.request_invitations.find({"requestId": str(request_id)}).sort("updatedAt", -1))
    return serialize_doc(invs)

def delete_request(request_id: str, user_doc: dict):
    db = get_db()
    if not ObjectId.is_valid(request_id):
        return False, "Invalid request ID format.", 400
    req = db.blood_requests.find_one({"_id": ObjectId(request_id)})
    if not req:
        return False, "Request not found.", 404

    is_admin = user_doc.get("role") == "ADMIN"
    user_id_str = str(user_doc.get("id") or user_doc.get("_id") or "")
    is_owner = (
        str(req.get("requesterId", "")) == user_id_str
        or (req.get("hospitalId") and str(req.get("hospitalId")) == user_id_str)
    )
    if not (is_admin or is_owner):
        return False, "Unauthorized to delete this request.", 403

    db.blood_requests.delete_one({"_id": ObjectId(request_id)})
    db.request_invitations.delete_many({"requestId": str(request_id)})
    return True, None, 200
