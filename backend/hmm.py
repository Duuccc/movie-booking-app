from zoneinfo import ZoneInfo
from datetime import datetime, timedelta, timezone


VN_TZ = ZoneInfo("America/Los_Angeles")


def vn_time(year, month, day, hour=0, minute=0) -> datetime:
    """A moment on the Vietnam wall clock (UTC+7), as an aware datetime."""
    return datetime(year, month, day, hour, minute, tzinfo=VN_TZ)

print(vn_time(2030, 6, 16, 0, 0))