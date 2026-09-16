from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.payment import PaymentMethod


class PaymentCreate(BaseModel):
    """Body for POST /bookings/{id}/pay."""
    method: PaymentMethod
    # Mock-only lever so the demo can show the failure path on demand.
    # A real gateway decides this itself -- this field would not exist.
    simulate_failure: bool = False


class PaymentOut(BaseModel):
    id: int
    booking_id: int
    amount: int  # whole VND
    method: PaymentMethod
    reference: str
    succeeded: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)