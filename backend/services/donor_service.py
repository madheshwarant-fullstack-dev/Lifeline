from datetime import datetime, timezone, timedelta
from collections import defaultdict
import time
from bson import ObjectId
from config import Config
from database.connection import get_db, serialize_doc
from services.notification_service import create_notification
from services.email_service import send_donation_status_email
from services.matching_service import (
    validate_gps_coordinates,
    make_geojson_point,
    get_approximate_coords,
    haversine_distance_km,
    expire_stale_donor_locations,
    is_donor_location_fresh,
)
from services.realtime_service import emit_realtime_event

# Sliding window per-user timestamps for location update rate limiting
_location_update_timestamps = defaultdict(list)

def get_donor_by_user_id(user_id: str):
    db = get_db()
    donor = db.donors.find_one({"userId": str(user_id)})
    return serialize_doc(donor)

def get_donor_by_id(donor_id: str):
    db = get_db()
    if not donor_id:
        return None
    try:
        if ObjectId.is_valid(donor_id):
            donor = db.donors.find_one({"_id": ObjectId(donor_id)})
            if donor:
                return serialize_doc(donor)
        donor = db.donors.find_one({"userId": str(donor_id)})
        if donor:
            return serialize_doc(donor)
        return None
    except Exception:
        return None

def update_donor_profile(user_id: str, data: dict):
    db = get_db()
    now = datetime.now(timezone.utc)
    
    # Fields allowed to update in donor record
    allowed_donor_fields = [
        "name", "phone", "state", "city", "district", "pinCode", "address", "emergencyContact",
        "availability", "gender", "dateOfBirth", "bloodGroup",
        "lastDonationDate", "currentDonationLocation", "matchingLocationPreference",
        "shareLocationForMatching", "notificationsEnabled", "lat", "lng"
    ]
    
    update_donor = {"updatedAt": now}
    update_user = {"updatedAt": now}
    
    for f in allowed_donor_fields:
        if f in data:
            update_donor[f] = data[f]
            if f in ["name", "phone", "state", "city", "address", "district", "pinCode", "gender", "dateOfBirth", "bloodGroup", "lat", "lng"]:
                update_user[f] = data[f]

    db.donors.update_one({"userId": str(user_id)}, {"$set": update_donor})
    db.users.update_one({"_id": ObjectId(user_id)}, {"$set": update_user})
    
    return get_donor_by_user_id(user_id)

def sanitize_public_donor(donor_serialized: dict) -> dict:
    """Masks personal phone, address, and removes all GPS/GeoJSON coordinates for public/unauthorized callers."""
    if not donor_serialized:
        return donor_serialized
    d = dict(donor_serialized)
    raw_phone = d.get("phone", "")
    if raw_phone and len(raw_phone) >= 7:
        d["phone"] = raw_phone[:6] + " •••••"
    d["isPhoneMasked"] = True
    d["address"] = f"{d.get('city', '')}, {d.get('state', '')}".strip(", ")
    d["emergencyContact"] = None
    d.pop("lat", None)
    d.pop("lng", None)
    d.pop("location", None)
    d.pop("locationExpiresAt", None)
    if "currentDonationLocation" in d and isinstance(d["currentDonationLocation"], dict):
        d["currentDonationLocation"].pop("lat", None)
        d["currentDonationLocation"].pop("lng", None)
        d["currentDonationLocation"].pop("address", None)
    return d


def toggle_availability(user_id: str, is_available: bool):
    db = get_db()
    now = datetime.now(timezone.utc)
    avail = bool(is_available)
    res = db.donors.update_one(
        {"userId": str(user_id)},
        {"$set": {"availability": avail, "updatedAt": now}}
    )
    if res.matched_count == 0 and ObjectId.is_valid(user_id):
        db.donors.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"availability": avail, "updatedAt": now}}
        )
        updated = get_donor_by_id(user_id)
    else:
        updated = get_donor_by_user_id(user_id)

    if updated:
        emit_realtime_event(
            "donor_availability_changed",
            {
                "donorId": updated.get("id"),
                "userId": updated.get("userId"),
                "name": updated.get("name"),
                "bloodGroup": updated.get("bloodGroup"),
                "availability": avail,
                "updatedAt": now.isoformat(),
            },
            target_roles=["HOSPITAL", "ADMIN"],
            target_users=[updated.get("userId")],
        )
    return updated


def set_location_sharing(
    user_id: str,
    enabled: bool,
    consent: bool = None,
    lat: float = None,
    lng: float = None,
):
    """Enables or revokes live GPS location sharing with explicit donor consent."""
    db = get_db()
    donor = db.donors.find_one({"userId": str(user_id)})
    if not donor:
        return None, "Donor profile not found.", 404

    now = datetime.now(timezone.utc)
    if not enabled:
        db.donors.update_one(
            {"_id": donor["_id"]},
            {
                "$set": {
                    "locationSharingEnabled": False,
                    "locationConsent": False,
                    "shareLocationForMatching": False,
                    "updatedAt": now,
                },
                "$unset": {
                    "location": "",
                    "lat": "",
                    "lng": "",
                    "locationExpiresAt": "",
                    "currentDonationLocation.lat": "",
                    "currentDonationLocation.lng": "",
                },
            },
        )
        updated = get_donor_by_user_id(user_id)
        emit_realtime_event(
            "donor_location_stopped",
            {
                "donorId": str(donor["_id"]),
                "userId": str(user_id),
                "locationSharingEnabled": False,
                "updatedAt": now.isoformat(),
            },
            target_roles=["HOSPITAL", "ADMIN"],
            target_users=[str(user_id)],
        )
        return updated, None, 200

    # Explicit consent guard
    if consent is False:
        return None, "Explicit consent is required to start live GPS location sharing.", 400

    update_set = {
        "locationSharingEnabled": True,
        "locationConsent": True,
        "locationConsentAt": now,
        "shareLocationForMatching": True,
        "updatedAt": now,
    }
    if lat is not None and lng is not None:
        lat_f, lng_f, err = validate_gps_coordinates(lat, lng)
        if err:
            return None, err, 400
        update_set.update({
            "lat": lat_f,
            "lng": lng_f,
            "location": make_geojson_point(lat_f, lng_f),
            "lastLocationUpdatedAt": now,
            "locationExpiresAt": now + timedelta(minutes=Config.LOCATION_STALE_MINUTES),
            "matchingLocationPreference": "CURRENT",
            "currentDonationLocation": {
                **(donor.get("currentDonationLocation") or {}),
                "city": (donor.get("currentDonationLocation") or {}).get("city") or donor.get("city", ""),
                "state": (donor.get("currentDonationLocation") or {}).get("state") or donor.get("state", ""),
                "lat": lat_f,
                "lng": lng_f,
                "updatedAt": now.isoformat(),
            },
        })

    db.donors.update_one({"_id": donor["_id"]}, {"$set": update_set})
    updated = get_donor_by_user_id(user_id)

    if lat is not None and lng is not None:
        alat, alng = get_approximate_coords(lat_f, lng_f)
        emit_realtime_event(
            "donor_location_updated",
            {
                "donorId": str(donor["_id"]),
                "userId": str(user_id),
                "name": donor.get("name"),
                "bloodGroup": donor.get("bloodGroup"),
                "availability": donor.get("availability", True),
                "verificationStatus": donor.get("verificationStatus", "VERIFIED"),
                "locationSharingEnabled": True,
                "approxLat": alat,
                "approxLng": alng,
                "city": donor.get("city", ""),
                "state": donor.get("state", ""),
                "lastLocationUpdatedAt": now.isoformat(),
            },
            target_roles=["HOSPITAL", "ADMIN"],
        )

    return updated, None, 200


def update_donor_live_location(
    user_id: str,
    lat: float,
    lng: float,
    accuracy: float = None,
    consent: bool = None,
):
    """Validates, rate-limits, and persists live GPS coordinates as GeoJSON Point."""
    db = get_db()
    donor = db.donors.find_one({"userId": str(user_id)})
    if not donor:
        return None, "Donor profile not found.", 404

    if consent is False or (not donor.get("locationSharingEnabled") and consent is not True):
        return None, "Live location sharing is disabled. Please enable sharing consent first.", 403

    lat_f, lng_f, err = validate_gps_coordinates(lat, lng)
    if err:
        return None, err, 400

    # Rate limiting (sliding window per donor)
    now_ts = time.monotonic()
    window = max(1, Config.LOCATION_RATE_LIMIT_WINDOW_SEC)
    max_updates = max(1, Config.LOCATION_RATE_LIMIT_MAX_UPDATES)
    recent = [t for t in _location_update_timestamps[str(user_id)] if (now_ts - t) <= window]
    if len(recent) >= max_updates:
        _location_update_timestamps[str(user_id)] = recent
        return None, "Too many location updates. Please wait a few seconds before sending the next GPS fix.", 429
    recent.append(now_ts)
    _location_update_timestamps[str(user_id)] = recent

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=Config.LOCATION_STALE_MINUTES)
    cur_loc = dict(donor.get("currentDonationLocation") or {})
    cur_loc.update({
        "city": cur_loc.get("city") or donor.get("city", ""),
        "state": cur_loc.get("state") or donor.get("state", ""),
        "lat": lat_f,
        "lng": lng_f,
        "updatedAt": now.isoformat(),
    })

    update_fields = {
        "lat": lat_f,
        "lng": lng_f,
        "location": make_geojson_point(lat_f, lng_f),
        "locationSharingEnabled": True,
        "locationConsent": True,
        "shareLocationForMatching": True,
        "lastLocationUpdatedAt": now,
        "locationExpiresAt": expires_at,
        "matchingLocationPreference": "CURRENT",
        "currentDonationLocation": cur_loc,
        "updatedAt": now,
    }
    if accuracy is not None:
        update_fields["locationAccuracyMeters"] = float(accuracy)

    db.donors.update_one({"_id": donor["_id"]}, {"$set": update_fields})
    updated = get_donor_by_user_id(user_id)

    alat, alng = get_approximate_coords(lat_f, lng_f)
    emit_realtime_event(
        "donor_location_updated",
        {
            "donorId": str(donor["_id"]),
            "userId": str(user_id),
            "name": donor.get("name"),
            "bloodGroup": donor.get("bloodGroup"),
            "availability": donor.get("availability", True),
            "verificationStatus": donor.get("verificationStatus", "VERIFIED"),
            "locationSharingEnabled": True,
            "approxLat": alat,
            "approxLng": alng,
            "city": donor.get("city", ""),
            "state": donor.get("state", ""),
            "lastLocationUpdatedAt": now.isoformat(),
            "locationExpiresAt": expires_at.isoformat(),
        },
        target_roles=["HOSPITAL", "ADMIN"],
    )

    return updated, None, 200


def get_donor_invitations(user_id: str):
    """
    Returns targeted emergency invitations + compatible nearby open requests for a donor,
    computing approximate distance and omitting unnecessary patient private info.
    """
    db = get_db()
    expire_stale_donor_locations(db)
    donor = db.donors.find_one({"userId": str(user_id)})
    if not donor:
        return None, "Donor profile not found."

    donor_id_str = str(donor["_id"])
    donor_lat = donor.get("lat")
    donor_lng = donor.get("lng")
    if (donor_lat is None or donor_lng is None) and isinstance(donor.get("location"), dict):
        coords = donor["location"].get("coordinates") or []
        if len(coords) == 2:
            donor_lng, donor_lat = coords[0], coords[1]

    invitations = list(
        db.request_invitations.find({"donorId": donor_id_str}).sort("createdAt", -1).limit(50)
    )
    inv_by_req = {str(inv["requestId"]): inv for inv in invitations}

    from services.blood_compatibility import get_compatible_recipient_groups
    compatible_recipient_bgs = get_compatible_recipient_groups(donor.get("bloodGroup", ""))

    active_req_ids = []
    for rid in inv_by_req:
        if ObjectId.is_valid(rid):
            active_req_ids.append(ObjectId(rid))

    open_requests = list(
        db.blood_requests.find({
            "$or": [
                {"_id": {"$in": active_req_ids}},
                {
                    "status": {"$in": ["OPEN", "PENDING", "MATCHED", "DONOR_CONTACTED", "DONOR_RESPONDED"]},
                    "bloodGroup": {"$in": compatible_recipient_bgs},
                },
            ]
        }).sort("createdAt", -1).limit(30)
    )

    items = []
    for req in open_requests:
        rid = str(req["_id"])
        inv = inv_by_req.get(rid)
        req_lat = req.get("lat") or req.get("latitude")
        req_lng = req.get("lng") or req.get("longitude")
        dist_km = haversine_distance_km(donor_lat, donor_lng, req_lat, req_lng)
        if dist_km is None and inv and inv.get("distanceKm") is not None:
            dist_km = inv.get("distanceKm")

        items.append({
            "requestId": rid,
            "hospitalName": req.get("hospitalName", "Verified Hospital"),
            "hospitalAddress": req.get("hospitalAddress", ""),
            "city": req.get("city", ""),
            "state": req.get("state", ""),
            "contactNumber": req.get("contactNumber", ""),
            "bloodGroup": req.get("bloodGroup"),
            "unitsRequired": req.get("unitsRequired", 1),
            "urgency": req.get("urgency", "NORMAL"),
            "requiredDate": req.get("requiredDate", ""),
            "status": req.get("status", "OPEN"),
            "additionalMessage": req.get("additionalMessage", ""),
            "approximateDistanceKm": dist_km,
            "isInvited": inv is not None,
            "invitationStatus": inv.get("status") if inv else "COMPATIBLE",
            "invitedAt": inv.get("createdAt").isoformat() if (inv and isinstance(inv.get("createdAt"), datetime)) else None,
            "createdAt": req.get("createdAt").isoformat() if isinstance(req.get("createdAt"), datetime) else req.get("createdAt"),
        })

    urgency_weight = {"EMERGENCY": 4, "HIGH": 3, "NORMAL": 2, "LOW": 1}
    items.sort(
        key=lambda x: (
            not x["isInvited"],
            -urgency_weight.get(x["urgency"], 0),
            x["approximateDistanceKm"] is None,
            x["approximateDistanceKm"] if x["approximateDistanceKm"] is not None else 99999,
        )
    )
    return {
        "locationSharingEnabled": bool(donor.get("locationSharingEnabled") and is_donor_location_fresh(donor)),
        "invitations": items,
    }, None

def search_donors(filters: dict, is_admin: bool = False):
    """
    Search donors using MongoDB queries (efficient indexed filter)
    Protects private contact information for non-admin requests
    """
    db = get_db()
    query = {}
    
    blood_group = filters.get("bloodGroup")
    if blood_group and blood_group.strip():
        query["bloodGroup"] = blood_group.strip().upper()
        
    state = filters.get("state")
    if state and state.strip():
        query["state"] = {"$regex": f"^{state.strip()}$", "$options": "i"}

    city = filters.get("city")
    if city and city.strip():
        query["city"] = {"$regex": f"^{city.strip()}$", "$options": "i"}
        
    availability = filters.get("availability")
    if availability is not None and availability != "":
        if isinstance(availability, str):
            query["availability"] = availability.lower() in ("true", "1", "yes")
        else:
            query["availability"] = bool(availability)
            
    verified_status = filters.get("verificationStatus")
    if verified_status and verified_status.strip():
        query["verificationStatus"] = verified_status.strip().upper()

    search = filters.get("search")
    if search and search.strip():
        search_rgx = {"$regex": search.strip(), "$options": "i"}
        query["$or"] = [
            {"name": search_rgx},
            {"city": search_rgx},
            {"state": search_rgx}
        ]

    donors = list(db.donors.find(query).sort("createdAt", -1).limit(100))
    serialized = serialize_doc(donors)

    # Privacy Protection: If not administrator, mask personal contact information and exact coordinates
    if not is_admin:
        serialized = [sanitize_public_donor(d) for d in serialized]

    return serialized

def contact_donor(requester_user: dict, donor_id: str, message_data: dict):
    db = get_db()
    donor = None
    if ObjectId.is_valid(donor_id):
        donor = db.donors.find_one({"_id": ObjectId(donor_id)})
    if not donor:
        donor = db.donors.find_one({"userId": str(donor_id)})
    if not donor:
        return None, "Donor not found."

    patient_name = message_data.get("patientName", "Patient").strip()
    hospital_name = message_data.get("hospitalName", "Hospital").strip()
    blood_group = message_data.get("bloodGroup", donor.get("bloodGroup", "Blood")).strip()
    city = message_data.get("city", donor.get("city", "")).strip()
    urgency = message_data.get("urgency", "NORMAL").strip().upper()
    contact_phone = message_data.get("contactPhone") or requester_user.get("phone", "")

    create_notification(
        recipient_id=donor.get("userId"),
        recipient_email=donor.get("email"),
        title=f"{'🚨 URGENT: ' if urgency == 'EMERGENCY' else 'Blood Donation Request: '}{blood_group} Needed",
        message=f"{requester_user.get('name')} has contacted you for {blood_group} blood for patient {patient_name} at {hospital_name}, {city}. Contact: {contact_phone}.",
        notif_type="EMERGENCY" if urgency == "EMERGENCY" else "REQUEST",
        related_id=str(donor["_id"])
    )

    return {"message": f"Direct contact notification sent to donor {donor.get('name')}."}, None

def get_donor_dashboard_stats(user_id: str):
    db = get_db()
    expire_stale_donor_locations(db)
    donor = db.donors.find_one({"userId": str(user_id)})
    if not donor:
        try:
            donor = db.donors.find_one({"_id": ObjectId(user_id)})
        except Exception:
            pass
    if not donor:
        return None
    
    # Calculate eligibility (>= 90 days since last donation)
    is_eligible = True
    days_until_eligible = 0
    last_donation = donor.get("lastDonationDate")
    if last_donation:
        try:
            if isinstance(last_donation, str):
                last_dt = datetime.fromisoformat(last_donation.replace('Z', '+00:00'))
            else:
                last_dt = last_donation
            if last_dt.tzinfo is None:
                last_dt = last_dt.replace(tzinfo=timezone.utc)
            days_since = (datetime.now(timezone.utc) - last_dt).days
            if days_since < 90:
                is_eligible = False
                days_until_eligible = 90 - days_since
        except Exception:
            pass

    # Find relevant open requests for donor's blood group and location
    from services.matching_service import DONOR_CAN_DONATE_TO
    compatible_recipient_groups = DONOR_CAN_DONATE_TO.get(donor.get("bloodGroup", "O+"), [])

    nearby_requests = list(db.blood_requests.find({
        "status": {"$in": ["OPEN", "PENDING", "MATCHED", "DONOR_CONTACTED", "DONOR_RESPONDED"]},
        "bloodGroup": {"$in": compatible_recipient_groups}
    }).sort("createdAt", -1).limit(12))

    donor_lat = donor.get("lat")
    donor_lng = donor.get("lng")
    serialized_nearby = serialize_doc(nearby_requests)
    for nr in serialized_nearby:
        rlat = nr.get("lat") or nr.get("latitude")
        rlng = nr.get("lng") or nr.get("longitude")
        nr["approximateDistanceKm"] = haversine_distance_km(donor_lat, donor_lng, rlat, rlng)

    inv_data, _ = get_donor_invitations(user_id)

    # Total completed donations
    completed_donations = db.donations.count_documents({
        "donorId": str(donor["_id"]),
        "status": "COMPLETED"
    })

    # Active Accepted Requests & Screenings for this donor
    active_requests = list(db.blood_requests.find({
        "acceptedDonorId": str(donor["_id"]),
        "status": {"$in": ["ACCEPTED", "SCREENING_SUBMITTED", "SCHEDULED"]}
    }).sort("updatedAt", -1))

    # Attach screening status to each active request
    serialized_active = serialize_doc(active_requests)
    for r in serialized_active:
        scr = db.health_screenings.find_one({"requestId": r["id"], "donorId": str(donor["_id"])})
        if scr:
            r["screening"] = serialize_doc(scr)
            r["hasScreening"] = True
            r["screeningStatus"] = scr.get("status", "AWAITING_REVIEW")
        else:
            r["hasScreening"] = False
            r["screeningStatus"] = "NOT_SUBMITTED"

    donor_serialized = serialize_doc(donor)
    donor_serialized["locationSharingEnabled"] = bool(is_donor_location_fresh(donor))

    return {
        "donor": donor_serialized,
        "isEligible": is_eligible,
        "daysUntilEligible": days_until_eligible,
        "totalDonations": completed_donations or donor.get("totalDonations", 0),
        "nearbyRequests": serialized_nearby,
        "invitations": (inv_data or {}).get("invitations", []),
        "activeAcceptedRequests": serialized_active
    }

def respond_to_request(donor_user_id: str, request_id: str, action: str, note: str = ""):
    """Donor accepts or rejects/declines a blood request or emergency invitation"""
    db = get_db()
    
    # 1. Look up donor by userId first, then fallback to donor _id
    donor = db.donors.find_one({"userId": str(donor_user_id)})
    if not donor:
        try:
            donor = db.donors.find_one({"_id": ObjectId(donor_user_id)})
        except Exception:
            pass
    if not donor:
        return None, "Donor profile not found."
    
    # 2. Look up blood request
    try:
        req = db.blood_requests.find_one({"_id": ObjectId(request_id)})
    except Exception:
        req = None
    if not req:
        return None, "Blood request not found."
    
    action_clean = (action or "").strip().upper()
    now = datetime.now(timezone.utc)
    donor_id_str = str(donor["_id"])
    donor_uid_str = str(donor.get("userId", ""))

    if action_clean in ["ACCEPT", "ACCEPTED"]:
        # Record invitation acceptance in request_invitations
        db.request_invitations.update_one(
            {"requestId": str(request_id), "donorId": donor_id_str},
            {
                "$set": {
                    "donorUserId": donor_uid_str,
                    "donorName": donor.get("name", "Donor"),
                    "bloodGroup": donor.get("bloodGroup", ""),
                    "hospitalId": str(req.get("requesterId", "")),
                    "status": "ACCEPTED",
                    "respondedAt": now,
                    "responseNote": (note or "").strip(),
                    "updatedAt": now,
                },
                "$setOnInsert": {"createdAt": now},
            },
            upsert=True,
        )

        # Update request status to ACCEPTED
        db.blood_requests.update_one(
            {"_id": ObjectId(request_id)},
            {
                "$set": {
                    "status": "ACCEPTED",
                    "acceptedDonorId": donor_id_str,
                    "acceptedDonorUserId": donor_uid_str,
                    "acceptedDonorName": donor.get("name", "Donor"),
                    "acceptedDonorPhone": donor.get("phone", ""),
                    "screeningStatus": "NOT_SUBMITTED",
                    "updatedAt": now
                }
            }
        )

        # Notify requester
        if req.get("requesterId"):
            try:
                create_notification(
                    recipient_id=req["requesterId"],
                    recipient_email=req.get("requesterEmail", ""),
                    title="Donor Accepted Your Request!",
                    message=f"Good news! Donor {donor.get('name', 'A donor')} ({donor.get('bloodGroup', '')}) has accepted your blood request for patient {req.get('patientName', '')}.",
                    notif_type="ACCEPTED",
                    related_id=str(request_id)
                )
            except Exception as e:
                print(f"[respond_to_request] Requester notification notice: {e}")

        try:
            send_donation_status_email(
                to_email=req.get("requesterEmail"),
                recipient_name=req.get("requesterName", "Requester"),
                status="ACCEPTED",
                details=f"Donor {donor.get('name', 'A donor')} has accepted the blood request for patient {req.get('patientName', '')}."
            )
        except Exception as e:
            print(f"[respond_to_request] Status email notice: {e}")

        emit_realtime_event(
            "donor_responded",
            {
                "requestId": str(request_id),
                "donorId": donor_id_str,
                "donorUserId": donor_uid_str,
                "donorName": donor.get("name", "Donor"),
                "bloodGroup": donor.get("bloodGroup", ""),
                "action": "ACCEPTED",
                "requestStatus": "ACCEPTED",
                "respondedAt": now.isoformat(),
            },
            target_users=[req.get("requesterId"), donor_uid_str],
            target_roles=["ADMIN"],
        )
        emit_realtime_event(
            "request_status_updated",
            {
                "requestId": str(request_id),
                "status": "ACCEPTED",
                "acceptedDonorName": donor.get("name", "Donor"),
                "updatedAt": now.isoformat(),
            },
            target_users=[req.get("requesterId"), donor_uid_str],
            target_roles=["ADMIN"],
        )

        return {
            "message": "Request accepted successfully. Please proceed to Donation Screening.",
            "requestId": str(request_id),
            "status": "ACCEPTED",
            "screeningRequired": True
        }, None

    elif action_clean in ["DECLINE", "DECLINED", "REJECT", "REJECTED"]:
        db.request_invitations.update_one(
            {"requestId": str(request_id), "donorId": donor_id_str},
            {
                "$set": {
                    "donorUserId": donor_uid_str,
                    "donorName": donor.get("name", "Donor"),
                    "bloodGroup": donor.get("bloodGroup", ""),
                    "hospitalId": str(req.get("requesterId", "")),
                    "status": "REJECTED",
                    "respondedAt": now,
                    "responseNote": (note or "").strip(),
                    "updatedAt": now,
                },
                "$setOnInsert": {"createdAt": now},
            },
            upsert=True,
        )

        # If this donor was previously assigned as accepted donor and now declines, revert status to PENDING
        new_req_status = req.get("status", "OPEN")
        if str(req.get("acceptedDonorId")) == donor_id_str:
            new_req_status = "PENDING"
            db.blood_requests.update_one(
                {"_id": ObjectId(request_id)},
                {
                    "$set": {
                        "status": "PENDING",
                        "screeningStatus": "NOT_SUBMITTED",
                        "updatedAt": now
                    },
                    "$unset": {
                        "acceptedDonorId": "",
                        "acceptedDonorUserId": "",
                        "acceptedDonorName": "",
                        "acceptedDonorPhone": ""
                    }
                }
            )

        # Notify requester
        if req.get("requesterId"):
            try:
                create_notification(
                    recipient_id=req["requesterId"],
                    recipient_email=req.get("requesterEmail", ""),
                    title="Donor Declined Request",
                    message=f"A prospective donor declined your blood request for {req.get('hospitalName', 'your hospital')}. Other compatible donors remain searchable.",
                    notif_type="REJECTED",
                    related_id=str(request_id)
                )
            except Exception as e:
                print(f"[respond_to_request] Requester decline notification notice: {e}")

        emit_realtime_event(
            "donor_responded",
            {
                "requestId": str(request_id),
                "donorId": donor_id_str,
                "donorUserId": donor_uid_str,
                "donorName": donor.get("name", "Donor"),
                "bloodGroup": donor.get("bloodGroup", ""),
                "action": "REJECTED",
                "requestStatus": new_req_status,
                "respondedAt": now.isoformat(),
            },
            target_users=[req.get("requesterId"), donor_uid_str],
            target_roles=["ADMIN"],
        )

        return {"message": "You have declined this request.", "requestId": str(request_id), "status": "REJECTED"}, None

    return None, "Invalid response action. Allowed: ACCEPT, DECLINE, or REJECT."


def save_donor_medical_profile(user_id: str, data: dict):
    """
    Saves or updates a complete DonorMedicalProfile for the donor.
    Tracks health declaration, weight, allergies, medications, complications.
    Synchronizes public status to the donor record.
    """
    db = get_db()
    donor = db.donors.find_one({"userId": str(user_id)})
    if not donor:
        try:
            donor = db.donors.find_one({"_id": ObjectId(user_id)})
        except Exception:
            pass
    if not donor:
        return None, "Donor record not found.", 404

    donor_id = str(donor["_id"])
    now = datetime.now(timezone.utc)
    
    existing = db.donor_medical_profiles.find_one({"donorId": donor_id})
    current_status = (existing or {}).get("medicalReviewStatus") or donor.get("medicalReviewStatus") or "PENDING"
    
    has_flagged_clinical_factors = bool(
        data.get("previousComplications")
        or data.get("medicalHistory")
        or data.get("currentMedication")
    )
    
    if current_status == "PENDING" and has_flagged_clinical_factors:
        current_status = "REQUIRES_ASSESSMENT"

    profile_doc = {
        "donorId": donor_id,
        "userId": str(user_id),
        "fullName": (data.get("fullName") or donor.get("name") or "").strip(),
        "age": data.get("age"),
        "bloodGroup": data.get("bloodGroup") or donor.get("bloodGroup") or "O+",
        "gender": data.get("gender") or donor.get("gender") or "Not Specified",
        "weight": data.get("weight"),
        "lastDonationDate": data.get("lastDonationDate") or donor.get("lastDonationDate"),
        "medicalHistory": (data.get("medicalHistory") or "").strip(),
        "currentMedication": (data.get("currentMedication") or "").strip(),
        "allergies": (data.get("allergies") or "").strip(),
        "previousComplications": (data.get("previousComplications") or "").strip(),
        "healthDeclaration": bool(data.get("healthDeclaration", False)),
        "healthDeclarationAt": now if data.get("healthDeclaration") else None,
        "medicalReviewStatus": current_status,
        "clinicalNotes": (existing or {}).get("clinicalNotes", ""),
        "reviewedBy": (existing or {}).get("reviewedBy"),
        "reviewedAt": (existing or {}).get("reviewedAt"),
        "updatedAt": now
    }

    db.donor_medical_profiles.update_one(
        {"donorId": donor_id},
        {"$set": profile_doc, "$setOnInsert": {"createdAt": now}},
        upsert=True
    )

    donor_sync = {
        "medicalReviewStatus": current_status,
        "healthDeclaration": bool(data.get("healthDeclaration", False)),
        "updatedAt": now
    }
    if data.get("fullName"):
        donor_sync["name"] = data["fullName"].strip()
    if data.get("bloodGroup"):
        donor_sync["bloodGroup"] = data["bloodGroup"]
    if data.get("lastDonationDate"):
        donor_sync["lastDonationDate"] = data["lastDonationDate"]
    if data.get("weight"):
        donor_sync["weight"] = data["weight"]
    if data.get("age"):
        donor_sync["age"] = data["age"]
        
    db.donors.update_one({"_id": donor["_id"]}, {"$set": donor_sync})

    saved = db.donor_medical_profiles.find_one({"donorId": donor_id})
    return serialize_doc(saved), None, 200


def get_donor_medical_profile(user_id: str):
    """
    Retrieves full medical profile for the authenticated donor.
    """
    db = get_db()
    donor = db.donors.find_one({"userId": str(user_id)})
    if not donor:
        try:
            donor = db.donors.find_one({"_id": ObjectId(user_id)})
        except Exception:
            pass
    if not donor:
        return None, "Donor profile not found.", 404

    donor_id = str(donor["_id"])
    prof = db.donor_medical_profiles.find_one({"donorId": donor_id})
    if not prof:
        prof = {
            "donorId": donor_id,
            "userId": str(user_id),
            "fullName": donor.get("name", ""),
            "bloodGroup": donor.get("bloodGroup", "O+"),
            "gender": donor.get("gender", "Not Specified"),
            "age": donor.get("age"),
            "weight": donor.get("weight"),
            "lastDonationDate": donor.get("lastDonationDate"),
            "medicalHistory": "",
            "currentMedication": "",
            "allergies": "",
            "previousComplications": "",
            "healthDeclaration": bool(donor.get("healthDeclaration", False)),
            "medicalReviewStatus": donor.get("medicalReviewStatus", "PENDING"),
            "clinicalNotes": "",
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        }
    return serialize_doc(prof), None, 200


def get_donor_medical_review_for_requester(donor_id: str, user: dict, request_id: str = None):
    """
    Role-based, privacy-preserving Medical Review endpoint.
    Requesters & Hospitals receive ONLY non-sensitive clearance info:
      - Donor Name & Blood Group
      - Verification Status
      - Medical Review Status ('Verified', 'Pending Verification', 'Requires Medical Assessment', 'Not Cleared')
      - Last Donation Date
      - Donation History Summary (total donations)
      - Health Declaration Status ('Declared' / 'Pending')
      - Medical Eligibility Assessment Status
      - Approximate Donor Location & Distance
    Authorized Admins receive complete profile including medications, history, and complications.
    """
    db = get_db()
    try:
        donor = db.donors.find_one({"_id": ObjectId(donor_id)})
    except Exception:
        donor = db.donors.find_one({"userId": str(donor_id)})
        
    if not donor:
        return None, "Donor not found.", 404

    d_id = str(donor["_id"])
    prof = db.donor_medical_profiles.find_one({"donorId": d_id})
    
    completed_donations = db.donations.count_documents({
        "donorId": d_id,
        "status": "COMPLETED"
    })
    
    raw_status = (prof or {}).get("medicalReviewStatus") or donor.get("medicalReviewStatus") or "PENDING"
    raw_status = raw_status.upper()
    if raw_status == "VERIFIED":
        medical_review_label = "Verified"
        assessment_status = "Cleared for Clinical Donation"
    elif raw_status == "REQUIRES_ASSESSMENT":
        medical_review_label = "Requires Medical Assessment"
        assessment_status = "Clinical Assessment Required at Centre"
    elif raw_status in ["NOT_CLEARED", "REJECTED"]:
        medical_review_label = "Not Cleared"
        assessment_status = "Deferred / Not Cleared for Transfusion"
    else:
        medical_review_label = "Pending Verification"
        assessment_status = "Pending Medical Staff Review"

    has_declaration = bool((prof or {}).get("healthDeclaration") or donor.get("healthDeclaration"))
    declaration_label = "Declared & Signed" if has_declaration else "Pending Declaration"

    dlat = donor.get("lat")
    dlng = donor.get("lng")
    alat, alng = get_approximate_coords(dlat, dlng) if (dlat is not None and dlng is not None) else (None, None)

    distance_km = None
    if request_id:
        try:
            req = db.blood_requests.find_one({"_id": ObjectId(request_id)})
            if req and req.get("lat") is not None and req.get("lng") is not None:
                distance_km = haversine_distance_km(dlat, dlng, req["lat"], req["lng"])
        except Exception:
            pass

    sanitized_review = {
        "donorId": d_id,
        "donorName": donor.get("name", "Verified Donor"),
        "bloodGroup": donor.get("bloodGroup", "Unknown"),
        "donorVerificationStatus": donor.get("verificationStatus", "VERIFIED"),
        "medicalReviewStatus": medical_review_label,
        "rawMedicalReviewStatus": raw_status,
        "lastDonationDate": donor.get("lastDonationDate"),
        "totalDonations": completed_donations or donor.get("totalDonations", 0),
        "healthDeclarationStatus": declaration_label,
        "medicalEligibilityStatus": assessment_status,
        "approximateLocation": {
            "city": donor.get("city", ""),
            "state": donor.get("state", ""),
            "approxLat": alat,
            "approxLng": alng
        },
        "distanceKm": distance_km,
        "lastLocationUpdatedAt": donor.get("lastLocationUpdatedAt").isoformat() if donor.get("lastLocationUpdatedAt") else None,
        "disclaimer": "Do not automatically declare a donor medically eligible based on a form. Final eligibility must be determined by qualified medical personnel at the donation centre."
    }

    if user.get("role") == "ADMIN":
        sanitized_review["authorizedClinicalDetails"] = {
            "age": (prof or {}).get("age") or donor.get("age"),
            "weight": (prof or {}).get("weight") or donor.get("weight"),
            "gender": (prof or {}).get("gender") or donor.get("gender"),
            "medicalHistory": (prof or {}).get("medicalHistory", ""),
            "currentMedication": (prof or {}).get("currentMedication", ""),
            "allergies": (prof or {}).get("allergies", ""),
            "previousComplications": (prof or {}).get("previousComplications", ""),
            "clinicalNotes": (prof or {}).get("clinicalNotes", ""),
            "reviewedBy": (prof or {}).get("reviewedBy"),
            "reviewedAt": (prof or {}).get("reviewedAt").isoformat() if (prof or {}).get("reviewedAt") else None
        }

    return sanitized_review, None, 200


def update_donor_medical_review_by_admin(admin_user: dict, donor_id: str, review_data: dict):
    """
    Authorized admin/medical staff verifies or flags a donor's medical profile.
    """
    db = get_db()
    if admin_user.get("role") != "ADMIN":
        return None, "Only authorized medical staff or administrators can update medical reviews.", 403

    try:
        donor = db.donors.find_one({"_id": ObjectId(donor_id)})
    except Exception:
        donor = db.donors.find_one({"userId": str(donor_id)})
    if not donor:
        return None, "Donor not found.", 404

    d_id = str(donor["_id"])
    status = (review_data.get("status") or "").strip().upper()
    notes = (review_data.get("clinicalNotes") or "").strip()
    now = datetime.now(timezone.utc)

    db.donor_medical_profiles.update_one(
        {"donorId": d_id},
        {
            "$set": {
                "medicalReviewStatus": status,
                "clinicalNotes": notes,
                "reviewedBy": admin_user.get("name", "Medical Officer"),
                "reviewedById": admin_user.get("id"),
                "reviewedAt": now,
                "updatedAt": now
            },
            "$setOnInsert": {
                "createdAt": now,
                "donorId": d_id,
                "userId": donor.get("userId", "")
            }
        },
        upsert=True
    )

    db.donors.update_one(
        {"_id": donor["_id"]},
        {"$set": {"medicalReviewStatus": status, "updatedAt": now}}
    )

    create_notification(
        recipient_id=donor.get("userId"),
        recipient_email=donor.get("email"),
        title=f"Medical Profile Status: {status.replace('_', ' ').title()}",
        message=f"Your Lifeline medical profile verification status was updated to '{status.replace('_', ' ').title()}'. {notes}".strip(),
        notif_type="SYSTEM",
        related_id=d_id
    )

    emit_realtime_event(
        "medical_review_updated",
        {
            "donorId": d_id,
            "status": status,
            "notes": notes,
            "updatedAt": now.isoformat()
        },
        target_users=[donor.get("userId")],
        target_roles=["ADMIN", "HOSPITAL"]
    )

    return {
        "message": f"Medical profile status updated to {status}.",
        "donorId": d_id,
        "status": status,
        "notes": notes
    }, None, 200
