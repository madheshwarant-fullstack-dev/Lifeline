from flask import Blueprint, request
from bson import ObjectId
from datetime import datetime, timezone
from middleware.auth_middleware import role_required
from database.connection import get_db, serialize_doc
from utils.response import success_response, error_response
from services.email_service import send_donor_verified_email

admin_bp = Blueprint('admin_bp', __name__)

@admin_bp.route('/dashboard', methods=['GET'])
@role_required('ADMIN')
def get_admin_dashboard():
    db = get_db()

    total_users = db.users.count_documents({})
    total_donors = db.donors.count_documents({})
    available_donors = db.donors.count_documents({"availability": True})
    total_requests = db.blood_requests.count_documents({})
    emergency_requests = db.blood_requests.count_documents({"urgency": "EMERGENCY"})
    completed_donations = db.donations.count_documents({"status": "COMPLETED"})
    total_hospitals = db.hospitals.count_documents({})

    # Blood Group Distribution in Donors
    bg_pipeline = [
        {"$group": {"_id": "$bloodGroup", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    bg_dist = list(db.donors.aggregate(bg_pipeline))
    blood_group_counts = {item["_id"] or "Unknown": item["count"] for item in bg_dist}

    # Emergency vs Normal Requests
    urgency_pipeline = [
        {"$group": {"_id": "$urgency", "count": {"$sum": 1}}}
    ]
    urgency_dist = list(db.blood_requests.aggregate(urgency_pipeline))
    urgency_counts = {item["_id"]: item["count"] for item in urgency_dist}

    # Active Donors by City
    city_pipeline = [
        {"$group": {"_id": "$city", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 6}
    ]
    city_dist = list(db.donors.aggregate(city_pipeline))
    city_counts = {item["_id"] or "Other": item["count"] for item in city_dist}

    # Active Donors by State
    state_pipeline = [
        {"$group": {"_id": "$state", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 6}
    ]
    state_dist = list(db.donors.aggregate(state_pipeline))
    state_counts = {item["_id"] or "Other": item["count"] for item in state_dist}

    # Recent Emergency Requests
    recent_emergency = list(db.blood_requests.find(
        {"urgency": "EMERGENCY"}
    ).sort("createdAt", -1).limit(5))

    # Recent Registrations
    recent_users = list(db.users.find({}, {"password": 0}).sort("createdAt", -1).limit(5))

    return success_response({
        "stats": {
            "totalUsers": total_users,
            "totalDonors": total_donors,
            "availableDonors": available_donors,
            "totalRequests": total_requests,
            "emergencyRequests": emergency_requests,
            "completedDonations": completed_donations,
            "totalHospitals": total_hospitals
        },
        "charts": {
            "bloodGroupDistribution": blood_group_counts,
            "urgencyDistribution": urgency_counts,
            "cityDistribution": city_counts,
            "stateDistribution": state_counts
        },
        "recentEmergency": serialize_doc(recent_emergency),
        "recentUsers": serialize_doc(recent_users)
    }, "Admin dashboard summary loaded.")

@admin_bp.route('/users', methods=['GET'])
@role_required('ADMIN')
def get_users_list():
    db = get_db()
    query = {}
    
    role = request.args.get('role')
    if role:
        query['role'] = role.strip().upper()
        
    blood_group = request.args.get('bloodGroup')
    if blood_group:
        query['bloodGroup'] = blood_group.strip().upper()
        
    search = request.args.get('search')
    if search:
        search_rgx = {"$regex": search.strip(), "$options": "i"}
        query['$or'] = [
            {"name": search_rgx},
            {"email": search_rgx},
            {"city": search_rgx},
            {"state": search_rgx},
            {"phone": search_rgx}
        ]

    users = list(db.users.find(query, {"password": 0}).sort("createdAt", -1).limit(100))
    serialized_users = serialize_doc(users)
    for u in serialized_users:
        if u.get("role") == "HOSPITAL":
            hosp = db.hospitals.find_one({"userId": str(u["id"])})
            u["isVerified"] = hosp.get("isVerified", False) if hosp else False
            if hosp and hosp.get("registrationNumber"):
                u["registrationNumber"] = hosp.get("registrationNumber")

    return success_response(serialized_users, f"Found {len(serialized_users)} users.")

@admin_bp.route('/users/<user_id>/status', methods=['PUT'])
@role_required('ADMIN')
def toggle_user_status(user_id):
    db = get_db()
    data = request.get_json() or {}
    new_status = data.get('status', 'ACTIVE').strip().upper()
    
    if new_status not in ['ACTIVE', 'BLOCKED']:
        return error_response("Status must be ACTIVE or BLOCKED", 400)
        
    res = db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"status": new_status, "updatedAt": datetime.now(timezone.utc)}}
    )
    if res.matched_count == 0:
        return error_response("User not found.", 404)
        
    return success_response(None, f"User status successfully updated to {new_status}.")

@admin_bp.route('/donors/<donor_id>/verify', methods=['PUT'])
@role_required('ADMIN')
def verify_donor(donor_id):
    db = get_db()
    data = request.get_json() or {}
    status = data.get('status', 'VERIFIED').strip().upper()

    if status not in ['PENDING', 'VERIFIED', 'REJECTED']:
        return error_response("Verification status must be PENDING, VERIFIED, or REJECTED.", 400)

    donor = db.donors.find_one({"_id": ObjectId(donor_id)})
    if not donor:
        return error_response("Donor not found.", 404)

    db.donors.update_one(
        {"_id": ObjectId(donor_id)},
        {"$set": {"verificationStatus": status, "updatedAt": datetime.now(timezone.utc)}}
    )

    # Send email notification
    send_donor_verified_email(donor.get("name", "Donor"), donor.get("email"), status)

    return success_response(None, f"Donor status updated to {status}.")

@admin_bp.route('/hospitals/<hospital_id>/verify', methods=['PUT'])
@role_required('ADMIN')
def verify_hospital(hospital_id):
    db = get_db()
    data = request.get_json() or {}
    is_verified = bool(data.get('isVerified', True))
    
    query = {}
    if ObjectId.is_valid(hospital_id):
        query["_id"] = ObjectId(hospital_id)
    else:
        query["userId"] = str(hospital_id)

    res = db.hospitals.update_one(
        query,
        {"$set": {"isVerified": is_verified, "updatedAt": datetime.now(timezone.utc)}}
    )
    if res.matched_count == 0:
        return error_response("Hospital not found.", 404)
        
    status_label = "Verified" if is_verified else "Unverified / Pending"
    return success_response(None, f"Hospital status updated to {status_label}.")

@admin_bp.route('/users/<user_id>', methods=['DELETE'])
@role_required('ADMIN')
def delete_user(user_id):
    db = get_db()
    # Check that we do not delete our self
    admin_user = request.user
    if str(admin_user['id']) == str(user_id):
        return error_response("You cannot delete your own administrative account.", 400)

    # Delete donor if exists
    db.donors.delete_many({"userId": str(user_id)})
    db.hospitals.delete_many({"userId": str(user_id)})
    res = db.users.delete_one({"_id": ObjectId(user_id)})
    if res.deleted_count == 0:
        return error_response("User not found.", 404)

    return success_response(None, "User and associated records deleted permanently.")

@admin_bp.route('/reports', methods=['GET'])
@role_required('ADMIN')
def get_admin_reports():
    db = get_db()
    
    total_donations = db.donations.count_documents({"status": "COMPLETED"})
    total_requests = db.blood_requests.count_documents({})
    fulfilled_requests = db.blood_requests.count_documents({"status": {"$in": ["DONATION_COMPLETED", "CLOSED"]}})
    fulfillment_rate = (fulfilled_requests / total_requests * 100) if total_requests > 0 else 0

    return success_response({
        "totalDonations": total_donations,
        "totalRequests": total_requests,
        "fulfilledRequests": fulfilled_requests,
        "fulfillmentRate": round(fulfillment_rate, 1),
        "generatedAt": datetime.now(timezone.utc).isoformat()
    }, "Reports generated.")
