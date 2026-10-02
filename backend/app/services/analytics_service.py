"""
Aggregation queries for the admin analytics dashboard. Kept separate
from booking_service.py since these are read-only reporting queries,
not part of the booking/payment transaction flow.
"""
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from sqlalchemy import func, cast, Date
from sqlalchemy.orm import Session

from app.models.payment import Payment
from app.models.booking import Booking, BookingStatus
from app.models.booking_seat import BookingSeat
from app.models.showtime import Showtime
from app.models.movie import Movie
from app.models.seat import Seat

VN_TZ = "Asia/Ho_Chi_Minh"


def get_total_revenue(db: Session, window_start: datetime, window_end: Optional[datetime] = None) -> int:
    """
    window_end is exclusive and optional -- omitted, this sums everything
    from window_start onward. Passed, it bounds a closed period (used for
    the "previous period" comparison, which needs a start AND an end).
    """
    query = db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(
        Payment.succeeded == 1, Payment.created_at >= window_start
    )
    if window_end is not None:
        query = query.filter(Payment.created_at < window_end)
    return int(query.scalar())


def get_total_bookings(db: Session, window_start: datetime, window_end: Optional[datetime] = None) -> int:
    """Count of distinct bookings that received at least one successful payment in the window."""
    query = db.query(func.count(func.distinct(Payment.booking_id))).filter(
        Payment.succeeded == 1, Payment.created_at >= window_start
    )
    if window_end is not None:
        query = query.filter(Payment.created_at < window_end)
    return int(query.scalar())


def get_total_tickets_sold(db: Session, window_start: datetime) -> int:
    """
    Sum of total_seats across bookings paid for in the window. Not the
    same as counting BookingSeat rows directly -- that would double-count
    nothing here, but summing total_seats is simpler since it's already
    snapshotted on the booking and avoids an extra join.
    """
    total = (
        db.query(func.coalesce(func.sum(Booking.total_seats), 0))
        .join(Payment, Payment.booking_id == Booking.id)
        .filter(Payment.succeeded == 1, Payment.created_at >= window_start)
        .scalar()
    )
    return int(total)


def get_cancellation_rate(db: Session, window_start: datetime) -> float:
    """
    % of bookings CREATED in the window that ended up CANCELLED (whether
    by the customer or by expiry). Based on Booking.created_at, not
    Payment.created_at -- a cancelled booking never has a payment, so
    this has to look at bookings directly, not payments.
    """
    total = db.query(func.count(Booking.id)).filter(Booking.created_at >= window_start).scalar()
    if total == 0:
        return 0.0
    cancelled = (
        db.query(func.count(Booking.id))
        .filter(Booking.created_at >= window_start, Booking.status == BookingStatus.CANCELLED)
        .scalar()
    )
    return round(cancelled / total * 100, 1)


def get_percent_change(current: int, previous: int) -> Optional[float]:
    """
    None when there's no previous-period baseline to compare against
    (previous == 0) -- showing e.g. "+infinity%" or treating 0->5 as a
    number would be misleading, so the frontend just omits the badge
    in that case rather than displaying a nonsense percentage.
    """
    if previous == 0:
        return None
    return round((current - previous) / previous * 100, 1)


def get_revenue_by_format(db: Session, window_start: datetime) -> List[dict]:
    rows = (
        db.query(Showtime.format, func.sum(Payment.amount))
        .join(Booking, Booking.id == Payment.booking_id)
        .join(Showtime, Showtime.id == Booking.showtime_id)
        .filter(Payment.succeeded == 1, Payment.created_at >= window_start)
        .group_by(Showtime.format)
        .all()
    )
    return [{"format": fmt.value, "revenue": int(revenue)} for fmt, revenue in rows]


def get_daily_revenue(db: Session, window_start: datetime, days: int) -> List[dict]:
    rows = (
        db.query(
            cast(func.timezone(VN_TZ, Payment.created_at), Date).label("day"),
            func.sum(Payment.amount).label("revenue"),
        )
        .filter(Payment.succeeded == 1, Payment.created_at >= window_start)
        .group_by("day")
        .all()
    )
    revenue_by_day = {row.day.isoformat(): int(row.revenue) for row in rows}

    today = datetime.now(timezone.utc).date()
    series = []
    for i in range(days - 1, -1, -1):
        day = today - timedelta(days=i)
        key = day.isoformat()
        series.append({"date": key, "revenue": revenue_by_day.get(key, 0)})
    return series


def get_top_movies(db: Session, window_start: datetime, limit: int = 5) -> List[dict]:
    rows = (
        db.query(
            Movie.id,
            Movie.title,
            func.sum(Payment.amount).label("revenue"),
            func.count(Payment.id).label("payments_count"),
        )
        .join(Booking, Booking.id == Payment.booking_id)
        .join(Showtime, Showtime.id == Booking.showtime_id)
        .join(Movie, Movie.id == Showtime.movie_id)
        .filter(Payment.succeeded == 1, Payment.created_at >= window_start)
        .group_by(Movie.id, Movie.title)
        .order_by(func.sum(Payment.amount).desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "movie_id": r.id,
            "title": r.title,
            "revenue": int(r.revenue),
            "bookings_count": r.payments_count,
        }
        for r in rows
    ]


def get_average_occupancy(db: Session, window_start: datetime) -> float:
    now = datetime.now(timezone.utc)

    showtimes = (
        db.query(Showtime.id, Showtime.theater_id)
        .filter(Showtime.start_time >= window_start, Showtime.start_time <= now)
        .all()
    )
    if not showtimes:
        return 0.0

    showtime_ids = [s.id for s in showtimes]
    theater_ids = {s.theater_id for s in showtimes}

    total_seats_by_theater = dict(
        db.query(Seat.theater_id, func.count(Seat.id))
        .filter(Seat.theater_id.in_(theater_ids))
        .group_by(Seat.theater_id)
        .all()
    )

    booked_by_showtime = dict(
        db.query(BookingSeat.showtime_id, func.count(BookingSeat.id))
        .filter(BookingSeat.showtime_id.in_(showtime_ids))
        .group_by(BookingSeat.showtime_id)
        .all()
    )

    rates = []
    for s in showtimes:
        total = total_seats_by_theater.get(s.theater_id, 0)
        if total == 0:
            continue
        booked = booked_by_showtime.get(s.id, 0)
        rates.append(booked / total)

    if not rates:
        return 0.0
    return round(sum(rates) / len(rates) * 100, 1)