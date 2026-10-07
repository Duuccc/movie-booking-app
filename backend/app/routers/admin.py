"""
Admin-only endpoints that don't belong to a single resource's router.
Right now that's just "view every booking in the system" -- movie,
theater, and showtime admin actions already live on their own routers
(movies.py, theaters.py, showtimes.py) since they're just admin-gated
CRUD on those resources.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.booking import Booking
from app.schemas.booking import BookingOut
from app.models.user import User, UserRole
from app.schemas.user import UserOut, UserRoleUpdate
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

@router.get("/users", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db), _admin=Depends(require_admin)):
    return db.query(User).order_by(User.name).all()

@router.put("/users/{user_id}/role", response_model=UserOut)
def update_user_role(
    user_id: int,
    payload: UserRoleUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if user.id == admin.id and payload.role != UserRole.ADMIN:
        # An admin can't demote themselves -- there's no "re-grant admin"
        # path except a direct DB edit or the seed script, so this would
        # be a one-way lockout, not a reversible mistake.
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot remove your own admin role",
        )

    user.role = payload.role
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if user_id == admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot delete your own account")

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    db.delete(user)
    db.commit()
    return None