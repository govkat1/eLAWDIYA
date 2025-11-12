from sqlalchemy import Column, String, DateTime, Boolean, Integer, Float, Enum as SQLEnum
from sqlalchemy.sql import func
from app.database import Base
import enum
from datetime import datetime


class UserRole(str, enum.Enum):
    USER = "user"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"


class ReportStatus(str, enum.Enum):
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(SQLEnum(UserRole), default=UserRole.USER)
    total_points = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Report(Base):
    __tablename__ = "reports"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, index=True)
    violation_type = Column(String)  # car or bike
    location = Column(String, index=True)
    description = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    status = Column(SQLEnum(ReportStatus), default=ReportStatus.PENDING, index=True)
    detection_confidence = Column(Float, default=0.0)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    points_awarded = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    verified_at = Column(DateTime(timezone=True), nullable=True)
    verified_by = Column(String, nullable=True)
