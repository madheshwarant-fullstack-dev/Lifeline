import random
import string
from datetime import datetime, timezone
from bson import ObjectId
from database.connection import get_db, serialize_doc
from services.notification_service import create_notification
from services.email_service import send_donation_status_email

def generate_donation_id():
    suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"DON-{datetime.now().year}-{suffix}"

def record_donation(data: dict):
    db = get_db()
    now = datetime.now(timezone.utc)
    donation_id = data.get("donationId") or generate_donation_id()
    status = data.get("status", "SCHEDULED").strip().upper()

    doc = {
        "donationId": donation_id,
        "donorId": str(data.get("donorId")),
        "donorName": data.get("donorName", "Donor"),
        "donorEmail": data.get("donorEmail", ""),
        "donorPhone": data.get("donorPhone", ""),
        "bloodGroup": data.get("bloodGroup", "").strip().upper(),
        "requestId": str(data.get("requestId")) if data.get("requestId") else None,
        "patientName": data.get("patientName", ""),
        "hospitalName": data.get("hospitalName", ""),
        "hospitalAddress": data.get("hospitalAddress", ""),
        "city": data.get("city", ""),
        "state": data.get("state", ""),
        "units": int(data.get("units", 1)),
        "donationDate": data.get("donationDate") or now.isoformat(),
        "status": status,
        "notes": data.get("notes", ""),
        "createdAt": now,
        "updatedAt": now
    }

    result = db.donations.insert_one(doc)
    doc["_id"] = result.inserted_id

    # If completed, update donor stats
    if status == "COMPLETED" and data.get("donorId"):
        try:
            db.donors.update_one(
                {"_id": ObjectId(data["donorId"])},
                {
                    "$inc": {"totalDonations": 1},
                    "$set": {"lastDonationDate": doc["donationDate"], "updatedAt": now}
                }
            )
        except Exception as e:
            print(f"[DonationService] Donor update notice: {e}")

    return serialize_doc(doc)

def get_donations(filters: dict):
    db = get_db()
    query = {}

    if filters.get("donorId"):
        query["donorId"] = str(filters["donorId"])
    if filters.get("bloodGroup"):
        query["bloodGroup"] = filters["bloodGroup"].strip().upper()
    if filters.get("status"):
        query["status"] = filters["status"].strip().upper()
    if filters.get("requestId"):
        query["requestId"] = str(filters["requestId"])

    donations = list(db.donations.find(query).sort("createdAt", -1).limit(100))
    return serialize_doc(donations)

def update_donation_status(donation_db_id: str, new_status: str, notes=None):
    db = get_db()
    now = datetime.now(timezone.utc)
    status_clean = new_status.strip().upper()

    update_payload = {"status": status_clean, "updatedAt": now}
    if notes:
        update_payload["notes"] = notes

    donation = db.donations.find_one({"_id": ObjectId(donation_db_id)})
    if not donation:
        return None, "Donation record not found."

    db.donations.update_one({"_id": ObjectId(donation_db_id)}, {"$set": update_payload})

    # If transitioning to COMPLETED
    if status_clean == "COMPLETED" and donation.get("donorId"):
        try:
            db.donors.update_one(
                {"_id": ObjectId(donation["donorId"])},
                {
                    "$inc": {"totalDonations": 1},
                    "$set": {"lastDonationDate": now.isoformat(), "updatedAt": now}
                }
            )
        except Exception as e:
            print(f"[DonationService] Non-critical donor stats increment notice: {e}")

    updated = db.donations.find_one({"_id": ObjectId(donation_db_id)})
    return serialize_doc(updated), None
