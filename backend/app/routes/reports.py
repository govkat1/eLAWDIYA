from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form
from sqlalchemy.orm import Session
from sqlalchemy import func
from uuid import uuid4
from typing import Optional
from app.database import get_db
from app.models.models import Report, User, ReportStatus
from app.schemas.schemas import ReportCreate, ReportResponse
from app.utils.security import get_current_user
import os

router = APIRouter()

UPLOAD_DIR = "uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR)


@router.post("/", response_model=ReportResponse)
async def create_report(
    violation_type: str = Form(...),
    location: str = Form(...),
    description: Optional[str] = Form(None),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    image: Optional[UploadFile] = File(None),
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new traffic violation report."""
    image_url = None
    if image:
        # Save image
        file_extension = image.filename.split(".")[-1]
        unique_filename = f"{uuid4()}.{file_extension}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)

        with open(file_path, "wb") as f:
            content = await image.read()
            f.write(content)

        image_url = f"/uploads/{unique_filename}"

    # Create report
    new_report = Report(
        id=str(uuid4()),
        user_id=user_id,
        violation_type=violation_type,
        location=location,
        description=description,
        image_url=image_url,
        latitude=latitude,
        longitude=longitude,
        status=ReportStatus.PENDING,
    )

    db.add(new_report)
    db.commit()
    db.refresh(new_report)

    return new_report


@router.get("/", response_model=list[ReportResponse])
async def get_user_reports(
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all reports for the current user."""
    reports = db.query(Report).filter(Report.user_id == user_id).all()
    return reports


@router.get("/{report_id}", response_model=ReportResponse)
async def get_report(
    report_id: str,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a specific report."""
    report = db.query(Report).filter(Report.id == report_id).first()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )

    if report.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this report"
        )

    return report
