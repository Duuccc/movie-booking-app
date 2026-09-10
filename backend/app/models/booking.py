import enum
from sqlalchemy import Column, Integer, ForeignKey, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class BookingStatus(str, enum.Enum):
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    showtime_id = Column(
        Integer, ForeignKey("showtimes.id", ondelete="CASCADE"), nullable=False
    )
    status = Column(Enum(BookingStatus), nullable=False, default=BookingStatus.CONFIRMED)
    total_seats = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="bookings")
    showtime = relationship("Showtime", back_populates="bookings")
    booking_seats = relationship(
        "BookingSeat", back_populates="booking", cascade="all, delete-orphan"
    )
