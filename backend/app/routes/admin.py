from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime
from app.database import get_db
from app.models.models import Report, User, ReportStatus, UserRole
from app.schemas.schemas import ReportVerification, AdminReportResponse
from app.utils.security import get_current_user

router = APIRouter()


async def get_current_admin(
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Verify the current user is an admin."""
    user = db.query(User).filter(User.id == user_id).first()

    if not user or user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    return user_id


@router.get("/verify")
async def get_pending_reports(
    admin_id: str = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Get all pending reports for verification."""
    pending_reports = db.query(Report).filter(
        Report.status == ReportStatus.PENDING
    ).all()

    total_reports = db.query(func.count(Report.id)).scalar()
    verified_reports = db.query(func.count(Report.id)).filter(
        Report.status == ReportStatus.VERIFIED
    ).scalar()
    pending_count = len(pending_reports)

    stats = {
        "totalReports": total_reports,
        "verifiedReports": verified_reports,
        "pendingReports": pending_count,
    }

    return {
        "pendingReports": pending_reports,
        "stats": stats,
    }


@router.post("/verify")
async def verify_report(
    verification: ReportVerification,
    admin_id: str = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Verify or reject a report."""
    report = db.query(Report).filter(Report.id == verification.report_id).first()

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )

    if verification.verified:
        report.status = ReportStatus.VERIFIED
        report.verified_by = admin_id
        report.verified_at = datetime.utcnow()
        report.points_awarded = 10  # Award points for verified report

        # Update user points
        user = db.query(User).filter(User.id == report.user_id).first()
        if user:
            user.total_points += 10
    else:
        report.status = ReportStatus.REJECTED
        report.verified_by = admin_id
        report.verified_at = datetime.utcnow()

    db.commit()
    db.refresh(report)

    return {
        "message": "Report updated successfully",
        "report": report,
    }
