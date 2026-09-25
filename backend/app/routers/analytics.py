from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth.dependencies import require_admin
from app.schemas.analytics import AnalyticsOut
from app.services.analytics_service import (
    get_total_revenue,
    get_daily_revenue,
    get_top_movies,
    get_average_occupancy,
)

router = APIRouter(prefix="/admin/analytics", tags=["analytics"])

WINDOW_DAYS = 30  # fixed for now, per the scoping decision -- no date picker yet


@router.get("", response_model=AnalyticsOut)
def get_analytics(db: Session = Depends(get_db), _admin=Depends(require_admin)):
    window_start = datetime.now(timezone.utc) - timedelta(days=WINDOW_DAYS)

    return AnalyticsOut(
        window_days=WINDOW_DAYS,
        total_revenue=get_total_revenue(db, window_start),
        average_occupancy=get_average_occupancy(db, window_start),
        daily_revenue=get_daily_revenue(db, window_start, WINDOW_DAYS),
        top_movies=get_top_movies(db, window_start),
    )