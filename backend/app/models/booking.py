import enum
from sqlalchemy import Column, Integer, ForeignKey, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class BookingStatus(str, enum.Enum):
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"


class PaymentStatus(str, enum.Enum):
    """
    Payment state for a booking, tracked separately from BookingStatus.

    They're deliberately independent: a booking reserves its seats the
    moment it's created (that's what the BookingSeat unique constraint
    enforces), and payment happens afterwards against a booking that
    already holds them. So a booking can be CONFIRMED + PENDING (seats
    held, not yet paid) or CANCELLED + PAID (paid, then cancelled --
    which in a real system would trigger a refund).
    """
    PENDING = "PENDING"
    PAID = "PAID"
    FAILED = "FAILED"


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
    payment_status = Column(
        Enum(PaymentStatus), nullable=False, default=PaymentStatus.PENDING
    )
    total_seats = Column(Integer, nullable=False)
    # Price is copied from the showtime at booking time rather than read
    # live -- if an admin later changes the showtime price, what this
    # customer actually owes must not change retroactively.
    total_amount = Column(Integer, nullable=False, default=0)  # whole VND
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="bookings")
    showtime = relationship("Showtime", back_populates="bookings")
    booking_seats = relationship(
        "BookingSeat", back_populates="booking", cascade="all, delete-orphan"
    )
    payments = relationship(
        "Payment", back_populates="booking", cascade="all, delete-orphan"
    )