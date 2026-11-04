import random
import string
from datetime import datetime, timezone
from bson import ObjectId
from database.connection import get_db, serialize_doc
from services.notification_service import create_notification
from services.email_service import send_donation_status_email

QUESTIONS_CONFIG = [
    {
        "key": "healthIssues",
        "question": "Have you experienced any health issues or illness during the last 6 months?",
        "followUpLabel": "Please describe the health issue, illness, symptoms, and duration:"
    },
    {
        "key": "medications",
        "question": "Have you taken any medication recently or are you currently taking medication?",
        "followUpLabel": "Please list medication name(s), purpose, dosage, and when you last took them:"
    },
    {
        "key": "tattooPiercing",
        "question": "Have you had a tattoo or piercing recently?",
        "followUpLabel": "Please specify the date of the tattoo or piercing and location/facility:"
    },
    {
        "key": "surgery",
        "question": "Have you undergone any recent surgery or medical procedure?",
        "followUpLabel": "Please specify the surgery/procedure, hospital, and date performed:"
    },
    {
        "key": "feverInfection",
        "question": "Are you currently experiencing fever, infection, or feeling unwell?",
        "followUpLabel": "Please describe your current symptoms, temperature, or infection details:"
    }
]

def sanitize_screening_for_public(screening: dict) -> dict:
    """Strip sensitive medical question responses for non-medical / third-party viewers"""
    if not screening:
        return None
    sanitized = dict(screening)
    if "answers" in sanitized:
        sanitized["answers"] = None
    sanitized["hasPrivateAnswers"] = True
    return sanitized

def submit_health_screening(user_doc: dict, data: dict):
    db = get_db()
    now = datetime.now(timezone.utc)
    user_id = str(user_doc["_id"] if "_id" in user_doc else user_doc["id"])

    # 1. Fetch donor profile
    donor = db.donors.find_one({"userId": user_id})
    if not donor:
        return None, "Donor profile not found for this account."

    donor_id = str(donor["_id"])

    # 2. Validate Blood Request
    request_id = data.get("requestId")
    if not request_id:
        return None, "Blood request ID is required."

    if not ObjectId.is_valid(request_id):
        return None, "Invalid blood request ID format."

    req = db.blood_requests.find_one({"_id": ObjectId(request_id)})
    if not req:
        return None, "Blood request record not found."

    # 3. Check for duplicate submission
    existing_screening = db.health_screenings.find_one({
        "requestId": str(request_id),
        "donorId": donor_id
    })
    if existing_screening:
        return serialize_doc(existing_screening), "A health screening has already been submitted for this blood request."

    # 4. Validate Declaration Checkbox
    declaration = data.get("declaration") or data.get("declarationConfirmed")
    if not declaration:
        return None, "You must confirm the accuracy declaration before submitting."

    # 5. Validate the 5 Screening Questions
    raw_answers = data.get("answers") or {}
    processed_answers = {}
    has_flagged_answers = False

    for item in QUESTIONS_CONFIG:
        k = item["key"]
        q_text = item["question"]
        q_data = raw_answers.get(k) or {}

        # Allow format { answer: "YES"|"NO", details: "..." } or direct string "YES"/"NO"
        if isinstance(q_data, str):
            ans = q_data.strip().upper()
            details = (data.get(f"{k}Details") or "").strip()
        elif isinstance(q_data, dict):
            ans = (q_data.get("answer") or "").strip().upper()
            details = (q_data.get("details") or "").strip()
        else:
            ans = ""
            details = ""

        if ans not in ["YES", "NO"]:
            return None, f"Please select 'Yes' or 'No' for question: '{q_text}'"

        if ans == "YES":
            has_flagged_answers = True
            if not details:
                return None, f"Please provide details for the 'Yes' answer to: '{q_text}'"

        processed_answers[k] = {
            "question": q_text,
            "answer": ans,
            "details": details if ans == "YES" else ""
        }

    # 6. Build Screening Document
    screening_doc = {
        "requestId": str(request_id),
        "donorId": donor_id,
        "donorUserId": user_id,
        "donorName": donor.get("name", user_doc.get("name", "Donor")),
        "donorPhone": donor.get("phone", user_doc.get("phone", "")),
        "donorEmail": donor.get("email", user_doc.get("email", "")),
        "bloodGroup": donor.get("bloodGroup", user_doc.get("bloodGroup", "")),
        "patientName": req.get("patientName", ""),
        "requestBloodGroup": req.get("bloodGroup", ""),
        "unitsRequired": req.get("unitsRequired", 1),
        "hospitalName": req.get("hospitalName", ""),
        "hospitalAddress": req.get("hospitalAddress", ""),
        "city": req.get("city", ""),
        "state": req.get("state", ""),
        "urgency": req.get("urgency", "NORMAL"),
        "contactNumber": req.get("contactNumber", ""),
        "answers": processed_answers,
        "hasFlaggedAnswers": has_flagged_answers,
        "declarationConfirmed": True,
        "declarationText": "I confirm that the information I have provided is accurate to the best of my knowledge.",
        "status": "AWAITING_REVIEW", # Displayed as "Screening Submitted – Awaiting Medical Review"
        "medicalReview": {
            "decision": "PENDING",
            "reviewedBy": None,
            "reviewedAt": None,
            "notes": "",
            "hospitalInstructions": ""
        },
        "createdAt": now,
        "updatedAt": now
    }

    insert_result = db.health_screenings.insert_one(screening_doc)
    screening_id = str(insert_result.inserted_id)
    screening_doc["_id"] = insert_result.inserted_id

    # 7. Update Blood Request Status and link screening
    db.blood_requests.update_one(
        {"_id": ObjectId(request_id)},
        {
            "$set": {
                "status": "SCREENING_SUBMITTED",
                "screeningId": screening_id,
                "screeningStatus": "AWAITING_REVIEW",
                "acceptedDonorId": donor_id,
                "acceptedDonorName": donor.get("name"),
                "acceptedDonorPhone": donor.get("phone"),
                "updatedAt": now
            }
        }
    )

    # 8. Send Notifications
    # To Donor:
    create_notification(
        recipient_id=user_id,
        recipient_email=donor.get("email"),
        title="Screening Submitted – Awaiting Medical Review",
        message=f"Your pre-donation health screening for patient {req['patientName']} at {req['hospitalName']} has been submitted. Authorized medical personnel will evaluate your responses.",
        notif_type="SCREENING",
        related_id=str(request_id)
    )

    # To Requester:
    create_notification(
        recipient_id=req["requesterId"],
        recipient_email=req.get("requesterEmail"),
        title="Donor Health Screening Submitted",
        message=f"Donor {donor.get('name')} has submitted their pre-donation health screening for {req['patientName']}. Medical staff are conducting verification.",
        notif_type="SCREENING",
        related_id=str(request_id)
    )

    # Notify Admins / Hospital Staff for Review
    admins = list(db.users.find({"role": "ADMIN"}))
    for adm in admins:
        create_notification(
            recipient_id=str(adm["_id"]),
            recipient_email=adm.get("email"),
            title="Action Required: Health Screening Review",
            message=f"Donor {donor.get('name')} submitted health screening for {req['patientName']} ({req['hospitalName']}). {'⚠️ Attention: Disclosures provided.' if has_flagged_answers else 'Standard responses submitted.'}",
            notif_type="MEDICAL_REVIEW",
            related_id=screening_id
        )

    return serialize_doc(screening_doc), None

def get_screening_by_request(user_doc: dict, request_id: str):
    db = get_db()
    user_id = str(user_doc["_id"] if "_id" in user_doc else user_doc["id"])
    role = user_doc.get("role", "").upper()

    screening = db.health_screenings.find_one({"requestId": str(request_id)})
    if not screening:
        return None, "No screening found for this request."

    serialized = serialize_doc(screening)

    # Privacy Protection
    is_owner_donor = str(serialized.get("donorUserId")) == user_id
    is_medical_staff = role in ["ADMIN", "HOSPITAL"]

    if is_owner_donor or is_medical_staff:
        return serialized, None

    # Requester or public view: return sanitized view without sensitive answers
    return sanitize_screening_for_public(serialized), None

def get_screening_by_id(user_doc: dict, screening_id: str):
    db = get_db()
    user_id = str(user_doc["_id"] if "_id" in user_doc else user_doc["id"])
    role = user_doc.get("role", "").upper()

    if not ObjectId.is_valid(screening_id):
        return None, "Invalid screening ID format."

    screening = db.health_screenings.find_one({"_id": ObjectId(screening_id)})
    if not screening:
        return None, "Screening record not found."

    serialized = serialize_doc(screening)

    is_owner_donor = str(serialized.get("donorUserId")) == user_id
    is_medical_staff = role in ["ADMIN", "HOSPITAL"]

    if is_owner_donor or is_medical_staff:
        return serialized, None

    return sanitize_screening_for_public(serialized), None

def list_health_screenings(user_doc: dict, filters: dict):
    db = get_db()
    user_id = str(user_doc["_id"] if "_id" in user_doc else user_doc["id"])
    role = user_doc.get("role", "").upper()

    query = {}

    if role == "DONOR":
        query["donorUserId"] = user_id
    elif role in ["ADMIN", "HOSPITAL"]:
        # Filters allowed for staff
        status = filters.get("status")
        if status and status.strip():
            query["status"] = status.strip().upper()
        if filters.get("donorId"):
            query["donorId"] = str(filters["donorId"])
        if filters.get("requestId"):
            query["requestId"] = str(filters["requestId"])
    else:
        return [], "Unauthorized to view screening logs."

    screenings = list(db.health_screenings.find(query).sort("createdAt", -1).limit(100))
    serialized = serialize_doc(screenings)

    # If non-medical staff requested list, sanitize answers
    if role not in ["ADMIN", "HOSPITAL"]:
        for s in serialized:
            if str(s.get("donorUserId")) != user_id:
                s["answers"] = None

    return serialized, None

def review_health_screening(user_doc: dict, screening_id: str, review_data: dict):
    """
    Authorized medical staff (ADMIN, HOSPITAL) reviews the donor's screening responses
    and records the final eligibility decision.
    """
    db = get_db()
    now = datetime.now(timezone.utc)
    reviewer_name = user_doc.get("name", "Authorized Medical Officer")

    if not ObjectId.is_valid(screening_id):
        return None, "Invalid screening ID format."

    screening = db.health_screenings.find_one({"_id": ObjectId(screening_id)})
    if not screening:
        return None, "Screening record not found."

    decision = (review_data.get("decision") or "").strip().upper()
    if decision not in ["APPROVED", "DEFERRED"]:
        return None, "Decision must be 'APPROVED' or 'DEFERRED'."

    notes = (review_data.get("notes") or "").strip()
    if not notes:
        return None, "Clinical notes or reviewer remarks are required."

    hospital_instructions = (review_data.get("hospitalInstructions") or "").strip()
    if decision == "APPROVED" and not hospital_instructions:
        hospital_instructions = "Please proceed to the hospital blood transfusion desk with government ID and donor registration card."

    medical_review_obj = {
        "decision": decision,
        "reviewedBy": reviewer_name,
        "reviewedAt": now,
        "notes": notes,
        "hospitalInstructions": hospital_instructions
    }

    new_screening_status = decision # "APPROVED" or "DEFERRED"

    # Update screening document
    db.health_screenings.update_one(
        {"_id": ObjectId(screening_id)},
        {
            "$set": {
                "status": new_screening_status,
                "medicalReview": medical_review_obj,
                "updatedAt": now
            }
        }
    )

    request_id = screening.get("requestId")
    req = None
    if request_id and ObjectId.is_valid(request_id):
        req = db.blood_requests.find_one({"_id": ObjectId(request_id)})

    if req:
        if decision == "APPROVED":
            # Advance to SCHEDULED / Hospital Coordination
            db.blood_requests.update_one(
                {"_id": ObjectId(request_id)},
                {
                    "$set": {
                        "status": "SCHEDULED",
                        "screeningStatus": "APPROVED",
                        "hospitalCoordination": {
                            "status": "READY_FOR_DONATION",
                            "instructions": hospital_instructions,
                            "clinicalNotes": notes,
                            "clearedAt": now.isoformat()
                        },
                        "updatedAt": now
                    }
                }
            )

            # Notifications
            create_notification(
                recipient_id=screening["donorUserId"],
                recipient_email=screening.get("donorEmail"),
                title="Medical Clearance Approved! Proceed to Hospital",
                message=f"You have been medically cleared by {reviewer_name} for blood donation for patient {screening['patientName']}. Hospital instructions: {hospital_instructions}",
                notif_type="ACCEPTED",
                related_id=request_id
            )

            create_notification(
                recipient_id=req["requesterId"],
                recipient_email=req.get("requesterEmail"),
                title="Donor Cleared for Donation",
                message=f"Great news! Donor {screening['donorName']} has been medically approved and scheduled for donation at {screening['hospitalName']}.",
                notif_type="SCHEDULED",
                related_id=request_id
            )

        elif decision == "DEFERRED":
            # Defer donor; reopen request for other compatible donors
            db.blood_requests.update_one(
                {"_id": ObjectId(request_id)},
                {
                    "$set": {
                        "status": "MATCHED",
                        "screeningStatus": "DEFERRED",
                        "acceptedDonorId": None,
                        "acceptedDonorName": None,
                        "acceptedDonorPhone": None,
                        "updatedAt": now
                    }
                }
            )

            create_notification(
                recipient_id=screening["donorUserId"],
                recipient_email=screening.get("donorEmail"),
                title="Medical Screening Review Update",
                message=f"Thank you for your willingness to donate. Clinical review completed with notes: {notes}",
                notif_type="REJECTED",
                related_id=request_id
            )

            create_notification(
                recipient_id=req["requesterId"],
                recipient_email=req.get("requesterEmail"),
                title="Blood Request Update",
                message=f"Prospective donor was deferred following medical assessment. Lifeline is continuing to coordinate with other compatible donors.",
                notif_type="REQUEST",
                related_id=request_id
            )

    updated_screening = db.health_screenings.find_one({"_id": ObjectId(screening_id)})
    return serialize_doc(updated_screening), None

def confirm_donation_from_screening(user_doc: dict, screening_id: str, donation_data: dict):
    """
    Final step: Hospital staff or Admin completes the physical donation verification,
    generating a verified donation record and concluding the transfusion workflow.
    """
    db = get_db()
    now = datetime.now(timezone.utc)

    if not ObjectId.is_valid(screening_id):
        return None, "Invalid screening ID format."

    screening = db.health_screenings.find_one({"_id": ObjectId(screening_id)})
    if not screening:
        return None, "Screening record not found."

    request_id = screening.get("requestId")
    req = None
    if request_id and ObjectId.is_valid(request_id):
        req = db.blood_requests.find_one({"_id": ObjectId(request_id)})

    # Generate donation record
    from services.donation_service import record_donation
    units = int(donation_data.get("units") or (req.get("unitsRequired", 1) if req else 1))
    notes = donation_data.get("notes") or f"Donation confirmed and verified at {screening.get('hospitalName')}."

    don_record = record_donation({
        "donorId": screening.get("donorId"),
        "donorName": screening.get("donorName"),
        "donorEmail": screening.get("donorEmail"),
        "donorPhone": screening.get("donorPhone"),
        "bloodGroup": screening.get("bloodGroup"),
        "requestId": request_id,
        "patientName": screening.get("patientName"),
        "hospitalName": screening.get("hospitalName"),
        "hospitalAddress": screening.get("hospitalAddress"),
        "city": screening.get("city"),
        "state": screening.get("state"),
        "units": units,
        "donationDate": now.isoformat(),
        "status": "COMPLETED",
        "notes": notes
    })

    # Update request to DONATION_COMPLETED
    if req:
        db.blood_requests.update_one(
            {"_id": ObjectId(request_id)},
            {
                "$set": {
                    "status": "DONATION_COMPLETED",
                    "completedDonationId": don_record.get("id"),
                    "updatedAt": now
                }
            }
        )

        # Notify requester
        create_notification(
            recipient_id=req["requesterId"],
            recipient_email=req.get("requesterEmail"),
            title="Blood Donation Completed!",
            message=f"Blood donation for {screening['patientName']} has been successfully completed at {screening['hospitalName']}.",
            notif_type="SYSTEM",
            related_id=request_id
        )

    # Notify donor
    create_notification(
        recipient_id=screening["donorUserId"],
        recipient_email=screening.get("donorEmail"),
        title="Donation Completed! Thank you for saving a life.",
        message=f"Your blood donation ({screening['bloodGroup']}) at {screening['hospitalName']} has been recorded. Donation ID: {don_record.get('donationId')}.",
        notif_type="SYSTEM",
        related_id=don_record.get("id")
    )

    return {
        "donation": don_record,
        "message": "Donation successfully confirmed and logged in platform registry."
    }, None
