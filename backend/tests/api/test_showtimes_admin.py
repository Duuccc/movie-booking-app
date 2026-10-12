from datetime import datetime, timedelta

import pytest

from app.models.seat import Seat
from tests.factories import (
    auth_headers,
    make_booking,
    make_movie,
    make_showtime,
    make_theater,
    seat_ids,
    vn_time,
)

from app.models.booking import Booking

@pytest.fixture()
def movie(db_session):
    return make_movie(db_session)


@pytest.fixture()
def theater(db_session):
    return make_theater(db_session)


def payload(movie, theater, **overrides):
    body = {
        "movie_id": movie.id,
        "theater_id": theater.id,
        "start_time": "2030-06-15T10:00:00+07:00",
        "price": 90000,
        "format": "3D",
    }
    body.update(overrides)
    return body


# ---------- create ----------

def test_admin_creates_a_showtime(client, admin, movie, theater):
    response = client.post("/showtimes", json=payload(movie, theater), headers=auth_headers(admin))

    assert response.status_code == 201
    body = response.json()
    assert (body["movie_id"], body["theater_id"]) == (movie.id, theater.id)
    assert body["price"] == 90000
    assert body["format"] == "3D"
    # same instant no matter which UTC offset the client used to write it
    assert datetime.fromisoformat(body["start_time"]) == vn_time(2030, 6, 15, 10)


def test_price_and_format_have_defaults(client, admin, movie, theater):
    body = {"movie_id": movie.id, "theater_id": theater.id, "start_time": "2030-06-15T10:00:00+07:00"}

    response = client.post("/showtimes", json=body, headers=auth_headers(admin))

    assert response.status_code == 201
    assert response.json()["price"] == 75000
    assert response.json()["format"] == "2D"


@pytest.mark.parametrize(
    "field, message", [("movie_id", "Movie not found"), ("theater_id", "Theater not found")]
)
def test_create_rejects_an_unknown_movie_or_theater(client, admin, movie, theater, field, message):
    body = payload(movie, theater, **{field: 999999})

    response = client.post("/showtimes", json=body, headers=auth_headers(admin))

    assert response.status_code == 404
    assert response.json()["detail"] == message


def test_create_rejects_an_unknown_format(client, admin, movie, theater):
    response = client.post("/showtimes", json=payload(movie, theater, format="4DX"), headers=auth_headers(admin))
    assert response.status_code == 422


# ---------- update ----------

def test_update_changes_only_the_fields_sent(client, admin, showtime):
    response = client.put(f"/showtimes/{showtime.id}", json={"price": 99000}, headers=auth_headers(admin))

    assert response.status_code == 200
    body = response.json()
    assert body["price"] == 99000
    assert body["format"] == "2D"
    assert body["movie_id"] == showtime.movie_id


def test_update_rejects_an_unknown_movie(client, admin, showtime):
    response = client.put(f"/showtimes/{showtime.id}", json={"movie_id": 999999}, headers=auth_headers(admin))
    assert response.status_code == 404


def test_update_of_an_unknown_showtime_returns_404(client, admin):
    response = client.put("/showtimes/999999", json={"price": 1000}, headers=auth_headers(admin))
    assert response.status_code == 404


# ---------- batch ----------

def test_batch_creates_every_row(client, admin, movie, theater):
    rows = [
        payload(movie, theater, start_time=f"2030-06-15T{hour}:00:00+07:00", format=fmt)
        for hour, fmt in [("10", "2D"), ("14", "3D"), ("19", "IMAX")]
    ]

    response = client.post("/showtimes/batch", json={"showtimes": rows}, headers=auth_headers(admin))

    assert response.status_code == 201
    assert [s["format"] for s in response.json()] == ["2D", "3D", "IMAX"]
    assert len(client.get("/showtimes").json()) == 3


def test_batch_is_all_or_nothing(client, admin, movie, theater):
    rows = [
        payload(movie, theater),
        payload(movie, theater, movie_id=999999),   # row 2 is invalid
        payload(movie, theater),
    ]

    response = client.post("/showtimes/batch", json={"showtimes": rows}, headers=auth_headers(admin))

    assert response.status_code == 400
    assert "Row 2" in response.json()["detail"]
    # the status code alone proves nothing: check that row 1 was not kept
    assert client.get("/showtimes").json() == []


def test_batch_with_a_schema_invalid_row_creates_nothing(client, admin, movie, theater):
    rows = [payload(movie, theater), payload(movie, theater, format="4DX")]

    response = client.post("/showtimes/batch", json={"showtimes": rows}, headers=auth_headers(admin))

    assert response.status_code == 422
    assert client.get("/showtimes").json() == []


def test_an_empty_batch_is_rejected(client, admin):
    response = client.post("/showtimes/batch", json={"showtimes": []}, headers=auth_headers(admin))
    assert response.status_code == 400


# ---------- delete + the "active bookings" guards ----------

@pytest.fixture()
def active_booking(db_session, showtime, customer):
    """An unpaid booking whose hold is still valid: it counts as active."""
    (a1,) = seat_ids(db_session, showtime.theater_id, "A1")
    return make_booking(db_session, customer, showtime, [a1], expires_in=timedelta(minutes=4))


def test_a_showtime_with_an_active_booking_cannot_be_deleted(client, admin, showtime, active_booking):
    showtime_id = showtime.id

    response = client.delete(f"/showtimes/{showtime_id}", headers=auth_headers(admin))

    assert response.status_code == 400
    assert client.get(f"/showtimes/{showtime_id}").status_code == 200   # still there


def test_a_movie_with_an_active_booking_cannot_be_deleted(client, admin, showtime, active_booking):
    response = client.delete(f"/movies/{showtime.movie_id}", headers=auth_headers(admin))
    assert response.status_code == 400


def test_a_theater_with_an_active_booking_cannot_be_deleted(client, admin, showtime, active_booking):
    response = client.delete(f"/theaters/{showtime.theater_id}", headers=auth_headers(admin))
    assert response.status_code == 400


def test_a_showtime_without_bookings_can_be_deleted(client, admin, showtime):
    showtime_id = showtime.id

    assert client.delete(f"/showtimes/{showtime_id}", headers=auth_headers(admin)).status_code == 204
    assert client.get(f"/showtimes/{showtime_id}").status_code == 404


def test_deleting_a_movie_without_bookings_removes_its_showtimes(client, admin, showtime):
    showtime_id, movie_id = showtime.id, showtime.movie_id

    assert client.delete(f"/movies/{movie_id}", headers=auth_headers(admin)).status_code == 204
    assert client.get(f"/showtimes/{showtime_id}").status_code == 404


def test_deleting_a_theater_without_bookings_removes_its_seats_and_showtimes(client, db_session, admin, showtime):
    showtime_id, theater_id = showtime.id, showtime.theater_id

    assert client.delete(f"/theaters/{theater_id}", headers=auth_headers(admin)).status_code == 204
    assert client.get(f"/showtimes/{showtime_id}").status_code == 404
    assert db_session.query(Seat).filter(Seat.theater_id == theater_id).count() == 0


def test_a_showtime_whose_booking_was_cancelled_can_be_deleted(client, admin, customer, showtime, active_booking):
    cancel = client.post(f"/bookings/{active_booking.id}/cancel", headers=auth_headers(customer))
    assert cancel.status_code == 200

    response = client.delete(f"/showtimes/{showtime.id}", headers=auth_headers(admin))

    assert response.status_code == 204

def test_a_movie_whose_only_bookings_are_cancelled_can_be_deleted(client, admin, customer, showtime, active_booking):
    cancel = client.post(f"/bookings/{active_booking.id}/cancel", headers=auth_headers(customer))
    assert cancel.status_code == 200

    response = client.delete(f"/movies/{showtime.movie_id}", headers=auth_headers(admin))

    assert response.status_code == 204


def test_a_theater_whose_only_bookings_are_cancelled_can_be_deleted(client, admin, customer, showtime, active_booking):
    cancel = client.post(f"/bookings/{active_booking.id}/cancel", headers=auth_headers(customer))
    assert cancel.status_code == 200

    response = client.delete(f"/theaters/{showtime.theater_id}", headers=auth_headers(admin))

    assert response.status_code == 204


def test_a_showtime_whose_abandoned_hold_was_cleaned_up_can_be_deleted(client, db_session, admin, customer, showtime):
    # The realistic path: a customer abandons checkout, the hold expires, and
    # opening the seat map runs the lazy cleanup that marks it CANCELLED.
    (a1,) = seat_ids(db_session, showtime.theater_id, "A1")
    make_booking(db_session, customer, showtime, [a1], expires_in=timedelta(minutes=-1))
    client.get(f"/showtimes/{showtime.id}/seats")

    response = client.delete(f"/showtimes/{showtime.id}", headers=auth_headers(admin))

    assert response.status_code == 204


def test_deleting_a_showtime_also_deletes_its_cancelled_bookings(client, db_session, admin, customer, showtime, active_booking):
    # Characterization test: records that the history of cancelled bookings
    # goes away with the showtime. If you decide to keep history, change this
    # on purpose.
    booking_id = active_booking.id
    client.post(f"/bookings/{booking_id}/cancel", headers=auth_headers(customer))

    assert client.delete(f"/showtimes/{showtime.id}", headers=auth_headers(admin)).status_code == 204

    assert db_session.query(Booking).filter(Booking.id == booking_id).count() == 0