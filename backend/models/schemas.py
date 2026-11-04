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
    patientName: str = Field(..., min_length=2)
    bloodGroup: str = Field(...)
    units: int = Field(default=1, ge=1, le=50)
    hospitalName: str = Field(..., min_length=2)
    hospitalAddress: Optional[str] = ""
    city: str = Field(..., min_length=2)
    state: Optional[str] = ""
    contactPhone: str = Field(..., min_length=7)
    contactName: Optional[str] = ""
    urgency: str = Field(default="NORMAL")
    requiredDate: Optional[str] = None
    notes: Optional[str] = ""

class BloodRequestStatusUpdateSchema(BaseModel):
    status: str

class DonorAvailabilitySchema(BaseModel):
    availability: bool

class DonorContactSchema(BaseModel):
    message: str = Field(..., min_length=1)
    requestId: Optional[str] = None

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
    decision: str  # APPROVED / REJECTED
    comments: Optional[str] = None

class UserStatusUpdateSchema(BaseModel):
    status: str  # ACTIVE / BLOCKED

class DonorVerifySchema(BaseModel):
    status: str  # VERIFIED / REJECTED / PENDING

class HospitalVerifySchema(BaseModel):
    isVerified: bool = True

