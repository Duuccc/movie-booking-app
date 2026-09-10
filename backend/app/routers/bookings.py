"""
Booking endpoints: create, list mine, get one, cancel.

Every route here requires a logged-in user (get_current_user) -- there
is no public booking endpoint. Ownership is actually checked in code,
not just assumed by the UI: a customer can only see or cancel their own
bookings.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.booking import Booking
from app.schemas.booking import BookingCreate, BookingOut
from app.auth.dependencies import get_current_user
from app.services.booking_service import create_booking, cancel_booking, serialize_booking

router = APIRouter(prefix="/bookings", tags=["bookings"])


def get_owned_booking_or_404(booking_id: int, current_user: User, db: Session) -> Booking:
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if booking is None or booking.user_id != current_user.id:
        # Same 404 whether the booking doesn't exist or belongs to
        # someone else -- don't reveal that a booking ID exists at all
        # to a user who doesn't own it.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    return booking


@router.post("", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def book_seats(
    payload: BookingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    booking = create_booking(db, current_user.id, payload.showtime_id, payload.seat_ids)
    return serialize_booking(booking)


@router.get("", response_model=List[BookingOut])
def list_my_bookings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    bookings = (
        db.query(Booking)
        .filter(Booking.user_id == current_user.id)
        .order_by(Booking.created_at.desc())
        .all()
    )
    return [serialize_booking(b) for b in bookings]


@router.get("/{booking_id}", response_model=BookingOut)
def get_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    booking = get_owned_booking_or_404(booking_id, current_user, db)
    return serialize_booking(booking)


@router.post("/{booking_id}/cancel", response_model=BookingOut)
def cancel_my_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    booking = get_owned_booking_or_404(booking_id, current_user, db)
    booking = cancel_booking(db, booking)
    return serialize_booking(booking)