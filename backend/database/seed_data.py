from datetime import datetime, timezone, timedelta
from database.connection import get_db
from services.auth_service import hash_password

# City to State lookup for Indian geography
CITY_STATE_MAP = {
    "Chennai": "Tamil Nadu",
    "Coimbatore": "Tamil Nadu",
    "Madurai": "Tamil Nadu",
    "Tiruchirappalli": "Tamil Nadu",
    "Salem": "Tamil Nadu",
    "Tirunelveli": "Tamil Nadu",
    "Tiruppur": "Tamil Nadu",
    "Erode": "Tamil Nadu",
    "Vellore": "Tamil Nadu",
    "Thoothukudi": "Tamil Nadu",
    "Hosur": "Tamil Nadu",
    "Nagercoil": "Tamil Nadu",
    "Kanchipuram": "Tamil Nadu",
    "Mumbai": "Maharashtra",
    "Pune": "Maharashtra",
    "Nagpur": "Maharashtra",
    "Thane": "Maharashtra",
    "Nashik": "Maharashtra",
    "Navi Mumbai": "Maharashtra",
    "New Delhi": "Delhi",
    "Delhi": "Delhi",
    "Bengaluru": "Karnataka",
    "Mysuru": "Karnataka",
    "Mangaluru": "Karnataka",
    "Hyderabad": "Telangana",
    "Warangal": "Telangana",
    "Kolkata": "West Bengal",
    "Howrah": "West Bengal",
    "Ahmedabad": "Gujarat",
    "Surat": "Gujarat",
    "Vadodara": "Gujarat",
    "Jaipur": "Rajasthan",
    "Jodhpur": "Rajasthan",
    "Udaipur": "Rajasthan",
    "Lucknow": "Uttar Pradesh",
    "Kanpur": "Uttar Pradesh",
    "Varanasi": "Uttar Pradesh",
    "Noida": "Uttar Pradesh",
    "Ludhiana": "Punjab",
    "Amritsar": "Punjab",
    "Chandigarh": "Chandigarh",
    "Bhopal": "Madhya Pradesh",
    "Indore": "Madhya Pradesh",
    "Patna": "Bihar",
    "Kochi": "Kerala",
    "Thiruvananthapuram": "Kerala"
}

def migrate_existing_data_to_india(db):
    """
    Ensures all existing records in MongoDB are migrated to Indian cities,
    states, hospital names, addresses, and phone numbers.
    """
    print("[Database Seed] Running Indian city and state migration on existing records...")

    # 1. Update Admin user if has legacy US info
    db.users.update_one(
        {"email": "admin@bloodconnect.org"},
        {"$set": {
            "name": "Dr. Sarah Sharma (Chief Admin)",
            "city": "New Delhi",
            "state": "Delhi",
            "address": "AIIMS Campus, Ring Road, Ansari Nagar, New Delhi 110029",
            "phone": "+91 98101 23456"
        }}
    )

    # 2. Update Demo Donor if has legacy US info
    db.users.update_one(
        {"email": "donor@bloodconnect.org"},
        {"$set": {
            "name": "Arjun Mehta (Demo Donor)",
            "city": "Mumbai",
            "state": "Maharashtra",
            "address": "42 Marine Drive, Nariman Point, Mumbai 400021",
            "phone": "+91 98201 34567"
        }}
    )
    db.donors.update_one(
        {"email": "donor@bloodconnect.org"},
        {"$set": {
            "name": "Arjun Mehta (Demo Donor)",
            "city": "Mumbai",
            "state": "Maharashtra",
            "address": "42 Marine Drive, Nariman Point, Mumbai 400021",
            "phone": "+91 98201 34567",
            "emergencyContact": "+91 98201 99999"
        }}
    )

    # 3. Update Demo Requester if has legacy US info
    db.users.update_one(
        {"email": "requester@bloodconnect.org"},
        {"$set": {
            "name": "Priya Sharma (Demo Requester)",
            "city": "Bengaluru",
            "state": "Karnataka",
            "address": "15, 100 Feet Rd, Indiranagar, Bengaluru 560038",
            "phone": "+91 98301 45678"
        }}
    )

    # 4. Update Hospitals
    db.hospitals.update_many(
        {"city": "New York"},
        {"$set": {
            "hospitalName": "Apollo Hospitals & Emergency Transfusion Centre",
            "city": "Chennai",
            "state": "Tamil Nadu",
            "address": "21 Greams Lane, Off Greams Road, Thousand Lights, Chennai 600006",
            "phone": "+91 44 2829 0200",
            "registrationNumber": "TN-MED-94021"
        }}
    )

    # 5. Migrate any other users/donors with legacy cities
    city_replacements = {
        "New York": ("Mumbai", "Maharashtra"),
        "Boston": ("Bengaluru", "Karnataka"),
        "Chicago": ("Pune", "Maharashtra"),
        "Houston": ("Hyderabad", "Telangana")
    }

    for old_city, (new_city, new_state) in city_replacements.items():
        db.users.update_many({"city": old_city}, {"$set": {"city": new_city, "state": new_state}})
        db.donors.update_many({"city": old_city}, {"$set": {"city": new_city, "state": new_state}})
        db.blood_requests.update_many({"city": old_city}, {"$set": {"city": new_city, "state": new_state}})
        db.donations.update_many({"city": old_city}, {"$set": {"city": new_city, "state": new_state}})

    # 6. Ensure all records have valid Indian state populated based on their city
    for city, state in CITY_STATE_MAP.items():
        db.users.update_many({"city": city, "$or": [{"state": None}, {"state": ""}, {"state": {"$exists": False}}]}, {"$set": {"state": state}})
        db.donors.update_many({"city": city, "$or": [{"state": None}, {"state": ""}, {"state": {"$exists": False}}]}, {"$set": {"state": state}})
        db.blood_requests.update_many({"city": city, "$or": [{"state": None}, {"state": ""}, {"state": {"$exists": False}}]}, {"$set": {"state": state}})
        db.donations.update_many({"city": city, "$or": [{"state": None}, {"state": ""}, {"state": {"$exists": False}}]}, {"$set": {"state": state}})

    # Default any remaining records without state to Tamil Nadu
    db.users.update_many({"$or": [{"state": None}, {"state": ""}, {"state": {"$exists": False}}]}, {"$set": {"state": "Tamil Nadu"}})
    db.donors.update_many({"$or": [{"state": None}, {"state": ""}, {"state": {"$exists": False}}]}, {"$set": {"state": "Tamil Nadu"}})
    db.blood_requests.update_many({"$or": [{"state": None}, {"state": ""}, {"state": {"$exists": False}}]}, {"$set": {"state": "Tamil Nadu"}})
    db.donations.update_many({"$or": [{"state": None}, {"state": ""}, {"state": {"$exists": False}}]}, {"$set": {"state": "Tamil Nadu"}})

    # Update request hospital names if legacy
    db.blood_requests.update_many(
        {"hospitalName": "Mount Sinai Hospital"},
        {"$set": {
            "hospitalName": "Apollo Hospitals",
            "hospitalAddress": "21 Greams Lane, Thousand Lights",
            "city": "Chennai",
            "state": "Tamil Nadu"
        }}
    )
    db.blood_requests.update_many(
        {"hospitalName": "Massachusetts General Hospital"},
        {"$set": {
            "hospitalName": "Fortis Hospital",
            "hospitalAddress": "154/9, Bannerghatta Road",
            "city": "Bengaluru",
            "state": "Karnataka"
        }}
    )
    db.blood_requests.update_many(
        {"hospitalName": "NYU Langone Medical Center"},
        {"$set": {
            "hospitalName": "Lilavati Hospital & Research Centre",
            "hospitalAddress": "A-791, Bandra Reclamation, Bandra West",
            "city": "Mumbai",
            "state": "Maharashtra"
        }}
    )
    db.donations.update_many(
        {"hospitalName": "NYU Langone Medical Center"},
        {"$set": {
            "hospitalName": "Lilavati Hospital & Research Centre",
            "hospitalAddress": "A-791, Bandra Reclamation, Bandra West",
            "city": "Mumbai",
            "state": "Maharashtra"
        }}
    )

def seed_database():
    db = get_db()
    
    # Check if admin already exists
    admin_exists = db.users.find_one({"email": "admin@bloodconnect.org"})
    if admin_exists:
        # Database already initialized and seeded
        return

    print("[Database Seed] Seeding initial users, donors, requests, and donations for India...")
    now = datetime.now(timezone.utc)

    # 1. Admin Account
    admin_user = {
        "name": "Dr. Sarah Sharma (Chief Admin)",
        "email": "admin@bloodconnect.org",
        "phone": "+91 98101 23456",
        "password": hash_password("AdminPassword123!"),
        "role": "ADMIN",
        "bloodGroup": "O-",
        "dateOfBirth": "1985-04-12",
        "gender": "Female",
        "state": "Delhi",
        "city": "New Delhi",
        "address": "AIIMS Campus, Ring Road, Ansari Nagar, New Delhi 110029",
        "status": "ACTIVE",
        "createdAt": now - timedelta(days=60),
        "updatedAt": now
    }
    admin_id = db.users.insert_one(admin_user).inserted_id

    # 2. Sample Demo Donor Account
    donor_user = {
        "name": "Arjun Mehta (Demo Donor)",
        "email": "donor@bloodconnect.org",
        "phone": "+91 98201 34567",
        "password": hash_password("Donor123!"),
        "role": "DONOR",
        "bloodGroup": "O+",
        "dateOfBirth": "1994-08-20",
        "gender": "Male",
        "state": "Maharashtra",
        "city": "Mumbai",
        "address": "42 Marine Drive, Nariman Point, Mumbai 400021",
        "status": "ACTIVE",
        "createdAt": now - timedelta(days=45),
        "updatedAt": now
    }
    donor_user_id = db.users.insert_one(donor_user).inserted_id

    db.donors.insert_one({
        "userId": str(donor_user_id),
        "name": donor_user["name"],
        "email": donor_user["email"],
        "phone": donor_user["phone"],
        "bloodGroup": "O+",
        "state": "Maharashtra",
        "city": "Mumbai",
        "address": donor_user["address"],
        "gender": "Male",
        "dateOfBirth": "1994-08-20",
        "availability": True,
        "totalDonations": 3,
        "lastDonationDate": (now - timedelta(days=120)).isoformat(),
        "verificationStatus": "VERIFIED",
        "emergencyContact": "+91 98201 99999",
        "createdAt": now - timedelta(days=45),
        "updatedAt": now
    })

    # 3. Sample Demo Requester Account
    req_user = {
        "name": "Priya Sharma (Demo Requester)",
        "email": "requester@bloodconnect.org",
        "phone": "+91 98301 45678",
        "password": hash_password("Requester123!"),
        "role": "REQUESTER",
        "bloodGroup": "A+",
        "dateOfBirth": "1990-11-15",
        "gender": "Female",
        "state": "Karnataka",
        "city": "Bengaluru",
        "address": "15, 100 Feet Rd, Indiranagar, Bengaluru 560038",
        "status": "ACTIVE",
        "createdAt": now - timedelta(days=30),
        "updatedAt": now
    }
    req_user_id = db.users.insert_one(req_user).inserted_id

    # 4. Additional Donors across Indian States, Blood Groups, and Cities
    extra_donors = [
        {"name": "Rajesh Kumar", "email": "rajesh.k@gmail.com", "bg": "O-", "state": "Tamil Nadu", "city": "Chennai", "avail": True, "ver": "VERIFIED", "last": 100},
        {"name": "Ananya Sen", "email": "ananya.s@gmail.com", "bg": "A+", "state": "West Bengal", "city": "Kolkata", "avail": True, "ver": "VERIFIED", "last": 140},
        {"name": "Karthik Raman", "email": "karthik.r@gmail.com", "bg": "A-", "state": "Karnataka", "city": "Bengaluru", "avail": True, "ver": "VERIFIED", "last": 95},
        {"name": "Vikram Reddy", "email": "vikram.r@gmail.com", "bg": "B+", "state": "Telangana", "city": "Hyderabad", "avail": True, "ver": "VERIFIED", "last": 200},
        {"name": "Sneha Joshi", "email": "sneha.j@gmail.com", "bg": "B-", "state": "Maharashtra", "city": "Pune", "avail": True, "ver": "VERIFIED", "last": 30},
        {"name": "Amit Patel", "email": "amit.p@gmail.com", "bg": "AB+", "state": "Gujarat", "city": "Ahmedabad", "avail": False, "ver": "VERIFIED", "last": 110},
        {"name": "Pooja Verma", "email": "pooja.v@gmail.com", "bg": "AB-", "state": "Delhi", "city": "New Delhi", "avail": True, "ver": "PENDING", "last": None},
        {"name": "Rohan Deshmukh", "email": "rohan.d@gmail.com", "bg": "O+", "state": "Maharashtra", "city": "Mumbai", "avail": True, "ver": "VERIFIED", "last": 180},
        {"name": "Gurpreet Singh", "email": "gurpreet.s@gmail.com", "bg": "O-", "state": "Punjab", "city": "Ludhiana", "avail": True, "ver": "VERIFIED", "last": 92},
    ]

    for idx, d in enumerate(extra_donors):
        phone_num = f"+91 98{idx+1:02d} 11223"
        u_doc = {
            "name": d["name"],
            "email": d["email"],
            "phone": phone_num,
            "password": hash_password("DonorPassword123!"),
            "role": "DONOR",
            "bloodGroup": d["bg"],
            "dateOfBirth": "1992-05-15",
            "gender": "Other",
            "state": d["state"],
            "city": d["city"],
            "address": f"Flat {idx+101}, Main Road, {d['city']}, {d['state']}",
            "status": "ACTIVE",
            "createdAt": now - timedelta(days=20),
            "updatedAt": now
        }
        u_id = db.users.insert_one(u_doc).inserted_id

        last_don_date = (now - timedelta(days=d["last"])).isoformat() if d["last"] else None
        db.donors.insert_one({
            "userId": str(u_id),
            "name": d["name"],
            "email": d["email"],
            "phone": u_doc["phone"],
            "bloodGroup": d["bg"],
            "state": d["state"],
            "city": d["city"],
            "address": u_doc["address"],
            "gender": "Other",
            "dateOfBirth": "1992-05-15",
            "availability": d["avail"],
            "totalDonations": 2 if d["last"] else 0,
            "lastDonationDate": last_don_date,
            "verificationStatus": d["ver"],
            "emergencyContact": "+91 98000 00000",
            "createdAt": now - timedelta(days=20),
            "updatedAt": now
        })

    # 5. Hospital Account (Apollo Hospital Chennai)
    hosp_user = {
        "name": "Apollo Hospitals & Emergency Transfusion Centre",
        "email": "apollo@bloodconnect.org",
        "phone": "+91 44 2829 0200",
        "password": hash_password("Hospital123!"),
        "role": "HOSPITAL",
        "state": "Tamil Nadu",
        "city": "Chennai",
        "address": "21 Greams Lane, Off Greams Road, Thousand Lights, Chennai 600006",
        "status": "ACTIVE",
        "createdAt": now - timedelta(days=40),
        "updatedAt": now
    }
    hosp_id = db.users.insert_one(hosp_user).inserted_id
    db.hospitals.insert_one({
        "userId": str(hosp_id),
        "hospitalName": hosp_user["name"],
        "registrationNumber": "TN-MED-94021",
        "email": hosp_user["email"],
        "phone": hosp_user["phone"],
        "state": "Tamil Nadu",
        "city": "Chennai",
        "address": hosp_user["address"],
        "isVerified": True,
        "createdAt": now - timedelta(days=40),
        "updatedAt": now
    })

    # 6. Sample Blood Requests across Indian Cities & States
    req1 = {
        "requesterId": str(req_user_id),
        "requesterName": req_user["name"],
        "requesterEmail": req_user["email"],
        "requesterPhone": req_user["phone"],
        "patientName": "Aarav Sundaram",
        "bloodGroup": "O+",
        "unitsRequired": 2,
        "hospitalName": "Apollo Hospitals",
        "hospitalAddress": "21 Greams Lane, Thousand Lights",
        "state": "Tamil Nadu",
        "city": "Chennai",
        "contactNumber": "+91 98301 45678",
        "requiredDate": (now + timedelta(days=1)).strftime("%Y-%m-%d"),
        "urgency": "EMERGENCY",
        "additionalMessage": "Critical trauma surgery scheduled. Immediate O+ or O- donors needed.",
        "status": "MATCHED",
        "matchedDonorIds": [],
        "acceptedDonorId": None,
        "createdAt": now - timedelta(hours=3),
        "updatedAt": now - timedelta(hours=3)
    }
    db.blood_requests.insert_one(req1)

    req2 = {
        "requesterId": str(req_user_id),
        "requesterName": req_user["name"],
        "requesterEmail": req_user["email"],
        "requesterPhone": req_user["phone"],
        "patientName": "Ananya Mukherjee",
        "bloodGroup": "A-",
        "unitsRequired": 1,
        "hospitalName": "Fortis Hospital",
        "hospitalAddress": "154/9, Bannerghatta Road",
        "state": "Karnataka",
        "city": "Bengaluru",
        "contactNumber": "+91 98301 45678",
        "requiredDate": (now + timedelta(days=3)).strftime("%Y-%m-%d"),
        "urgency": "HIGH",
        "additionalMessage": "Scheduled orthopedic procedure.",
        "status": "PENDING",
        "matchedDonorIds": [],
        "acceptedDonorId": None,
        "createdAt": now - timedelta(days=1),
        "updatedAt": now - timedelta(days=1)
    }
    db.blood_requests.insert_one(req2)

    req3 = {
        "requesterId": str(req_user_id),
        "requesterName": req_user["name"],
        "requesterEmail": req_user["email"],
        "requesterPhone": req_user["phone"],
        "patientName": "Rohan Deshmukh",
        "bloodGroup": "B+",
        "unitsRequired": 3,
        "hospitalName": "Lilavati Hospital & Research Centre",
        "hospitalAddress": "A-791, Bandra Reclamation, Bandra West",
        "state": "Maharashtra",
        "city": "Mumbai",
        "contactNumber": "+91 98301 45678",
        "requiredDate": (now - timedelta(days=5)).strftime("%Y-%m-%d"),
        "urgency": "NORMAL",
        "additionalMessage": "Chemotherapy support.",
        "status": "DONATION_COMPLETED",
        "matchedDonorIds": [],
        "acceptedDonorId": str(donor_user_id),
        "createdAt": now - timedelta(days=7),
        "updatedAt": now - timedelta(days=5)
    }
    req3_id = db.blood_requests.insert_one(req3).inserted_id

    # 7. Sample Completed Donation
    db.donations.insert_one({
        "donationId": "DON-2026-IN0912",
        "donorId": str(donor_user_id),
        "donorName": donor_user["name"],
        "donorEmail": donor_user["email"],
        "donorPhone": donor_user["phone"],
        "bloodGroup": "O+",
        "requestId": str(req3_id),
        "patientName": "Rohan Deshmukh",
        "hospitalName": "Lilavati Hospital & Research Centre",
        "hospitalAddress": "A-791, Bandra Reclamation, Bandra West",
        "state": "Maharashtra",
        "city": "Mumbai",
        "units": 2,
        "donationDate": (now - timedelta(days=5)).isoformat(),
        "status": "COMPLETED",
        "notes": "Successful donation. Hemoglobin was 14.5 g/dL.",
        "createdAt": now - timedelta(days=5),
        "updatedAt": now - timedelta(days=5)
    })

    print("[Database Seed] Seed data generated successfully for India.")

if __name__ == '__main__':
    seed_database()
