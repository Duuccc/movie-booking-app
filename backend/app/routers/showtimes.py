"""
Showtime endpoints, plus GET /showtimes/{id}/seats -- the endpoint that
computes AVAILABLE/BOOKED per seat for one specific showtime.

Browsing (GET) is public. Create/update/delete require require_admin.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.showtime import Showtime
from app.models.movie import Movie
from app.models.theater import Theater
from app.models.seat import Seat
from app.models.booking_seat import BookingSeat
from app.schemas.showtime import ShowtimeCreate, ShowtimeUpdate, ShowtimeOut, SeatAvailability
from app.auth.dependencies import require_admin
from app.services.booking_service import showtime_has_confirmed_bookings, expire_bookings_for_showtime

from datetime import datetime, date as date_type, timedelta
from zoneinfo import ZoneInfo

VN_TZ = ZoneInfo("Asia/Ho_Chi_Minh")

router = APIRouter(prefix="/showtimes", tags=["showtimes"])


def get_showtime_or_404(showtime_id: int, db: Session) -> Showtime:
    showtime = db.query(Showtime).filter(Showtime.id == showtime_id).first()
    if showtime is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Showtime not found")
    return showtime


def _validate_movie_and_theater(movie_id: int, theater_id: int, db: Session) -> None:
    if db.query(Movie).filter(Movie.id == movie_id).first() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movie not found")
    if db.query(Theater).filter(Theater.id == theater_id).first() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Theater not found")


@router.get("", response_model=List[ShowtimeOut])
def list_showtimes(
    date: Optional[date_type] = None,
    theater_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """
    Both filters are optional and additive -- calling with no params
    behaves exactly as before, so existing callers (if any still hit
    this with no query string) are unaffected.

    `date` is a calendar day (YYYY-MM-DD), interpreted in VN local time.
    We convert that day's VN-local midnight-to-midnight boundaries into
    UTC-aware datetimes before filtering, since start_time is stored
    timezone-aware (DateTime(timezone=True)).
    """
    query = db.query(Showtime)

    if theater_id is not None:
        query = query.filter(Showtime.theater_id == theater_id)

    if date is not None:
        day_start = datetime.combine(date, datetime.min.time(), tzinfo=VN_TZ)
        day_end = day_start + timedelta(days=1)
        query = query.filter(
            Showtime.start_time >= day_start,
            Showtime.start_time < day_end,
        )

    return query.order_by(Showtime.start_time).all()


@router.get("/{showtime_id}", response_model=ShowtimeOut)
def get_showtime(showtime_id: int, db: Session = Depends(get_db)):
    return get_showtime_or_404(showtime_id, db)


@router.post("", response_model=ShowtimeOut, status_code=status.HTTP_201_CREATED)
def create_showtime(
    payload: ShowtimeCreate,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    _validate_movie_and_theater(payload.movie_id, payload.theater_id, db)
    showtime = Showtime(**payload.model_dump())
    db.add(showtime)
    db.commit()
    db.refresh(showtime)
    return showtime


@router.put("/{showtime_id}", response_model=ShowtimeOut)
def update_showtime(
    showtime_id: int,
    payload: ShowtimeUpdate,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    showtime = get_showtime_or_404(showtime_id, db)
    updates = payload.model_dump(exclude_unset=True)

    # Only re-validate FKs the caller is actually trying to change.
    if "movie_id" in updates or "theater_id" in updates:
        _validate_movie_and_theater(
            updates.get("movie_id", showtime.movie_id),
            updates.get("theater_id", showtime.theater_id),
            db,
        )

    for field, value in updates.items():
        setattr(showtime, field, value)
    db.commit()
    db.refresh(showtime)
    return showtime


@router.delete("/{showtime_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_showtime(
    showtime_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    showtime = get_showtime_or_404(showtime_id, db)
    if showtime_has_confirmed_bookings(db, showtime_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete a showtime with active bookings",
        )
    db.delete(showtime)
    db.commit()
    return None


@router.get("/{showtime_id}/seats", response_model=List[SeatAvailability])
def get_showtime_seats(showtime_id: int, db: Session = Depends(get_db)):
    """
    Every seat in the showtime's theater, tagged AVAILABLE or BOOKED for
    *this* showtime specifically. The same physical seat can be BOOKED
    for the 10:00 screening and AVAILABLE for the 14:00 screening in the
    same theater -- that's why we filter BookingSeat by showtime_id, not
    just by seat_id. This is a read-only view; nothing here reserves a
    seat (that's POST /bookings in Milestone 6).
    """
    showtime = get_showtime_or_404(showtime_id, db)

    expire_bookings_for_showtime(db, showtime_id)

    seats = (
        db.query(Seat)
        .filter(Seat.theater_id == showtime.theater_id)
        .order_by(Seat.row, Seat.seat_number)
        .all()
    )

    booked_seat_ids = {
        row.seat_id
        for row in db.query(BookingSeat.seat_id)
        .filter(BookingSeat.showtime_id == showtime_id)
        .all()
    }

    return [
        SeatAvailability(
            seat_id=seat.id,
            seat_number=f"{seat.row}{seat.seat_number}",
            status="BOOKED" if seat.id in booked_seat_ids else "AVAILABLE",
        )
        for seat in seats
    ]
