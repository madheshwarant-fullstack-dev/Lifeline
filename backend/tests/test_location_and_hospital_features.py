import unittest
import math
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timezone
from database.connection import get_db
from services.auth_service import register_user
from services.matching_service import haversine_distance_km, calculate_match_score, find_matched_donors_for_request
from services.donor_service import update_donor_profile, get_donor_by_user_id
from services.request_service import create_blood_request

class TestLocationAndHospitalFeatures(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = get_db()

    def test_01_haversine_distance_calculation(self):
        # Mumbai (18.9220, 72.8347) to Pune (18.5204, 73.8567) is approx 120-130 km
        dist = haversine_distance_km(18.9220, 72.8347, 18.5204, 73.8567)
        self.assertIsNotNone(dist)
        self.assertGreater(dist, 100)
        self.assertLess(dist, 150)

        # Same location should be 0.0 km
        self.assertEqual(haversine_distance_km(13.0827, 80.2707, 13.0827, 80.2707), 0.0)

    def test_02_travelling_donor_location_preference(self):
        ts = int(datetime.now().timestamp())
        res, err = register_user({
            "name": f"Travelling Donor {ts}",
            "email": f"travel_{ts}@bloodconnect.org",
            "phone": "+91 98999 11111",
            "password": "Password123!",
            "role": "DONOR",
            "bloodGroup": "O-",
            "city": "Chennai",
            "state": "Tamil Nadu"
        })
        self.assertIsNone(err)
        user_id = str(res["user"]["id"])

        # Update current travelling location to Mumbai
        updated = update_donor_profile(user_id, {
            "matchingLocationPreference": "CURRENT",
            "currentDonationLocation": {
                "city": "Mumbai",
                "state": "Maharashtra",
                "pinCode": "400001",
                "lat": 18.9220,
                "lng": 72.8347
            }
        })
        self.assertEqual(updated["matchingLocationPreference"], "CURRENT")
        self.assertEqual(updated["currentDonationLocation"]["city"], "Mumbai")

        # Create a blood request in Mumbai
        donor_doc = cls = self.db.donors.find_one({"userId": user_id})
        score, breakdown, dist = calculate_match_score(
            donor_doc,
            patient_blood_group="O-",
            request_city="Mumbai",
            request_state="Maharashtra",
            req_lat=18.9250,
            req_lng=72.8350
        )
        self.assertGreater(score, 70)
        self.assertIn("Current Travelling Location", breakdown)

    def test_03_unavailable_donor_excluded_from_matching(self):
        ts = int(datetime.now().timestamp())
        res, err = register_user({
            "name": f"Busy Donor {ts}",
            "email": f"busy_{ts}@bloodconnect.org",
            "phone": "+91 98888 22222",
            "password": "Password123!",
            "role": "DONOR",
            "bloodGroup": "A+",
            "city": "Bengaluru",
            "state": "Karnataka"
        })
        self.assertIsNone(err)
        user_id = str(res["user"]["id"])

        # Mark donor as unavailable
        update_donor_profile(user_id, {"availability": False})
        donor_doc = self.db.donors.find_one({"userId": user_id})

        score, breakdown, _ = calculate_match_score(donor_doc, "A+", "Bengaluru", "Karnataka")
        self.assertEqual(score, 0)
        self.assertIn("unavailable", breakdown.lower())

    def test_04_hospital_verification_and_request_creation(self):
        ts = int(datetime.now().timestamp())
        # 1. Register new hospital (unverified by default)
        res, err = register_user({
            "name": f"City Hospital {ts}",
            "hospitalName": f"City Care Hospital {ts}",
            "representativeName": "Dr. A. Sharma",
            "registrationNumber": "MH-HOSP-2026-X",
            "email": f"hosp_{ts}@bloodconnect.org",
            "phone": "+91 98777 33333",
            "password": "Password123!",
            "role": "HOSPITAL",
            "city": "Pune",
            "state": "Maharashtra",
            "isVerified": False
        })
        self.assertIsNone(err)
        hospital_user = res["user"]
        hospital_user_id = str(hospital_user["id"])

        # Fetch db user doc
        user_doc = self.db.users.find_one({"_id": hospital_user["_id"] if "_id" in hospital_user else res["user"].get("id")})
        if not user_doc:
            from bson import ObjectId
            user_doc = self.db.users.find_one({"_id": ObjectId(hospital_user_id)})

        # 2. Attempt to create request while unverified -> Should fail
        req_res, req_err = create_blood_request(user_doc, {
            "bloodGroup": "B+",
            "unitsRequired": 2,
            "hospitalName": "City Care Hospital",
            "city": "Pune",
            "state": "Maharashtra",
            "requiredDate": "2026-11-01"
        })
        self.assertIsNone(req_res)
        self.assertIn("pending administrative verification", req_err.lower())

        # 3. Admin verifies hospital
        self.db.hospitals.update_one({"userId": hospital_user_id}, {"$set": {"isVerified": True}})

        # 4. Attempt to create request now -> Should succeed
        req_res2, req_err2 = create_blood_request(user_doc, {
            "bloodGroup": "B+",
            "unitsRequired": 2,
            "hospitalName": "City Care Hospital",
            "city": "Pune",
            "state": "Maharashtra",
            "requiredDate": "2026-11-01"
        })
        self.assertIsNone(req_err2)
        self.assertIsNotNone(req_res2)
        self.assertEqual(req_res2["bloodGroup"], "B+")
        self.assertEqual(req_res2["unitsRequired"], 2)

if __name__ == "__main__":
    unittest.main()
