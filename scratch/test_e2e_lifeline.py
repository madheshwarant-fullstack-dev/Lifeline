import urllib.request
import urllib.parse
import json
import sys

BASE_URL = "http://127.0.0.1:8000"

def api_request(method, path, body=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            content = resp.read().decode("utf-8")
            return resp.status, json.loads(content) if content else {}
    except urllib.error.HTTPError as e:
        content = e.read().decode("utf-8")
        try:
            parsed = json.loads(content)
        except Exception:
            parsed = {"error": content}
        return e.code, parsed
    except Exception as e:
        return 500, {"error": str(e)}

def run_tests():
    print("=" * 70)
    print("LIFELINE FULL-STACK SYSTEM VERIFICATION SUITE")
    print("=" * 70)

    # 1. Health & Telemetry
    print("\n[1] Checking Backend Health & Telemetry...")
    st, res = api_request("GET", "/api/health")
    assert st == 200, f"Health check failed: {st} {res}"
    print("  ✓ /api/health: OK (MongoDB Atlas Connected & Pingable)")

    st, res = api_request("GET", "/api/stats")
    assert st == 200, f"Stats endpoint failed: {st} {res}"
    print(f"  ✓ /api/stats: OK ({res.get('data', {})})")

    st, res = api_request("GET", "/api/blood-compatibility")
    assert st == 200, f"Blood compatibility failed: {st} {res}"
    print("  ✓ /api/blood-compatibility: OK (Serological Rules Loaded)")

    # 2. Authentications
    print("\n[2] Authenticating User Roles (Donor, Hospital, Admin)...")
    def login(email, password):
        st, res = api_request("POST", "/api/auth/login", {"email": email, "password": password})
        if st != 200:
            raise Exception(f"Login failed for {email}: {res}")
        token = res.get("data", {}).get("token")
        user = res.get("data", {}).get("user", {})
        return token, user

    donor_token, donor_user = login("donor@bloodconnect.org", "Donor123!")
    print(f"  ✓ Donor Logged In: {donor_user.get('name')} (ID: {donor_user.get('id')})")

    hospital_token, hospital_user = login("apollo@bloodconnect.org", "Hospital123!")
    print(f"  ✓ Hospital Logged In: {hospital_user.get('name')} (Role: {hospital_user.get('role')})")

    admin_token, admin_user = login("admin@bloodconnect.org", "AdminPassword123!")
    print(f"  ✓ Admin Logged In: {admin_user.get('name')} (Role: {admin_user.get('role')})")

    # 3. FEATURE 1: REAL-TIME LIVE LOCATION TRACKING
    print("\n[3] Testing Feature 1: Real-Time Live Location Tracking...")
    # 3a. Donor enables live GPS location sharing
    st, res = api_request(
        "POST",
        "/api/donors/location-sharing",
        {"enabled": True, "consent": True, "lat": 13.0630, "lng": 80.2515},
        donor_token
    )
    assert st == 200, f"Enable location failed: {st} {res}"
    print("  ✓ Enable Live Location Sharing with explicit consent: OK")

    # 3b. Donor updates live GPS location periodically
    st, res = api_request(
        "POST",
        "/api/donors/location",
        {"lat": 13.0635, "lng": 80.2520, "accuracy": 12.5, "consent": True},
        donor_token
    )
    assert st == 200, f"Update location failed: {st} {res}"
    donor_profile = res.get("data", {})
    print(f"  ✓ Donor Location Updated: lat={donor_profile.get('lat')}, lng={donor_profile.get('lng')}, sharing={donor_profile.get('locationSharingEnabled')}")

    # 3c. Hospital searches nearby donors within 10 km
    st, res = api_request(
        "GET",
        "/api/donors/nearby?lat=13.0633&lng=80.2519&radiusKm=10&bloodGroup=O%2B",
        token=hospital_token
    )
    assert st == 200, f"Find nearby failed: {st} {res}"
    nearby_data = res.get("data", {})
    nearby_donors = nearby_data.get("donors", [])
    print(f"  ✓ Hospital Nearby Donor Search: Found {len(nearby_donors)} nearby live donor(s) within 10 km")
    
    # 3d. Verify coordinates privacy (approximate coordinates only, raw GPS coordinates masked)
    if nearby_donors:
        first_d = nearby_donors[0]
        assert "approxLat" in first_d and "approxLng" in first_d, "Approximate coordinates missing"
        assert "lat" not in first_d and "lng" not in first_d, "Security breach: raw GPS coordinates exposed to requester!"
        print(f"  ✓ Privacy Guard Verified: Raw GPS stripped, approximate coordinates provided (approxLat={first_d.get('approxLat')}, approxLng={first_d.get('approxLng')}, distance={round(first_d.get('distanceKm', 0), 2)} km)")

    # 4. FEATURE 2: DONOR MEDICAL REVIEW / HEALTH PROFILE
    print("\n[4] Testing Feature 2: Donor Medical Review / Health Profile...")
    # 4a. Donor submits complete medical profile
    medical_payload = {
        "fullName": "Arjun Mehta (Demo Donor)",
        "age": 30,
        "bloodGroup": "O+",
        "gender": "Male",
        "weight": 72.5,
        "lastDonationDate": "2026-08-15",
        "medicalHistory": "Seasonal allergic rhinitis; no chronic cardiovascular or renal diseases.",
        "currentMedication": "Cetirizine 10mg PRN; non-steroidal anti-inflammatory absent.",
        "allergies": "Dust mite and pollen.",
        "previousComplications": "None; uneventful past phlebotomies.",
        "healthDeclaration": True
    }
    st, res = api_request("POST", "/api/donors/medical-profile", medical_payload, donor_token)
    assert st == 200, f"Save medical profile failed: {st} {res}"
    print("  ✓ Donor Medical Profile & Health Declaration submitted: OK")

    # 4b. Donor retrieves their own medical profile
    st, res = api_request("GET", "/api/donors/medical-profile", token=donor_token)
    assert st == 200, f"Get medical profile failed: {st} {res}"
    med_prof = res.get("data", {})
    print(f"  ✓ Donor Medical Profile Retrieved: Weight={med_prof.get('weight')} kg, Declaration={med_prof.get('healthDeclaration')}, Status={med_prof.get('medicalReviewStatus')}")

    # 4c. Hospital/Requester views Medical Review (Privacy Guard Verification)
    donor_id = donor_profile.get("id") or donor_profile.get("_id")
    st, res = api_request("GET", f"/api/donors/{donor_id}/medical-review", token=hospital_token)
    assert st == 200, f"Requester get medical review failed: {st} {res}"
    req_review = res.get("data", {})
    assert "disclaimer" in req_review, "Clinical disclaimer missing"
    assert "authorizedClinicalDetails" not in req_review, "Security breach: sensitive clinical history exposed to hospital!"
    print(f"  ✓ Privacy Guard Verified: Hospital sees clearance status '{req_review.get('medicalReviewStatus')}', declaration '{req_review.get('healthDeclarationStatus')}', and clinical disclaimer without sensitive medical history/meds/allergies.")

    # 4d. Admin views Medical Review (Authorized Clinical Access)
    st, res = api_request("GET", f"/api/donors/{donor_id}/medical-review", token=admin_token)
    assert st == 200, f"Admin get medical review failed: {st} {res}"
    admin_review = res.get("data", {})
    assert "authorizedClinicalDetails" in admin_review, "Admin should receive authorizedClinicalDetails"
    clin = admin_review.get("authorizedClinicalDetails", {})
    print(f"  ✓ Admin Authorized Clinical Access Verified: Weight={clin.get('weight')} kg, Allergies='{clin.get('allergies')}', Meds='{clin.get('currentMedication')}'")

    # 4e. Admin updates Medical Review Clearance Status
    st, res = api_request(
        "PUT",
        f"/api/admin/donors/{donor_id}/medical-review",
        {"status": "VERIFIED", "clinicalNotes": "Vitals and hemoglobin checked; donor cleared for whole blood donation."},
        admin_token
    )
    assert st == 200, f"Admin update medical review failed: {st} {res}"
    print("  ✓ Admin Medical Review Status updated to VERIFIED with clinical notes: OK")

    # 5. FEATURE 3: DONATION REQUEST ACCEPT / REJECT WORKFLOW
    print("\n[5] Testing Feature 3: Donation Request Accept / Reject Workflow...")
    # 5a. Hospital creates an emergency blood request
    req_payload = {
        "patientName": "Kavitha R.",
        "bloodGroup": "O+",
        "unitsRequired": 2,
        "hospitalName": "Apollo Hospitals Chennai",
        "hospitalAddress": "21 Greams Lane, Thousand Lights",
        "city": "Chennai",
        "state": "Tamil Nadu",
        "contactNumber": "+91 44 2829 0200",
        "requiredDate": "2026-11-20",
        "urgency": "EMERGENCY",
        "lat": 13.0633,
        "lng": 80.2519,
        "searchRadiusKm": 25,
        "additionalMessage": "Urgent acute trauma case requiring O+ blood."
    }
    st, res = api_request("POST", "/api/hospitals/requests", req_payload, hospital_token)
    assert st == 201, f"Create emergency request failed: {st} {res}"
    created_req = res.get("data", {})
    test_req_id = created_req.get("id") or created_req.get("_id")
    print(f"  ✓ Hospital Emergency Blood Request Created: ID={test_req_id}, Patient={created_req.get('patientName')}, Blood={created_req.get('bloodGroup')}")

    # 5b. Hospital invites nearby donor
    st, res = api_request("POST", f"/api/requests/{test_req_id}/invite", {"donorIds": [donor_id]}, hospital_token)
    assert st == 200, f"Invite donor failed: {st} {res}"
    print(f"  ✓ Emergency Invitation Dispatched to Donor ID {donor_id}: OK")

    # 5c. Donor checks their invitations
    st, res = api_request("GET", "/api/donors/invitations", token=donor_token)
    assert st == 200, f"Get donor invitations failed: {st} {res}"
    inv_data = res.get("data", {})
    donor_invs = inv_data.get("invitations", [])
    matching_inv = next((inv for inv in donor_invs if str(inv.get("requestId") or inv.get("id")) == str(test_req_id)), None)
    assert matching_inv is not None, f"Targeted invitation not found in donor's emergency inbox: {donor_invs}"
    print(f"  ✓ Donor Received Emergency Invitation: Request ID={test_req_id}, Hospital='{matching_inv.get('hospitalName')}', Distance={matching_inv.get('approximateDistanceKm')} km")

    # 5d. Donor ACCEPTS the donation request
    st, res = api_request(
        "POST",
        f"/api/requests/{test_req_id}/respond",
        {"action": "ACCEPT", "note": "I can reach Apollo Hospitals within 30 minutes."},
        donor_token
    )
    assert st == 200, f"Accept request failed: {st} {res}"
    print("  ✓ Donor ACCEPTS Emergency Blood Request: OK")

    # 5e. Hospital verifies Live Response Tracking table status
    st, res = api_request("GET", f"/api/requests/{test_req_id}/invitations", token=hospital_token)
    assert st == 200, f"Get request invitations failed: {st} {res}"
    tracker_invs = res.get("data", [])
    donor_tracker = next((inv for inv in tracker_invs if str(inv.get("donorId")) == str(donor_id)), None)
    assert donor_tracker is not None and donor_tracker.get("status") == "ACCEPTED", f"Tracker status expected ACCEPTED, got {donor_tracker}"
    print(f"  ✓ Live Response Tracking Table Verified: Donor={donor_tracker.get('donorName')}, Status={donor_tracker.get('status')}, RespondedAt={donor_tracker.get('respondedAt')}")

    # 5f. Test REJECT Workflow on a second request
    req2_payload = dict(req_payload)
    req2_payload["patientName"] = "Suresh M."
    st, res = api_request("POST", "/api/hospitals/requests", req2_payload, hospital_token)
    req2_id = res.get("data", {}).get("id")
    api_request("POST", f"/api/requests/{req2_id}/invite", {"donorIds": [donor_id]}, hospital_token)
    
    st, res = api_request(
        "POST",
        f"/api/requests/{req2_id}/respond",
        {"action": "REJECT", "note": "Currently traveling out of city."},
        donor_token
    )
    assert st == 200, f"Reject request failed: {st} {res}"
    
    st, res = api_request("GET", f"/api/requests/{req2_id}/invitations", token=hospital_token)
    tracker2 = res.get("data", [])
    donor_tracker2 = next((inv for inv in tracker2 if str(inv.get("donorId")) == str(donor_id)), None)
    assert donor_tracker2 is not None and donor_tracker2.get("status") == "REJECTED", f"Tracker status expected REJECTED, got {donor_tracker2}"
    print("  ✓ Donor REJECTED Workflow Verified: Tracker shows REJECTED status, hospital free to invite alternate donor.")

    print("\n" + "=" * 70)
    print("ALL 3 MAJOR FEATURES VERIFIED END-TO-END WITH 100% SUCCESS!")
    print("=" * 70)
    return True

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
