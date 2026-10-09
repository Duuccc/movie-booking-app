from datetime import date, datetime, timedelta, timezone

import pytest

from app.services.analytics_service import date_range_to_utc_bounds, get_percent_change


@pytest.mark.parametrize(
    "current, previous, expected",
    [
        (150, 100, 50.0),
        (50, 100, -50.0),
        (100, 100, 0.0),
        (0, 100, -100.0),
        (1, 3, -66.7),  # rounded to one decimal
    ],
)
def test_percent_change(current, previous, expected):
    assert get_percent_change(current, previous) == expected


def test_percent_change_without_a_baseline_is_none():
    # previous == 0: any percentage would be misleading (or divide by zero)
    assert get_percent_change(500, 0) is None


def test_single_day_bounds_are_vietnam_midnight_to_midnight():
    start, end = date_range_to_utc_bounds(date(2026, 9, 25), date(2026, 9, 25))
    # Vietnam is UTC+7 with no DST: 2026-09-25 00:00 +07:00 == 2026-09-24 17:00 UTC
    assert start == datetime(2026, 9, 24, 17, 0, tzinfo=timezone.utc)
    assert end == datetime(2026, 9, 25, 17, 0, tzinfo=timezone.utc)


def test_multi_day_range_end_is_exclusive_midnight_after_the_last_day():
    start, end = date_range_to_utc_bounds(date(2026, 9, 25), date(2026, 9, 27))
    assert end - start == timedelta(days=3)