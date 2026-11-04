import math
from datetime import datetime, timezone
from bson import ObjectId
from database.connection import get_db, serialize_doc

# Red Blood Cell compatibility map: Patient Blood Group -> List of Compatible Donor Blood Groups
COMPATIBLE_DONORS_FOR_PATIENT = {
    'O-': ['O-'],
    'O+': ['O+', 'O-'],
    'A-': ['A-', 'O-'],
    'A+': ['A+', 'A-', 'O+', 'O-'],
    'B-': ['B-', 'O-'],
    'B+': ['B+', 'B-', 'O+', 'O-'],
    'AB-': ['AB-', 'A-', 'B-', 'O-'],
    'AB+': ['AB+', 'AB-', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-']
}

# Red Blood Cell donation map: Donor Blood Group -> List of Compatible Recipients
DONOR_CAN_DONATE_TO = {
    'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
    'O+': ['O+', 'A+', 'B+', 'AB+'],
    'A-': ['A-', 'A+', 'AB-', 'AB+'],
    'A+': ['A+', 'AB+'],
    'B-': ['B-', 'B+', 'AB-', 'AB+'],
    'B+': ['B+', 'AB+'],
    'AB-': ['AB-', 'AB+'],
    'AB+': ['AB+']
}

MATCHING_DISCLAIMER = (
    "NOTICE: Lifeline matching algorithms are an algorithmic decision-support tool. "
    "Final blood typing, serological crossmatching, infectious disease screening, and transfusion decisions "
    "must always be clinically validated by licensed medical doctors and certified blood banks."
)

def haversine_distance_km(lat1, lon1, lat2, lon2):
    """Calculates great-circle distance between two GPS coordinates in kilometers."""
    try:
        if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
            return None
        lat1, lon1, lat2, lon2 = float(lat1), float(lon1), float(lat2), float(lon2)
        R = 6371.0  # Earth's radius in kilometers
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (math.sin(dlat / 2) ** 2 +
             math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
             math.sin(dlon / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return round(R * c, 1)
    except Exception:
        return None

def is_donor_compatible(donor_blood_group, patient_blood_group):
    """Checks if donor blood group is serologically compatible for patient red blood cells"""
    allowed_donors = COMPATIBLE_DONORS_FOR_PATIENT.get(patient_blood_group, [])
    return donor_blood_group in allowed_donors

def get_effective_donor_location(donor):
    """
    Returns the active matching location for the donor.
    If the donor is travelling and set matchingLocationPreference to 'CURRENT',
    use their current donation location. Otherwise default to their home location.
    """
    pref = donor.get("matchingLocationPreference", "HOME")
    cur = donor.get("currentDonationLocation") or {}

    if pref == "CURRENT" and cur.get("city"):
        return {
            "city": cur.get("city", "").strip(),
            "state": cur.get("state", "").strip(),
            "pinCode": cur.get("pinCode", "").strip(),
            "lat": cur.get("lat"),
            "lng": cur.get("lng"),
            "isTemporaryLocation": True
        }
    
    return {
        "city": (donor.get("city") or "").strip(),
        "state": (donor.get("state") or "").strip(),
        "pinCode": (donor.get("pinCode") or "").strip(),
        "lat": donor.get("lat"),
        "lng": donor.get("lng"),
        "isTemporaryLocation": False
    }

def calculate_match_score(donor, patient_blood_group, request_city, request_state=None, req_lat=None, req_lng=None):
    """
    Computes a match score (0 - 100) based on:
    - Serological Compatibility (Exact = 40 pts, Compatible = 30 pts)
    - Proximity / Distance (Haversine distance when available, or City / State fallback = max 35 pts)
    - Availability status (15 pts if available, 0 if not)
    - Cooldown period (10 pts if >= 90 days or first time)
    """
    donor_bg = donor.get('bloodGroup', '')
    if not is_donor_compatible(donor_bg, patient_blood_group):
        return 0, "Incompatible blood group", None

    # Donors who turned off matching or are unavailable
    if not donor.get('availability', True) or donor.get('shareLocationForMatching') is False:
        return 0, "Donor unavailable or matching disabled", None

    loc = get_effective_donor_location(donor)
    donor_city = loc["city"].lower()
    req_city = (request_city or '').strip().lower()
    donor_state = loc["state"].lower()
    req_state = (request_state or '').strip().lower()

    score = 0

    # 1. Blood Compatibility (max 40)
    if donor_bg == patient_blood_group:
        score += 40
        match_type = "Exact Match"
    else:
        score += 30
        match_type = "Compatible Match"

    # 2. Location & Proximity (max 35)
    dist_km = haversine_distance_km(loc.get("lat"), loc.get("lng"), req_lat, req_lng)
    if dist_km is not None:
        if dist_km <= 10:
            score += 35
            location_fit = f"~{dist_km} km away (Immediate Vicinity)"
        elif dist_km <= 25:
            score += 30
            location_fit = f"~{dist_km} km away (Nearby District)"
        elif dist_km <= 50:
            score += 25
            location_fit = f"~{dist_km} km away (Metro Area)"
        elif dist_km <= 100:
            score += 20
            location_fit = f"~{dist_km} km away (Regional)"
        else:
            score += 10
            location_fit = f"~{dist_km} km away"
    else:
        # Fallback to City / State match
        if donor_city and req_city and donor_city == req_city:
            score += 35
            location_fit = "Same City"
        elif donor_state and req_state and donor_state == req_state:
            score += 25
            location_fit = "Same State"
        else:
            score += 15
            location_fit = "Interstate / Regional"

    if loc.get("isTemporaryLocation"):
        location_fit += " [Current Travelling Location]"

    # 3. Availability (15 pts)
    score += 15

    # 4. Donation Eligibility Cooldown (max 10 pts)
    last_donation = donor.get('lastDonationDate')
    if not last_donation:
        score += 10
    else:
        try:
            if isinstance(last_donation, str):
                last_dt = datetime.fromisoformat(last_donation.replace('Z', '+00:00'))
            else:
                last_dt = last_donation
            days_since = (datetime.now(timezone.utc) - last_dt.replace(tzinfo=timezone.utc)).days
            if days_since >= 90:
                score += 10
            elif days_since >= 60:
                score += 5
            else:
                score += 2
        except Exception:
            score += 8

    return min(score, 100), f"{match_type} • {location_fit}", dist_km

def find_matched_donors_for_request(request_doc, only_verified=False):
    """
    Finds and ranks donors matching the given blood request.
    Excludes unavailable donors, applies RBC compatibility, and sorts by proximity.
    """
    db = get_db()
    patient_bg = request_doc.get('bloodGroup')
    city = request_doc.get('city')
    state = request_doc.get('state')
    req_lat = request_doc.get('lat') or request_doc.get('latitude')
    req_lng = request_doc.get('lng') or request_doc.get('longitude')

    compatible_bgs = COMPATIBLE_DONORS_FOR_PATIENT.get(patient_bg, [patient_bg])

    query = {
        "bloodGroup": {"$in": compatible_bgs},
        "availability": True
    }
    if only_verified:
        query["verificationStatus"] = "VERIFIED"

    donors = list(db.donors.find(query))

    matched_results = []
    seen_donor_ids = set()

    for donor in donors:
        donor_id = str(donor["_id"])
        if donor_id in seen_donor_ids:
            continue

        # Check user status in case user account is blocked
        user = db.users.find_one({"_id": ObjectId(donor.get("userId"))})
        if user and user.get("status") == "BLOCKED":
            continue

        score, breakdown, dist_km = calculate_match_score(donor, patient_bg, city, state, req_lat, req_lng)
        if score > 0:
            seen_donor_ids.add(donor_id)
            donor_serialized = serialize_doc(donor)
            donor_serialized["matchScore"] = score
            donor_serialized["matchLabel"] = f"{score}% Match"
            donor_serialized["matchBreakdown"] = breakdown
            donor_serialized["distanceKm"] = dist_km
            donor_serialized["isExactMatch"] = (donor.get('bloodGroup') == patient_bg)
            
            # Protect precise coordinates
            if "lat" in donor_serialized:
                del donor_serialized["lat"]
            if "lng" in donor_serialized:
                del donor_serialized["lng"]
            if "currentDonationLocation" in donor_serialized and isinstance(donor_serialized["currentDonationLocation"], dict):
                donor_serialized["currentDonationLocation"].pop("lat", None)
                donor_serialized["currentDonationLocation"].pop("lng", None)

            matched_results.append(donor_serialized)

    # Sort matches: if distance is present for matches, prioritize closer proximity, then score
    matched_results.sort(key=lambda x: (
        x["distanceKm"] is None,
        x["distanceKm"] if x["distanceKm"] is not None else 99999,
        -x["matchScore"]
    ))

    return {
        "disclaimer": MATCHING_DISCLAIMER,
        "patientBloodGroup": patient_bg,
        "compatibleBloodGroups": compatible_bgs,
        "totalMatches": len(matched_results),
        "matches": matched_results
    }
