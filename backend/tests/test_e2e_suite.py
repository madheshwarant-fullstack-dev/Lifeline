import urllib.request
import json
import time

BASE_URL = "http://127.0.0.1:5000/api"

def make_request(endpoint, method="GET", data=None, token=None):
    url = f"{BASE_URL}{endpoint}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    encoded_data = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=encoded_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.getcode(), json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode("utf-8"))

def test_full_system():
    print("====================================================")
    print("BLOODCONNECT SYSTEM INTEGRATION & VERIFICATION SUITE")
    print("====================================================")

    # 1. Health check
    code, res = make_request("/health")
    assert code == 200 and res["success"], f"Health check failed: {res}"
    print("[PASS] 1. Backend Health Check Online")

    # 2. Admin Login
    code, res = make_request("/auth/login", method="POST", data={
        "email": "admin@bloodconnect.org",
        "password": "AdminPassword123!"
    })
    assert code == 200, f"Admin login failed: {res}"
    admin_token = res["data"]["token"]
    admin_user = res["data"]["user"]
    assert admin_user["role"] == "ADMIN"
    print(f"[PASS] 2. Admin Authentication (JWT generated, Role: {admin_user['role']})")

    # 3. Role Restriction Check: Non-admin accessing admin route
    # Let's register a fresh donor
    unique_ts = int(time.time())
    donor_email = f"testdonor_{unique_ts}@bloodconnect.org"
    code, res = make_request("/auth/register", method="POST", data={
        "name": "Pooja Sharma",
        "email": donor_email,
        "phone": "+91 98111 22222",
        "password": "Password123!",
        "role": "DONOR",
        "bloodGroup": "O-",
        "state": "Maharashtra",
        "city": "Mumbai",
        "dateOfBirth": "1995-01-01",
        "gender": "Female",
        "address": "123 Marine Lines, Mumbai"
    })
    assert code == 201, f"Donor registration failed: {res}"
    donor_token = res["data"]["token"]
    donor_user = res["data"]["user"]
    print(f"[PASS] 3. Donor Registration ({donor_email}, Blood Group: O-)")

    # Attempt accessing /api/admin/dashboard with donor_token -> Must return 403 Forbidden
    code, res = make_request("/admin/dashboard", token=donor_token)
    assert code == 403, f"Expected 403 Forbidden for donor accessing admin, got {code}: {res}"
    print("[PASS] 4. Role-Based Authorization Guard (Donor blocked from Admin APIs with 403)")

    # 4. Requester Registration & Request Creation
    req_email = f"testreq_{unique_ts}@bloodconnect.org"
    code, res = make_request("/auth/register", method="POST", data={
        "name": "Karan Malhotra",
        "email": req_email,
        "phone": "+91 98333 44444",
        "password": "Password123!",
        "role": "REQUESTER",
        "state": "Maharashtra",
        "city": "Mumbai",
        "address": "456 Bandra West, Mumbai"
    })
    assert code == 201, f"Requester registration failed: {res}"
    requester_token = res["data"]["token"]
    print(f"[PASS] 5. Requester Registration ({req_email})")

    # Create EMERGENCY blood request for O+
    code, res = make_request("/requests", method="POST", data={
        "patientName": "Aarav Sundaram (ICU)",
        "bloodGroup": "O+",
        "unitsRequired": 2,
        "hospitalName": "Lilavati Hospital & Research Centre",
        "hospitalAddress": "A-791, Bandra Reclamation",
        "state": "Maharashtra",
        "city": "Mumbai",
        "contactNumber": "+91 98987 65432",
        "requiredDate": "2026-10-15",
        "urgency": "EMERGENCY",
        "additionalMessage": "Critical trauma unit patient needing urgent matching."
    }, token=requester_token)
    assert code == 201, f"Emergency request creation failed: {res}"
    request_data = res["data"]
    request_id = request_data["id"]
    assert request_data["urgency"] == "EMERGENCY"
    print(f"[PASS] 6. Emergency Blood Request Created (ID: {request_id}, Urgency: EMERGENCY)")

    # 5. Algorithmic Donor Matching Verification
    code, res = make_request(f"/matching/{request_id}")
    assert code == 200, f"Matching engine call failed: {res}"
    matching_info = res["data"]
    matches = matching_info["matches"]
    assert len(matches) > 0, "Expected at least 1 matched donor"
    top_match = matches[0]
    assert "matchScore" in top_match, "Match score missing"
    assert "disclaimer" in matching_info, "Medical disclaimer missing"
    print(f"[PASS] 7. Smart Matching Engine ({len(matches)} donors matched, Top Match: {top_match['name']} with {top_match['matchScore']}%)")
    print(f"       Medical Disclaimer: '{matching_info['disclaimer'][:65]}...'")

    # 6. Donor Notifications check
    code, res = make_request("/notifications", token=donor_token)
    assert code == 200, f"Notifications load failed: {res}"
    notifs = res["data"]["notifications"]
    print(f"[PASS] 8. Notification Center (Donor has {len(notifs)} notification(s))")

    # 7. Donor Accepts Request Flow
    code, res = make_request(f"/donors/requests/{request_id}/respond", method="POST", data={
        "action": "ACCEPT"
    }, token=donor_token)
    assert code == 200, f"Donor response failed: {res}"
    print(f"[PASS] 9. Donor Accepted Blood Request (Response: {res['message']})")

    # Verify Request Status updated to ACCEPTED
    code, res = make_request(f"/requests/{request_id}")
    assert code == 200
    assert res["data"]["status"] == "ACCEPTED"
    print(f"[PASS] 10. Status Workflow Progression (Request status is now: {res['data']['status']})")

    # 8. Transfusion Completion & Donation Logging
    code, res = make_request(f"/requests/{request_id}/status", method="PUT", data={
        "status": "DONATION_COMPLETED"
    }, token=requester_token)
    assert code == 200
    assert res["data"]["status"] == "DONATION_COMPLETED"
    print(f"[PASS] 11. Donation Completed & Signed Off by Hospital")

    # 9. Verify Admin Dashboard & Reports
    code, res = make_request("/admin/dashboard", token=admin_token)
    assert code == 200
    admin_dash = res["data"]
    assert admin_dash["stats"]["totalUsers"] >= 3
    assert admin_dash["stats"]["totalRequests"] >= 1
    assert "bloodGroupDistribution" in admin_dash["charts"]
    print(f"[PASS] 12. Admin Dashboard Live Telemetry ({admin_dash['stats']['totalUsers']} Total Users, {admin_dash['stats']['totalRequests']} Requests)")

    # 10. Admin Reports API
    code, res = make_request("/admin/reports", token=admin_token)
    assert code == 200
    print(f"[PASS] 13. Operational Compliance Report (Fulfillment Rate: {res['data']['fulfillmentRate']}%)")

    # 11. Public Platform Live Telemetry Statistics (/api/stats)
    code, res = make_request("/stats")
    assert code == 200 and res["success"]
    stats_data = res["data"]
    assert stats_data["totalDonors"] >= 1
    assert stats_data["totalRequests"] >= 1
    assert "successfulDonations" in stats_data
    print(f"[PASS] 14. Public Platform Live Telemetry API (/api/stats: {stats_data['totalDonors']} Donors, {stats_data['totalRequests']} Requests, {stats_data['successfulDonations']} Successful Donations)")

    # 12. Public Donor Search & Privacy Protection
    code, res = make_request("/donors?bloodGroup=O-")
    assert code == 200
    donors_list = res["data"]
    assert len(donors_list) > 0
    sample_donor = donors_list[0]
    # Verify phone is masked for privacy protection
    assert "•••••" in sample_donor.get("phone", "") or sample_donor.get("isPhoneMasked")
    assert sample_donor.get("emergencyContact") is None
    print(f"[PASS] 15. Public Donor Search & Privacy Protection (Phone masked: {sample_donor['phone']})")

    # 13. Donor Availability Toggle
    code, res = make_request("/donors/availability", method="POST", data={"availability": False}, token=donor_token)
    assert code == 200
    assert res["data"]["availability"] is False
    # Toggle back
    code, res = make_request("/donors/availability", method="POST", data={"availability": True}, token=donor_token)
    assert code == 200
    assert res["data"]["availability"] is True
    print("[PASS] 16. Donor Availability Real-time Toggle API")

    # 14. Status Workflow (APPROVED & FULFILLED)
    # Create request and update to APPROVED, then FULFILLED
    code, res = make_request("/requests", method="POST", data={
        "patientName": "Sunita Verma",
        "bloodGroup": "B+",
        "unitsRequired": 1,
        "hospitalName": "Apollo Hospital",
        "state": "Maharashtra",
        "city": "Mumbai",
        "contactNumber": "+91 98222 33333",
        "requiredDate": "2026-10-28",
        "urgency": "NORMAL"
    }, token=requester_token)
    assert code == 201
    test_req_id = res["data"]["id"]

    code, res = make_request(f"/requests/{test_req_id}/status", method="PUT", data={"status": "APPROVED"}, token=admin_token)
    assert code == 200
    assert res["data"]["status"] == "APPROVED"

    code, res = make_request(f"/requests/{test_req_id}/status", method="PUT", data={"status": "FULFILLED"}, token=admin_token)
    assert code == 200
    assert res["data"]["status"] == "FULFILLED"
    print(f"[PASS] 17. Blood Request Status Transition (Pending -> Approved -> Fulfilled)")

    print("====================================================")
    print("ALL 17 END-TO-END VERIFICATION CHECKS PASSED PERFECTLY!")
    print("====================================================")

if __name__ == "__main__":
    test_full_system()
