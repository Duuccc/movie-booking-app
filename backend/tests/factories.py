from datetime import datetime, timedelta, timezone

from app.auth.jwt import create_access_token
from app.auth.password import hash_password
from app.models import User, UserRole, Movie, Theater, Seat, Showtime
from app.models.seat import SeatType
from app.models.showtime import ShowtimeFormat

from app.models.booking import Booking, BookingStatus, PaymentStatus
from app.models.booking_seat import BookingSeat

from zoneinfo import ZoneInfo

from jose import jwt
from app.config import settings

import uuid

from app.models.payment import Payment, PaymentMethod

DEFAULT_PASSWORD = "Password123!"
# bcrypt is deliberately slow (~0.2s per hash). Hash once per test run and
# reuse it for every user instead of paying that cost in every test.
_DEFAULT_PASSWORD_HASH = hash_password(DEFAULT_PASSWORD)

DEFAULT_LAYOUT = (("A", 5, SeatType.STANDARD),)

VN_TZ = ZoneInfo("Asia/Ho_Chi_Minh")


def vn_time(year, month, day, hour=0, minute=0) -> datetime:
    """A moment on the Vietnam wall clock (UTC+7), as an aware datetime."""
    return datetime(year, month, day, hour, minute, tzinfo=VN_TZ)


def make_user(db, *, email="user@test.com", name="Test User", role=UserRole.CUSTOMER) -> User:
    user = User(name=name, email=email, password_hash=_DEFAULT_PASSWORD_HASH, role=role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def auth_headers(user: User) -> dict:
    # Build the token directly instead of calling POST /auth/login: booking
    # tests shouldn't start failing just because login broke. The login
    # endpoint gets its own tests (Milestone 2).
    token = create_access_token(user_id=user.id, role=user.role.value)
    return {"Authorization": f"Bearer {token}"}


def make_movie(db, *, title="Test Movie", release_date=None) -> Movie:
    movie = Movie(
        title=title, description="A test movie", duration=100, genre="Drama",
        release_date=release_date,
    )
    db.add(movie)
    db.commit()
    db.refresh(movie)
    return movie



def make_theater(db, *, name="Test Theater", layout=DEFAULT_LAYOUT) -> Theater:
    """layout = ((row_letter, seat_count, SeatType), ...)"""
    theater = Theater(name=name, location="Somewhere")
    db.add(theater)
    db.flush()  # assigns theater.id
    for row, count, seat_type in layout:
        for number in range(1, count + 1):
            db.add(Seat(theater_id=theater.id, row=row, seat_number=number, seat_type=seat_type))
    db.commit()
    db.refresh(theater)
    return theater


def seat_ids(db, theater_id: int, *labels: str) -> list[int]:
    """seat_ids(db, theater.id, "A1", "B2") -> [id of A1, id of B2], in that order."""
    seats = db.query(Seat).filter(Seat.theater_id == theater_id).all()
    by_label = {f"{s.row}{s.seat_number}": s.id for s in seats}
    return [by_label[label] for label in labels]


def make_showtime(
    db, movie, theater, *, starts_in=timedelta(hours=2), start_time=None,
    price=75000, fmt=ShowtimeFormat.TWO_D,
) -> Showtime:
    """Pass start_time for an exact moment, or starts_in for 'relative to now'."""
    showtime = Showtime(
        movie_id=movie.id,
        theater_id=theater.id,
        start_time=start_time or datetime.now(timezone.utc) + starts_in,
        price=price,
        format=fmt,
    )
    db.add(showtime)
    db.commit()
    db.refresh(showtime)
    return showtime

def forge_token(user_id, role="CUSTOMER", *, expires_in=timedelta(minutes=30), secret=None) -> dict:
    """
    Build an Authorization header by hand. Lets tests produce tokens the real
    login endpoint never would: expired (negative expires_in), signed with the
    wrong secret, or claiming a role the user doesn't have.
    """
    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": datetime.now(timezone.utc) + expires_in,
    }
    token = jwt.encode(payload, secret or settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return {"Authorization": f"Bearer {token}"}

def book_seats(client, user, showtime_id, seat_id_list):
    """POST /bookings through the real API."""
    return client.post(
        "/bookings",
        json={"showtime_id": showtime_id, "seat_ids": seat_id_list},
        headers=auth_headers(user),
    )


def make_booking(
    db, user, showtime, seat_id_list, *,
    expires_in=timedelta(minutes=5),
    status=BookingStatus.CONFIRMED,
    payment_status=PaymentStatus.PENDING,
) -> Booking:
    """
    Insert a booking straight into the database, bypassing create_booking().
    That is the point: it can create states the API can't reach quickly, like
    a hold that expired a minute ago (expires_in=timedelta(minutes=-1)).
    It prices every seat at showtime.price with no surcharges, so use the API
    (book_seats) in tests that care about price.
    """
    booking = Booking(
        user_id=user.id,
        showtime_id=showtime.id,
        status=status,
        payment_status=payment_status,
        total_seats=len(seat_id_list),
        total_amount=len(seat_id_list) * showtime.price,
        expires_at=datetime.now(timezone.utc) + expires_in,
    )
    db.add(booking)
    db.flush()
    for seat_id in seat_id_list:
        db.add(BookingSeat(booking_id=booking.id, seat_id=seat_id, showtime_id=showtime.id))
    db.commit()
    db.refresh(booking)
    return booking