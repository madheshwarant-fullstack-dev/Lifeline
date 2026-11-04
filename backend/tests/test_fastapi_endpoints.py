import sys
import os
import time

# Ensure backend directory is in python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from fastapi.testclient import TestClient
from main import app
from database.connection import get_db
from bson import ObjectId

def run_api_verification():
    print("=" * 65)
    print("LIFELINE FASTAPI & MONGODB ATLAS INTEGRATION TEST SUITE")
    print("=" * 65)

    client = TestClient(app)

    # 1. Test Swagger UI Documentation
    res = client.get("/docs")
    assert res.status_code == 200, f"/docs failed: {res.status_code}"
    assert "swagger-ui" in res.text.lower(), "Swagger UI HTML not rendered!"
    print("[PASS] 1. Swagger UI (/docs) online and accessible.")

    # 2. Test OpenAPI Specification
    res = client.get("/openapi.json")
    assert res.status_code == 200, f"/openapi.json failed: {res.status_code}"
    spec = res.json()
    assert spec["info"]["title"] == "Lifeline Blood Donation & Emergency Coordination API"
    paths_count = len(spec["paths"])
    print(f"[PASS] 2. OpenAPI Specification verified with {paths_count} registered API routes.")

    # 3. Test Health Check Endpoint
    res = client.get("/api/health")
    assert res.status_code == 200
    health_data = res.json()
    assert health_data["success"] is True
    print(f"[PASS] 3. Health Check: {health_data['data']['service']} is {health_data['data']['status']}")

    # 4. Test Public Statistics Endpoint
    res = client.get("/api/stats")
    assert res.status_code == 200
    stats_data = res.json()
    assert stats_data["success"] is True
    print(f"[PASS] 4. Platform Stats: Total Donors={stats_data['data']['totalDonors']}, Requests={stats_data['data']['totalRequests']}")

    # 5. Test Public Donors Listing & Search
    res = client.get("/api/donors")
    assert res.status_code == 200
    donors_res = res.json()
    assert donors_res["success"] is True
    print(f"[PASS] 5. Donors List Endpoint: Returned {len(donors_res['data'])} donor profiles.")

    # 6. Test User Registration
    unique_ts = int(time.time())
    donor_email = f"donor_api_test_{unique_ts}@lifeline.org"
    donor_payload = {
        "name": "Priya Ramanathan",
        "email": donor_email,
        "phone": "+91 98401 55555",
        "password": "DonorSecretPassword123!",
        "role": "DONOR",
        "bloodGroup": "O+",
        "city": "Chennai",
        "state": "Tamil Nadu",
        "dateOfBirth": "1995-05-15",
        "gender": "Female"
    }
    res = client.post("/api/auth/register", json=donor_payload)
    assert res.status_code == 201, f"Registration failed: {res.text}"
    reg_body = res.json()
    assert reg_body["success"] is True
    donor_token = reg_body["data"]["token"]
    donor_user_id = reg_body["data"]["user"]["id"]
    print(f"[PASS] 6. Donor Registration: Created account for {donor_email}")

    # 7. Test User Login
    res = client.post("/api/auth/login", json={
        "email": donor_email,
        "password": "DonorSecretPassword123!"
    })
    assert res.status_code == 200, f"Login failed: {res.text}"
    login_body = res.json()
    assert login_body["success"] is True
    assert "token" in login_body["data"]
    print("[PASS] 7. Donor Login: JWT Access Token successfully authenticated.")

    # 8. Test Protected Profile Route (/api/auth/me)
    headers = {"Authorization": f"Bearer {donor_token}"}
    res = client.get("/api/auth/me", headers=headers)
    assert res.status_code == 200, f"/auth/me failed: {res.text}"
    me_data = res.json()
    assert me_data["data"]["email"] == donor_email
    assert "password" not in me_data["data"], "Security issue: Password hash leaked in /auth/me"
    print("[PASS] 8. Protected Endpoint (/api/auth/me): User verified, credentials safely masked.")

    # 9. Test Role-Based Access Control (RBAC): Donor cannot access Admin Dashboard
    res = client.get("/api/admin/dashboard", headers=headers)
    assert res.status_code == 403, f"Expected 403 Forbidden for non-admin, got: {res.status_code}"
    print("[PASS] 9. RBAC Enforcement: Unauthorized role correctly blocked with HTTP 403.")

    # 10. Test Admin Authentication & Dashboard
    res = client.post("/api/auth/login", json={
        "email": "admin@bloodconnect.org",
        "password": "AdminPassword123!"
    })
    assert res.status_code == 200, f"Admin login failed: {res.text}"
    admin_token = res.json()["data"]["token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    res = client.get("/api/admin/dashboard", headers=admin_headers)
    assert res.status_code == 200, f"Admin dashboard failed: {res.text}"
    admin_dash = res.json()["data"]
    assert "stats" in admin_dash and "charts" in admin_dash
    print(f"[PASS] 10. Admin Cockpit: Admin authenticated, dashboard charts loaded.")

    # 11. Test Blood Request Creation & Matching
    req_payload = {
        "patientName": "Aravind Swaminathan",
        "bloodGroup": "O+",
        "unitsRequired": 1,
        "hospitalName": "Kauvery Hospital",
        "hospitalAddress": "199 Luz Church Road, Mylapore",
        "city": "Chennai",
        "state": "Tamil Nadu",
        "contactNumber": "+91 98401 55555",
        "urgency": "HIGH"
    }
    res = client.post("/api/requests", json=req_payload, headers=headers)
    assert res.status_code == 201, f"Create request failed: {res.text}"
    created_req = res.json()["data"]
    req_id = created_req["id"]
    print(f"[PASS] 11. Blood Request Created: ID={req_id}, BloodGroup={created_req['bloodGroup']}")

    # 12. Test Algorithmic Matching Route
    res = client.get(f"/api/matching/{req_id}")
    assert res.status_code == 200, f"Matching failed: {res.text}"
    matches_body = res.json()["data"]
    assert "matches" in matches_body
    print(f"[PASS] 12. Algorithmic Matching: Found {len(matches_body['matches'])} compatible donors.")

    # 13. Test Notifications
    res = client.get("/api/notifications", headers=headers)
    assert res.status_code == 200
    notifs = res.json()["data"]
    print(f"[PASS] 13. Notifications: User has {len(notifs['notifications'])} notifications.")

    # 14. Clean up test data
    db = get_db()
    db.blood_requests.delete_one({"_id": ObjectId(req_id)})
    db.donors.delete_many({"userId": donor_user_id})
    db.users.delete_one({"_id": ObjectId(donor_user_id)})
    print("[PASS] 14. Test records cleaned up successfully.")

    print("=" * 65)
    print("ALL FASTAPI & MONGODB INTEGRATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 65)

if __name__ == "__main__":
    run_api_verification()
