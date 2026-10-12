from datetime import datetime, timedelta, timezone

import pytest

from app.models.seat import SeatType
from app.models.showtime import ShowtimeFormat
from tests.factories import auth_headers, make_movie, make_showtime, make_theater, seat_ids

from tests.factories import book_seats as book

def test_create_booking_succeeds(client, db_session, showtime, customer):
    seats = seat_ids(db_session, showtime.theater_id, "A1", "A2")

    response = book(client, customer, showtime.id, seats)

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "CONFIRMED"
    assert body["payment_status"] == "PENDING"
    assert body["total_seats"] == 2
    assert body["total_amount"] == 150000
    assert sorted(s["seat_number"] for s in body["seats"]) == ["A1", "A2"]


def test_new_booking_holds_the_seats_for_fifteen_minutes(client, db_session, showtime, customer):
    seats = seat_ids(db_session, showtime.theater_id, "A1")

    response = book(client, customer, showtime.id, seats)

    expires_at = datetime.fromisoformat(response.json()["expires_at"])
    seconds_left = (expires_at - datetime.now(timezone.utc)).total_seconds()
    assert seconds_left <= 15 * 60


def test_total_includes_seat_type_and_format_surcharges(client, db_session, customer):
    theater = make_theater(
        db_session, layout=(("A", 3, SeatType.STANDARD), ("B", 3, SeatType.VIP))
    )
    imax = make_showtime(db_session, make_movie(db_session), theater, price=75000, fmt=ShowtimeFormat.IMAX)
    seats = seat_ids(db_session, theater.id, "A1", "B1")

    response = book(client, customer, imax.id, seats)

    # A1: 75000 + 0     (standard) + 50000 (IMAX) = 125000
    # B1: 75000 + 15000 (VIP)      + 50000 (IMAX) = 140000
    assert response.status_code == 201
    assert response.json()["total_amount"] == 265000


def test_booking_a_taken_seat_returns_409(client, db_session, showtime, customer, other_customer):
    (a1,) = seat_ids(db_session, showtime.theater_id, "A1")
    assert book(client, customer, showtime.id, [a1]).status_code == 201

    response = book(client, other_customer, showtime.id, [a1])

    assert response.status_code == 409
    assert "already booked" in response.json()["detail"]


def test_a_conflict_rolls_back_the_whole_booking(client, db_session, showtime, customer, other_customer):
    a1, a2 = seat_ids(db_session, showtime.theater_id, "A1", "A2")
    assert book(client, customer, showtime.id, [a1]).status_code == 201

    # A1 is taken, A2 is free: it must be all or nothing
    response = book(client, other_customer, showtime.id, [a1, a2])
    assert response.status_code == 409

    # no half-booking left behind: no booking row, and A2 is still free
    mine = client.get("/bookings", headers=auth_headers(other_customer))
    assert mine.json() == []
    assert book(client, other_customer, showtime.id, [a2]).status_code == 201


def test_the_same_seat_can_be_booked_for_different_showtimes(client, db_session, customer, other_customer):
    movie, theater = make_movie(db_session), make_theater(db_session)
    early = make_showtime(db_session, movie, theater, starts_in=timedelta(hours=2))
    late = make_showtime(db_session, movie, theater, starts_in=timedelta(hours=6))
    (a1,) = seat_ids(db_session, theater.id, "A1")

    # the unique constraint is on (showtime, seat), not on the seat alone
    assert book(client, customer, early.id, [a1]).status_code == 201
    assert book(client, other_customer, late.id, [a1]).status_code == 201


def test_a_seat_from_another_theater_is_rejected(client, db_session, showtime, customer):
    other_theater = make_theater(db_session, name="Other Theater")
    foreign_seat = seat_ids(db_session, other_theater.id, "A1")

    response = book(client, customer, showtime.id, foreign_seat)

    assert response.status_code == 400


def test_unknown_showtime_returns_404(client, db_session, showtime, customer):
    seats = seat_ids(db_session, showtime.theater_id, "A1")
    assert book(client, customer, 999999, seats).status_code == 404


def test_unknown_seat_returns_404(client, showtime, customer):
    assert book(client, customer, showtime.id, [999999]).status_code == 404


def test_empty_seat_list_is_rejected(client, showtime, customer):
    assert book(client, customer, showtime.id, []).status_code == 422


def test_duplicate_seat_ids_are_rejected(client, db_session, showtime, customer):
    (a1,) = seat_ids(db_session, showtime.theater_id, "A1")
    assert book(client, customer, showtime.id, [a1, a1]).status_code == 422


def test_booking_requires_login(client, db_session, showtime):
    (a1,) = seat_ids(db_session, showtime.theater_id, "A1")

    response = client.post("/bookings", json={"showtime_id": showtime.id, "seat_ids": [a1]})

    assert response.status_code == 401


def test_cancelling_frees_the_seat_for_someone_else(client, db_session, showtime, customer, other_customer):
    (a1,) = seat_ids(db_session, showtime.theater_id, "A1")
    booking = book(client, customer, showtime.id, [a1]).json()

    cancel = client.post(f"/bookings/{booking['id']}/cancel", headers=auth_headers(customer))

    assert cancel.status_code == 200
    assert cancel.json()["status"] == "CANCELLED"
    assert book(client, other_customer, showtime.id, [a1]).status_code == 201


def test_another_users_booking_looks_like_it_does_not_exist(client, db_session, showtime, customer, other_customer):
    (a1,) = seat_ids(db_session, showtime.theater_id, "A1")
    booking = book(client, customer, showtime.id, [a1]).json()

    response = client.get(f"/bookings/{booking['id']}", headers=auth_headers(other_customer))

    # 404, not 403: don't reveal that the booking ID exists
    assert response.status_code == 404