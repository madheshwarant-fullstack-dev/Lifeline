from datetime import datetime, timezone
from bson import ObjectId
from database.connection import get_db, serialize_doc
from services.notification_service import create_notification
from services.email_service import send_donation_status_email

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

def toggle_availability(user_id: str, is_available: bool):
    db = get_db()
    now = datetime.now(timezone.utc)
    db.donors.update_one(
        {"userId": str(user_id)},
        {"$set": {"availability": bool(is_available), "updatedAt": now}}
    )
    return get_donor_by_user_id(user_id)

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
        for d in serialized:
            raw_phone = d.get("phone", "")
            if raw_phone and len(raw_phone) >= 7:
                d["phone"] = raw_phone[:6] + " •••••"
            d["isPhoneMasked"] = True
            d["address"] = f"{d.get('city', '')}, {d.get('state', '')}"
            d["emergencyContact"] = None
            d.pop("lat", None)
            d.pop("lng", None)
            if "currentDonationLocation" in d and isinstance(d["currentDonationLocation"], dict):
                d["currentDonationLocation"].pop("lat", None)
                d["currentDonationLocation"].pop("lng", None)
                d["currentDonationLocation"].pop("address", None)

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
    donor = db.donors.find_one({"userId": str(user_id)})
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
            days_since = (datetime.now(timezone.utc) - last_dt.replace(tzinfo=timezone.utc)).days
            if days_since < 90:
                is_eligible = False
                days_until_eligible = 90 - days_since
        except Exception:
            pass

    # Find relevant open requests for donor's blood group and city
    # Donor can donate if compatible
    from services.matching_service import DONOR_CAN_DONATE_TO
    compatible_recipient_groups = DONOR_CAN_DONATE_TO.get(donor.get("bloodGroup", "O+"), [])

    nearby_requests = list(db.blood_requests.find({
        "status": {"$in": ["PENDING", "MATCHED", "DONOR_CONTACTED"]},
        "bloodGroup": {"$in": compatible_recipient_groups}
    }).sort("createdAt", -1).limit(10))

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

    return {
        "donor": serialize_doc(donor),
        "isEligible": is_eligible,
        "daysUntilEligible": days_until_eligible,
        "totalDonations": completed_donations or donor.get("totalDonations", 0),
        "nearbyRequests": serialize_doc(nearby_requests),
        "activeAcceptedRequests": serialized_active
    }

def respond_to_request(donor_user_id: str, request_id: str, action: str):
    """Donor accepts or rejects/declines a blood request"""
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

    if action_clean in ["ACCEPT", "ACCEPTED"]:
        # Update request status to ACCEPTED
        db.blood_requests.update_one(
            {"_id": ObjectId(request_id)},
            {
                "$set": {
                    "status": "ACCEPTED",
                    "acceptedDonorId": str(donor["_id"]),
                    "acceptedDonorUserId": str(donor.get("userId", "")),
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

        return {
            "message": "Request accepted successfully. Please proceed to Donation Screening.",
            "requestId": str(request_id),
            "screeningRequired": True
        }, None

    elif action_clean in ["DECLINE", "DECLINED", "REJECT", "REJECTED"]:
        # If this donor was previously assigned as accepted donor and now declines, revert status to PENDING
        if str(req.get("acceptedDonorId")) == str(donor["_id"]):
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
                    message=f"A prospective donor was unavailable for your blood request for patient {req.get('patientName', '')}. Other compatible donors are still searchable.",
                    notif_type="REJECTED",
                    related_id=str(request_id)
                )
            except Exception as e:
                print(f"[respond_to_request] Requester decline notification notice: {e}")

        return {"message": "You have declined this request.", "requestId": str(request_id)}, None

    return None, "Invalid response action. Allowed: ACCEPT, DECLINE, or REJECT."
