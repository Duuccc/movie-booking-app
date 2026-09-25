"""
Aggregation queries for the admin analytics dashboard. Kept separate
from booking_service.py since these are read-only reporting queries,
not part of the booking/payment transaction flow.
"""
from datetime import datetime, timedelta, timezone
from typing import List

from sqlalchemy import func, cast, Date
from sqlalchemy.orm import Session

from app.models.payment import Payment
from app.models.booking import Booking, BookingStatus
from app.models.booking_seat import BookingSeat
from app.models.showtime import Showtime
from app.models.movie import Movie
from app.models.seat import Seat

VN_TZ = "Asia/Ho_Chi_Minh"


def get_total_revenue(db: Session, window_start: datetime) -> int:
    total = (
        db.query(func.coalesce(func.sum(Payment.amount), 0))
        .filter(Payment.succeeded == 1, Payment.created_at >= window_start)
        .scalar()
    )
    return int(total)


def get_daily_revenue(db: Session, window_start: datetime, days: int) -> List[dict]:
    """
    Revenue per VN-local calendar day, for the full window, including
    days with zero revenue (a chart with gaps looks broken -- fill them).
    """
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
    """
    Average % of seats filled, across showtimes that have already
    screened within the window (start_time in the past -- a future
    showtime's occupancy isn't a meaningful number yet, it's still
    filling up).
    """
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