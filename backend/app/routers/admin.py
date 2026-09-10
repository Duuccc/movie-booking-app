"""
Admin-only endpoints that don't belong to a single resource's router.
Right now that's just "view every booking in the system" -- movie,
theater, and showtime admin actions already live on their own routers
(movies.py, theaters.py, showtimes.py) since they're just admin-gated
CRUD on those resources.
"""
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.booking import Booking
from app.schemas.booking import BookingOut
from app.auth.dependencies import require_admin
from app.services.booking_service import serialize_booking

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/bookings", response_model=List[BookingOut])
def list_all_bookings(
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    bookings = db.query(Booking).order_by(Booking.created_at.desc()).all()
    return [serialize_booking(b) for b in bookings]