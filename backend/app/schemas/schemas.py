from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from enum import Enum


class UserRole(str, Enum):
    USER = "user"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"


class ReportStatus(str, Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"


# Auth Schemas
class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    token: str
    userType: str


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: str
    total_points: int
    created_at: datetime

    class Config:
        from_attributes = True


# Report Schemas
class ReportCreate(BaseModel):
    violation_type: str  # car or bike
    location: str
    description: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class ReportResponse(BaseModel):
    id: str
    user_id: str
    violation_type: str
    location: str
    description: Optional[str]
    image_url: Optional[str]
    status: str
    detection_confidence: float
    points_awarded: int
    created_at: datetime
    verified_at: Optional[datetime]

    class Config:
        from_attributes = True


# Admin Schemas
class ReportVerification(BaseModel):
    report_id: str
    verified: bool


class AdminReportResponse(BaseModel):
    id: str
    violation_type: str
    location: str
    description: Optional[str]
    image_url: Optional[str]
    reporter_name: str
    created_at: datetime

    class Config:
        from_attributes = True


# Leaderboard Schemas
class LeaderboardUser(BaseModel):
    rank: int
    name: str
    total_points: int
    report_count: int
    verified_count: int


class UserRank(BaseModel):
    rank: int
    name: str
    total_points: int
    report_count: int
    verified_count: int
