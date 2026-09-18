"""
Booking business logic. create_booking() is the most important function
in this project -- it's where double-booking prevention actually happens.
"""
from typing import List, Dict

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.showtime import Showtime
from app.models.seat import Seat
from app.models.booking import Booking, BookingStatus, PaymentStatus
from app.models.booking_seat import BookingSeat
from app.schemas.booking import BookingOut, BookingSeatOut

from datetime import datetime, timezone, timedelta

def serialize_booking(booking: Booking) -> BookingOut:
    """
    Builds the API response shape for a booking, including each seat's
    combined display form ("A1") -- BookingSeat only stores seat_id, so
    this can't be produced by plain from_attributes ORM mapping alone.
    """
    return BookingOut(
        id=booking.id,
        user_id=booking.user_id,
        showtime_id=booking.showtime_id,
        status=booking.status,
        payment_status=booking.payment_status,
        total_seats=booking.total_seats,
        total_amount=booking.total_amount,
        created_at=booking.created_at,
        expires_at=booking.expires_at,
        seats=[
            BookingSeatOut(
                seat_id=bs.seat_id,
                seat_number=f"{bs.seat.row}{bs.seat.seat_number}",
            )
            for bs in booking.booking_seats
        ],
    )


def create_booking(db: Session, user_id: int, showtime_id: int, seat_ids: List[int]) -> Booking:
    """
    Creates a booking for the given seats on the given showtime.

    --- Double-booking prevention strategy ---
    We do NOT check "is this seat free?" and then insert as two separate
    steps. Two concurrent requests could both pass that check before
    either one commits -- a classic check-then-act race condition -- and
    both would succeed, double-booking the seat.

    Instead we lean entirely on the database: BookingSeat has a UNIQUE
    constraint on (showtime_id, seat_id) (see models/booking_seat.py).
    We simply attempt the insert inside a transaction. If a seat is
    already taken, Postgres raises IntegrityError the moment the
    conflicting row would be written. We catch that, roll back the
    *entire* booking -- it's all seats or none, never a partial booking
    -- and return a clean 409 to the client.

    No SELECT ... FOR UPDATE, no application-level locks, no Redis. The
    unique index on the table *is* the concurrency control, and unlike
    an app-level check-then-insert, it is correct even under genuinely
    concurrent requests.
    """
    showtime = db.query(Showtime).filter(Showtime.id == showtime_id).first()
    if showtime is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Showtime not found")

    expire_bookings_for_showtime(db, showtime_id)

    seats = db.query(Seat).filter(Seat.id.in_(seat_ids)).all()
    if len(seats) != len(seat_ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="One or more seats not found"
        )

    mismatched = [s.id for s in seats if s.theater_id != showtime.theater_id]
    if mismatched:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Seat(s) {mismatched} do not belong to this showtime's theater",
        )

    booking = Booking(
        user_id=user_id,
        showtime_id=showtime_id,
        status=BookingStatus.CONFIRMED,
        total_seats=len(seat_ids),
        # Snapshot the price now. If an admin edits the showtime price
        # later, this customer still owes what they agreed to.
        total_amount=len(seat_ids) * showtime.price,
        expires_at= datetime.now(timezone.utc) + timedelta(minutes=15)
    )
    db.add(booking)
    db.flush()  # assigns booking.id without committing yet

    for seat_id in seat_ids:
        db.add(BookingSeat(booking_id=booking.id, seat_id=seat_id, showtime_id=showtime_id))

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="One or more selected seats are already booked for this showtime",
        )

    db.refresh(booking)
    return booking


def cancel_booking(db: Session, booking: Booking) -> Booking:
    """
    Cancelling deletes the BookingSeat rows -- freeing those seats back
    up for that showtime -- but keeps the Booking row itself, marked
    CANCELLED, so "view booking history" still shows it.
    """
    booking = db.query(Booking).filter(Booking.id == booking.id).with_for_update().first()

    if booking is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found"
        )
    
    if booking.status == BookingStatus.CANCELLED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Booking is already cancelled"
        )

    if booking.payment_status == PaymentStatus.PAID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel a booking that has already been paid for",
        )
    
    for booking_seat in list(booking.booking_seats):
        db.delete(booking_seat)
    booking.status = BookingStatus.CANCELLED
    db.commit()
    db.refresh(booking)
    return booking


def showtime_has_confirmed_bookings(db: Session, showtime_id: int) -> bool:
    """
    Used by the movie/theater/showtime DELETE endpoints. Deleting a
    showtime, movie, or theater cascades at the database level (see the
    ondelete="CASCADE" foreign keys in models/) -- which would silently
    delete real customer bookings along with it. Checking this first and
    returning a 400 instead is a deliberate small guard, not the default
    cascade behavior left unexamined.
    """
    return (
        db.query(Booking)
        .filter(Booking.showtime_id == showtime_id, Booking.status == BookingStatus.CONFIRMED)
        .first()
        is not None
    )

def get_availability_for_showtimes(db: Session, showtime_ids: List[int]) -> Dict[int, int]:
    """
    Returns {showtime_id: available_seat_count} for the given showtimes,
    in 3 queries total regardless of how many showtimes are in the batch.

    "Available" here matches GET /showtimes/{id}/seats exactly: any seat
    with a BookingSeat row is counted as taken, regardless of whether
    that booking's payment_status is PENDING or PAID, or whether it's
    since expired but not yet lazily cleaned up. Same definition of
    "booked" everywhere in the app, on purpose.
    """
    showtimes = db.query(Showtime).filter(Showtime.id.in_(showtime_ids)).all()

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

    return {
        s.id: total_seats_by_theater.get(s.theater_id, 0) - booked_by_showtime.get(s.id, 0)
        for s in showtimes
    }

def movie_has_confirmed_bookings(db: Session, movie_id: int) -> bool:
    return (
        db.query(Booking)
        .join(Showtime, Booking.showtime_id == Showtime.id)
        .filter(Showtime.movie_id == movie_id, Booking.status == BookingStatus.CONFIRMED)
        .first()
        is not None
    )


def theater_has_confirmed_bookings(db: Session, theater_id: int) -> bool:
    return (
        db.query(Booking)
        .join(Showtime, Booking.showtime_id == Showtime.id)
        .filter(Showtime.theater_id == theater_id, Booking.status == BookingStatus.CONFIRMED)
        .first()
        is not None
    )

def expire_bookings_for_showtime(db: Session, showtime_id: int) -> int:
    """
    Cancels expired, unpaid bookings for one showtime and releases their
    BookingSeat rows.

    The Booking rows are locked with SELECT ... FOR UPDATE before we
    cancel them. This prevents an expiration cleanup from racing with
    payment for the same booking.

    Returns the number of bookings that were expired.
    """
    now = datetime.now(timezone.utc)

    expired_bookings = (
        db.query(Booking)
        .filter(
            Booking.showtime_id == showtime_id,
            Booking.status == BookingStatus.CONFIRMED,
            Booking.payment_status == PaymentStatus.PENDING,
            Booking.expires_at <= now,
        )
        .with_for_update()
        .all()
    )

    for booking in expired_bookings:
        for booking_seat in list(booking.booking_seats):
            db.delete(booking_seat)

        booking.status = BookingStatus.CANCELLED

    if expired_bookings:
        db.commit()

    return len(expired_bookings)

def expire_booking_if_needed(db: Session, booking_id: int) -> bool:
    """
    Locks a booking and expires it if it is still an unpaid booking
    whose expiration time has passed.

    Returns True if the booking was expired and cancelled.
    """
    now = datetime.now(timezone.utc)

    booking = (
        db.query(Booking)
        .filter(Booking.id == booking_id)
        .with_for_update()
        .first()
    )

    if booking is None:
        return False

    if (
        booking.status == BookingStatus.CONFIRMED
        and booking.payment_status == PaymentStatus.PENDING
        and booking.expires_at <= now
    ):
        for booking_seat in list(booking.booking_seats):
            db.delete(booking_seat)

        booking.status = BookingStatus.CANCELLED
        db.commit()

        return True

    return False