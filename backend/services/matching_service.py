import math
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from config import Config
from database.connection import get_db, serialize_doc
from services.blood_compatibility import (
    COMPATIBLE_DONORS_FOR_PATIENT,
    DONOR_CAN_DONATE_TO,
    BLOOD_COMPATIBILITY_CONFIG,
    get_compatible_donor_groups,
    get_compatible_recipient_groups,
    is_donor_compatible,
    normalize_blood_group,
)

MATCHING_DISCLAIMER = (
    "NOTICE: Lifeline matching algorithms are an algorithmic decision-support tool. "
    "Final blood typing, serological crossmatching, infectious disease screening, and transfusion decisions "
    "must always be clinically validated by licensed medical doctors and certified blood banks."
)


def validate_gps_coordinates(lat, lng):
    """Validates latitude (-90..90) and longitude (-180..180) as finite numbers."""
    try:
        if lat is None or lng is None:
            return None, None, "Both latitude and longitude are required."
        lat_f = float(lat)
        lng_f = float(lng)
        if not (math.isfinite(lat_f) and math.isfinite(lng_f)):
            return None, None, "GPS coordinates must be finite numbers."
        if lat_f < -90.0 or lat_f > 90.0:
            return None, None, "Latitude must be between -90 and 90 degrees."
        if lng_f < -180.0 or lng_f > 180.0:
            return None, None, "Longitude must be between -180 and 180 degrees."
        return lat_f, lng_f, None
    except (TypeError, ValueError):
        return None, None, "Invalid GPS coordinates format."


def make_geojson_point(lat: float, lng: float):
    """Creates a MongoDB GeoJSON Point object [longitude, latitude]."""
    return {"type": "Point", "coordinates": [float(lng), float(lat)]}


def get_approximate_coords(lat, lng, precision: int = 3):
    """Rounds coordinates to ~110m precision so general map pins avoid doorstep precision."""
    try:
        if lat is None or lng is None:
            return None, None
        return round(float(lat), precision), round(float(lng), precision)
    except (TypeError, ValueError):
        return None, None


def expire_stale_donor_locations(db=None, stale_minutes: int = None) -> int:
    """
    Expires stale live donor locations cleanly without deleting donor profiles.
    Removes GeoJSON location & lat/lng when lastLocationUpdatedAt exceeds TTL.
    """
    db = db if db is not None else get_db()
    now = datetime.now(timezone.utc)
    ttl_mins = stale_minutes if stale_minutes is not None else Config.LOCATION_STALE_MINUTES
    cutoff = now - timedelta(minutes=ttl_mins)

    stale_filter = {
        "$or": [
            {"locationSharingEnabled": True, "lastLocationUpdatedAt": {"$lt": cutoff}},
            {"locationSharingEnabled": True, "locationExpiresAt": {"$lte": now}},
            {"location": {"$exists": True}, "lastLocationUpdatedAt": {"$lt": cutoff}},
        ]
    }
    res = db.donors.update_many(
        stale_filter,
        {
            "$set": {"locationSharingEnabled": False, "updatedAt": now},
            "$unset": {
                "location": "",
                "lat": "",
                "lng": "",
                "locationExpiresAt": "",
                "currentDonationLocation.lat": "",
                "currentDonationLocation.lng": "",
            },
        },
    )
    return res.modified_count


def is_donor_location_fresh(donor: dict, stale_minutes: int = None) -> bool:
    """Checks whether a donor currently has consented, non-stale GPS coordinates."""
    if not donor.get("locationSharingEnabled"):
        return False
    lat = donor.get("lat")
    lng = donor.get("lng")
    if (lat is None or lng is None) and isinstance(donor.get("location"), dict):
        coords = donor["location"].get("coordinates") or []
        if len(coords) == 2:
            lng, lat = coords[0], coords[1]
    if lat is None or lng is None:
        return False

    updated_at = donor.get("lastLocationUpdatedAt")
    if not updated_at:
        return False
    try:
        if isinstance(updated_at, str):
            updated_dt = datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
        else:
            updated_dt = updated_at
        if updated_dt.tzinfo is None:
            updated_dt = updated_dt.replace(tzinfo=timezone.utc)
        ttl_mins = stale_minutes if stale_minutes is not None else Config.LOCATION_STALE_MINUTES
        return (datetime.now(timezone.utc) - updated_dt) <= timedelta(minutes=ttl_mins)
    except Exception:
        return False

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

def is_donor_cooldown_eligible(donor: dict):
    """Returns (is_eligible, days_since_last_donation)."""
    last_donation = donor.get("lastDonationDate")
    if not last_donation:
        return True, None
    try:
        if isinstance(last_donation, str):
            last_dt = datetime.fromisoformat(last_donation.replace("Z", "+00:00"))
        else:
            last_dt = last_donation
        if last_dt.tzinfo is None:
            last_dt = last_dt.replace(tzinfo=timezone.utc)
        days_since = (datetime.now(timezone.utc) - last_dt).days
        return days_since >= 90, days_since
    except Exception:
        return True, None


def get_effective_donor_location(donor):
    """
    Returns the active matching location for the donor.
    Prioritizes consented live coordinates when fresh; falls back to travelling/home.
    """
    if is_donor_location_fresh(donor):
        lat = donor.get("lat")
        lng = donor.get("lng")
        if (lat is None or lng is None) and isinstance(donor.get("location"), dict):
            coords = donor["location"].get("coordinates") or []
            if len(coords) == 2:
                lng, lat = coords[0], coords[1]
        cur = donor.get("currentDonationLocation") or {}
        return {
            "city": (cur.get("city") or donor.get("city") or "").strip(),
            "state": (cur.get("state") or donor.get("state") or "").strip(),
            "pinCode": (cur.get("pinCode") or donor.get("pinCode") or "").strip(),
            "lat": lat,
            "lng": lng,
            "isTemporaryLocation": bool(cur.get("city")),
            "isLiveLocation": True,
        }

    pref = donor.get("matchingLocationPreference", "HOME")
    cur = donor.get("currentDonationLocation") or {}

    if pref == "CURRENT" and cur.get("city"):
        return {
            "city": cur.get("city", "").strip(),
            "state": cur.get("state", "").strip(),
            "pinCode": cur.get("pinCode", "").strip(),
            "lat": cur.get("lat"),
            "lng": cur.get("lng"),
            "isTemporaryLocation": True,
            "isLiveLocation": False,
        }

    return {
        "city": (donor.get("city") or "").strip(),
        "state": (donor.get("state") or "").strip(),
        "pinCode": (donor.get("pinCode") or "").strip(),
        "lat": donor.get("lat"),
        "lng": donor.get("lng"),
        "isTemporaryLocation": False,
        "isLiveLocation": False,
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

    norm_bg = normalize_blood_group(patient_bg)
    compatible_bgs = get_compatible_donor_groups(norm_bg)
    if not compatible_bgs:
        return {
            "disclaimer": MATCHING_DISCLAIMER,
            "patientBloodGroup": patient_bg,
            "compatibleBloodGroups": [],
            "totalMatches": 0,
            "matches": [],
        }

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
            donor_serialized.pop("lat", None)
            donor_serialized.pop("lng", None)
            donor_serialized.pop("location", None)
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


def _strip_private_fields(donor_serialized: dict, include_approx_coords: bool = False):
    """Removes precise coordinates and sensitive fields for privacy enforcement."""
    raw_lat = donor_serialized.pop("lat", None)
    raw_lng = donor_serialized.pop("lng", None)
    geo = donor_serialized.pop("location", None)
    if (raw_lat is None or raw_lng is None) and isinstance(geo, dict):
        coords = geo.get("coordinates") or []
        if len(coords) == 2:
            raw_lng, raw_lat = coords[0], coords[1]

    if "currentDonationLocation" in donor_serialized and isinstance(donor_serialized["currentDonationLocation"], dict):
        donor_serialized["currentDonationLocation"].pop("lat", None)
        donor_serialized["currentDonationLocation"].pop("lng", None)

    raw_phone = donor_serialized.get("phone", "")
    if raw_phone and len(raw_phone) >= 7:
        donor_serialized["phoneMasked"] = raw_phone[:6] + " •••••"
    else:
        donor_serialized["phoneMasked"] = "Protected"
    donor_serialized["phone"] = donor_serialized["phoneMasked"]
    donor_serialized["address"] = f"{donor_serialized.get('city', '')}, {donor_serialized.get('state', '')}".strip(", ")

    if include_approx_coords and raw_lat is not None and raw_lng is not None:
        alat, alng = get_approximate_coords(raw_lat, raw_lng, precision=3)
        donor_serialized["approxLat"] = alat
        donor_serialized["approxLng"] = alng
    return donor_serialized


def find_nearby_donors(
    hospital_lat: float,
    hospital_lng: float,
    patient_blood_group: str = None,
    radius_km: int = 25,
    only_verified: bool = True,
    require_live_sharing: bool = True,
    request_city: str = None,
    request_state: str = None,
    request_id: str = None,
):
    """
    GeoJSON 2dsphere + Haversine nearby donor search engine for Hospitals & Admins.
    Filters:
      - Compatible RBC blood group (when patient_blood_group supplied)
      - Verified donors (when only_verified=True)
      - Available == True
      - Non-blocked active user account
      - Non-stale consented GPS coordinates within radius_km (when require_live_sharing=True)
    Sorts nearest Haversine distance first, then matchScore descending.
    """
    db = get_db()
    expire_stale_donor_locations(db)

    lat_f, lng_f, gps_err = validate_gps_coordinates(hospital_lat, hospital_lng)
    if gps_err:
        return None, gps_err

    try:
        rad = int(radius_km) if radius_km is not None else Config.DEFAULT_SEARCH_RADIUS_KM
    except (TypeError, ValueError):
        rad = Config.DEFAULT_SEARCH_RADIUS_KM
    if rad <= 0 or rad > 500:
        return None, "Search radius must be between 1 and 500 km."

    norm_bg = normalize_blood_group(patient_blood_group) if patient_blood_group else None
    compatible_bgs = get_compatible_donor_groups(norm_bg) if norm_bg else None

    match_query = {"availability": True}
    if only_verified:
        match_query["verificationStatus"] = "VERIFIED"
    if compatible_bgs:
        match_query["bloodGroup"] = {"$in": compatible_bgs}
    if require_live_sharing:
        cutoff = datetime.now(timezone.utc) - timedelta(minutes=Config.LOCATION_STALE_MINUTES)
        match_query["locationSharingEnabled"] = True
        match_query["lastLocationUpdatedAt"] = {"$gte": cutoff}

    raw_donors = []
    used_geonear = False
    try:
        pipeline = [
            {
                "$geoNear": {
                    "near": make_geojson_point(lat_f, lng_f),
                    "distanceField": "geoDistanceMeters",
                    "maxDistance": rad * 1000,
                    "spherical": True,
                    "query": match_query,
                }
            },
            {"$limit": 200},
        ]
        raw_donors = list(db.donors.aggregate(pipeline))
        used_geonear = True
    except Exception:
        # Fallback if index missing in ephemeral mock or older collection
        raw_donors = list(db.donors.find(match_query).limit(300))

    # Map existing invitations for request_id if provided
    invite_map = {}
    if request_id:
        for inv in db.request_invitations.find({"requestId": str(request_id)}):
            invite_map[str(inv.get("donorId"))] = inv.get("status", "PENDING")

    results = []
    for donor in raw_donors:
        if require_live_sharing and not is_donor_location_fresh(donor):
            continue

        # Exclude blocked user accounts
        user_id = donor.get("userId")
        if user_id and ObjectId.is_valid(str(user_id)):
            u_doc = db.users.find_one({"_id": ObjectId(str(user_id))}, {"status": 1})
            if u_doc and u_doc.get("status") == "BLOCKED":
                continue

        d_lat = donor.get("lat")
        d_lng = donor.get("lng")
        if (d_lat is None or d_lng is None) and isinstance(donor.get("location"), dict):
            coords = donor["location"].get("coordinates") or []
            if len(coords) == 2:
                d_lng, d_lat = coords[0], coords[1]

        dist_km = haversine_distance_km(d_lat, d_lng, lat_f, lng_f)
        if dist_km is None or dist_km > float(rad):
            continue

        target_bg = norm_bg or donor.get("bloodGroup", "O+")
        score, breakdown, _ = calculate_match_score(
            donor, target_bg, request_city or donor.get("city"), request_state or donor.get("state"), lat_f, lng_f
        )
        eligible_cooldown, days_since = is_donor_cooldown_eligible(donor)

        d_ser = serialize_doc(donor)
        donor_id_str = str(d_ser.get("id"))
        d_ser["distanceKm"] = dist_km
        d_ser["matchScore"] = score
        d_ser["matchLabel"] = f"{score}% Match"
        d_ser["matchBreakdown"] = breakdown
        d_ser["isExactMatch"] = bool(norm_bg and d_ser.get("bloodGroup") == norm_bg)
        d_ser["isCooldownEligible"] = eligible_cooldown
        d_ser["daysSinceLastDonation"] = days_since
        d_ser["invitationStatus"] = invite_map.get(donor_id_str)
        _strip_private_fields(d_ser, include_approx_coords=True)
        results.append(d_ser)

    results.sort(key=lambda x: (x["distanceKm"], -x["matchScore"]))

    next_radii = [r for r in Config.ALLOWED_SEARCH_RADII_KM if r > rad]
    return {
        "disclaimer": MATCHING_DISCLAIMER,
        "radiusKm": rad,
        "allowedRadiiKm": Config.ALLOWED_SEARCH_RADII_KM,
        "suggestedExpandRadiusKm": next_radii[0] if (len(results) == 0 and next_radii) else None,
        "patientBloodGroup": norm_bg,
        "compatibleBloodGroups": compatible_bgs or [],
        "totalMatches": len(results),
        "usedGeospatialIndex": used_geonear,
        "donors": results,
    }, None
