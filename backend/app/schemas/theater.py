from typing import Optional, List

from pydantic import BaseModel, ConfigDict, field_validator
from app.models.seat import SeatType
import re 

class TheaterBase(BaseModel):
    name: str
    location: str


class TheaterCreate(TheaterBase):
    pass


class TheaterUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None


class TheaterOut(TheaterBase):
    id: int

    model_config = ConfigDict(from_attributes=True)

class SeatRowConfig(BaseModel):
    row: str
    seat_count: int
    seat_type: SeatType = SeatType.STANDARD

    @field_validator('row')
    @classmethod
    def validate_row(cls, value: str) -> str:
        value = value.strip().upper()
        if not re.fullmatch(r'[A-Z]{1,2}', value):
            raise ValueError('Row must be 1-2 letters (A-Z), e.g. "A" or "AA"')
        return value

    @field_validator('seat_count')
    @classmethod
    def validate_seat_count(cls, value: int) -> int:
        if value < 1:
            raise ValueError('Seat count must be at least 1')
        if value > 50:
            raise ValueError('Seat count cannot exceed 50 per row')
        return value


class GenerateSeatsRequest(BaseModel):
    rows: List[SeatRowConfig]


class TheaterSeatSummary(BaseModel):
    total_seats: int
    rows: List[str]