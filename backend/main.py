import os
import asyncio
import traceback
from contextlib import asynccontextmanager, suppress
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from bson import ObjectId

from fastapi import FastAPI, Depends, HTTPException, status, Header, Request, Query, Path, WebSocket, WebSocketDisconnect
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
    HospitalVerifySchema,
    DonorLocationUpdateSchema,
    DonorLocationSharingSchema,
    RequestInviteSchema,
    RequestRespondSchema,
    DonorMedicalProfileSchema,
    DonorMedicalReviewUpdateSchema
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
    contact_donor,
    sanitize_public_donor,
    set_location_sharing,
    update_donor_live_location,
    get_donor_invitations,
    save_donor_medical_profile,
    get_donor_medical_profile,
    get_donor_medical_review_for_requester,
    update_donor_medical_review_by_admin
)
from services.request_service import (
    create_blood_request,
    get_blood_requests,
    get_request_by_id,
    update_request_status,
    delete_request,
    invite_donors_to_request,
    get_request_invitations
)
from services.matching_service import (
    find_matched_donors_for_request,
    find_nearby_donors,
    expire_stale_donor_locations,
    BLOOD_COMPATIBILITY_CONFIG
)
from services.realtime_service import manager as ws_manager
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
    ws_manager.set_loop(asyncio.get_running_loop())
    safe_uri = get_safe_uri(Config.MONGO_URI)
    print(f"[Lifeline FastAPI] Connecting to MongoDB Database: '{Config.DB_NAME}' ({safe_uri})")
    
    reaper_task = None
    try:
        db = get_db()
        is_ok, msg = ping_db()
        if is_ok:
            print("[Lifeline FastAPI] MongoDB Atlas connection verified with ping.")
            try:
                seed_database()
                expire_stale_donor_locations(db)
            except Exception as se:
                print(f"[Lifeline FastAPI] Seed database notice: {se}")
        else:
            print(f"[Lifeline FastAPI Warning] MongoDB Ping notice: {msg}")
    except Exception as e:
        print(f"[Lifeline FastAPI Startup Warning] Database init exception: {e}")

    async def _stale_location_reaper():
        while True:
            await asyncio.sleep(120)
            try:
                expire_stale_donor_locations()
            except Exception:
                pass

    reaper_task = asyncio.create_task(_stale_location_reaper())
    print("=" * 60)
    
    try:
        yield
    finally:
        if reaper_task:
            reaper_task.cancel()
            with suppress(asyncio.CancelledError):
                await reaper_task
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

# Standardized Status Code Mapping
HTTP_STATUS_CODE_MAP = {
    200: "OK",
    201: "CREATED",
    202: "ACCEPTED",
    204: "NO_CONTENT",
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "RESOURCE_NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    409: "CONFLICT",
    413: "PAYLOAD_TOO_LARGE",
    415: "UNSUPPORTED_MEDIA_TYPE",
    422: "UNPROCESSABLE_ENTITY",
    429: "TOO_MANY_REQUESTS",
    500: "INTERNAL_SERVER_ERROR",
    501: "NOT_IMPLEMENTED",
    502: "BAD_GATEWAY",
    503: "SERVICE_UNAVAILABLE",
    504: "GATEWAY_TIMEOUT",
}

# Helpers for uniform JSON responses per Section 4 architecture
def json_success(data=None, message="Operation completed successfully", status_code=200):
    payload = {
        "success": True,
        "message": message,
        "data": data if data is not None else {}
    }
    return JSONResponse(status_code=status_code, content=payload)

def json_error(message="An error occurred", status_code=400, error_code=None, errors=None):
    code = error_code or HTTP_STATUS_CODE_MAP.get(status_code, "ERROR")
    payload = {
        "success": False,
        "message": message,
        "error": {
            "code": code
        }
    }
    if errors is not None:
        payload["error"]["details"] = errors
        payload["errors"] = errors  # Backward-compatibility alias
    return JSONResponse(status_code=status_code, content=payload)

# Centralized Error-Handling Middlewares
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    code = HTTP_STATUS_CODE_MAP.get(exc.status_code, "ERROR")
    detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
    return json_error(message=detail, status_code=exc.status_code, error_code=code)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    err_msgs = []
    for err in exc.errors():
        loc = " -> ".join([str(x) for x in err.get("loc", [])])
        msg = err.get("msg", "Invalid value")
        err_msgs.append(f"{loc}: {msg}")
    return json_error(
        message="Input validation failed for request payload.",
        status_code=422,
        error_code="UNPROCESSABLE_ENTITY",
        errors=err_msgs
    )

@app.exception_handler(Exception)
async def global_unhandled_exception_handler(request: Request, exc: Exception):
    # Log securely without exposing stack trace or internal secrets to user
    print(f"[SECURITY ALERT / ERROR] Unhandled Exception on {request.method} {request.url.path}: {exc}")
    return json_error(
        message="An unexpected server error occurred. Please contact system support.",
        status_code=500,
        error_code="INTERNAL_SERVER_ERROR"
    )

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


@app.get("/api/blood-compatibility", tags=["System Telemetry"])
def api_blood_compatibility():
    return json_success(BLOOD_COMPATIBILITY_CONFIG, "RBC serological compatibility configuration.")


# ==========================================
# 1B. REAL-TIME WEBSOCKET GATEWAY (/ws)
# ==========================================
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: Optional[str] = Query(default=None)):
    raw_token = token
    if not raw_token:
        auth_header = websocket.headers.get("authorization", "")
        if auth_header.lower().startswith("bearer "):
            raw_token = auth_header.split(" ", 1)[1].strip()
    if not raw_token:
        await websocket.close(code=4001, reason="Authentication token missing.")
        return

    try:
        payload = jwt.decode(raw_token, Config.JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("sub") or payload.get("userId")
        if not user_id or not ObjectId.is_valid(str(user_id)):
            await websocket.close(code=4001, reason="Invalid token payload.")
            return
        db = get_db()
        user = db.users.find_one({"_id": ObjectId(str(user_id))})
        if not user or user.get("status") == "BLOCKED":
            await websocket.close(code=4003, reason="User unauthorized or blocked.")
            return
        role = (user.get("role") or "").upper()
        hospital_id = None
        if role == "HOSPITAL":
            hosp = db.hospitals.find_one({"userId": str(user_id)}, {"_id": 1})
            if hosp:
                hospital_id = str(hosp["_id"])
    except Exception:
        await websocket.close(code=4001, reason="Invalid or expired token.")
        return

    await ws_manager.connect(
        websocket=websocket,
        user_id=str(user_id),
        role=role,
        email=user.get("email", ""),
        hospital_id=hospital_id,
    )
    try:
        while True:
            msg = await websocket.receive_json()
            if isinstance(msg, dict) and (msg.get("event") == "ping" or msg.get("type") == "ping"):
                await websocket.send_json({
                    "event": "pong",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)

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
    stats = get_donor_dashboard_stats(current_user["id"])
    return json_success(stats, "Donor dashboard data retrieved.")

@app.get("/api/donors/nearby", tags=["Donors"])
def api_nearby_donors(
    lat: float = Query(..., ge=-90.0, le=90.0),
    lng: float = Query(..., ge=-180.0, le=180.0),
    bloodGroup: Optional[str] = None,
    radiusKm: int = Query(default=25, ge=1, le=500),
    requestId: Optional[str] = None,
    onlyVerified: bool = Query(default=True),
    current_user: dict = Depends(require_role("HOSPITAL", "ADMIN", "REQUESTER")),
):
    if current_user["role"] == "HOSPITAL":
        hosp = get_db().hospitals.find_one({"userId": str(current_user["id"])})
        if hosp and not hosp.get("isVerified", False):
            return json_error("Hospital verification is required to view nearby live donors.", 403)
    res, err = find_nearby_donors(
        hospital_lat=lat,
        hospital_lng=lng,
        patient_blood_group=bloodGroup,
        radius_km=radiusKm,
        only_verified=onlyVerified,
        require_live_sharing=True,
        request_id=requestId,
    )
    if err:
        return json_error(err, 400)
    return json_success(res, f"Found {res['totalMatches']} nearby matching donors within {radiusKm} km.")

@app.get("/api/donors/invitations", tags=["Donors"])
def api_donor_invitations(current_user: dict = Depends(require_role("DONOR"))):
    res, err = get_donor_invitations(current_user["id"])
    if err:
        return json_error(err, 404)
    return json_success(res, "Donor invitations retrieved.")

@app.post("/api/donors/location-sharing", tags=["Donors"])
def api_donor_location_sharing(
    payload: DonorLocationSharingSchema,
    current_user: dict = Depends(require_role("DONOR"))
):
    updated, err, code = set_location_sharing(
        user_id=current_user["id"],
        enabled=payload.enabled,
        consent=payload.consent,
        lat=payload.lat,
        lng=payload.lng,
    )
    if err:
        return json_error(err, code)
    return json_success(
        updated,
        "Live GPS location sharing enabled." if payload.enabled else "Live GPS location sharing stopped and coordinates cleared."
    )

@app.post("/api/donors/location", tags=["Donors"])
def api_update_donor_location(
    payload: DonorLocationUpdateSchema,
    current_user: dict = Depends(require_role("DONOR"))
):
    lat_val = payload.lat if payload.lat is not None else payload.latitude
    lng_val = payload.lng if payload.lng is not None else payload.longitude
    updated, err, code = update_donor_live_location(
        user_id=current_user["id"],
        lat=lat_val,
        lng=lng_val,
        accuracy=payload.accuracy,
        consent=payload.consent,
    )
    if err:
        return json_error(err, code)
    return json_success(updated, "Live location updated successfully.")

@app.get("/api/donors/medical-profile", tags=["Donors"])
def api_get_donor_medical_profile(
    current_user: dict = Depends(require_role("DONOR"))
):
    prof, err, code = get_donor_medical_profile(current_user["id"])
    if err:
        return json_error(err, code)
    return json_success(prof, "Donor medical profile retrieved.")

@app.post("/api/donors/medical-profile", tags=["Donors"])
@app.put("/api/donors/medical-profile", tags=["Donors"])
def api_save_donor_medical_profile(
    payload: DonorMedicalProfileSchema,
    current_user: dict = Depends(require_role("DONOR"))
):
    prof, err, code = save_donor_medical_profile(current_user["id"], payload.model_dump())
    if err:
        return json_error(err, code)
    return json_success(prof, "Donor medical profile saved successfully.")

@app.get("/api/donors/{donor_id}", tags=["Donors"])
def api_get_donor(donor_id: str, authorization: Optional[str] = Header(None)):
    donor = get_donor_by_id(donor_id)
    if not donor:
        return json_error("Donor not found.", 404)
    is_owner_or_admin = False
    if authorization and authorization.startswith("Bearer "):
        try:
            token = authorization.split(" ")[1]
            pay = jwt.decode(token, Config.JWT_SECRET, algorithms=["HS256"])
            uid = str(pay.get("sub") or pay.get("userId") or "")
            is_owner_or_admin = (pay.get("role") == "ADMIN" or uid == str(donor.get("userId")))
        except Exception:
            is_owner_or_admin = False
    if not is_owner_or_admin:
        donor = sanitize_public_donor(donor)
    return json_success(donor, "Donor profile retrieved.")

@app.get("/api/donors/{donor_id}/medical-review", tags=["Donors"])
def api_get_donor_medical_review(
    donor_id: str,
    requestId: Optional[str] = Query(default=None),
    current_user: dict = Depends(get_current_user)
):
    review, err, code = get_donor_medical_review_for_requester(donor_id, current_user, request_id=requestId)
    if err:
        return json_error(err, code)
    return json_success(review, "Donor medical review retrieved.")

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
@app.patch("/api/donors/availability", tags=["Donors"])
def api_set_availability(
    payload: DonorAvailabilitySchema,
    current_user: dict = Depends(require_role("DONOR"))
):
    donor = get_donor_by_user_id(current_user["id"])
    if not donor:
        return json_error("Donor profile not found.", 404)
    updated = toggle_availability(current_user["id"], payload.availability)
    return json_success(updated, f"Availability set to {'Available' if payload.availability else 'Unavailable'}.")

@app.post("/api/donors/requests/{request_id}/respond", tags=["Donors"])
def api_respond_to_request(
    request_id: str,
    payload: Dict[str, Any],
    current_user: dict = Depends(require_role("DONOR"))
):
    action = payload.get("action", "").strip().upper()
    if action not in ["ACCEPT", "ACCEPTED", "DECLINE", "DECLINED", "REJECT", "REJECTED"]:
        return json_error("Action must be ACCEPT or DECLINE.", 400)
    
    res, err = respond_to_request(current_user["id"], request_id, action)
    if err:
        return json_error(err, 400)
    return json_success(res, res.get("message", f"Request successfully processed."))

@app.post("/api/donors/{donor_id}/contact", tags=["Donors"])
def api_contact_donor(
    donor_id: str,
    payload: DonorContactSchema,
    current_user: dict = Depends(get_current_user)
):
    result, err = contact_donor(current_user, donor_id, payload.model_dump())
    if err:
        return json_error(err, 400)
    return json_success(result, result.get("message", "Contact request sent to donor."))

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
@app.patch("/api/requests/{request_id}/status", tags=["Blood Requests"])
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

@app.post("/api/requests/{request_id}/invite", tags=["Blood Requests"])
def api_invite_donors_for_request(
    request_id: str,
    payload: RequestInviteSchema = RequestInviteSchema(),
    current_user: dict = Depends(require_role("HOSPITAL", "ADMIN", "REQUESTER"))
):
    res, err, code = invite_donors_to_request(
        request_id=request_id,
        actor_user=current_user,
        donor_ids=payload.donorIds,
        radius_km=payload.radiusKm or Config.DEFAULT_SEARCH_RADIUS_KM,
        top_n=payload.topN or 10,
    )
    if err:
        return json_error(err, code)
    return json_success(res, f"Sent emergency blood donation invitations to {res['invitedCount']} compatible donor(s).")

@app.get("/api/requests/{request_id}/invitations", tags=["Blood Requests"])
def api_get_request_invitations(
    request_id: str,
    current_user: dict = Depends(get_current_user)
):
    req_doc = get_request_by_id(request_id)
    if not req_doc:
        return json_error("Blood request not found.", 404)
    if current_user["role"] != "ADMIN" and str(req_doc.get("requesterId")) != str(current_user["id"]):
        return json_error("Not authorized to view invitations for this request.", 403)
    return json_success(get_request_invitations(request_id), "Request invitations retrieved.")

@app.post("/api/requests/{request_id}/respond", tags=["Blood Requests"])
def api_donor_respond_request_v2(
    request_id: str,
    payload: RequestRespondSchema,
    current_user: dict = Depends(require_role("DONOR"))
):
    action = (payload.action or "").strip().upper()
    if action not in ["ACCEPT", "ACCEPTED", "DECLINE", "DECLINED", "REJECT", "REJECTED"]:
        return json_error("Action must be ACCEPT, DECLINE, or REJECT.", 400)
    res, err = respond_to_request(current_user["id"], request_id, action, note=payload.note or "")
    if err:
        return json_error(err, 400)
    return json_success(res, res.get("message", "Response processed."))

# ==========================================
# 4B. HOSPITAL REAL-TIME ROUTES (/api/hospitals)
# ==========================================
@app.post("/api/hospitals/requests", tags=["Hospital Portal"], status_code=201)
def api_hospital_create_request(
    payload: Dict[str, Any],
    current_user: dict = Depends(require_role("HOSPITAL", "ADMIN", "REQUESTER"))
):
    created, err = create_blood_request(current_user, payload)
    if err:
        return json_error(err, 400)
    return json_success(created, "Hospital blood request created and nearby donors queried.", 201)

@app.get("/api/hospitals/requests", tags=["Hospital Portal"])
def api_hospital_list_requests(
    status: Optional[str] = None,
    urgency: Optional[str] = None,
    bloodGroup: Optional[str] = None,
    current_user: dict = Depends(require_role("HOSPITAL", "ADMIN", "REQUESTER"))
):
    filters = {"status": status, "urgency": urgency, "bloodGroup": bloodGroup}
    if current_user["role"] in ("HOSPITAL", "REQUESTER"):
        filters["requesterId"] = current_user["id"]
    reqs = get_blood_requests(filters)
    db = get_db()
    for r in reqs:
        invs = get_request_invitations(r["id"])
        r["invitations"] = invs
        r["invitationSummary"] = {
            "total": len(invs),
            "pending": sum(1 for i in invs if i.get("status") == "PENDING"),
            "accepted": sum(1 for i in invs if i.get("status") == "ACCEPTED"),
            "rejected": sum(1 for i in invs if i.get("status") == "REJECTED"),
        }
    return json_success(reqs, f"Loaded {len(reqs)} hospital blood requests.")

@app.get("/api/hospitals/requests/{request_id}/donors", tags=["Hospital Portal"])
def api_hospital_request_nearby_donors(
    request_id: str,
    radius_km: Optional[int] = Query(default=None, ge=1, le=500),
    radiusKm: Optional[int] = Query(default=None, ge=1, le=500),
    lat: Optional[float] = Query(default=None, ge=-90.0, le=90.0),
    lng: Optional[float] = Query(default=None, ge=-180.0, le=180.0),
    current_user: dict = Depends(require_role("HOSPITAL", "ADMIN", "REQUESTER"))
):
    req_doc = get_request_by_id(request_id)
    if not req_doc:
        return json_error("Blood request not found.", 404)
    if current_user["role"] != "ADMIN" and str(req_doc.get("requesterId")) != str(current_user["id"]):
        return json_error("Not authorized to access nearby donor tracking for this request.", 403)
    if current_user["role"] == "HOSPITAL":
        hosp = get_db().hospitals.find_one({"userId": str(current_user["id"])})
        if hosp and not hosp.get("isVerified", False):
            return json_error("Verified hospital approval required to search nearby live donors.", 403)

    target_lat = lat if lat is not None else (req_doc.get("lat") or req_doc.get("latitude"))
    target_lng = lng if lng is not None else (req_doc.get("lng") or req_doc.get("longitude"))
    effective_radius = radius_km or radiusKm or req_doc.get("searchRadiusKm") or Config.DEFAULT_SEARCH_RADIUS_KM

    if target_lat is None or target_lng is None:
        return json_success({
            "request": req_doc,
            "radiusKm": effective_radius,
            "allowedRadiiKm": Config.ALLOWED_SEARCH_RADII_KM,
            "suggestedExpandRadiusKm": None,
            "compatibleBloodGroups": [],
            "totalMatches": 0,
            "donors": [],
            "invitations": get_request_invitations(request_id),
            "needsHospitalCoordinates": True,
        }, "Hospital coordinates are missing on this request. Set hospital GPS to enable radius tracking.")

    nearby_res, err = find_nearby_donors(
        hospital_lat=target_lat,
        hospital_lng=target_lng,
        patient_blood_group=req_doc.get("bloodGroup"),
        radius_km=effective_radius,
        only_verified=True,
        require_live_sharing=True,
        request_city=req_doc.get("city"),
        request_state=req_doc.get("state"),
        request_id=request_id,
    )
    if err:
        return json_error(err, 400)

    return json_success({
        "request": req_doc,
        **nearby_res,
        "invitations": get_request_invitations(request_id),
        "needsHospitalCoordinates": False,
    }, f"Found {nearby_res['totalMatches']} compatible live donors within {effective_radius} km.")

@app.delete("/api/requests/{request_id}", tags=["Blood Requests"])
def api_delete_request(
    request_id: str,
    current_user: dict = Depends(get_current_user)
):
    success, err, code = delete_request(request_id, current_user)
    if not success:
        return json_error(err, code)
    return json_success(None, "Blood request cancelled successfully.", 200)

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
    if not ObjectId.is_valid(user_id):
        return json_error("Invalid user ID format.", 400)
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

    donor = None
    if ObjectId.is_valid(donor_id):
        donor = db.donors.find_one({"_id": ObjectId(donor_id)})
    if not donor:
        donor = db.donors.find_one({"userId": str(donor_id)})
    if not donor:
        return json_error("Donor not found.", 404)

    db.donors.update_one(
        {"_id": donor["_id"]},
        {"$set": {"verificationStatus": status_val, "updatedAt": datetime.now(timezone.utc)}}
    )
    send_donor_verified_email(donor.get("name", "Donor"), donor.get("email"), status_val)
    return json_success(None, f"Donor status updated to {status_val}.")

@app.put("/api/admin/donors/{donor_id}/medical-review", tags=["Admin Cockpit"])
def api_admin_update_donor_medical_review(
    donor_id: str,
    payload: DonorMedicalReviewUpdateSchema,
    admin_user: dict = Depends(require_role("ADMIN"))
):
    res, err, code = update_donor_medical_review_by_admin(admin_user, donor_id, payload.model_dump())
    if err:
        return json_error(err, code)
    return json_success(res, res.get("message", "Medical review status updated successfully."))

@app.put("/api/admin/hospitals/{hospital_id}/verify", tags=["Admin Cockpit"])
def api_admin_verify_hospital(
    hospital_id: str,
    payload: HospitalVerifySchema,
    admin_user: dict = Depends(require_role("ADMIN"))
):
    db = get_db()
    is_verified = payload.isVerified
    if ObjectId.is_valid(hospital_id):
        query = {"$or": [{"_id": ObjectId(hospital_id)}, {"userId": str(hospital_id)}]}
    else:
        query = {"userId": str(hospital_id)}

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

    if not ObjectId.is_valid(user_id):
        return json_error("Invalid user ID format.", 400)
    db.donors.delete_many({"userId": str(user_id)})
    db.hospitals.delete_many({"userId": str(user_id)})
    res = db.users.delete_one({"_id": ObjectId(user_id)})
    if res.deleted_count == 0:
        return json_error("User not found.", 404)
    return json_success(None, "User and associated records deleted permanently.", 200)

@app.get("/api/admin/reports", tags=["Admin Cockpit"])
def api_admin_reports(admin_user: dict = Depends(require_role("ADMIN"))):
    db = get_db()
    total_donations = db.donations.count_documents({"status": "COMPLETED"})
    total_requests = db.blood_requests.count_documents({})
    fulfilled_requests = db.blood_requests.count_documents({"status": {"$in": ["DONATION_COMPLETED", "FULFILLED", "CLOSED"]}})
    fulfillment_rate = (fulfilled_requests / total_requests * 100) if total_requests > 0 else 0

    return json_success({
        "totalDonations": total_donations,
        "totalRequests": total_requests,
        "fulfilledRequests": fulfilled_requests,
        "fulfillmentRate": round(fulfillment_rate, 1),
        "generatedAt": datetime.now(timezone.utc).isoformat()
    }, "Reports generated.")

@app.get("/api/admin/donors", tags=["Admin Cockpit"])
def api_admin_donors(
    bloodGroup: Optional[str] = None,
    verificationStatus: Optional[str] = None,
    availability: Optional[str] = None,
    locationSharingEnabled: Optional[str] = None,
    search: Optional[str] = None,
    admin_user: dict = Depends(require_role("ADMIN")),
):
    db = get_db()
    expire_stale_donor_locations(db)
    query = {}
    if bloodGroup and bloodGroup.strip():
        query["bloodGroup"] = bloodGroup.strip().upper()
    if verificationStatus and verificationStatus.strip():
        query["verificationStatus"] = verificationStatus.strip().upper()
    if availability is not None and availability != "":
        query["availability"] = str(availability).lower() in ("true", "1", "yes")
    if locationSharingEnabled is not None and locationSharingEnabled != "":
        query["locationSharingEnabled"] = str(locationSharingEnabled).lower() in ("true", "1", "yes")
    if search and search.strip():
        rgx = {"$regex": search.strip(), "$options": "i"}
        query["$or"] = [{"name": rgx}, {"email": rgx}, {"city": rgx}, {"state": rgx}, {"phone": rgx}]

    donors = serialize_doc(list(db.donors.find(query).sort("createdAt", -1).limit(200)))
    return json_success(donors, f"Loaded {len(donors)} donors.")

@app.get("/api/admin/hospitals", tags=["Admin Cockpit"])
def api_admin_hospitals(
    isVerified: Optional[str] = None,
    search: Optional[str] = None,
    admin_user: dict = Depends(require_role("ADMIN")),
):
    db = get_db()
    query = {}
    if isVerified is not None and isVerified != "":
        query["isVerified"] = str(isVerified).lower() in ("true", "1", "yes")
    if search and search.strip():
        rgx = {"$regex": search.strip(), "$options": "i"}
        query["$or"] = [{"hospitalName": rgx}, {"email": rgx}, {"city": rgx}, {"state": rgx}, {"registrationNumber": rgx}]

    hospitals = serialize_doc(list(db.hospitals.find(query).sort("createdAt", -1).limit(200)))
    user_oids = [
        ObjectId(str(h["userId"]))
        for h in hospitals
        if h.get("userId") and ObjectId.is_valid(str(h["userId"]))
    ]
    user_map = {}
    if user_oids:
        for u in db.users.find({"_id": {"$in": user_oids}}, {"status": 1, "name": 1}):
            user_map[str(u["_id"])] = u
    for h in hospitals:
        u = user_map.get(str(h.get("userId")))
        if u:
            h["accountStatus"] = u.get("status", "ACTIVE")
            h["userName"] = u.get("name", h.get("hospitalName"))
    return json_success(hospitals, f"Loaded {len(hospitals)} hospitals.")

@app.get("/api/admin/requests", tags=["Admin Cockpit"])
def api_admin_requests(
    bloodGroup: Optional[str] = None,
    urgency: Optional[str] = None,
    status: Optional[str] = None,
    city: Optional[str] = None,
    admin_user: dict = Depends(require_role("ADMIN")),
):
    db = get_db()
    reqs = get_blood_requests({
        "bloodGroup": bloodGroup,
        "urgency": urgency,
        "status": status,
        "city": city,
    })
    req_ids = [r["id"] for r in reqs if r.get("id")]
    summary_by_req = {rid: {"total": 0, "pending": 0, "accepted": 0, "rejected": 0} for rid in req_ids}
    if req_ids:
        for inv in db.request_invitations.find(
            {"requestId": {"$in": req_ids}},
            {"requestId": 1, "status": 1},
        ):
            rid = inv.get("requestId")
            if rid in summary_by_req:
                summary_by_req[rid]["total"] += 1
                st = (inv.get("status") or "").upper()
                if st in ("PENDING", "INVITED"):
                    summary_by_req[rid]["pending"] += 1
                elif st == "ACCEPTED":
                    summary_by_req[rid]["accepted"] += 1
                elif st in ("REJECTED", "DECLINED"):
                    summary_by_req[rid]["rejected"] += 1
    for r in reqs:
        r["invitationSummary"] = summary_by_req.get(
            r.get("id"), {"total": 0, "pending": 0, "accepted": 0, "rejected": 0}
        )
    return json_success(reqs, f"Loaded {len(reqs)} blood requests.")

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
    port = Config.PORT
    print(f"[Lifeline] FastAPI server starting on http://localhost:{port} (Swagger UI: http://localhost:{port}/docs)")
    uvicorn.run(app, host="0.0.0.0", port=port)

