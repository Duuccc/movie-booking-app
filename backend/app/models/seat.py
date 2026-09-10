from sqlalchemy import Column, Integer, String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class Seat(Base):
    __tablename__ = "seats"
    __table_args__ = (
        UniqueConstraint(
            "theater_id", "row", "seat_number", name="uq_seat_theater_row_number"
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    theater_id = Column(
        Integer, ForeignKey("theaters.id", ondelete="CASCADE"), nullable=False
    )
    row = Column(String, nullable=False)          # e.g. "A"
    seat_number = Column(Integer, nullable=False)  # e.g. 1 -> displayed as "A1"

    theater = relationship("Theater", back_populates="seats")
    booking_seats = relationship("BookingSeat", back_populates="seat")
