"""
Aggregation queries for the admin analytics dashboard.
"""
from datetime import datetime, date as date_type, timedelta, timezone
from typing import List, Optional
from zoneinfo import ZoneInfo

from sqlalchemy import func, cast, Date
from sqlalchemy.orm import Session

from app.models.payment import Payment
from app.models.booking import Booking, BookingStatus
from app.models.booking_seat import BookingSeat
from app.models.showtime import Showtime
from app.models.movie import Movie
from app.models.seat import Seat
from app.models.theater import Theater

VN_TZ_NAME = "Asia/Ho_Chi_Minh"
VN_TZ = ZoneInfo(VN_TZ_NAME)


def date_range_to_utc_bounds(date_from: date_type, date_to: date_type) -> tuple[datetime, datetime]:
    """
    Chuyển 1 khoảng ngày VN-local (inclusive cả 2 đầu) thành cặp
    (window_start, window_end) dạng UTC-aware datetime, với window_end
    là điểm loại trừ (exclusive) -- tức là nửa đêm VN của ngày SAU
    date_to. Cùng cách làm với filter date ở GET /showtimes.
    """
    window_start = datetime.combine(date_from, datetime.min.time(), tzinfo=VN_TZ)
    window_end = datetime.combine(date_to, datetime.min.time(), tzinfo=VN_TZ) + timedelta(days=1)
    return window_start, window_end


def get_total_revenue(db: Session, window_start: datetime, window_end: datetime) -> int:
    total = (
        db.query(func.coalesce(func.sum(Payment.amount), 0))
        .filter(Payment.succeeded == 1, Payment.created_at >= window_start, Payment.created_at < window_end)
        .scalar()
    )
    return int(total)


def get_total_bookings(db: Session, window_start: datetime, window_end: datetime) -> int:
    total = (
        db.query(func.count(func.distinct(Payment.booking_id)))
        .filter(Payment.succeeded == 1, Payment.created_at >= window_start, Payment.created_at < window_end)
        .scalar()
    )
    return int(total)


def get_total_tickets_sold(db: Session, window_start: datetime, window_end: datetime) -> int:
    total = (
        db.query(func.coalesce(func.sum(Booking.total_seats), 0))
        .join(Payment, Payment.booking_id == Booking.id)
        .filter(Payment.succeeded == 1, Payment.created_at >= window_start, Payment.created_at < window_end)
        .scalar()
    )
    return int(total)


def get_cancellation_rate(db: Session, window_start: datetime, window_end: datetime) -> float:
    total = (
        db.query(func.count(Booking.id))
        .filter(Booking.created_at >= window_start, Booking.created_at < window_end)
        .scalar()
    )
    if total == 0:
        return 0.0
    cancelled = (
        db.query(func.count(Booking.id))
        .filter(
            Booking.created_at >= window_start,
            Booking.created_at < window_end,
            Booking.status == BookingStatus.CANCELLED,
        )
        .scalar()
    )
    return round(cancelled / total * 100, 1)


def get_percent_change(current: int, previous: int) -> Optional[float]:
    if previous == 0:
        return None
    return round((current - previous) / previous * 100, 1)


def get_revenue_by_format(db: Session, window_start: datetime, window_end: datetime) -> List[dict]:
    rows = (
        db.query(Showtime.format, func.sum(Payment.amount))
        .join(Booking, Booking.id == Payment.booking_id)
        .join(Showtime, Showtime.id == Booking.showtime_id)
        .filter(Payment.succeeded == 1, Payment.created_at >= window_start, Payment.created_at < window_end)
        .group_by(Showtime.format)
        .all()
    )
    return [{"format": fmt.value, "revenue": int(revenue)} for fmt, revenue in rows]


def get_revenue_by_seat_type(db: Session, window_start: datetime, window_end: datetime) -> List[dict]:
    rows = (
        db.query(Seat.seat_type, func.sum(Payment.amount / Booking.total_seats))
        .join(BookingSeat, BookingSeat.seat_id == Seat.id)
        .join(Booking, Booking.id == BookingSeat.booking_id)
        .join(Payment, Payment.booking_id == Booking.id)
        .filter(
            Payment.succeeded == 1,
            Payment.created_at >= window_start,
            Payment.created_at < window_end,
            BookingSeat.showtime_id == Booking.showtime_id,
        )
        .group_by(Seat.seat_type)
        .all()
    )
    return [{"seat_type": seat_type.value, "revenue": int(revenue)} for seat_type, revenue in rows]


def get_revenue_by_theater(db: Session, window_start: datetime, window_end: datetime) -> List[dict]:
    rows = (
        db.query(Theater.id, Theater.name, func.sum(Payment.amount))
        .join(Showtime, Showtime.theater_id == Theater.id)
        .join(Booking, Booking.showtime_id == Showtime.id)
        .join(Payment, Payment.booking_id == Booking.id)
        .filter(Payment.succeeded == 1, Payment.created_at >= window_start, Payment.created_at < window_end)
        .group_by(Theater.id, Theater.name)
        .order_by(func.sum(Payment.amount).desc())
        .all()
    )
    return [{"theater_id": tid, "theater_name": name, "revenue": int(revenue)} for tid, name, revenue in rows]


def get_bookings_by_hour(db: Session, window_start: datetime, window_end: datetime) -> List[dict]:
    rows = (
        db.query(
            func.extract('hour', func.timezone(VN_TZ_NAME, Booking.created_at)).label('hour'),
            func.count(Booking.id),
        )
        .filter(Booking.created_at >= window_start, Booking.created_at < window_end)
        .group_by('hour')
        .all()
    )
    counts_by_hour = {int(hour): count for hour, count in rows}
    return [{"hour": h, "bookings_count": counts_by_hour.get(h, 0)} for h in range(24)]


def get_bookings_by_weekday(db: Session, window_start: datetime, window_end: datetime) -> List[dict]:
    rows = (
        db.query(
            func.extract('dow', func.timezone(VN_TZ_NAME, Booking.created_at)).label('dow'),
            func.count(Booking.id),
        )
        .filter(Booking.created_at >= window_start, Booking.created_at < window_end)
        .group_by('dow')
        .all()
    )
    counts_by_dow = {int(dow): count for dow, count in rows}
    dow_labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return [{"weekday": dow_labels[i], "bookings_count": counts_by_dow.get(i, 0)} for i in range(7)]


def get_daily_revenue(db: Session, window_start: datetime, window_end: datetime, date_from: date_type, date_to: date_type) -> List[dict]:
    """
    date_from/date_to (VN-local calendar dates) dùng để sinh đủ các
    ngày trong khoảng, kể cả ngày không có doanh thu -- window_start/
    window_end chỉ dùng để query, không dùng để sinh chuỗi ngày vì
    chúng là datetime UTC, không tiện lặp theo ngày lịch trực tiếp.
    """
    rows = (
        db.query(
            cast(func.timezone(VN_TZ_NAME, Payment.created_at), Date).label("day"),
            func.sum(Payment.amount).label("revenue"),
        )
        .filter(Payment.succeeded == 1, Payment.created_at >= window_start, Payment.created_at < window_end)
        .group_by("day")
        .all()
    )
    revenue_by_day = {row.day.isoformat(): int(row.revenue) for row in rows}

    series = []
    d = date_from
    while d <= date_to:
        key = d.isoformat()
        series.append({"date": key, "revenue": revenue_by_day.get(key, 0)})
        d += timedelta(days=1)
    return series


def get_top_movies(db: Session, window_start: datetime, window_end: datetime, limit: int = 5) -> List[dict]:
    rows = (
        db.query(
            Movie.id,
            Movie.title,
            func.sum(Payment.amount).label("revenue"),
        )
        .join(Booking, Booking.id == Payment.booking_id)
        .join(Showtime, Showtime.id == Booking.showtime_id)
        .join(Movie, Movie.id == Showtime.movie_id)
        .filter(Payment.succeeded == 1, Payment.created_at >= window_start, Payment.created_at < window_end)
        .group_by(Movie.id, Movie.title)
        .order_by(func.sum(Payment.amount).desc())
        .limit(limit)
        .all()
    )
    return [{"movie_id": r.id, "title": r.title, "revenue": int(r.revenue)} for r in rows]

def get_showtime_performance(
    db: Session,
    target_date: date_type,
    theater_id: Optional[int] = None,
    movie_id: Optional[int] = None,
) -> List[dict]:
    """
    Mọi showtime chiếu trong 1 ngày VN-local cụ thể, kèm số ghế đã book
    và % lấp đầy -- dùng để trả lời "suất nào/phim nào/rạp nào đang hút
    khách hơn", khác với các hàm revenue_by_* ở trên (những hàm đó tổng
    hợp theo khoảng ngày, hàm này liệt kê từng suất trong đúng 1 ngày).

    "booked" dùng cùng định nghĩa với get_availability_for_showtimes
    (bất kỳ BookingSeat nào, không phân biệt PENDING/PAID) -- nhất quán
    với mọi nơi khác trong app.
    """
    day_start = datetime.combine(target_date, datetime.min.time(), tzinfo=VN_TZ)
    day_end = day_start + timedelta(days=1)

    query = (
        db.query(Showtime)
        .filter(Showtime.start_time >= day_start, Showtime.start_time < day_end)
    )
    if theater_id is not None:
        query = query.filter(Showtime.theater_id == theater_id)
    if movie_id is not None:
        query = query.filter(Showtime.movie_id == movie_id)

    showtimes = query.all()
    if not showtimes:
        return []

    showtime_ids = [s.id for s in showtimes]
    theater_ids = {s.theater_id for s in showtimes}
    movie_ids = {s.movie_id for s in showtimes}

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
    movie_titles = dict(
        db.query(Movie.id, Movie.title).filter(Movie.id.in_(movie_ids)).all()
    )
    theater_names = dict(
        db.query(Theater.id, Theater.name).filter(Theater.id.in_(theater_ids)).all()
    )

    rows = []
    for s in showtimes:
        total = total_seats_by_theater.get(s.theater_id, 0)
        booked = booked_by_showtime.get(s.id, 0)
        occupancy = round(booked / total * 100, 1) if total > 0 else 0.0
        rows.append({
            "showtime_id": s.id,
            "start_time": s.start_time,
            "movie_title": movie_titles.get(s.movie_id, "Unknown"),
            "theater_name": theater_names.get(s.theater_id, "Unknown"),
            "format": s.format.value,
            "booked_seats": booked,
            "total_seats": total,
            "occupancy_pct": occupancy,
        })

    # Occupancy giảm dần -- suất đông khách nhất lên đầu, đúng mục đích
    # "xem cái nào đang chiếm sóng" thay vì sắp theo giờ chiếu.
    rows.sort(key=lambda r: r["occupancy_pct"], reverse=True)
    return rows