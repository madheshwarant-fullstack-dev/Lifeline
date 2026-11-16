import os
import sys
import time
import unittest
from datetime import datetime, timezone, timedelta
from bson import ObjectId

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from main import app
from database.connection import get_db
from services.blood_compatibility import is_donor_compatible, get_compatible_donor_groups
from services.matching_service import expire_stale_donor_locations, haversine_distance_km


class TestRealtimeTrackingAndHospitalWorkflow(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = get_db()
        cls.created_user_ids = []
        cls.created_request_ids = []

    @classmethod
    def tearDownClass(cls):
        for rid in cls.created_request_ids:
            try:
                cls.db.request_invitations.delete_many({"requestId": str(rid)})
                cls.db.donations.delete_many({"requestId": str(rid)})
                cls.db.blood_requests.delete_one({"_id": ObjectId(rid)})
            except Exception:
                pass
        for uid in cls.created_user_ids:
            try:
                cls.db.notifications.delete_many({"recipientId": str(uid)})
                cls.db.donors.delete_many({"userId": str(uid)})
                cls.db.hospitals.delete_many({"userId": str(uid)})
                cls.db.users.delete_one({"_id": ObjectId(uid)})
            except Exception:
                pass

    def _register(self, client, payload):
        res = client.post("/api/auth/register", json=payload)
        self.assertEqual(res.status_code, 201, res.text)
        data = res.json()["data"]
        self.created_user_ids.append(data["user"]["id"])
        return data["token"], data["user"]

    def test_01_rbc_compatibility_rules(self):
        self.assertTrue(is_donor_compatible("O-", "AB+"))
        self.assertTrue(is_donor_compatible("O-", "O-"))
        self.assertFalse(is_donor_compatible("A+", "O-"))
        self.assertFalse(is_donor_compatible("AB+", "A+"))
        self.assertEqual(set(get_compatible_donor_groups("A-")), {"A-", "O-"})

    def test_02_full_realtime_gps_nearby_ws_invite_accept_complete_workflow(self):
        ts = int(time.time() * 1000)
        with TestClient(app) as client:
            # Login Admin
            adm_res = client.post(
                "/api/auth/login",
                json={"email": "admin@bloodconnect.org", "password": "AdminPassword123!"},
            )
            self.assertEqual(adm_res.status_code, 200)
            adm_token = adm_res.json()["data"]["token"]
            adm_headers = {"Authorization": f"Bearer {adm_token}"}

            # Register Donor A (near ~2.2 km from Apollo Chennai 13.0633, 80.2519, O-)
            d_near_tok, d_near = self._register(
                client,
                {
                    "name": f"Near Donor {ts}",
                    "email": f"near_{ts}@lifeline.test",
                    "phone": "+91 98400 10001",
                    "password": "Password123!",
                    "role": "DONOR",
                    "bloodGroup": "O-",
                    "city": "Chennai",
                    "state": "Tamil Nadu",
                },
            )
            d_near_hdr = {"Authorization": f"Bearer {d_near_tok}"}

            # Register Donor B (far ~18 km away, A+)
            d_far_tok, d_far = self._register(
                client,
                {
                    "name": f"Far Donor {ts}",
                    "email": f"far_{ts}@lifeline.test",
                    "phone": "+91 98400 10002",
                    "password": "Password123!",
                    "role": "DONOR",
                    "bloodGroup": "A+",
                    "city": "Chennai",
                    "state": "Tamil Nadu",
                },
            )
            d_far_hdr = {"Authorization": f"Bearer {d_far_tok}"}

            # Register Donor C (incompatible B+ near hospital)
            d_inc_tok, _ = self._register(
                client,
                {
                    "name": f"Incompatible Donor {ts}",
                    "email": f"inc_{ts}@lifeline.test",
                    "phone": "+91 98400 10003",
                    "password": "Password123!",
                    "role": "DONOR",
                    "bloodGroup": "B+",
                    "city": "Chennai",
                    "state": "Tamil Nadu",
                },
            )
            d_inc_hdr = {"Authorization": f"Bearer {d_inc_tok}"}

            # Consent guard: updating location BEFORE enabling sharing must return 403
            r_no_consent = client.post(
                "/api/donors/location",
                json={"lat": 13.0827, "lng": 80.2707},
                headers=d_near_hdr,
            )
            self.assertEqual(r_no_consent.status_code, 403)

            # Invalid GPS bounds must return 400 or 422
            r_bad_gps = client.post(
                "/api/donors/location-sharing",
                json={"enabled": True, "consent": True, "lat": 95.0, "lng": 80.0},
                headers=d_near_hdr,
            )
            self.assertIn(r_bad_gps.status_code, [400, 422])

            # Enable live sharing cleanly
            r_start = client.post(
                "/api/donors/location-sharing",
                json={"enabled": True, "consent": True},
                headers=d_near_hdr,
            )
            self.assertEqual(r_start.status_code, 200)
            self.assertTrue(r_start.json()["data"]["locationSharingEnabled"])

            client.post("/api/donors/location-sharing", json={"enabled": True, "consent": True}, headers=d_far_hdr)
            client.post("/api/donors/location-sharing", json={"enabled": True, "consent": True}, headers=d_inc_hdr)

            # Register & verify Hospital (coordinates at 13.0633, 80.2519)
            h_tok, h_user = self._register(
                client,
                {
                    "name": f"Emergency Care Hospital {ts}",
                    "hospitalName": f"Emergency Care Hospital {ts}",
                    "representativeName": "Dr. Rao",
                    "registrationNumber": f"TN-TEST-{ts}",
                    "email": f"hosp_{ts}@lifeline.test",
                    "phone": "+91 44 2222 3333",
                    "password": "Password123!",
                    "role": "HOSPITAL",
                    "city": "Chennai",
                    "state": "Tamil Nadu",
                },
            )
            h_hdr = {"Authorization": f"Bearer {h_tok}"}
            # Unverified hospital cannot search nearby donors or create requests
            r_unver = client.get("/api/donors/nearby?lat=13.0633&lng=80.2519&radiusKm=25", headers=h_hdr)
            self.assertEqual(r_unver.status_code, 403)

            # Admin verifies hospital
            r_ver = client.put(
                f"/api/admin/hospitals/{h_user['id']}/verify",
                json={"isVerified": True},
                headers=adm_headers,
            )
            self.assertEqual(r_ver.status_code, 200)

            # Test WebSocket Auth rejection
            with self.assertRaises(Exception):
                with client.websocket_connect("/ws?token=invalid_jwt"):
                    pass

            # Open authenticated WebSockets for Hospital & Near Donor
            with client.websocket_connect(f"/ws?token={h_tok}") as ws_hosp, \
                 client.websocket_connect(f"/ws?token={d_near_tok}") as ws_donor:
                hello_h = ws_hosp.receive_json()
                hello_d = ws_donor.receive_json()
                self.assertEqual(hello_h["event"], "connected")
                self.assertEqual(hello_d["event"], "connected")

                # Near donor posts live GPS update -> Hospital WS must receive donor_location_updated
                # while Donor WS must NOT receive another donor's coordinates!
                r_loc1 = client.post(
                    "/api/donors/location",
                    json={"lat": 13.0780, "lng": 80.2620, "accuracy": 18.0},
                    headers=d_near_hdr,
                )
                self.assertEqual(r_loc1.status_code, 200, r_loc1.text)
                ws_msg = ws_hosp.receive_json()
                self.assertEqual(ws_msg["event"], "donor_location_updated")
                self.assertEqual(ws_msg["data"]["donorId"], r_loc1.json()["data"]["id"])
                self.assertIn("approxLat", ws_msg["data"])

                # Update Far donor (~19 km away) & Incompatible donor (~1 km away)
                r_loc2 = client.post(
                    "/api/donors/location",
                    json={"lat": 12.9000, "lng": 80.2200},
                    headers=d_far_hdr,
                )
                self.assertEqual(r_loc2.status_code, 200)
                r_loc3 = client.post(
                    "/api/donors/location",
                    json={"lat": 13.0650, "lng": 80.2525},
                    headers=d_inc_hdr,
                )
                self.assertEqual(r_loc3.status_code, 200)

                # Test PATCH availability
                r_avail = client.patch("/api/donors/availability", json={"availability": True}, headers=d_near_hdr)
                self.assertEqual(r_avail.status_code, 200)

                # Public /api/donors MUST NOT expose lat/lng/location
                pub_list = client.get("/api/donors").json()["data"]
                for pd in pub_list:
                    self.assertNotIn("lat", pd)
                    self.assertNotIn("lng", pd)
                    self.assertNotIn("location", pd)
                pub_single = client.get(f"/api/donors/{r_loc1.json()['data']['id']}").json()["data"]
                self.assertNotIn("lat", pub_single)
                self.assertNotIn("location", pub_single)

                # Hospital creates Emergency Blood Request for A+ patient
                req_res = client.post(
                    "/api/hospitals/requests",
                    json={
                        "patientName": "Emergency Patient X",
                        "bloodGroup": "A+",
                        "unitsRequired": 2,
                        "hospitalName": f"Emergency Care Hospital {ts}",
                        "hospitalAddress": "Greams Lane, Chennai",
                        "city": "Chennai",
                        "state": "Tamil Nadu",
                        "contactNumber": "+91 44 2222 3333",
                        "urgency": "EMERGENCY",
                        "lat": 13.0633,
                        "lng": 80.2519,
                        "searchRadiusKm": 25,
                    },
                    headers=h_hdr,
                )
                self.assertEqual(req_res.status_code, 201, req_res.text)
                created_req = req_res.json()["data"]
                req_id = created_req["id"]
                self.created_request_ids.append(req_id)

                # Nearby donor query within 5 km -> should return Near Donor (O-) ONLY, not Far Donor (~18 km) or Incompatible B+
                r_5km = client.get(f"/api/hospitals/requests/{req_id}/donors?radius_km=5", headers=h_hdr)
                self.assertEqual(r_5km.status_code, 200)
                donors_5 = r_5km.json()["data"]["donors"]
                ids_5 = [d["userId"] for d in donors_5]
                self.assertIn(d_near["id"], ids_5)
                self.assertNotIn(d_far["id"], ids_5)
                self.assertTrue(all(d["bloodGroup"] in ["A+", "A-", "O+", "O-"] for d in donors_5))

                # Expanded 50 km -> returns BOTH Near Donor and Far Donor sorted nearest first!
                r_50km = client.get(f"/api/hospitals/requests/{req_id}/donors?radius_km=50", headers=h_hdr)
                self.assertEqual(r_50km.status_code, 200)
                donors_50 = r_50km.json()["data"]["donors"]
                distances = [d["distanceKm"] for d in donors_50]
                self.assertEqual(distances, sorted(distances))
                self.assertIn(d_far["id"], [d["userId"] for d in donors_50])

                # Hospital invites Near Donor explicitly
                inv_res = client.post(
                    f"/api/requests/{req_id}/invite",
                    json={"donorIds": [r_loc1.json()["data"]["id"]], "radiusKm": 25},
                    headers=h_hdr,
                )
                self.assertEqual(inv_res.status_code, 200, inv_res.text)
                self.assertEqual(inv_res.json()["data"]["invitedCount"], 1)

                # Verify Near Donor sees invitation with approximateDistanceKm via GET /api/donors/invitations
                d_invs = client.get("/api/donors/invitations", headers=d_near_hdr)
                self.assertEqual(d_invs.status_code, 200)
                matching_inv = [x for x in d_invs.json()["data"]["invitations"] if x["requestId"] == req_id]
                self.assertTrue(len(matching_inv) == 1)
                self.assertIsNotNone(matching_inv[0]["approximateDistanceKm"])

                # Donor accepts invitation via POST /api/requests/{id}/respond
                resp_acc = client.post(
                    f"/api/requests/{req_id}/respond",
                    json={"action": "ACCEPT"},
                    headers=d_near_hdr,
                )
                self.assertEqual(resp_acc.status_code, 200, resp_acc.text)

                # Hospital updates status via PATCH /api/requests/{id}/status to DONATION_COMPLETED
                patch_done = client.patch(
                    f"/api/requests/{req_id}/status",
                    json={"status": "DONATION_COMPLETED"},
                    headers=h_hdr,
                )
                self.assertEqual(patch_done.status_code, 200, patch_done.text)
                self.assertEqual(patch_done.json()["data"]["status"], "DONATION_COMPLETED")

            # Verify rate limiting (spam >5 updates rapidly -> HTTP 429)
            got_429 = False
            for i in range(8):
                rl = client.post(
                    "/api/donors/location",
                    json={"lat": 13.078 + (i * 0.0001), "lng": 80.262},
                    headers=d_near_hdr,
                )
                if rl.status_code == 429:
                    got_429 = True
                    break
            self.assertTrue(got_429, "Expected HTTP 429 from location update rate limiter")

            # Verify stopping sharing revokes GPS coordinates
            stop_res = client.post(
                "/api/donors/location-sharing",
                json={"enabled": False},
                headers=d_near_hdr,
            )
            self.assertEqual(stop_res.status_code, 200)
            self.assertFalse(stop_res.json()["data"]["locationSharingEnabled"])
            self.assertIsNone(stop_res.json()["data"].get("lat"))

            # Verify stale location auto-expiration leaves donor profile intact but removes stale GeoJSON
            old_ts = datetime.now(timezone.utc) - timedelta(minutes=120)
            self.db.donors.update_one(
                {"userId": d_far["id"]},
                {"$set": {"lastLocationUpdatedAt": old_ts, "locationExpiresAt": old_ts}},
            )
            expired_count = expire_stale_donor_locations(self.db)
            self.assertGreaterEqual(expired_count, 1)
            far_after = self.db.donors.find_one({"userId": d_far["id"]})
            self.assertIsNotNone(far_after)
            self.assertFalse(far_after.get("locationSharingEnabled"))
            self.assertNotIn("location", far_after)

            # Verify Admin endpoints & RBAC
            self.assertEqual(client.get("/api/admin/donors", headers=d_near_hdr).status_code, 403)
            self.assertEqual(client.get("/api/admin/donors", headers=adm_headers).status_code, 200)
            self.assertEqual(client.get("/api/admin/hospitals", headers=adm_headers).status_code, 200)
            self.assertEqual(client.get("/api/admin/requests", headers=adm_headers).status_code, 200)


if __name__ == "__main__":
    unittest.main()

