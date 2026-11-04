from datetime import datetime, timezone
from bson import ObjectId
from database.connection import get_db, serialize_doc
from services.matching_service import find_matched_donors_for_request
from services.notification_service import create_notification
from services.email_service import send_emergency_request_email, send_donation_status_email

def create_blood_request(user_doc: dict, data: dict):
    db = get_db()
    now = datetime.now(timezone.utc)
    urgency = data.get("urgency", "NORMAL").strip().upper()
    role = user_doc.get("role", "REQUESTER")

    # If role is HOSPITAL, verify that the hospital has been approved by admin
    if role == "HOSPITAL":
        hospital = db.hospitals.find_one({"userId": str(user_doc["_id"])})
        if hospital and not hospital.get("isVerified", False):
            return None, "Hospital account is pending administrative verification. Verified status is required to issue official hospital blood requests."

    blood_group = data.get("bloodGroup", "").strip().upper()
    valid_bgs = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
    if blood_group not in valid_bgs:
        return None, f"Invalid blood group '{blood_group}'. Must be one of: {', '.join(valid_bgs)}."

    try:
        units = int(data.get("unitsRequired", 1))
        if units < 1 or units > 20:
            return None, "Units required must be between 1 and 20 units."
    except (ValueError, TypeError):
        return None, "Units required must be a valid positive number."

    hospital_name = data.get("hospitalName", "").strip()
    if not hospital_name:
        return None, "Hospital or clinical facility name is required."

    city = data.get("city", "").strip()
    if not city:
        return None, "City is required."

    req_doc = {
        "requesterId": str(user_doc["_id"]),
        "requesterName": user_doc["name"],
        "requesterEmail": user_doc["email"],
        "requesterPhone": user_doc.get("phone", ""),
        "patientName": data.get("patientName", "Patient In Need").strip(),
        "bloodGroup": blood_group,
        "unitsRequired": units,
        "hospitalName": hospital_name,
        "hospitalAddress": data.get("hospitalAddress", "").strip(),
        "city": city,
        "state": data.get("state", "").strip(),
        "pinCode": data.get("pinCode", "").strip(),
        "contactNumber": data.get("contactNumber", "").strip() or user_doc.get("phone", ""),
        "requiredDate": data.get("requiredDate", ""),
        "urgency": urgency,
        "lat": data.get("lat"),
        "lng": data.get("lng"),
        "additionalMessage": data.get("additionalMessage", "").strip(),
        "status": "OPEN",
        "matchedDonorIds": [],
        "acceptedDonorId": None,
        "acceptedDonorName": None,
        "acceptedDonorPhone": None,
        "createdAt": now,
        "updatedAt": now
    }

    result = db.blood_requests.insert_one(req_doc)
    req_id = result.inserted_id
    req_doc["_id"] = req_id

    # Automatic matching step
    match_data = find_matched_donors_for_request(req_doc, only_verified=False)
    matched_donors = match_data.get("matches", [])
    matched_ids = [d["id"] for d in matched_donors[:10]] # top 10

    # If donors found, update status to MATCHED and store ids
    if matched_ids:
        db.blood_requests.update_one(
            {"_id": req_id},
            {"$set": {"status": "MATCHED", "matchedDonorIds": matched_ids, "updatedAt": now}}
        )
        req_doc["status"] = "MATCHED"
        req_doc["matchedDonorIds"] = matched_ids

    # Send notifications and emails
    location_label = f"{req_doc['city']}, {req_doc['state']}" if req_doc.get("state") else req_doc["city"]
    for donor in matched_donors[:10]:
        donor_user_id = donor.get("userId")
        donor_email = donor.get("email")
        if donor_user_id:
            create_notification(
                recipient_id=donor_user_id,
                recipient_email=donor_email,
                title=f"{'🚨 EMERGENCY: ' if urgency == 'EMERGENCY' else 'New Blood Request: '}{req_doc['bloodGroup']} Needed",
                message=f"{req_doc['unitsRequired']} unit(s) of {req_doc['bloodGroup']} required for {req_doc['patientName']} at {req_doc['hospitalName']}, {location_label}.",
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
        message=f"Your request for {req_doc['unitsRequired']} units of {req_doc['bloodGroup']} for {req_doc['patientName']} is active with {len(matched_donors)} potential donors matched.",
        notif_type="SYSTEM",
        related_id=req_id
    )

    serialized = serialize_doc(req_doc)
    serialized["matchedDonors"] = matched_donors
    serialized["matchingSummary"] = {
        "totalMatches": len(matched_donors),
        "disclaimer": match_data.get("disclaimer")
    }

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
    is_owner = str(req.get("requesterId")) == str(user_doc["_id"])
    if not (is_admin or is_owner):
        return None, "Not authorized to update this blood request status."

    # Allowed status lifecycle
    allowed_statuses = [
        "PENDING_VERIFICATION", "OPEN", "MATCHED", "DONOR_RESPONDED",
        "ACCEPTED", "SCREENING_SUBMITTED", "SCHEDULED",
        "DONATION_COMPLETED", "FULFILLED", "CANCELLED", "EXPIRED"
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

    updated_req = db.blood_requests.find_one({"_id": ObjectId(request_id)})
    return serialize_doc(updated_req), None

def delete_request(request_id: str, user_doc: dict):
    db = get_db()
    req = db.blood_requests.find_one({"_id": ObjectId(request_id)})
    if not req:
        return False, "Request not found."

    is_admin = user_doc.get("role") == "ADMIN"
    is_owner = str(req.get("requesterId")) == str(user_doc["_id"])
    if not (is_admin or is_owner):
        return False, "Unauthorized to delete this request."

    db.blood_requests.delete_one({"_id": ObjectId(request_id)})
    return True, None
