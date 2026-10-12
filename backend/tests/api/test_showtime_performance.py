from datetime import datetime
from types import SimpleNamespace

import pytest

from app.models.seat import SeatType
from app.models.showtime import ShowtimeFormat
from tests.factories import (
    auth_headers,
    book_seats,
    make_booking,
    make_movie,
    make_showtime,
    make_theater,
    seat_ids,
    vn_time,
)

PERFORMANCE = "/admin/analytics/showtime-performance"


def fetch(client, admin, date="2030-06-15", **filters):
    response = client.get(PERFORMANCE, params={"date": date, **filters}, headers=auth_headers(admin))
    assert response.status_code == 200, response.text
    return response.json()


def ids(rows):
    return [r["showtime_id"] for r in rows]


@pytest.fixture()
def lineup(db_session, customer):
    """
    Showtimes around 2030-06-15 (Vietnam day), each with a known occupancy:

    sold_out   06-15 10:00  Alpha  Small Hall (4 seats)   4/4   100.0
    late_night 06-15 00:30  Alpha  Small Hall              3/4    75.0   00:30 Vietnam is still the 14th in UTC
    half       06-15 12:00  Beta   Big Hall (10 seats)     5/10   50.0
    quiet      06-15 14:00  Alpha  Big Hall                1/10   10.0
    empty      06-15 18:00  Beta   Small Hall (IMAX)       0/4     0.0
    prev_day   06-14 23:59  Alpha  Small Hall              boundary: belongs to the 14th
    next_day   06-16 00:00  Beta   Big Hall                boundary: belongs to the 16th
    """
    alpha = make_movie(db_session, title="Alpha")
    beta = make_movie(db_session, title="Beta")
    small = make_theater(db_session, name="Small Hall", layout=(("A", 4, SeatType.STANDARD),))
    big = make_theater(db_session, name="Big Hall", layout=(("A", 10, SeatType.STANDARD),))

    def showtime_with(movie, theater, when, booked_labels, fmt=ShowtimeFormat.TWO_D):
        showtime = make_showtime(db_session, movie, theater, start_time=when, fmt=fmt)
        if booked_labels:
            make_booking(db_session, customer, showtime, seat_ids(db_session, theater.id, *booked_labels))
        return showtime

    return SimpleNamespace(
        alpha=alpha, beta=beta, small=small, big=big,
        sold_out=showtime_with(alpha, small, vn_time(2030, 6, 15, 10), ["A1", "A2", "A3", "A4"]),
        late_night=showtime_with(alpha, small, vn_time(2030, 6, 15, 0, 30), ["A1", "A2", "A3"]),
        half=showtime_with(beta, big, vn_time(2030, 6, 15, 12), [f"A{n}" for n in range(1, 6)]),
        quiet=showtime_with(alpha, big, vn_time(2030, 6, 15, 14), ["A1"]),
        empty=showtime_with(beta, small, vn_time(2030, 6, 15, 18), [], fmt=ShowtimeFormat.IMAX),
        prev_day=showtime_with(alpha, small, vn_time(2030, 6, 14, 23, 59), ["A1"]),
        next_day=showtime_with(beta, big, vn_time(2030, 6, 16, 0, 0), ["A1", "A2"]),
    )


def test_showtimes_are_listed_busiest_first(client, admin, lineup):
    rows = fetch(client, admin)

    assert ids(rows) == [
        lineup.sold_out.id, lineup.late_night.id, lineup.half.id, lineup.quiet.id, lineup.empty.id,
    ]
    assert [r["occupancy_pct"] for r in rows] == [100.0, 75.0, 50.0, 10.0, 0.0]


def test_a_row_describes_its_showtime(client, admin, lineup):
    row = fetch(client, admin)[0]   # the sold-out Alpha showtime

    assert row["showtime_id"] == lineup.sold_out.id
    assert row["movie_title"] == "Alpha"
    assert row["theater_name"] == "Small Hall"
    assert row["format"] == "2D"
    assert (row["booked_seats"], row["total_seats"]) == (4, 4)
    assert datetime.fromisoformat(row["start_time"]) == vn_time(2030, 6, 15, 10)


def test_the_format_is_reported(client, admin, lineup):
    by_id = {r["showtime_id"]: r for r in fetch(client, admin)}

    assert by_id[lineup.empty.id]["format"] == "IMAX"


def test_the_day_follows_vietnam_time(client, admin, lineup):
    on_15th = ids(fetch(client, admin, "2030-06-15"))
    on_14th = ids(fetch(client, admin, "2030-06-14"))
    on_16th = ids(fetch(client, admin, "2030-06-16"))

    assert lineup.late_night.id in on_15th and lineup.late_night.id not in on_14th   # 00:30 belongs to the 15th
    assert on_14th == [lineup.prev_day.id]                                           # 23:59 on the 14th
    assert on_16th == [lineup.next_day.id]                                           # midnight starts the 16th


def test_a_day_without_showtimes_is_an_empty_list(client, admin, lineup):
    assert fetch(client, admin, "2030-06-17") == []


def test_filter_by_theater(client, admin, lineup):
    assert ids(fetch(client, admin, theater_id=lineup.small.id)) == [
        lineup.sold_out.id, lineup.late_night.id, lineup.empty.id,
    ]
    assert ids(fetch(client, admin, theater_id=lineup.big.id)) == [lineup.half.id, lineup.quiet.id]


def test_filter_by_movie(client, admin, lineup):
    assert ids(fetch(client, admin, movie_id=lineup.alpha.id)) == [
        lineup.sold_out.id, lineup.late_night.id, lineup.quiet.id,
    ]
    assert ids(fetch(client, admin, movie_id=lineup.beta.id)) == [lineup.half.id, lineup.empty.id]


def test_filters_combine(client, admin, lineup):
    assert ids(fetch(client, admin, movie_id=lineup.alpha.id, theater_id=lineup.big.id)) == [lineup.quiet.id]


def test_filters_that_match_nothing_return_an_empty_list(client, admin, lineup):
    assert fetch(client, admin, theater_id=999999) == []
    assert fetch(client, admin, movie_id=999999) == []


def test_cancelling_a_booking_removes_it_from_the_booked_count(client, db_session, admin, customer, lineup):
    a1, a2 = seat_ids(db_session, lineup.small.id, "A1", "A2")
    booking = book_seats(client, customer, lineup.empty.id, [a1, a2]).json()

    def booked_for_empty():
        return {r["showtime_id"]: r["booked_seats"] for r in fetch(client, admin)}[lineup.empty.id]

    assert booked_for_empty() == 2   # a live unpaid hold counts as booked, same as everywhere else in the app
    client.post(f"/bookings/{booking['id']}/cancel", headers=auth_headers(customer))
    assert booked_for_empty() == 0   # cancelling frees the seats


def test_occupancy_is_rounded_to_one_decimal(client, db_session, admin, customer):
    theater = make_theater(db_session, layout=(("A", 3, SeatType.STANDARD),))
    showtime = make_showtime(db_session, make_movie(db_session), theater, start_time=vn_time(2030, 6, 20, 12))
    make_booking(db_session, customer, showtime, seat_ids(db_session, theater.id, "A1"))

    (row,) = fetch(client, admin, "2030-06-20")

    assert row["occupancy_pct"] == 33.3   # 1 of 3 seats


def test_a_theater_without_seats_has_zero_occupancy_instead_of_crashing(client, db_session, admin):
    theater = make_theater(db_session, layout=())
    make_showtime(db_session, make_movie(db_session), theater, start_time=vn_time(2030, 6, 21, 12))

    (row,) = fetch(client, admin, "2030-06-21")

    assert (row["booked_seats"], row["total_seats"], row["occupancy_pct"]) == (0, 0, 0.0)


def test_the_date_is_required(client, admin):
    assert client.get(PERFORMANCE, headers=auth_headers(admin)).status_code == 422