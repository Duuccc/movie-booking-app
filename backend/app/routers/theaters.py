"""
Theater endpoints. Same pattern as movies.py: public reads, admin-only
writes. Seat layout (which seats belong to a theater) is not managed
through this API -- seats are created by the seed script only, per your
spec's suggested endpoint list (theaters get plain CRUD; seats only
appear as a read-only sub-resource of showtimes, added in Milestone 5).
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.theater import Theater
from app.models.seat import Seat
from app.schemas.theater import TheaterCreate, TheaterUpdate, TheaterOut, GenerateSeatsRequest, TheaterSeatSummary
from app.auth.dependencies import require_admin
from app.services.booking_service import theater_has_confirmed_bookings, generate_seats, get_existing_theater_rows

router = APIRouter(prefix="/theaters", tags=["theaters"])


def get_theater_or_404(theater_id: int, db: Session) -> Theater:
    theater = db.query(Theater).filter(Theater.id == theater_id).first()
    if theater is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Theater not found")
    return theater


@router.get("", response_model=List[TheaterOut])
def list_theaters(db: Session = Depends(get_db)):
    return db.query(Theater).order_by(Theater.id).all()


@router.get("/{theater_id}", response_model=TheaterOut)
def get_theater(theater_id: int, db: Session = Depends(get_db)):
    return get_theater_or_404(theater_id, db)


@router.post("", response_model=TheaterOut, status_code=status.HTTP_201_CREATED)
def create_theater(
    payload: TheaterCreate,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    theater = Theater(**payload.model_dump())
    db.add(theater)
    db.commit()
    db.refresh(theater)
    return theater


@router.put("/{theater_id}", response_model=TheaterOut)
def update_theater(
    theater_id: int,
    payload: TheaterUpdate,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    theater = get_theater_or_404(theater_id, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(theater, field, value)
    db.commit()
    db.refresh(theater)
    return theater


@router.delete("/{theater_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_theater(
    theater_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    theater = get_theater_or_404(theater_id, db)
    if theater_has_confirmed_bookings(db, theater_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete a theater with active bookings against its showtimes",
        )
    db.delete(theater)
    db.commit()
    return None

@router.post("/{theater_id}/seats", response_model=TheaterSeatSummary, status_code=status.HTTP_201_CREATED)
def add_theater_seats(
    theater_id: int,
    payload: GenerateSeatsRequest,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    theater = db.query(Theater).filter(Theater.id == theater_id).first()
    if theater is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Theater not found")

    # A row is locked once it exists -- no extending an existing row's
    # seat count, even by adding new seat numbers within it.
    existing_rows = get_existing_theater_rows(db, theater_id)
    requested_rows = [r.row for r in payload.rows]

    duplicates_within_request = {r for r in requested_rows if requested_rows.count(r) > 1}
    if duplicates_within_request:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Row(s) listed more than once in this request: {', '.join(sorted(duplicates_within_request))}",
        )

    conflicts = existing_rows & set(requested_rows)
    if conflicts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Row(s) already exist and cannot be extended: {', '.join(sorted(conflicts))}",
        )

    generate_seats(db, theater_id, payload.rows)

    seats = db.query(Seat).filter(Seat.theater_id == theater_id).all()
    return TheaterSeatSummary(total_seats=len(seats), rows=sorted({s.row for s in seats}))


@router.get("/{theater_id}/seats/summary", response_model=TheaterSeatSummary)
def get_theater_seat_summary(
    theater_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    theater = db.query(Theater).filter(Theater.id == theater_id).first()
    if theater is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Theater not found")

    seats = db.query(Seat).filter(Seat.theater_id == theater_id).all()
    return TheaterSeatSummary(total_seats=len(seats), rows=sorted({s.row for s in seats}))