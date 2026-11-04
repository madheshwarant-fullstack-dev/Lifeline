import os
import traceback
from contextlib import asynccontextmanager
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId

from fastapi import FastAPI, Depends, HTTPException, status, Header, Request, Query, Path
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from config import Config
from database.connection import get_db, close_db, ping_db, serialize_doc, get_safe_uri
from database.seed_data import seed_database
import jwt

# Pydantic Schemas
from models.schemas import (
    UserRegisterSchema,
    UserLoginSchema,
    BloodRequestCreateSchema,
    BloodRequestStatusUpdateSchema,
    DonorAvailabilitySchema,
    DonorContactSchema,
    DonorProfileUpdateSchema,
    DonationCreateSchema,
    HealthScreeningSubmitSchema,
    HealthScreeningReviewSchema,
    UserStatusUpdateSchema,
    DonorVerifySchema,
    HospitalVerifySchema
)

# Business Services
from services.auth_service import register_user, login_user, get_current_user_profile
from services.donor_service import (
    get_donor_by_id,
    get_donor_by_user_id,
    update_donor_profile,
    toggle_availability,
    search_donors,
    get_donor_dashboard_stats,
    respond_to_request,
    contact_donor
)
from services.request_service import (
    create_blood_request,
    get_blood_requests,
    get_request_by_id,
    update_request_status,
    delete_request
)
from services.matching_service import find_matched_donors_for_request
from services.donation_service import record_donation, get_donations, update_donation_status
from services.notification_service import (
    get_user_notifications,
    mark_notification_read,
    mark_all_notifications_read,
    get_unread_count
)
from services.screening_service import (
    submit_health_screening,
    get_screening_by_request,
    get_screening_by_id,
    list_health_screenings,
    review_health_screening,
    confirm_donation_from_screening
)
from services.email_service import send_donor_verified_email

# Lifespan Management
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("=" * 60)
    print("[Lifeline FastAPI] Starting up Lifeline Backend...")
    safe_uri = get_safe_uri(Config.MONGO_URI)
    print(f"[Lifeline FastAPI] Connecting to MongoDB Database: '{Config.DB_NAME}' ({safe_uri})")
    
    try:
        db = get_db()
        is_ok, msg = ping_db()
        if is_ok:
            print("[Lifeline FastAPI] MongoDB Atlas connection verified with ping.")
            try:
                seed_database()
            except Exception as se:
                print(f"[Lifeline FastAPI] Seed database notice: {se}")
        else:
            print(f"[Lifeline FastAPI Warning] MongoDB Ping notice: {msg}")
    except Exception as e:
        print(f"[Lifeline FastAPI Startup Warning] Database init exception: {e}")
    print("=" * 60)
    
    yield
    
    print("[Lifeline FastAPI] Shutting down application and closing MongoDB connection pool...")
    close_db()

# Initialize FastAPI App
app = FastAPI(
    title="Lifeline Blood Donation & Emergency Coordination API",
    description="High-performance backend API powering voluntary blood donor matching, emergency alerts, and clinical workflows.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Robust Production CORS Configuration supporting Localhost and Vercel domains
frontend_origin = Config.FRONTEND_URL.rstrip('/') if getattr(Config, 'FRONTEND_URL', None) else None
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
]
if frontend_origin and frontend_origin not in allowed_origins:
    allowed_origins.append(frontend_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app|http://localhost:\d+|http://127\.0\.0\.1:\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helpers for uniform JSON responses
def json_success(data=None, message="Success", status_code=200):
    payload = {"success": True, "message": message}
    if data is not None:
        payload["data"] = data
    return JSONResponse(status_code=status_code, content=payload)

def json_error(message="An error occurred", status_code=400, errors=None):
    payload = {"success": False, "message": message}
    if errors is not None:
        payload["errors"] = errors
    return JSONResponse(status_code=status_code, content=payload)

# Custom Validation Error Handler
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    err_msgs = []
    for err in exc.errors():
        loc = " -> ".join([str(x) for x in err.get("loc", [])])
        msg = err.get("msg", "Invalid value")
        err_msgs.append(f"{loc}: {msg}")
    return json_error("Validation failed", status_code=400, errors=err_msgs)

# Authentication & Dependency Injection
async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is missing. Please log in."
        )
    parts = authorization.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization token format. Format must be 'Bearer <token>'."
        )
    token = parts[1]
    try:
        payload = jwt.decode(token, Config.JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("sub") or payload.get("userId")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload.")
        
        db = get_db()
        user = db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=401, detail="User account no longer exists.")
        if user.get("status") == "BLOCKED":
            raise HTTPException(status_code=403, detail="Your account has been suspended by an administrator.")
        
        serialized = serialize_doc(user)
        if "password" in serialized:
            del serialized["password"]
        return serialized
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or corrupted authentication token.")

def require_role(*allowed_roles):
    async def role_checker(current_user: dict = Depends(get_current_user)):
        user_role = (current_user.get("role") or "").upper()
        allowed = [r.upper() for r in allowed_roles]
        if user_role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: requires one of the following roles: {', '.join(allowed)}."
            )
        return current_user
    return role_checker

# ==========================================
# 1. SYSTEM HEALTH & TELEMETRY ROUTES
# ==========================================
@app.get("/api/health", tags=["System Telemetry"])
def health_check():
    db_connected = False
    try:
        db = get_db()
        is_ok, _ = ping_db()
        db_connected = is_ok
    except Exception:
        db_connected = False

    return json_success({
        "service": "Lifeline FastAPI REST API",
        "status": "online",
        "version": "1.0.0",
        "database": "connected" if db_connected else "connecting/disconnected",
        "engine": "FastAPI + PyMongo"
    }, "Lifeline backend is healthy and operating.")

@app.get("/api/stats", tags=["System Telemetry"])
def public_stats():
    try:
        db = get_db()
        total_donors = db.donors.count_documents({})
        available_donors = db.donors.count_documents({"availability": True})
        total_requests = db.blood_requests.count_documents({})
        successful_donations = db.donations.count_documents({"status": "COMPLETED"})
        fulfilled_requests = db.blood_requests.count_documents({
            "status": {"$in": ["DONATION_COMPLETED", "FULFILLED", "CLOSED"]}
        })
        effective_donations = max(successful_donations, fulfilled_requests)
        emergency_requests = db.blood_requests.count_documents({"urgency": "EMERGENCY"})
        total_hospitals = db.hospitals.count_documents({})
        active_states = len(db.donors.distinct("state")) or 1

        return json_success({
            "totalDonors": total_donors,
            "availableDonors": available_donors,
            "totalRequests": total_requests,
            "successfulDonations": effective_donations,
            "emergencyRequests": emergency_requests,
            "totalHospitals": total_hospitals,
            "activeStates": active_states
        }, "Live blood donation platform statistics")
    except Exception as e:
        return json_error(f"Failed to fetch live statistics: {str(e)}", 500)

# ==========================================
# 2. AUTHENTICATION ROUTES (/api/auth)
# ==========================================
@app.post("/api/auth/register", tags=["Authentication"], status_code=201)
def api_register(payload: UserRegisterSchema):
    data = payload.model_dump()
    result, error_msg = register_user(data)
    if error_msg:
        return json_error(error_msg, 400)
    return json_success(result, "Registration successful!", 201)

@app.post("/api/auth/login", tags=["Authentication"])
def api_login(payload: UserLoginSchema):
    result, error_msg = login_user(payload.email, payload.password)
    if error_msg:
        return json_error(error_msg, 401)
    return json_success(result, "Login successful!")

@app.post("/api/auth/logout", tags=["Authentication"])
def api_logout():
    return json_success(None, "Logged out successfully.")

@app.get("/api/auth/me", tags=["Authentication"])
def api_get_me(current_user: dict = Depends(get_current_user)):
    profile = get_current_user_profile(current_user["id"])
    if not profile:
        return json_error("User profile not found", 404)
    return json_success(profile, "Profile retrieved successfully.")

# ==========================================
# 3. DONOR ROUTES (/api/donors)
# ==========================================
@app.get("/api/donors", tags=["Donors"])
def api_list_donors(
    bloodGroup: Optional[str] = None,
    state: Optional[str] = None,
    city: Optional[str] = None,
    availability: Optional[str] = None,
    verificationStatus: Optional[str] = None,
    search: Optional[str] = None,
    authorization: Optional[str] = Header(None)
):
    filters = {
        "bloodGroup": bloodGroup,
        "state": state,
        "city": city,
        "availability": availability,
        "verificationStatus": verificationStatus,
        "search": search
    }
    is_admin = False
    if authorization and authorization.startswith("Bearer "):
        try:
            token = authorization.split(" ")[1]
            pay = jwt.decode(token, Config.JWT_SECRET, algorithms=["HS256"])
            is_admin = pay.get("role") == "ADMIN"
        except Exception:
            is_admin = False

    donors = search_donors(filters, is_admin=is_admin)
    return json_success(donors, f"Found {len(donors)} donors.")

@app.get("/api/donors/search", tags=["Donors"])
def api_search_donors(
    bloodGroup: Optional[str] = None,
    state: Optional[str] = None,
    city: Optional[str] = None,
    availability: Optional[str] = None,
    verificationStatus: Optional[str] = None,
    search: Optional[str] = None,
    authorization: Optional[str] = Header(None)
):
    return api_list_donors(bloodGroup, state, city, availability, verificationStatus, search, authorization)

@app.get("/api/donors/dashboard", tags=["Donors"])
def api_donor_dashboard(current_user: dict = Depends(require_role("DONOR"))):
    donor = get_donor_by_user_id(current_user["id"])
    if not donor:
        return json_error("Donor record not found for authenticated user.", 404)
    stats = get_donor_dashboard_stats(donor["id"])
    return json_success(stats, "Donor dashboard data retrieved.")

@app.get("/api/donors/{donor_id}", tags=["Donors"])
def api_get_donor(donor_id: str):
    donor = get_donor_by_id(donor_id)
    if not donor:
        return json_error("Donor not found.", 404)
    return json_success(donor, "Donor profile retrieved.")

@app.put("/api/donors/{donor_id}", tags=["Donors"])
def api_update_donor(
    donor_id: str,
    payload: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    donor = get_donor_by_id(donor_id)
    if not donor:
        return json_error("Donor not found.", 404)
    if current_user["role"] != "ADMIN" and donor["userId"] != current_user["id"]:
        return json_error("You are not authorized to update this profile.", 403)
    
    updated = update_donor_profile(donor["userId"], payload)
    return json_success(updated, "Profile updated successfully.")

@app.post("/api/donors/availability", tags=["Donors"])
def api_set_availability(
    payload: DonorAvailabilitySchema,
    current_user: dict = Depends(require_role("DONOR"))
):
    donor = get_donor_by_user_id(current_user["id"])
    if not donor:
        return json_error("Donor profile not found.", 404)
    updated = toggle_availability(donor["id"], payload.availability)
    return json_success(updated, f"Availability set to {'Available' if payload.availability else 'Unavailable'}.")

@app.post("/api/donors/requests/{request_id}/respond", tags=["Donors"])
def api_respond_to_request(
    request_id: str,
    payload: Dict[str, Any],
    current_user: dict = Depends(require_role("DONOR"))
):
    action = payload.get("action", "").strip().upper()
    if action not in ["ACCEPT", "DECLINE"]:
        return json_error("Action must be ACCEPT or DECLINE.", 400)
    
    donor = get_donor_by_user_id(current_user["id"])
    if not donor:
        return json_error("Donor profile not found.", 404)
    
    res, err = respond_to_request(donor["id"], request_id, action)
    if err:
        return json_error(err, 400)
    return json_success(res, f"Request successfully {action.lower()}ed.")

@app.post("/api/donors/{donor_id}/contact", tags=["Donors"])
def api_contact_donor(
    donor_id: str,
    payload: DonorContactSchema,
    current_user: dict = Depends(get_current_user)
):
    success, msg = contact_donor(donor_id, current_user, payload.message, payload.requestId)
    if not success:
        return json_error(msg, 400)
    return json_success(None, msg)

# ==========================================
# 4. BLOOD REQUEST ROUTES (/api/requests)
# ==========================================
@app.post("/api/requests", tags=["Blood Requests"], status_code=201)
def api_create_request(
    payload: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    created, err = create_blood_request(current_user, payload)
    if err:
        return json_error(err, 400)
    return json_success(created, "Blood request created and matched successfully!", 201)

@app.get("/api/requests", tags=["Blood Requests"])
def api_list_requests(
    bloodGroup: Optional[str] = None,
    state: Optional[str] = None,
    city: Optional[str] = None,
    urgency: Optional[str] = None,
    status: Optional[str] = None,
    requesterId: Optional[str] = None
):
    filters = {
        "bloodGroup": bloodGroup,
        "state": state,
        "city": city,
        "urgency": urgency,
        "status": status,
        "requesterId": requesterId
    }
    requests = get_blood_requests(filters)
    return json_success(requests, f"Found {len(requests)} requests.")

@app.get("/api/requests/{request_id}", tags=["Blood Requests"])
def api_get_request(request_id: str):
    req_doc = get_request_by_id(request_id)
    if not req_doc:
        return json_error("Blood request not found.", 404)
    return json_success(req_doc, "Blood request retrieved.")

@app.put("/api/requests/{request_id}/status", tags=["Blood Requests"])
def api_update_request_status(
    request_id: str,
    payload: BloodRequestStatusUpdateSchema,
    current_user: dict = Depends(get_current_user)
):
    new_status = payload.status.strip().upper()
    updated, err = update_request_status(request_id, new_status, current_user)
    if err:
        return json_error(err, 400)
    return json_success(updated, f"Request status updated to {new_status}.")

@app.delete("/api/requests/{request_id}", tags=["Blood Requests"])
def api_delete_request(
    request_id: str,
    current_user: dict = Depends(get_current_user)
):
    success, err = delete_request(request_id, current_user)
    if not success:
        return json_error(err, 400)
    return json_success(None, "Blood request cancelled successfully.")

# ==========================================
# 5. MATCHING ENGINE ROUTES (/api/matching)
# ==========================================
@app.get("/api/matching/{request_id}", tags=["Matching Engine"])
def api_get_matches(
    request_id: str,
    only_verified: bool = Query(default=False)
):
    req_doc = get_request_by_id(request_id)
    if not req_doc:
        return json_error("Blood request not found.", 404)
    match_result = find_matched_donors_for_request(req_doc, only_verified=only_verified)
    return json_success({
        "request": req_doc,
        **match_result
    }, "Donor matching calculated successfully.")

# ==========================================
# 6. DONATION ROUTES (/api/donations)
# ==========================================
@app.post("/api/donations", tags=["Donations"], status_code=201)
def api_record_donation(
    payload: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] == "DONOR" and not payload.get("donorId"):
        donor = get_donor_by_user_id(current_user["id"])
        if donor:
            payload["donorId"] = donor["id"]
            payload["donorName"] = donor["name"]
            payload["bloodGroup"] = donor["bloodGroup"]
    created = record_donation(payload)
    return json_success(created, "Donation record created.", 201)

@app.get("/api/donations", tags=["Donations"])
def api_list_donations(
    bloodGroup: Optional[str] = None,
    status: Optional[str] = None,
    requestId: Optional[str] = None,
    donorId: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    filters = {
        "bloodGroup": bloodGroup,
        "status": status,
        "requestId": requestId
    }
    if current_user["role"] == "DONOR":
        donor = get_donor_by_user_id(current_user["id"])
        if donor:
            filters["donorId"] = donor["id"]
        else:
            return json_success([], "No donor record found.")
    elif donorId:
        filters["donorId"] = donorId

    donations = get_donations(filters)
    return json_success(donations, f"Found {len(donations)} donation records.")

@app.put("/api/donations/{donation_id}", tags=["Donations"])
def api_update_donation(
    donation_id: str,
    payload: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    new_status = payload.get("status", "").strip().upper()
    updated = update_donation_status(donation_id, new_status, payload)
    if not updated:
        return json_error("Donation record not found.", 404)
    return json_success(updated, "Donation status updated.")

# ==========================================
# 7. NOTIFICATION ROUTES (/api/notifications)
# ==========================================
@app.get("/api/notifications", tags=["Notifications"])
def api_get_notifications(current_user: dict = Depends(get_current_user)):
    notifs = get_user_notifications(current_user["id"])
    unread = get_unread_count(current_user["id"])
    return json_success({
        "notifications": notifs,
        "unreadCount": unread
    }, "Notifications retrieved.")

@app.put("/api/notifications/{notification_id}/read", tags=["Notifications"])
def api_mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
):
    ok = mark_notification_read(notification_id, current_user["id"])
    if not ok:
        return json_error("Notification not found or already read.", 404)
    return json_success(None, "Notification marked as read.")

@app.put("/api/notifications/read-all", tags=["Notifications"])
def api_mark_all_notifications_read(current_user: dict = Depends(get_current_user)):
    cnt = mark_all_notifications_read(current_user["id"])
    return json_success({"count": cnt}, f"Marked {cnt} notifications as read.")

# ==========================================
# 8. ADMIN ROUTES (/api/admin)
# ==========================================
@app.get("/api/admin/dashboard", tags=["Admin Cockpit"])
def api_admin_dashboard(admin_user: dict = Depends(require_role("ADMIN"))):
    db = get_db()
    total_users = db.users.count_documents({})
    total_donors = db.donors.count_documents({})
    available_donors = db.donors.count_documents({"availability": True})
    total_requests = db.blood_requests.count_documents({})
    emergency_requests = db.blood_requests.count_documents({"urgency": "EMERGENCY"})
    completed_donations = db.donations.count_documents({"status": "COMPLETED"})
    total_hospitals = db.hospitals.count_documents({})

    bg_pipeline = [
        {"$group": {"_id": "$bloodGroup", "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]
    bg_dist = list(db.donors.aggregate(bg_pipeline))
    blood_group_counts = {item["_id"] or "Unknown": item["count"] for item in bg_dist}

    urgency_pipeline = [
        {"$group": {"_id": "$urgency", "count": {"$sum": 1}}}
    ]
    urgency_dist = list(db.blood_requests.aggregate(urgency_pipeline))
    urgency_counts = {item["_id"]: item["count"] for item in urgency_dist}

    city_pipeline = [
        {"$group": {"_id": "$city", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 6}
    ]
    city_dist = list(db.donors.aggregate(city_pipeline))
    city_counts = {item["_id"] or "Other": item["count"] for item in city_dist}

    state_pipeline = [
        {"$group": {"_id": "$state", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 6}
    ]
    state_dist = list(db.donors.aggregate(state_pipeline))
    state_counts = {item["_id"] or "Other": item["count"] for item in state_dist}

    recent_emergency = list(db.blood_requests.find(
        {"urgency": "EMERGENCY"}
    ).sort("createdAt", -1).limit(5))

    recent_users = list(db.users.find({}, {"password": 0}).sort("createdAt", -1).limit(5))

    return json_success({
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

@app.get("/api/admin/users", tags=["Admin Cockpit"])
def api_admin_users(
    role: Optional[str] = None,
    bloodGroup: Optional[str] = None,
    search: Optional[str] = None,
    admin_user: dict = Depends(require_role("ADMIN"))
):
    db = get_db()
    query = {}
    if role:
        query["role"] = role.strip().upper()
    if bloodGroup:
        query["bloodGroup"] = bloodGroup.strip().upper()
    if search:
        search_rgx = {"$regex": search.strip(), "$options": "i"}
        query["$or"] = [
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

    return json_success(serialized_users, f"Found {len(serialized_users)} users.")

@app.put("/api/admin/users/{user_id}/status", tags=["Admin Cockpit"])
def api_admin_update_user_status(
    user_id: str,
    payload: UserStatusUpdateSchema,
    admin_user: dict = Depends(require_role("ADMIN"))
):
    db = get_db()
    new_status = payload.status.strip().upper()
    if new_status not in ["ACTIVE", "BLOCKED"]:
        return json_error("Status must be ACTIVE or BLOCKED", 400)
    
    res = db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"status": new_status, "updatedAt": datetime.now(timezone.utc)}}
    )
    if res.matched_count == 0:
        return json_error("User not found.", 404)
    return json_success(None, f"User status successfully updated to {new_status}.")

@app.put("/api/admin/donors/{donor_id}/verify", tags=["Admin Cockpit"])
def api_admin_verify_donor(
    donor_id: str,
    payload: DonorVerifySchema,
    admin_user: dict = Depends(require_role("ADMIN"))
):
    db = get_db()
    status_val = payload.status.strip().upper()
    if status_val not in ["PENDING", "VERIFIED", "REJECTED"]:
        return json_error("Verification status must be PENDING, VERIFIED, or REJECTED.", 400)

    donor = db.donors.find_one({"_id": ObjectId(donor_id)})
    if not donor:
        return json_error("Donor not found.", 404)

    db.donors.update_one(
        {"_id": ObjectId(donor_id)},
        {"$set": {"verificationStatus": status_val, "updatedAt": datetime.now(timezone.utc)}}
    )
    send_donor_verified_email(donor.get("name", "Donor"), donor.get("email"), status_val)
    return json_success(None, f"Donor status updated to {status_val}.")

@app.put("/api/admin/hospitals/{hospital_id}/verify", tags=["Admin Cockpit"])
def api_admin_verify_hospital(
    hospital_id: str,
    payload: HospitalVerifySchema,
    admin_user: dict = Depends(require_role("ADMIN"))
):
    db = get_db()
    is_verified = payload.isVerified
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
        return json_error("Hospital not found.", 404)
    status_label = "Verified" if is_verified else "Unverified / Pending"
    return json_success(None, f"Hospital status updated to {status_label}.")

@app.delete("/api/admin/users/{user_id}", tags=["Admin Cockpit"])
def api_admin_delete_user(
    user_id: str,
    admin_user: dict = Depends(require_role("ADMIN"))
):
    db = get_db()
    if str(admin_user["id"]) == str(user_id):
        return json_error("You cannot delete your own administrative account.", 400)

    db.donors.delete_many({"userId": str(user_id)})
    db.hospitals.delete_many({"userId": str(user_id)})
    res = db.users.delete_one({"_id": ObjectId(user_id)})
    if res.deleted_count == 0:
        return json_error("User not found.", 404)
    return json_success(None, "User and associated records deleted permanently.")

@app.get("/api/admin/reports", tags=["Admin Cockpit"])
def api_admin_reports(admin_user: dict = Depends(require_role("ADMIN"))):
    db = get_db()
    total_donations = db.donations.count_documents({"status": "COMPLETED"})
    total_requests = db.blood_requests.count_documents({})
    fulfilled_requests = db.blood_requests.count_documents({"status": {"$in": ["DONATION_COMPLETED", "CLOSED"]}})
    fulfillment_rate = (fulfilled_requests / total_requests * 100) if total_requests > 0 else 0

    return json_success({
        "totalDonations": total_donations,
        "totalRequests": total_requests,
        "fulfilledRequests": fulfilled_requests,
        "fulfillmentRate": round(fulfillment_rate, 1),
        "generatedAt": datetime.now(timezone.utc).isoformat()
    }, "Reports generated.")

# ==========================================
# 9. HEALTH SCREENING ROUTES (/api/screenings)
# ==========================================
@app.post("/api/screenings", tags=["Health Screenings"], status_code=201)
def api_submit_screening(
    payload: Dict[str, Any],
    current_user: dict = Depends(require_role("DONOR"))
):
    result, err = submit_health_screening(current_user, payload)
    if err:
        return json_error(err, 400)
    return json_success(result, "Screening Submitted - Awaiting Medical Review.", 201)

@app.get("/api/screenings", tags=["Health Screenings"])
def api_list_screenings(
    status: Optional[str] = None,
    donorId: Optional[str] = None,
    requestId: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    filters = {"status": status, "donorId": donorId, "requestId": requestId}
    screenings, err = list_health_screenings(current_user, filters)
    if err:
        return json_error(err, 403)
    return json_success(screenings, f"Found {len(screenings)} screening records.")

@app.get("/api/screenings/request/{request_id}", tags=["Health Screenings"])
def api_get_screening_by_request(
    request_id: str,
    current_user: dict = Depends(get_current_user)
):
    screening, err = get_screening_by_request(current_user, request_id)
    if err:
        return json_error(err, 404)
    return json_success(screening, "Screening details retrieved.")

@app.get("/api/screenings/{screening_id}", tags=["Health Screenings"])
def api_get_screening_by_id(
    screening_id: str,
    current_user: dict = Depends(get_current_user)
):
    screening, err = get_screening_by_id(current_user, screening_id)
    if err:
        return json_error(err, 404)
    return json_success(screening, "Screening details retrieved.")

@app.put("/api/screenings/{screening_id}/review", tags=["Health Screenings"])
def api_review_screening(
    screening_id: str,
    payload: Dict[str, Any],
    current_user: dict = Depends(require_role("ADMIN", "HOSPITAL"))
):
    updated, err = review_health_screening(current_user, screening_id, payload)
    if err:
        return json_error(err, 400)
    return json_success(updated, "Screening reviewed successfully.")

@app.post("/api/screenings/{screening_id}/confirm", tags=["Health Screenings"])
def api_confirm_screening(
    screening_id: str,
    payload: Dict[str, Any] = {},
    current_user: dict = Depends(require_role("ADMIN", "HOSPITAL"))
):
    result, err = confirm_donation_from_screening(current_user, screening_id, payload)
    if err:
        return json_error(err, 400)
    return json_success(result, "Donation verified and completed.")

# Execution entry point
if __name__ == "__main__":
    import uvicorn
    import sys
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)
    port = int(os.getenv("PORT", 5000))
    print(f"[Lifeline] FastAPI server starting on http://localhost:{port} (Swagger UI: http://localhost:{port}/docs)")
    uvicorn.run(app, host="0.0.0.0", port=port)

