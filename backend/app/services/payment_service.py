"""
Mock payment processing.

There is no real gateway here: no HTTP call, no money, no webhook. This
module exists to model the payment *lifecycle* correctly (pending ->
paid/failed, one row per attempt, idempotent success) so that swapping
in VNPay/MoMo/Stripe later is a change inside _charge() plus a webhook
endpoint -- not a redesign of the booking flow.

What a real integration would add on top of this:
  - _charge() calls the gateway and returns a redirect URL instead of a
    synchronous result
  - a webhook endpoint receives the gateway's callback and is the thing
    that actually flips payment_status (never trust the browser)
  - signature verification on that callback
  - reconciliation for callbacks that arrive twice, late, or never
"""
import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.booking import Booking, BookingStatus, PaymentStatus
from app.models.payment import Payment, PaymentMethod

from datetime import datetime, timezone, timedelta

def _generate_reference(method: PaymentMethod) -> str:
    """Stands in for the transaction id a gateway would return."""
    return f"{method.value}-{uuid.uuid4().hex[:12].upper()}"


def _charge(amount: int, method: PaymentMethod, simulate_failure: bool) -> bool:
    """
    The seam where a real gateway call would go. Right now it just
    returns the outcome the caller asked for.
    """
    return not simulate_failure


def pay_for_booking(
    db: Session,
    booking: Booking,
    method: PaymentMethod,
    simulate_failure: bool = False,
) -> Payment:
    """
    Attempts payment for a booking.

    Guards, in order:
      - a cancelled booking can't be paid for
      - an already-PAID booking can't be charged twice (idempotency:
        paying twice is a real bug class, so it's rejected outright
        rather than silently creating a second charge)

    A FAILED attempt leaves the booking PENDING, not FAILED-forever --
    the customer keeps their seats and can retry with another method,
    which is how real checkout flows behave.
    """
    booking = (
        db.query(Booking)
        .filter(Booking.id == booking.id)
        .with_for_update()
        .first()
    )

    if booking is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found",
        )

    if booking.status == BookingStatus.CANCELLED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot pay for a cancelled booking",
        )

    if booking.payment_status == PaymentStatus.PAID:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This booking has already been paid for",
        )

    # Check expiration while holding the booking lock.
    if booking.expires_at <= datetime.now(timezone.utc):
        for booking_seat in list(booking.booking_seats):
            db.delete(booking_seat)

        booking.status = BookingStatus.CANCELLED

        db.commit()

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Booking has expired",
        )

    # For the current MOCK payment, this is safe to perform
    # inside the same database transaction.
    succeeded = _charge(
        booking.total_amount,
        method,
        simulate_failure,
    )

    payment = Payment(
        booking_id=booking.id,
        amount=booking.total_amount,
        method=method,
        reference=_generate_reference(method),
        succeeded=1 if succeeded else 0,
    )

    db.add(payment)

    booking.payment_status = (
        PaymentStatus.PAID
        if succeeded
        else PaymentStatus.PENDING
    )

    db.commit()
    db.refresh(payment)

    return payment