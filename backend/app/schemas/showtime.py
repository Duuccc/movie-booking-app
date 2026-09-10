from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict


class ShowtimeBase(BaseModel):
    movie_id: int
    theater_id: int
    start_time: datetime
    price: Decimal = Decimal("10.00")


class ShowtimeCreate(ShowtimeBase):
    pass


class ShowtimeUpdate(BaseModel):
    movie_id: Optional[int] = None
    theater_id: Optional[int] = None
    start_time: Optional[datetime] = None
    price: Optional[Decimal] = None


class ShowtimeOut(ShowtimeBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class SeatAvailability(BaseModel):
    """
    One row of GET /showtimes/{id}/seats. seat_number is the combined
    display form ("A1") built from Seat.row + Seat.seat_number -- those
    are stored separately on the model but shown as one string, matching
    your spec's example response shape.
    """
    seat_id: int
    seat_number: str
    status: str  # "AVAILABLE" | "BOOKED"