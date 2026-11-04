import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import time
import json
from app import create_app

def run_screening_workflow_test():
    print("\n========================================================")
    print("RUNNING LIFELINE HEALTH SCREENING WORKFLOW END-TO-END TEST")
    print("========================================================\n")

    app = create_app()
    client = app.test_client()

    # Step 1: Donor Registration (Only basic details, contact, blood group, location)
    ts = int(time.time())
    donor_email = f"donor_screen_{ts}@bloodconnect.org"
    donor_reg_data = {
        "name": f"Kavita Verma {ts}",
        "email": donor_email,
        "phone": "+91 98765 43210",
        "password": "DonorPassword123!",
        "role": "DONOR",
        "bloodGroup": "O+",
        "state": "Maharashtra",
        "city": "Mumbai",
        "dateOfBirth": "1996-05-15",
        "gender": "Female",
        "address": "45 Linking Road, Bandra West, Mumbai"
        # Notice: NO health questions, medicines, tattoos, or medical history
    }

    res = client.post("/api/auth/register", json=donor_reg_data)
    assert res.status_code == 201, f"Registration failed: {res.data}"
    donor_data = json.loads(res.data)["data"]
    donor_token = donor_data["token"]
    donor_user = donor_data["user"]
    print(f"[PASS] 1. Donor Registration completed without any health/medical questions (User ID: {donor_user['id']})")

    # Step 2: Requester creates a blood request
    req_login = client.post("/api/auth/login", json={
        "email": "requester@bloodconnect.org",
        "password": "Requester123!"
    })
    assert req_login.status_code == 200, f"Requester login failed: {req_login.data}"
    requester_token = json.loads(req_login.data)["data"]["token"]

    create_req_res = client.post(
        "/api/requests",
        headers={"Authorization": f"Bearer {requester_token}"},
        json={
            "patientName": f"Patient Rajan {ts}",
            "bloodGroup": "O+",
            "unitsRequired": 2,
            "hospitalName": "Lilavati Hospital & Research Centre",
            "hospitalAddress": "A-791, Bandra Reclamation, Bandra West",
            "city": "Mumbai",
            "state": "Maharashtra",
            "contactNumber": "+91 98200 11223",
            "requiredDate": "2026-11-05",
            "urgency": "HIGH",
            "additionalMessage": "Scheduled cardiovascular surgery replacement reserve"
        }
    )
    assert create_req_res.status_code == 201, f"Request creation failed: {create_req_res.data}"
    created_request = json.loads(create_req_res.data)["data"]
    request_id = created_request["id"]
    print(f"[PASS] 2. Matching Blood Request created for O+ (Request ID: {request_id})")

    # Step 3: Donor accepts the request
    accept_res = client.post(
        f"/api/donors/requests/{request_id}/respond",
        headers={"Authorization": f"Bearer {donor_token}"},
        json={"action": "ACCEPT"}
    )
    assert accept_res.status_code == 200, f"Accept request failed: {accept_res.data}"
    accept_data = json.loads(accept_res.data)["data"]
    assert accept_data.get("screeningRequired") is True
    print(f"[PASS] 3. Donor accepted blood request. Action indicates Proceed to Donation Screening: {accept_data['message']}")

    # Step 4: Verify health screening has NOT yet been submitted
    dash_res = client.get(
        "/api/donors/dashboard",
        headers={"Authorization": f"Bearer {donor_token}"}
    )
    assert dash_res.status_code == 200
    dash_data = json.loads(dash_res.data)["data"]
    active_reqs = dash_data.get("activeAcceptedRequests", [])
    matched_req = next((r for r in active_reqs if r["id"] == request_id), None)
    assert matched_req is not None
    assert matched_req.get("hasScreening") is False
    assert matched_req.get("screeningStatus") == "NOT_SUBMITTED"
    print("[PASS] 4. Donor Dashboard confirms request is accepted with screeningStatus='NOT_SUBMITTED'")

    # Step 5: Test Validation - Missing follow-up or declaration failure
    bad_screening_res = client.post(
        "/api/screenings",
        headers={"Authorization": f"Bearer {donor_token}"},
        json={
            "requestId": request_id,
            "answers": {
                "healthIssues": {"answer": "YES", "details": ""}, # Missing details
                "medications": {"answer": "NO"},
                "tattooPiercing": {"answer": "NO"},
                "surgery": {"answer": "NO"},
                "feverInfection": {"answer": "NO"}
            },
            "declaration": True
        }
    )
    assert bad_screening_res.status_code == 400
    print("[PASS] 5. Validation properly rejects 'YES' answers without follow-up details")

    # Step 6: Submit 5-Question Pre-Donation Health Screening
    screening_payload = {
        "requestId": request_id,
        "answers": {
            "healthIssues": {
                "answer": "YES",
                "details": "Mild seasonal flu 2 months ago, fully recovered after 3 days without hospital admission."
            },
            "medications": {
                "answer": "YES",
                "details": "Took Paracetamol 500mg 2 weeks ago for mild headache."
            },
            "tattooPiercing": {
                "answer": "YES",
                "details": "Ear piercing performed 4 months ago at licensed professional clinic, completely healed."
            },
            "surgery": {
                "answer": "NO",
                "details": ""
            },
            "feverInfection": {
                "answer": "NO",
                "details": ""
            }
        },
        "declaration": True
    }

    submit_scr_res = client.post(
        "/api/screenings",
        headers={"Authorization": f"Bearer {donor_token}"},
        json=screening_payload
    )
    assert submit_scr_res.status_code == 201, f"Screening submission failed: {submit_scr_res.data}"
    screening_data = json.loads(submit_scr_res.data)["data"]
    screening_id = screening_data["id"]

    # Verify status and fields
    assert screening_data["status"] == "AWAITING_REVIEW"
    assert screening_data["hasFlaggedAnswers"] is True
    assert screening_data["medicalReview"]["decision"] == "PENDING"
    print(f"[PASS] 6. Screening submitted successfully (ID: {screening_id}, Status: 'Screening Submitted – Awaiting Medical Review')")
    print(f"        Answers flagged for clinical evaluation: {screening_data['hasFlaggedAnswers']}")
    print(f"        Automatic eligibility decision was NOT made; awaiting authorized staff review.")

    # Step 7: Duplicate Submission Prevention
    dup_res = client.post(
        "/api/screenings",
        headers={"Authorization": f"Bearer {donor_token}"},
        json=screening_payload
    )
    # Returns existing screening with message notice
    dup_body = json.loads(dup_res.data)
    assert "already been submitted" in dup_body.get("message", "")
    print("[PASS] 7. Duplicate submission prevented appropriately.")

    # Step 8: Privacy Check - Requester should NOT see raw medical answers
    req_scr_res = client.get(
        f"/api/screenings/request/{request_id}",
        headers={"Authorization": f"Bearer {requester_token}"}
    )
    assert req_scr_res.status_code == 200
    req_scr_data = json.loads(req_scr_res.data)["data"]
    assert req_scr_data.get("answers") is None, "Sensitive answers leaked to requester!"
    print("[PASS] 8. Privacy protection verified: Sensitive medical answers are stripped for non-medical users.")

    # Step 9: Authorized Medical Staff Review (Admin Dr. Sarah Sharma)
    admin_login = client.post("/api/auth/login", json={
        "email": "admin@bloodconnect.org",
        "password": "AdminPassword123!"
    })
    assert admin_login.status_code == 200
    admin_token = json.loads(admin_login.data)["data"]["token"]

    # Admin lists screenings
    admin_scr_list = client.get(
        "/api/screenings?status=AWAITING_REVIEW",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert admin_scr_list.status_code == 200
    screenings_list = json.loads(admin_scr_list.data)["data"]
    found = any(s["id"] == screening_id for s in screenings_list)
    assert found, "Submitted screening not in admin pending list"
    print(f"[PASS] 9. Authorized medical personnel retrieved screening queue ({len(screenings_list)} pending)")

    # Admin reviews and approves eligibility with clinical rationale and hospital instructions
    review_payload = {
        "decision": "APPROVED",
        "notes": "Clinically reviewed reported seasonal flu, paracetamol 2 weeks ago, and healed ear piercing. In accordance with blood transfusion safety criteria, donor is in good health and cleared for whole blood donation.",
        "hospitalInstructions": "Report to Lilavati Hospital Blood Bank, 2nd Floor Room 204. Carry photo ID and donor card. Hydrate well prior to draw."
    }

    review_res = client.put(
        f"/api/screenings/{screening_id}/review",
        headers={"Authorization": f"Bearer {admin_token}"},
        json=review_payload
    )
    assert review_res.status_code == 200, f"Review submission failed: {review_res.data}"
    reviewed_scr = json.loads(review_res.data)["data"]
    assert reviewed_scr["status"] == "APPROVED"
    assert reviewed_scr["medicalReview"]["decision"] == "APPROVED"
    assert reviewed_scr["medicalReview"]["notes"] == review_payload["notes"]
    print("[PASS] 10. Authorized medical staff recorded final eligibility decision: APPROVED")

    # Step 11: Verify Request and Donor Next Steps / Hospital Coordination
    donor_scr_res = client.get(
        f"/api/screenings/request/{request_id}",
        headers={"Authorization": f"Bearer {donor_token}"}
    )
    assert donor_scr_res.status_code == 200
    donor_scr = json.loads(donor_scr_res.data)["data"]
    assert donor_scr["status"] == "APPROVED"
    assert donor_scr["medicalReview"]["hospitalInstructions"] == review_payload["hospitalInstructions"]
    print(f"[PASS] 11. Donor received medical clearance and hospital instructions: '{donor_scr['medicalReview']['hospitalInstructions']}'")

    # Step 12: Hospital Staff / Admin Confirms Physical Donation Completion
    confirm_res = client.post(
        f"/api/screenings/{screening_id}/confirm",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "units": 2,
            "notes": "Whole blood donation successfully collected and verified at Lilavati Hospital transfusion lab."
        }
    )
    assert confirm_res.status_code == 200, f"Confirm donation failed: {confirm_res.data}"
    confirm_data = json.loads(confirm_res.data)["data"]
    assert "donation" in confirm_data
    assert confirm_data["donation"]["status"] == "COMPLETED"
    print(f"[PASS] 12. Transfusion concluded: Donation record {confirm_data['donation']['donationId']} created (Status: COMPLETED)")

    print("\n========================================================")
    print("ALL 12 PRE-DONATION SCREENING WORKFLOW TESTS PASSED!")
    print("========================================================\n")

if __name__ == "__main__":
    run_screening_workflow_test()
