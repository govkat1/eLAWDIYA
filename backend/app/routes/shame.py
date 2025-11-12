from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from app.database import get_db
from app.models.models import Report, User
from app.schemas.schemas import LeaderboardUser, UserRank

router = APIRouter()


@router.get("/top-offenders")
async def top_offenders(limit: int = 10, db: Session = Depends(get_db)):
    """Return top offender locations and basic stats (mocked/aggregated)."""
    # Basic aggregation by location
    rows = (
        db.query(Report.location, Report.violation_type, func.count(Report.id).label('count'))
        .filter(Report.status == 'verified')
        .group_by(Report.location, Report.violation_type)
        .order_by(func.count(Report.id).desc())
        .limit(limit)
        .all()
    )

    offenders = []
    for row in rows:
        offenders.append({
            'location': row[0],
            'violation_type': row[1],
            'count': int(row[2]),
        })

    return { 'data': { 'offenders': offenders } }


@router.get("/leaderboard")
async def leaderboard(limit: int = 10, db: Session = Depends(get_db)):
    """Return leaderboard of top users by points."""
    rows = (
        db.query(User.id, User.name, User.total_points)
        .order_by(User.total_points.desc())
        .limit(limit)
        .all()
    )

    leaderboard = []
    rank = 1
    for r in rows:
        leaderboard.append({
            'rank': rank,
            'name': r.name,
            'total_points': r.total_points or 0,
            'report_count': 0,
            'verified_count': 0,
        })
        rank += 1

    return { 'leaderboard': leaderboard }
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, timedelta
from app.database import get_db
from app.models.models import Report, User, ReportStatus

router = APIRouter()


@router.get("/top-offenders")
async def get_top_offenders(
    limit: int = Query(50, ge=1, le=100),
    vehicle_type: str = Query(None),
    time_range: str = Query("30"),
    db: Session = Depends(get_db),
):
    """Get top violation hotspots (Hall of Shame)."""

    # Calculate date range
    days = int(time_range) if time_range != "all" else 365
    start_date = datetime.utcnow() - timedelta(days=days)

    # Build query
    query = db.query(Report).filter(
        and_(
            Report.status == ReportStatus.VERIFIED,
            Report.created_at >= start_date,
        )
    )

    if vehicle_type and vehicle_type != "all":
        query = query.filter(Report.violation_type == vehicle_type)

    reports = query.all()

    # Group by location to get hotspots
    location_stats = {}
    for report in reports:
        if report.location not in location_stats:
            location_stats[report.location] = {
                "total_violations": 0,
                "latest_violation": report.created_at,
                "average_confidence": 0,
                "unique_reporters": set(),
                "total_points_awarded": 0,
                "violation_type": report.violation_type,
                "reports": [],
            }

        stats = location_stats[report.location]
        stats["total_violations"] += 1
        stats["latest_violation"] = max(stats["latest_violation"], report.created_at)
        stats["average_confidence"] += report.detection_confidence
        stats["unique_reporters"].add(report.user_id)
        stats["total_points_awarded"] += report.points_awarded
        stats["reports"].append(report)

    # Calculate averages and sort
    offenders = []
    for location, stats in location_stats.items():
        avg_confidence = stats["average_confidence"] / max(stats["total_violations"], 1)
        risk_level = "critical" if stats["total_violations"] >= 5 else "high" if stats["total_violations"] >= 3 else "medium" if stats["total_violations"] >= 1 else "low"

        offenders.append({
            "violation_type": stats["violation_type"],
            "location": {
                "address": location,
                "latitude": stats["reports"][0].latitude,
                "longitude": stats["reports"][0].longitude,
            },
            "statistics": {
                "total_violations": stats["total_violations"],
                "latest_violation": stats["latest_violation"],
                "average_confidence": avg_confidence,
                "unique_reporters": len(stats["unique_reporters"]),
                "total_points_awarded": stats["total_points_awarded"],
            },
            "risk_level": risk_level,
        })

    # Sort by total violations
    offenders.sort(key=lambda x: x["statistics"]["total_violations"], reverse=True)
    offenders = offenders[:limit]

    # Get overall stats
    overall_stats = {
        "total_verified_reports": len(reports),
        "unique_locations": len(location_stats),
        "unique_reporters": len(set(r.user_id for r in reports)),
        "violations_by_type": {
            "car": len([r for r in reports if r.violation_type == "car"]),
            "bike": len([r for r in reports if r.violation_type == "bike"]),
        },
        "average_detection_confidence": sum(r.detection_confidence for r in reports) / max(len(reports), 1),
        "total_points_awarded": sum(r.points_awarded for r in reports),
    }

    # Get recent activity
    recent_reports = db.query(Report).filter(
        Report.status == ReportStatus.VERIFIED
    ).order_by(Report.created_at.desc()).limit(20).all()

    recent_activity = []
    for report in recent_reports:
        user = db.query(User).filter(User.id == report.user_id).first()
        recent_activity.append({
            "id": report.id,
            "violation_type": report.violation_type,
            "location": {
                "address": report.location,
                "latitude": report.latitude,
                "longitude": report.longitude,
            },
            "timestamp": report.created_at,
            "detection_confidence": report.detection_confidence,
            "reporter_name": user.name if user else "Anonymous",
        })

    return {
        "data": {
            "offenders": offenders,
            "overall_stats": overall_stats,
            "recent_activity": recent_activity,
        }
    }


@router.get("/leaderboard")
async def get_leaderboard(db: Session = Depends(get_db)):
    """Get leaderboard of top reporters."""
    users = db.query(
        User.id,
        User.name,
        User.total_points,
        func.count(Report.id).label("report_count"),
        func.sum(func.cast(Report.status == ReportStatus.VERIFIED, db.INTEGER)).label("verified_count"),
    ).outerjoin(Report, User.id == Report.user_id).group_by(User.id).all()

    # Sort by points
    users_sorted = sorted(
        users,
        key=lambda x: (x.total_points, x.verified_count or 0),
        reverse=True
    )

    leaderboard = []
    for rank, user in enumerate(users_sorted[:100], 1):
        leaderboard.append({
            "rank": rank,
            "name": user.name,
            "total_points": user.total_points,
            "report_count": user.report_count,
            "verified_count": user.verified_count or 0,
        })

    # Find current user rank if authenticated
    user_rank = None
    if leaderboard:
        user_rank = leaderboard[0]  # Placeholder

    return {
        "leaderboard": leaderboard,
        "user_rank": user_rank,
    }
