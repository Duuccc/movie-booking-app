import pytest
from pydantic import ValidationError

from app.schemas.theater import SeatRowConfig


@pytest.mark.parametrize("raw, normalized", [("A", "A"), ("a", "A"), (" b ", "B"), ("AA", "AA"), ("aA", "AA"), ("aa", "AA"), ("aa ", "AA")])
def test_valid_rows_are_trimmed_and_uppercased(raw, normalized):
    assert SeatRowConfig(row=raw, seat_count=10).row == normalized


@pytest.mark.parametrize("bad_row", ["", " ", "1", "A1", "ABC", "A-", "asdnasnckjanskjnsd"])
def test_invalid_rows_are_rejected(bad_row):
    with pytest.raises(ValidationError):
        SeatRowConfig(row=bad_row, seat_count=10)


@pytest.mark.parametrize("count", [1, 2, 3, 25, 28, 32, 33, 38, 39, 46, 50])  # the two boundary values that must work
def test_seat_count_at_the_boundaries_is_accepted(count):
    assert SeatRowConfig(row="A", seat_count=count).seat_count == count


@pytest.mark.parametrize("count", [0, -1, 51, 999999])  # just outside, plus extremes
def test_seat_count_outside_the_range_is_rejected(count):
    with pytest.raises(ValidationError):
        SeatRowConfig(row="A", seat_count=count)