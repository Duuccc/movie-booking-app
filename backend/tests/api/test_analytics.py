from datetime import date

import pytest

from app.models.booking import BookingStatus, PaymentStatus
from app.models.seat import SeatType
from app.models.showtime import ShowtimeFormat
from tests.factories import (
    auth_headers,
    make_booking,
    make_movie,
    make_payment,
    make_showtime,
    make_theater,
    seat_ids,
    vn_time,
)

ANALYTICS = "/admin/analytics"
PRICE = 100000


def sale(db, user, movie, theater, labels, when, fmt=ShowtimeFormat.TWO_D):
    """A booking created AND paid at the same instant `when`, for amount = seats x PRICE."""
    showtime = make_showtime(db, movie, theater, start_time=when, fmt=fmt, price=PRICE)
    booking = make_booking(
        db, user, showtime, seat_ids(db, theater.id, *labels),
        payment_status=PaymentStatus.PAID, created_at=when,
    )
    make_payment(db, booking, paid_at=when)
    return booking


@pytest.fixture()
def sales(db_session, customer, other_customer):
    """
    Window under test: 2030-06-10 .. 2030-06-12 (Vietnam dates).
    Previous period of the same length: 2030-06-07 .. 2030-06-09.
    Every sale has amount = seats x 100000, so all expected numbers are checkable by hand.

    id  when (Vietnam)  what                                  why it is here
    P1  06-10 10:00     Alpha  Downtown 2D   A1 A2            plain sale
    P2  06-10 23:30     Beta   Riverside 3D  A1               late evening: hour 16 and the 10th in UTC
    P3  06-11 00:30     Alpha  Downtown IMAX A3 B1(VIP)       00:30 Vietnam = 17:30 UTC on the 10th:
                                                              a UTC-based query puts it on the wrong day
    P4  06-12 23:59     Alpha  Downtown 2D   B2(VIP)          last minute of the window
    X1  06-13 00:00     Beta   Riverside 2D  A2               exactly window_end: must be excluded
    Q1  06-09 23:59     Beta   Riverside 2D  A3               last minute of the previous period
    Q2  06-07 00:00     Alpha  Downtown 2D   A1               first instant of the previous period
    Q3  06-08 12:00     Alpha  Downtown 2D   A2 A3            plain previous-period sale
    Z1  06-06 23:59     Beta   Riverside 2D  A4               just before the previous period: in neither
    F1  06-11 12:00     pending booking + DECLINED payment    not revenue, but a booking created in the window
    K1  06-11 15:00     CANCELLED booking                     cancellation-rate numerator

    Bookings created in the window: P1 P2 P3 P4 F1 K1 = 6.
    2030-06-10 is a Monday (checked in test_bookings_by_weekday).
    """
    alpha = make_movie(db_session, title="Alpha")
    beta = make_movie(db_session, title="Beta")
    downtown = make_theater(
        db_session, name="Downtown", layout=(("A", 4, SeatType.STANDARD), ("B", 2, SeatType.VIP))
    )
    riverside = make_theater(db_session, name="Riverside", layout=(("A", 4, SeatType.STANDARD),))
    db, c1, c2 = db_session, customer, other_customer

    sale(db, c1, alpha, downtown, ["A1", "A2"], vn_time(2030, 6, 10, 10, 0))                          # P1
    sale(db, c2, beta, riverside, ["A1"], vn_time(2030, 6, 10, 23, 30), ShowtimeFormat.THREE_D)       # P2
    sale(db, c1, alpha, downtown, ["A3", "B1"], vn_time(2030, 6, 11, 0, 30), ShowtimeFormat.IMAX)     # P3
    sale(db, c2, alpha, downtown, ["B2"], vn_time(2030, 6, 12, 23, 59))                                # P4

    sale(db, c1, beta, riverside, ["A2"], vn_time(2030, 6, 13, 0, 0))                                  # X1
    sale(db, c1, beta, riverside, ["A3"], vn_time(2030, 6, 9, 23, 59))                                 # Q1
    sale(db, c1, alpha, downtown, ["A1"], vn_time(2030, 6, 7, 0, 0))                                   # Q2
    sale(db, c2, alpha, downtown, ["A2", "A3"], vn_time(2030, 6, 8, 12, 0))                            # Q3
    sale(db, c1, beta, riverside, ["A4"], vn_time(2030, 6, 6, 23, 59))                                 # Z1

    f_time = vn_time(2030, 6, 11, 12, 0)                                                               # F1
    f_showtime = make_showtime(db, beta, riverside, start_time=f_time, price=PRICE)
    pending = make_booking(
        db, c1, f_showtime, seat_ids(db, riverside.id, "A4"), created_at=f_time,
    )
    make_payment(db, pending, paid_at=f_time, succeeded=0)

    k_time = vn_time(2030, 6, 11, 15, 0)                                                               # K1
    k_showtime = make_showtime(db, beta, riverside, start_time=k_time, price=PRICE)
    make_booking(                      # unrealistic (a real cancel frees the seats); fine for these queries
        db, c2, k_showtime, seat_ids(db, riverside.id, "A4"),
        status=BookingStatus.CANCELLED, created_at=k_time,
    )


def fetch(client, admin, date_from="2030-06-10", date_to="2030-06-12"):
    response = client.get(
        ANALYTICS, params={"date_from": date_from, "date_to": date_to}, headers=auth_headers(admin)
    )
    assert response.status_code == 200, response.text
    return response.json()


# ---------- headline numbers ----------

def test_headline_numbers(client, admin, sales):
    body = fetch(client, admin)

    assert (body["date_from"], body["date_to"]) == ("2030-06-10", "2030-06-12")
    assert body["total_revenue"] == 600000          # P1 + P2 + P3 + P4; F1's declined payment is excluded
    assert body["total_bookings"] == 4
    assert body["total_tickets_sold"] == 6          # 2 + 1 + 2 + 1
    assert body["average_order_value"] == 150000    # 600000 / 4


def test_cancellation_rate(client, admin, sales):
    # 6 bookings created in the window (P1 P2 P3 P4 F1 K1), 1 cancelled: 16.67%, rounded to 1 decimal
    assert fetch(client, admin)["cancellation_rate"] == 16.7


# ---------- date windows: boundaries and period-over-period change ----------

WINDOWS = [
    pytest.param("2030-06-10", "2030-06-12", 600000, 50.0, id="three-days"),                 # previous: 400000
    pytest.param("2030-06-11", "2030-06-12", 300000, -25.0, id="drop-vs-previous"),           # previous: 400000 over 06-09..06-10
    pytest.param("2030-06-11", "2030-06-11", 200000, -33.3, id="00:30-belongs-to-the-vietnam-day"),
    pytest.param("2030-06-12", "2030-06-12", 100000, -50.0, id="last-minute-is-included"),    # X1 at 06-13 00:00 is not
    pytest.param("2030-06-13", "2030-06-13", 100000, 0.0, id="midnight-starts-the-next-day"),  # previous: P4, also 100000
    pytest.param("2030-06-06", "2030-06-06", 100000, None, id="no-previous-period-data"),
    pytest.param("2030-05-01", "2030-05-03", 0, None, id="no-data-at-all"),
]


@pytest.mark.parametrize("date_from, date_to, revenue, change", WINDOWS)
def test_revenue_and_change_for_each_window(client, admin, sales, date_from, date_to, revenue, change):
    body = fetch(client, admin, date_from, date_to)

    assert body["total_revenue"] == revenue
    assert body["revenue_change_pct"] == change


def test_bookings_change_compares_paid_bookings_with_the_previous_period(client, admin, sales):
    # current: P1 P2 P3 P4 = 4 paid bookings; previous: Q1 Q2 Q3 = 3  ->  +33.3%
    assert fetch(client, admin)["bookings_change_pct"] == 33.3


# ---------- breakdowns ----------

def test_daily_revenue_is_grouped_by_vietnam_day(client, admin, sales):
    assert fetch(client, admin)["daily_revenue"] == [
        {"date": "2030-06-10", "revenue": 300000},   # P1 + P2
        {"date": "2030-06-11", "revenue": 200000},   # P3, paid at 00:30 Vietnam time
        {"date": "2030-06-12", "revenue": 100000},   # P4
    ]


def test_top_movies_are_ranked_by_revenue(client, admin, sales):
    top = fetch(client, admin)["top_movies"]

    assert [(m["title"], m["revenue"]) for m in top] == [("Alpha", 500000), ("Beta", 100000)]


def test_top_movies_is_limited_to_the_five_highest_earners(client, admin, db_session, customer):
    theater = make_theater(db_session, layout=(("A", 6, SeatType.STANDARD),))
    for n in range(1, 7):   # "Movie n" sells n seats -> n x 100000
        movie = make_movie(db_session, title=f"Movie {n}")
        sale(db_session, customer, movie, theater, [f"A{i}" for i in range(1, n + 1)], vn_time(2030, 7, 1, 12))

    top = fetch(client, admin, "2030-07-01", "2030-07-01")["top_movies"]

    assert [(m["title"], m["revenue"]) for m in top] == [(f"Movie {n}", n * 100000) for n in range(6, 1, -1)]


def test_revenue_by_format(client, admin, sales):
    rows = fetch(client, admin)["revenue_by_format"]

    assert {r["format"]: r["revenue"] for r in rows} == {"2D": 300000, "3D": 100000, "IMAX": 200000}


def test_revenue_by_theater_is_ordered_highest_first(client, admin, sales):
    rows = fetch(client, admin)["revenue_by_theater"]

    assert [(r["theater_name"], r["revenue"]) for r in rows] == [("Downtown", 500000), ("Riverside", 100000)]


def test_revenue_by_seat_type_splits_each_booking_evenly_across_its_seats(client, admin, sales):
    rows = fetch(client, admin)["revenue_by_seat_type"]

    # P1: 2 standard -> 200000 | P2: 1 standard -> 100000
    # P3: 1 standard + 1 VIP, split 100000 each | P4: 1 VIP -> 100000
    assert {r["seat_type"]: r["revenue"] for r in rows} == {"STANDARD": 400000, "VIP": 200000}


def test_bookings_by_hour_use_vietnam_time(client, admin, sales):
    hours = fetch(client, admin)["peak_hours"]

    assert [h["hour"] for h in hours] == list(range(24))   # always 24 entries, gaps filled with 0
    expected = {hour: 0 for hour in range(24)}
    # P3 created 00:30 -> hour 0 (it is hour 17 in UTC); P2 + P4 created at 23:xx -> hour 23
    expected.update({0: 1, 10: 1, 12: 1, 15: 1, 23: 2})
    assert {h["hour"]: h["bookings_count"] for h in hours} == expected


def test_bookings_by_weekday_use_vietnam_time(client, admin, sales):
    assert date(2030, 6, 10).weekday() == 0   # sanity check on the dates in the fixture: a Monday
    weekdays = fetch(client, admin)["bookings_by_weekday"]

    assert [w["weekday"] for w in weekdays] == ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    # Mon: P1 P2 | Tue: P3 (00:30 Vietnam = still Monday in UTC) F1 K1 | Wed: P4
    assert {w["weekday"]: w["bookings_count"] for w in weekdays} == {
        "Sun": 0, "Mon": 2, "Tue": 3, "Wed": 1, "Thu": 0, "Fri": 0, "Sat": 0,
    }


def test_every_breakdown_adds_up_to_the_total(client, admin, sales):
    body = fetch(client, admin)
    total = body["total_revenue"]

    assert total > 0   # otherwise every comparison below is trivially 0 == 0
    assert sum(d["revenue"] for d in body["daily_revenue"]) == total
    assert sum(f["revenue"] for f in body["revenue_by_format"]) == total
    assert sum(t["revenue"] for t in body["revenue_by_theater"]) == total
    assert sum(s["revenue"] for s in body["revenue_by_seat_type"]) == total
    assert sum(m["revenue"] for m in body["top_movies"]) == total   # holds while there are <= 5 movies
    by_hour = sum(h["bookings_count"] for h in body["peak_hours"])
    by_weekday = sum(w["bookings_count"] for w in body["bookings_by_weekday"])
    assert by_hour == by_weekday == 6   # the six bookings created in the window


# ---------- empty and invalid input ----------

def test_a_window_with_no_data_returns_complete_zeroed_series(client, admin):
    body = fetch(client, admin, "2030-05-01", "2030-05-03")

    assert [d["date"] for d in body["daily_revenue"]] == ["2030-05-01", "2030-05-02", "2030-05-03"]
    assert [d["revenue"] for d in body["daily_revenue"]] == [0, 0, 0]
    assert len(body["peak_hours"]) == 24 and all(h["bookings_count"] == 0 for h in body["peak_hours"])
    assert len(body["bookings_by_weekday"]) == 7
    assert body["top_movies"] == [] and body["revenue_by_format"] == []
    assert body["revenue_by_theater"] == [] and body["revenue_by_seat_type"] == []
    assert (body["total_revenue"], body["total_bookings"], body["average_order_value"]) == (0, 0, 0)
    assert body["cancellation_rate"] == 0.0


def test_a_reversed_range_is_rejected(client, admin):
    response = client.get(
        ANALYTICS, params={"date_from": "2030-06-12", "date_to": "2030-06-10"}, headers=auth_headers(admin)
    )

    assert response.status_code == 400
    assert "must not be after" in response.json()["detail"]


@pytest.mark.parametrize(
    "date_to, expected_status",
    [("2031-01-01", 200), ("2031-01-02", 400)],
    ids=["366-days-is-allowed", "367-days-is-too-many"],
)
def test_range_length_limit(client, admin, date_to, expected_status):
    response = client.get(
        ANALYTICS, params={"date_from": "2030-01-01", "date_to": date_to}, headers=auth_headers(admin)
    )
    assert response.status_code == expected_status


@pytest.mark.parametrize(
    "params",
    [{}, {"date_from": "2030-06-10"}, {"date_to": "2030-06-10"}, {"date_from": "yesterday", "date_to": "2030-06-10"}],
    ids=["no-dates", "only-from", "only-to", "not-a-date"],
)
def test_missing_or_malformed_dates_are_rejected(client, admin, params):
    assert client.get(ANALYTICS, params=params, headers=auth_headers(admin)).status_code == 422