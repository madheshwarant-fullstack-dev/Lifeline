import os
import re
import urllib.parse
import pymongo
from pymongo import ASCENDING, DESCENDING
from bson import ObjectId
from datetime import datetime
from config import Config

try:
    import certifi
    CA_FILE = certifi.where()
except Exception:
    CA_FILE = None

_client = None
_db = None
_active_uri = None

def get_safe_uri(uri: str) -> str:
    """Masks database credentials in connection URI for safe logging without exposing secrets."""
    if not uri:
        return ""
    try:
        return re.sub(r'://([^:]+):([^@]+)@', r'://\1:****@', uri)
    except Exception:
        return "mongodb+srv://[credentials-hidden]"

def create_client(uri: str):
    """Creates a PyMongo MongoClient instance with robust timeouts and TLS settings."""
    options = {
        "serverSelectionTimeoutMS": 4000,
        "connectTimeoutMS": 4000,
        "socketTimeoutMS": 10000,
        "retryWrites": True,
        "appName": "LifelineBackend"
    }
    if CA_FILE and ("mongodb+srv://" in uri or "ssl=true" in uri.lower() or "tls=true" in uri.lower()):
        options["tlsCAFile"] = CA_FILE

    return pymongo.MongoClient(uri, **options)

def ping_db(client=None) -> tuple[bool, str]:
    """Tests the database connection using admin ping command."""
    try:
        c = client or _client
        if c is None:
            return False, "Client is not initialized."
        c.admin.command('ping')
        return True, "Ping successful"
    except Exception as e:
        err_str = str(e)
        if "tlsv1 alert internal error" in err_str.lower() or "serverselectiontimeouterror" in err_str.lower():
            diagnostic = (
                "Atlas SSL/TLS handshake alert (IP Not Whitelisted). "
                "Your current client IP must be added to MongoDB Atlas -> Network Access -> IP Access List."
            )
            return False, diagnostic
        return False, err_str

def get_client():
    """Returns singleton PyMongo client instance."""
    global _client, _db, _active_uri
    if _client is None:
        get_db()
    return _client

def get_db():
    """Returns the lifeline database instance with Atlas primary connection and local failover resilience."""
    global _client, _db, _active_uri
    if _db is not None:
        return _db

    primary_uri = Config.MONGO_URI or "mongodb+srv://lifeline_admin:Lifeline-123@lifeline.hpq3jzn.mongodb.net/lifeline?retryWrites=true&w=majority"
    db_name = Config.DB_NAME or "lifeline"
    safe_primary = get_safe_uri(primary_uri)

    # 1. Attempt Primary (MongoDB Atlas)
    try:
        print(f"[MongoDB] Connecting to primary database at {safe_primary} ...")
        client = create_client(primary_uri)
        is_ok, msg = ping_db(client)
        if is_ok:
            _client = client
            _db = _client[db_name]
            _active_uri = primary_uri
            print(f"[MongoDB Atlas] Successfully connected and pinged '{db_name}'.")
            init_indexes(_db)
            return _db
        else:
            print(f"[MongoDB Atlas Network Warning] Ping to Atlas cluster unsuccessful: {msg}")
    except Exception as e:
        print(f"[MongoDB Atlas Warning] Connection error: {e}")

    # 2. Resilient local fallback if local mongod is available
    local_uri = "mongodb://127.0.0.1:27017/lifeline"
    try:
        print(f"[MongoDB Resilience] Checking local MongoDB instance at mongodb://127.0.0.1:27017/{db_name} ...")
        local_client = create_client(local_uri)
        is_local_ok, local_msg = ping_db(local_client)
        if is_local_ok:
            _client = local_client
            _db = _client[db_name]
            _active_uri = local_uri
            print(f"[MongoDB Local Fallback] Connected to local MongoDB '{db_name}'. App remains operational while Atlas IP is whitelisted.")
            init_indexes(_db)
            return _db
    except Exception as le:
        print(f"[MongoDB Local Notice] Local fallback unavailable: {le}")

    # 3. If local fallback also not available, keep the Atlas client object so reconnect attempts can proceed
    if '_client' not in globals() or _client is None:
        _client = create_client(primary_uri)
        _db = _client[db_name]
        _active_uri = primary_uri

    return _db

def close_db():
    """Closes the MongoDB client connection cleanly during shutdown."""
    global _client, _db, _active_uri
    if _client is not None:
        try:
            _client.close()
            print("[MongoDB] Database connection closed successfully.")
        except Exception as e:
            print(f"[MongoDB] Error closing database connection: {e}")
        finally:
            _client = None
            _db = None
            _active_uri = None

def init_indexes(db):
    """Ensures unique and query-optimizing indexes exist on all collections."""
    try:
        # Users indexes
        db.users.create_index([("email", ASCENDING)], unique=True)
        db.users.create_index([("role", ASCENDING)])
        db.users.create_index([("status", ASCENDING)])
        db.users.create_index([("city", ASCENDING)])
        db.users.create_index([("state", ASCENDING)])

        # Donors indexes
        db.donors.create_index([("userId", ASCENDING)], unique=True)
        db.donors.create_index([("bloodGroup", ASCENDING)])
        db.donors.create_index([("city", ASCENDING)])
        db.donors.create_index([("state", ASCENDING)])
        db.donors.create_index([("availability", ASCENDING)])
        db.donors.create_index([("verificationStatus", ASCENDING)])
        db.donors.create_index([("bloodGroup", ASCENDING), ("city", ASCENDING), ("availability", ASCENDING)])
        db.donors.create_index([("bloodGroup", ASCENDING), ("state", ASCENDING), ("availability", ASCENDING)])

        # Blood Requests indexes
        db.blood_requests.create_index([("bloodGroup", ASCENDING)])
        db.blood_requests.create_index([("city", ASCENDING)])
        db.blood_requests.create_index([("state", ASCENDING)])
        db.blood_requests.create_index([("urgency", ASCENDING)])
        db.blood_requests.create_index([("status", ASCENDING)])
        db.blood_requests.create_index([("requesterId", ASCENDING)])
        db.blood_requests.create_index([("createdAt", DESCENDING)])

        # Donations indexes
        db.donations.create_index([("donationId", ASCENDING)], unique=True)
        db.donations.create_index([("donorId", ASCENDING)])
        db.donations.create_index([("requestId", ASCENDING)])
        db.donations.create_index([("status", ASCENDING)])
        db.donations.create_index([("donationDate", DESCENDING)])

        # Hospitals indexes
        db.hospitals.create_index([("userId", ASCENDING)], unique=True)
        db.hospitals.create_index([("city", ASCENDING)])
        db.hospitals.create_index([("state", ASCENDING)])

        # Notifications indexes
        db.notifications.create_index([("recipientId", ASCENDING), ("createdAt", DESCENDING)])
        db.notifications.create_index([("recipientId", ASCENDING), ("isRead", ASCENDING)])

        # Admin Logs indexes
        db.admin_logs.create_index([("createdAt", DESCENDING)])

        # Health Screenings indexes
        db.health_screenings.create_index([("requestId", ASCENDING)])
        db.health_screenings.create_index([("donorId", ASCENDING)])
        db.health_screenings.create_index([("donorUserId", ASCENDING)])
        db.health_screenings.create_index([("status", ASCENDING)])
        db.health_screenings.create_index([("createdAt", DESCENDING)])
        
        print("[MongoDB] Indexes initialized successfully.")
    except Exception as e:
        print(f"[MongoDB] Note on indexes: {e}")

def serialize_doc(doc):
    """Recursively converts MongoDB ObjectId and datetime to JSON serializable formats."""
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize_doc(item) for item in doc]
    if isinstance(doc, dict):
        result = {}
        for k, v in doc.items():
            if k == '_id':
                result['id'] = str(v)
                result['_id'] = str(v)
            elif isinstance(v, ObjectId):
                result[k] = str(v)
            elif isinstance(v, datetime):
                result[k] = v.isoformat()
            elif isinstance(v, dict) or isinstance(v, list):
                result[k] = serialize_doc(v)
            else:
                result[k] = v
        return result
    if isinstance(doc, ObjectId):
        return str(doc)
    if isinstance(doc, datetime):
        return doc.isoformat()
    return doc
