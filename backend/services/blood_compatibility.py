"""
Configurable Red Blood Cell (RBC) Compatibility Rules.

Kept deliberately separate from transport, matching, and database layers so
clinical blood-group compatibility mappings can be audited or configured safely.
Note: Whole blood / packed red blood cell compatibility follows ABO + Rh(D)
immunology where O- is the universal red-cell donor and AB+ is the universal recipient.
"""

from typing import Dict, List

VALID_BLOOD_GROUPS: List[str] = ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"]

# Red Blood Cell compatibility map:
# Recipient (Patient) Blood Group -> Ordered Compatible Donor Blood Groups (exact match first)
COMPATIBLE_DONORS_FOR_PATIENT: Dict[str, List[str]] = {
    "O-": ["O-"],
    "O+": ["O+", "O-"],
    "A-": ["A-", "O-"],
    "A+": ["A+", "A-", "O+", "O-"],
    "B-": ["B-", "O-"],
    "B+": ["B+", "B-", "O+", "O-"],
    "AB-": ["AB-", "A-", "B-", "O-"],
    "AB+": ["AB+", "AB-", "A+", "A-", "B+", "B-", "O+", "O-"],
}

# Reverse Red Blood Cell map:
# Donor Blood Group -> Recipient Blood Groups this donor can safely donate RBCs to
DONOR_CAN_DONATE_TO: Dict[str, List[str]] = {
    "O-": ["O-", "O+", "A-", "A+", "B-", "B+", "AB-", "AB+"],
    "O+": ["O+", "A+", "B+", "AB+"],
    "A-": ["A-", "A+", "AB-", "AB+"],
    "A+": ["A+", "AB+"],
    "B-": ["B-", "B+", "AB-", "AB+"],
    "B+": ["B+", "AB+"],
    "AB-": ["AB-", "AB+"],
    "AB+": ["AB+"],
}

BLOOD_COMPATIBILITY_CONFIG = {
    "componentType": "RED_BLOOD_CELLS",
    "rules": COMPATIBLE_DONORS_FOR_PATIENT,
    "donorRecipients": DONOR_CAN_DONATE_TO,
    "clinicalNotice": (
        "Red Blood Cell (RBC) serological compatibility rules only. "
        "Final crossmatch and infectious disease screening must be completed by a licensed blood bank."
    ),
}


def normalize_blood_group(bg: str) -> str:
    return (bg or "").strip().upper()


def is_valid_blood_group(bg: str) -> bool:
    return normalize_blood_group(bg) in VALID_BLOOD_GROUPS


def get_compatible_donor_groups(
    patient_blood_group: str,
    rules: Dict[str, List[str]] = COMPATIBLE_DONORS_FOR_PATIENT,
) -> List[str]:
    norm = normalize_blood_group(patient_blood_group)
    return list(rules.get(norm, []))


def get_compatible_recipient_groups(
    donor_blood_group: str,
    rules: Dict[str, List[str]] = DONOR_CAN_DONATE_TO,
) -> List[str]:
    norm = normalize_blood_group(donor_blood_group)
    return list(rules.get(norm, []))


def is_donor_compatible(
    donor_blood_group: str,
    patient_blood_group: str,
    rules: Dict[str, List[str]] = COMPATIBLE_DONORS_FOR_PATIENT,
) -> bool:
    """Checks if donor RBC blood group is compatible with recipient patient blood group."""
    d_bg = normalize_blood_group(donor_blood_group)
    p_bg = normalize_blood_group(patient_blood_group)
    if not d_bg or not p_bg:
        return False
    return d_bg in rules.get(p_bg, [])

