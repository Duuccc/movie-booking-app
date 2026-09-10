from datetime import datetime
from typing import List

from pydantic import BaseModel, ConfigDict, field_validator

from app.models.booking import BookingStatus


class BookingCreate(BaseModel):
    showtime_id: int
    seat_ids: List[int]

    @field_validator("seat_ids")
    @classmethod
    def seat_ids_not_empty_or_duplicated(cls, value: List[int]) -> List[int]:
        if not value:
            raise ValueError("seat_ids must contain at least one seat")
        if len(value) != len(set(value)):
            raise ValueError("seat_ids must not contain duplicates")
        return value


class BookingSeatOut(BaseModel):
    seat_id: int
    seat_number: str  # combined "A1" form, built in booking_service.serialize_booking


class BookingOut(BaseModel):
    id: int
    showtime_id: int
    status: BookingStatus
    total_seats: int
    created_at: datetime
    seats: List[BookingSeatOut] = []

    model_config = ConfigDict(from_attributes=True)