from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class BookingSeat(Base):
    """
    Links one seat to one booking, for one specific showtime.

    The unique constraint on (showtime_id, seat_id) is what actually
    prevents double-booking: the database itself will reject a second
    row for the same seat + showtime combination, even under concurrent
    requests. See app/services/booking_service.py (Milestone 6) for how
    we catch that and turn it into a clean 409 response.

    showtime_id is duplicated here from the parent Booking on purpose.
    Without it, this table alone can't tell you whether two rows compete
    for the same seat at the same screening.
    """

    __tablename__ = "booking_seats"
    __table_args__ = (
        UniqueConstraint(
            "showtime_id", "seat_id", name="uq_booking_seat_showtime_seat"
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(
        Integer, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False
    )
    seat_id = Column(
        Integer, ForeignKey("seats.id", ondelete="CASCADE"), nullable=False
    )
    showtime_id = Column(
        Integer, ForeignKey("showtimes.id", ondelete="CASCADE"), nullable=False
    )

    booking = relationship("Booking", back_populates="booking_seats")
    seat = relationship("Seat", back_populates="booking_seats")
    showtime = relationship("Showtime", back_populates="booking_seats")
