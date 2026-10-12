from datetime import timedelta

import pytest

from app.models.seat import SeatType
from app.models.showtime import ShowtimeFormat
from tests.factories import (
    book_seats,
    make_booking,
    make_movie,
    make_showtime,
    make_theater,
    seat_ids,
)


@pytest.fixture()
def mixed_showtime(db_session):
    """IMAX showtime at 75000 in a theater with A1-A2 (standard) and B1-B2 (VIP)."""
    theater = make_theater(db_session, layout=(("A", 2, SeatType.STANDARD), ("B", 2, SeatType.VIP)))
    return make_showtime(db_session, make_movie(db_session), theater, price=75000, fmt=ShowtimeFormat.IMAX)


# ---------- seat map ----------

def test_seat_map_shows_type_price_and_availability(client, mixed_showtime):
    response = client.get(f"/showtimes/{mixed_showtime.id}/seats")   # public: no headers

    assert response.status_code == 200
    rows = [(s["seat_number"], s["seat_type"], s["price"], s["status"]) for s in response.json()]
    assert rows == [
        ("A1", "STANDARD", 125000, "AVAILABLE"),   # 75000 + 50000 IMAX
        ("A2", "STANDARD", 125000, "AVAILABLE"),
        ("B1", "VIP", 140000, "AVAILABLE"),        # + 15000 VIP
        ("B2", "VIP", 140000, "AVAILABLE"),
    ]


def test_seat_map_orders_seat_10_after_seat_9(client, db_session):
    theater = make_theater(db_session, layout=(("A", 11, SeatType.STANDARD),))
    showtime = make_showtime(db_session, make_movie(db_session), theater)

    labels = [s["seat_number"] for s in client.get(f"/showtimes/{showtime.id}/seats").json()]

    assert labels == [f"A{n}" for n in range(1, 12)]   # numeric order, not "A1, A10, A11, A2..."


def test_seat_map_marks_only_the_booked_seats(client, db_session, mixed_showtime, customer):
    (a1,) = seat_ids(db_session, mixed_showtime.theater_id, "A1")
    assert book_seats(client, customer, mixed_showtime.id, [a1]).status_code == 201

    seat_map = client.get(f"/showtimes/{mixed_showtime.id}/seats").json()

    status_by_seat = {s["seat_number"]: s["status"] for s in seat_map}
    assert status_by_seat == {"A1": "BOOKED", "A2": "AVAILABLE", "B1": "AVAILABLE", "B2": "AVAILABLE"}


def test_the_price_on_the_seat_map_is_the_price_charged(client, mixed_showtime, customer):
    seat_map = {s["seat_number"]: s for s in client.get(f"/showtimes/{mixed_showtime.id}/seats").json()}
    chosen = ["A1", "B2"]

    response = book_seats(client, customer, mixed_showtime.id, [seat_map[label]["seat_id"] for label in chosen])

    assert response.json()["total_amount"] == sum(seat_map[label]["price"] for label in chosen)


def test_seat_map_of_an_unknown_showtime_returns_404(client):
    assert client.get("/showtimes/999999/seats").status_code == 404


# ---------- availability counts ----------

def availability(client, *showtime_ids):
    response = client.get("/showtimes/availability", params=[("showtime_id", i) for i in showtime_ids])
    assert response.status_code == 200
    return {row["showtime_id"]: row["available_seats"] for row in response.json()}


def test_availability_route_is_not_shadowed_by_the_showtime_id_route(client, showtime):
    # If "/{showtime_id}" were declared first, "availability" would be parsed
    # as an integer id and this would be a 422.
    response = client.get("/showtimes/availability", params={"showtime_id": showtime.id})
    assert response.status_code == 200


def test_availability_requires_at_least_one_showtime_id(client):
    assert client.get("/showtimes/availability").status_code == 422


def test_availability_counts_every_seat_when_nothing_is_booked(client, showtime):
    assert availability(client, showtime.id) == {showtime.id: 5}


def test_availability_drops_by_the_number_of_booked_seats(client, db_session, showtime, customer):
    a1, a2 = seat_ids(db_session, showtime.theater_id, "A1", "A2")
    book_seats(client, customer, showtime.id, [a1, a2])

    assert availability(client, showtime.id) == {showtime.id: 3}


def test_availability_is_tracked_per_showtime(client, db_session, customer):
    theater, movie = make_theater(db_session), make_movie(db_session)
    first = make_showtime(db_session, movie, theater, starts_in=timedelta(hours=2))
    second = make_showtime(db_session, movie, theater, starts_in=timedelta(hours=5))
    (a1,) = seat_ids(db_session, theater.id, "A1")
    book_seats(client, customer, first.id, [a1])

    assert availability(client, first.id, second.id) == {first.id: 4, second.id: 5}


def test_a_live_unpaid_hold_counts_as_taken(client, db_session, showtime, customer):
    (a1,) = seat_ids(db_session, showtime.theater_id, "A1")
    make_booking(db_session, customer, showtime, [a1], expires_in=timedelta(minutes=4))

    assert availability(client, showtime.id) == {showtime.id: 4}


@pytest.mark.xfail(
    strict=True,
    reason="Known inconsistency: availability counts expired-but-uncleaned holds, "
           "while the seat map cleans them first. Fix it, then delete this marker.",
)
def test_availability_ignores_expired_holds(client, db_session, showtime, customer):
    (a1,) = seat_ids(db_session, showtime.theater_id, "A1")
    make_booking(db_session, customer, showtime, [a1], expires_in=timedelta(minutes=-1))

    assert availability(client, showtime.id) == {showtime.id: 5}