import re
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator, ConfigDict

class UserRegisterSchema(BaseModel):
    name: str = Field(..., min_length=2, description="Full name")
    email: str = Field(..., description="Valid email address")
    phone: str = Field(..., min_length=7, description="Contact phone number")
    password: str = Field(..., min_length=6, description="Password (at least 6 characters)")
    confirmPassword: Optional[str] = None
    role: str = Field(default="DONOR", description="Role: DONOR, REQUESTER, ADMIN, HOSPITAL")
    bloodGroup: Optional[str] = Field(default=None, description="Blood group (e.g. A+, O-, etc.)")
    dateOfBirth: Optional[str] = ""
    gender: Optional[str] = "Not Specified"
    city: Optional[str] = ""
    state: Optional[str] = ""
    address: Optional[str] = ""
    emergencyContact: Optional[str] = ""
    hospitalName: Optional[str] = ""
    representativeName: Optional[str] = ""
    registrationNumber: Optional[str] = ""
    pinCode: Optional[str] = ""

    model_config = ConfigDict(extra="ignore")

    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        clean = (v or "").strip().lower()
        if not re.match(r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$', clean):
            raise ValueError("A valid email address is required.")
        return clean

    @field_validator('role')
    @classmethod
    def validate_role(cls, v: str) -> str:
        role = (v or "DONOR").strip().upper()
        allowed = ['DONOR', 'REQUESTER', 'ADMIN', 'HOSPITAL']
        if role not in allowed:
            raise ValueError(f"Role must be one of: {', '.join(allowed)}")
        return role

class UserLoginSchema(BaseModel):
    email: str
    password: str

    model_config = ConfigDict(extra="ignore")

    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        return (v or "").strip().lower()

class BloodRequestCreateSchema(BaseModel):
    patientName: Optional[str] = Field(default="Patient In Need", min_length=2)
    bloodGroup: str = Field(...)
    unitsRequired: Optional[int] = Field(default=None, ge=1, le=50)
    units: int = Field(default=1, ge=1, le=50)
    hospitalName: str = Field(..., min_length=2)
    hospitalAddress: Optional[str] = ""
    city: str = Field(..., min_length=2)
    state: Optional[str] = ""
    pinCode: Optional[str] = ""
    contactPhone: Optional[str] = None
    contactNumber: Optional[str] = None
    contactName: Optional[str] = ""
    urgency: str = Field(default="NORMAL")
    requiredDate: Optional[str] = None
    notes: Optional[str] = ""
    additionalMessage: Optional[str] = ""
    lat: Optional[float] = Field(default=None, ge=-90.0, le=90.0)
    lng: Optional[float] = Field(default=None, ge=-180.0, le=180.0)
    latitude: Optional[float] = Field(default=None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(default=None, ge=-180.0, le=180.0)
    searchRadiusKm: Optional[int] = Field(default=25)

    model_config = ConfigDict(extra="ignore")


class DonorLocationUpdateSchema(BaseModel):
    lat: Optional[float] = Field(default=None, ge=-90.0, le=90.0)
    lng: Optional[float] = Field(default=None, ge=-180.0, le=180.0)
    latitude: Optional[float] = Field(default=None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(default=None, ge=-180.0, le=180.0)
    accuracy: Optional[float] = Field(default=None, ge=0.0)
    consent: Optional[bool] = None

    model_config = ConfigDict(extra="ignore")


class DonorLocationSharingSchema(BaseModel):
    enabled: bool
    consent: Optional[bool] = None
    lat: Optional[float] = Field(default=None, ge=-90.0, le=90.0)
    lng: Optional[float] = Field(default=None, ge=-180.0, le=180.0)

    model_config = ConfigDict(extra="ignore")


class RequestInviteSchema(BaseModel):
    donorIds: Optional[List[str]] = None
    radiusKm: Optional[int] = Field(default=25)
    topN: Optional[int] = Field(default=10, ge=1, le=50)

    model_config = ConfigDict(extra="ignore")


class RequestRespondSchema(BaseModel):
    action: str  # ACCEPT / REJECT / DECLINE
    note: Optional[str] = ""

    model_config = ConfigDict(extra="ignore")

class BloodRequestStatusUpdateSchema(BaseModel):
    status: str

class DonorAvailabilitySchema(BaseModel):
    availability: bool

class DonorContactSchema(BaseModel):
    message: Optional[str] = "Emergency blood donation contact request"
    patientName: Optional[str] = "Patient"
    hospitalName: Optional[str] = "Hospital"
    bloodGroup: Optional[str] = None
    city: Optional[str] = None
    urgency: Optional[str] = "NORMAL"
    contactPhone: Optional[str] = None
    requestId: Optional[str] = None

    model_config = ConfigDict(extra="ignore")

class DonorProfileUpdateSchema(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    bloodGroup: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    address: Optional[str] = None
    emergencyContact: Optional[str] = None
    dateOfBirth: Optional[str] = None
    gender: Optional[str] = None

class DonationCreateSchema(BaseModel):
    requestId: Optional[str] = None
    donorId: Optional[str] = None
    units: Optional[int] = 1
    hospitalName: Optional[str] = None
    donationDate: Optional[str] = None
    status: Optional[str] = "COMPLETED"

class HealthScreeningSubmitSchema(BaseModel):
    requestId: str
    donorId: Optional[str] = None
    weightKg: Optional[float] = None
    hemoglobin: Optional[float] = None
    lastDonationDate: Optional[str] = None
    answers: Optional[Dict[str, Any]] = None
    isEligibleSelfDeclared: Optional[bool] = True

class HealthScreeningReviewSchema(BaseModel):
    decision: str  # APPROVED / DEFERRED / REJECTED
    comments: Optional[str] = None
    notes: Optional[str] = None
    hospitalInstructions: Optional[str] = None

    model_config = ConfigDict(extra="ignore")

class UserStatusUpdateSchema(BaseModel):
    status: str  # ACTIVE / BLOCKED

class DonorVerifySchema(BaseModel):
    status: str  # VERIFIED / REJECTED / PENDING

class DonorMedicalProfileSchema(BaseModel):
    fullName: Optional[str] = None
    age: Optional[int] = Field(default=None, ge=16, le=90)
    bloodGroup: Optional[str] = None
    gender: Optional[str] = None
    weight: Optional[float] = Field(default=None, ge=30.0, le=250.0)
    lastDonationDate: Optional[str] = None
    medicalHistory: Optional[str] = ""
    currentMedication: Optional[str] = ""
    allergies: Optional[str] = ""
    previousComplications: Optional[str] = ""
    healthDeclaration: bool = Field(default=False, description="Explicit donor declaration of health truthfulness")

    model_config = ConfigDict(extra="ignore")

class DonorMedicalReviewUpdateSchema(BaseModel):
    status: str = Field(..., description="VERIFIED, PENDING, REQUIRES_ASSESSMENT, NOT_CLEARED")
    clinicalNotes: Optional[str] = ""

    model_config = ConfigDict(extra="ignore")

    @field_validator('status')
    @classmethod
    def validate_status(cls, v: str) -> str:
        s = (v or "").strip().upper()
        allowed = ['VERIFIED', 'PENDING', 'REQUIRES_ASSESSMENT', 'NOT_CLEARED']
        if s not in allowed:
            raise ValueError(f"Status must be one of: {', '.join(allowed)}")
        return s

class HospitalVerifySchema(BaseModel):
    isVerified: bool = True

