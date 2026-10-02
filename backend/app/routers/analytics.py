from datetime import date as date_type, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import Optional, List

from app.database import get_db
from app.auth.dependencies import require_admin
from app.schemas.analytics import AnalyticsOut
from app.services.analytics_service import (
    date_range_to_utc_bounds,
    get_total_revenue,
    get_total_bookings,
    get_total_tickets_sold,
    get_cancellation_rate,
    get_percent_change,
    get_revenue_by_format,
    get_revenue_by_seat_type,
    get_revenue_by_theater,
    get_bookings_by_hour,
    get_bookings_by_weekday,
    get_daily_revenue,
    get_top_movies,
    get_showtime_performance
)
from app.schemas.analytics import ShowtimePerformance

router = APIRouter(prefix="/admin/analytics", tags=["analytics"])

MAX_RANGE_DAYS = 366  # chặn range quá lớn làm query/biểu đồ phình to vô lý


@router.get("", response_model=AnalyticsOut)
def get_analytics(
    date_from: date_type = Query(...),
    date_to: date_type = Query(...),
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    if date_from > date_to:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="date_from must not be after date_to")

    range_days = (date_to - date_from).days + 1
    if range_days > MAX_RANGE_DAYS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Date range too large (max {MAX_RANGE_DAYS} days)",
        )

    window_start, window_end = date_range_to_utc_bounds(date_from, date_to)

    # Kỳ trước để so sánh %: cùng độ dài (range_days), nằm ngay trước
    # window_start.
    previous_date_to = date_from - timedelta(days=1)
    previous_date_from = previous_date_to - timedelta(days=range_days - 1)
    previous_window_start, previous_window_end = date_range_to_utc_bounds(previous_date_from, previous_date_to)

    total_revenue = get_total_revenue(db, window_start, window_end)
    previous_revenue = get_total_revenue(db, previous_window_start, previous_window_end)

    total_bookings = get_total_bookings(db, window_start, window_end)
    previous_bookings = get_total_bookings(db, previous_window_start, previous_window_end)

    average_order_value = round(total_revenue / total_bookings) if total_bookings else 0

    return AnalyticsOut(
        date_from=date_from.isoformat(),
        date_to=date_to.isoformat(),
        total_revenue=total_revenue,
        total_bookings=total_bookings,
        total_tickets_sold=get_total_tickets_sold(db, window_start, window_end),
        cancellation_rate=get_cancellation_rate(db, window_start, window_end),
        average_order_value=average_order_value,
        revenue_change_pct=get_percent_change(total_revenue, previous_revenue),
        bookings_change_pct=get_percent_change(total_bookings, previous_bookings),
        daily_revenue=get_daily_revenue(db, window_start, window_end, date_from, date_to),
        top_movies=get_top_movies(db, window_start, window_end),
        revenue_by_format=get_revenue_by_format(db, window_start, window_end),
        revenue_by_seat_type=get_revenue_by_seat_type(db, window_start, window_end),
        revenue_by_theater=get_revenue_by_theater(db, window_start, window_end),
        peak_hours=get_bookings_by_hour(db, window_start, window_end),
        bookings_by_weekday=get_bookings_by_weekday(db, window_start, window_end),
    )

@router.get("/showtime-performance", response_model=List[ShowtimePerformance])
def get_showtime_performance_route(
    date: date_type = Query(...),
    theater_id: Optional[int] = None,
    movie_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    return get_showtime_performance(db, date, theater_id, movie_id)