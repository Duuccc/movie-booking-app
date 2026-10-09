import pytest

from app.models.seat import SeatType
from app.models.showtime import ShowtimeFormat
from app.services.booking_service import get_seat_price

BASE = 75000


@pytest.mark.parametrize(
    "seat_type, fmt, expected",
    [
        (SeatType.STANDARD, ShowtimeFormat.TWO_D, 75000),    # no surcharge at all
        (SeatType.VIP, ShowtimeFormat.TWO_D, 90000),          # +15000
        (SeatType.COUPLE, ShowtimeFormat.TWO_D, 110000),      # +35000
        (SeatType.STANDARD, ShowtimeFormat.THREE_D, 100000),  # +25000
        (SeatType.STANDARD, ShowtimeFormat.IMAX, 125000),     # +50000
        # surcharges stack
        (SeatType.VIP, ShowtimeFormat.IMAX, 140000),
        (SeatType.COUPLE, ShowtimeFormat.THREE_D, 135000),
    ],
)
def test_seat_price(seat_type, fmt, expected):
    assert get_seat_price(BASE, seat_type, fmt) == expected