import re

VALID_BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
VALID_ROLES = ['DONOR', 'REQUESTER', 'ADMIN', 'HOSPITAL']
VALID_URGENCIES = ['LOW', 'NORMAL', 'HIGH', 'EMERGENCY']
VALID_REQUEST_STATUSES = [
    'PENDING',
    'APPROVED',
    'FULFILLED',
    'REJECTED',
    'MATCHED',
    'DONOR_CONTACTED',
    'ACCEPTED',
    'SCHEDULED',
    'DONATION_COMPLETED',
    'CANCELLED',
    'CLOSED'
]
VALID_DONATION_STATUSES = ['SCHEDULED', 'COMPLETED', 'CANCELLED']

EMAIL_REGEX = r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$'

def is_valid_email(email):
    if not email or not isinstance(email, str):
        return False
    return bool(re.match(EMAIL_REGEX, email.strip()))

def is_valid_blood_group(bg):
    if not bg:
        return False
    return bg.strip().upper() in VALID_BLOOD_GROUPS

def is_valid_phone(phone):
    if not phone or not isinstance(phone, str):
        return False
    cleaned = re.sub(r'[\s\-\(\)\+]', '', phone.strip())
    return len(cleaned) >= 7 and cleaned.isdigit()

def validate_registration(data):
    errors = []
    name = (data.get('name') or '').strip()
    email = (data.get('email') or '').strip()
    phone = (data.get('phone') or '').strip()
    password = data.get('password') or ''
    role = (data.get('role') or 'DONOR').strip().upper()
    blood_group = (data.get('bloodGroup') or '').strip().upper()
    city = (data.get('city') or '').strip()

    if not name or len(name) < 2:
        errors.append("Full Name is required and must be at least 2 characters.")
    if not is_valid_email(email):
        errors.append("A valid email address is required.")
    if not is_valid_phone(phone):
        errors.append("A valid phone number is required.")
    if not password or len(password) < 6:
        errors.append("Password must be at least 6 characters long.")
    if role not in VALID_ROLES:
        errors.append(f"Invalid role. Allowed roles: {', '.join(VALID_ROLES)}")
    if role == 'DONOR' and not is_valid_blood_group(blood_group):
        errors.append("Valid blood group is required for donors (A+, A-, B+, B-, AB+, AB-, O+, O-).")
    if not city:
        errors.append("City is required.")

    return errors

def validate_blood_request(data):
    errors = []
    patient_name = data.get('patientName', '').strip()
    blood_group = data.get('bloodGroup', '').strip().upper()
    units = data.get('unitsRequired')
    hospital_name = data.get('hospitalName', '').strip()
    city = data.get('city', '').strip()
    contact = data.get('contactNumber', '').strip()
    urgency = data.get('urgency', 'NORMAL').strip().upper()

    if not patient_name:
        errors.append("Patient name is required.")
    if not is_valid_blood_group(blood_group):
        errors.append("Valid blood group is required (A+, A-, B+, B-, AB+, AB-, O+, O-).")
    try:
        units_val = int(units)
        if units_val < 1 or units_val > 50:
            errors.append("Units required must be between 1 and 50.")
    except (ValueError, TypeError):
        errors.append("Units required must be a valid number.")

    if not hospital_name:
        errors.append("Hospital name is required.")
    if not city:
        errors.append("City is required.")
    if not is_valid_phone(contact):
        errors.append("Valid contact phone number is required.")
    if urgency not in VALID_URGENCIES:
        errors.append(f"Urgency must be one of: {', '.join(VALID_URGENCIES)}")

    return errors
