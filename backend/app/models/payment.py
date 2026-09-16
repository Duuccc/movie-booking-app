import enum
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class PaymentMethod(str, enum.Enum):
    """
    Mock payment methods. Named after real Vietnamese options so the
    swap to an actual gateway later is a matter of implementing the
    call, not renaming everything.
    """
    MOMO = "MOMO"
    VNPAY = "VNPAY"
    CARD = "CARD"


class Payment(Base):
    """
    One payment ATTEMPT against a booking -- not one payment per booking.

    A booking can have several rows here: a failed attempt followed by a
    successful retry. Keeping every attempt (rather than overwriting a
    single row) is how real payment systems work, because the attempt
    history is what you reconcile against the gateway's own records when
    something goes wrong.

    NOTE: this is a MOCK. No money moves, no gateway is contacted. See
    app/services/payment_service.py for where a real integration would
    slot in.
    """

    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(
        Integer, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False
    )
    amount = Column(Integer, nullable=False)  # whole VND
    method = Column(Enum(PaymentMethod), nullable=False)
    # What a gateway would hand back as its transaction id. Unique so a
    # duplicate submission can't create two identical payment records.
    reference = Column(String, unique=True, nullable=False, index=True)
    succeeded = Column(Integer, nullable=False, default=0)  # 0/1, kept simple
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    booking = relationship("Booking", back_populates="payments")