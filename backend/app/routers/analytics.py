from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth.dependencies import require_admin
from app.schemas.analytics import AnalyticsOut
from app.services.analytics_service import (
    get_total_revenue,
    get_total_bookings,
    get_total_tickets_sold,
    get_cancellation_rate,
    get_percent_change,
    get_revenue_by_format,
    get_daily_revenue,
    get_top_movies,
    get_average_occupancy,
)

router = APIRouter(prefix="/admin/analytics", tags=["analytics"])

WINDOW_DAYS = 30


@router.get("", response_model=AnalyticsOut)
def get_analytics(db: Session = Depends(get_db), _admin=Depends(require_admin)):
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(days=WINDOW_DAYS)
    # The "previous period" is the WINDOW_DAYS immediately before
    # window_start -- e.g. if the current window is the last 30 days,
    # the previous one is the 30 days before that, not all-time-before.
    previous_window_start = window_start - timedelta(days=WINDOW_DAYS)

    total_revenue = get_total_revenue(db, window_start)
    previous_revenue = get_total_revenue(db, previous_window_start, window_start)

    total_bookings = get_total_bookings(db, window_start)
    previous_bookings = get_total_bookings(db, previous_window_start, window_start)

    average_order_value = round(total_revenue / total_bookings) if total_bookings else 0

    return AnalyticsOut(
        window_days=WINDOW_DAYS,
        total_revenue=total_revenue,
        total_bookings=total_bookings,
        total_tickets_sold=get_total_tickets_sold(db, window_start),
        cancellation_rate=get_cancellation_rate(db, window_start),
        average_order_value=average_order_value,
        average_occupancy=get_average_occupancy(db, window_start),
        revenue_change_pct=get_percent_change(total_revenue, previous_revenue),
        bookings_change_pct=get_percent_change(total_bookings, previous_bookings),
        daily_revenue=get_daily_revenue(db, window_start, WINDOW_DAYS),
        top_movies=get_top_movies(db, window_start),
        revenue_by_format=get_revenue_by_format(db, window_start),
    )