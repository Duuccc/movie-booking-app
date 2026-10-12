import pytest

from app.models.seat import SeatType
from tests.factories import (
    auth_headers,
    book_seats,
    make_movie,
    make_showtime,
    make_theater,
    seat_ids,
)


def row_config(letter, count, seat_type="STANDARD"):
    return {"row": letter, "seat_count": count, "seat_type": seat_type}


def add_rows(client, admin, theater_id, rows):
    return client.post(f"/theaters/{theater_id}/seats", json={"rows": rows}, headers=auth_headers(admin))


def seat_summary(client, admin, theater_id):
    response = client.get(f"/theaters/{theater_id}/seats/summary", headers=auth_headers(admin))
    assert response.status_code == 200
    return response.json()


@pytest.fixture()
def empty_theater(db_session):
    return make_theater(db_session, layout=())   # no seats at all


# ---------- basic CRUD ----------

def test_admin_creates_a_theater_with_no_seats_yet(client, admin):
    response = client.post(
        "/theaters", json={"name": "Grand Hall", "location": "1 Main St"}, headers=auth_headers(admin)
    )

    assert response.status_code == 201
    theater_id = response.json()["id"]
    assert "Grand Hall" in [t["name"] for t in client.get("/theaters").json()]
    assert seat_summary(client, admin, theater_id) == {"total_seats": 0, "rows": []}


def test_admin_updates_a_theater(client, admin, empty_theater):
    response = client.put(
        f"/theaters/{empty_theater.id}",
        json={"name": "Renamed", "location": "New Address"},
        headers=auth_headers(admin),
    )

    assert response.status_code == 200
    assert response.json()["name"] == "Renamed"


def test_unknown_theater_returns_404(client, admin):
    assert client.get("/theaters/999999").status_code == 404
    assert add_rows(client, admin, 999999, [row_config("A", 5)]).status_code == 404
    assert client.get("/theaters/999999/seats/summary", headers=auth_headers(admin)).status_code == 404


# ---------- adding seat rows ----------

def test_rows_create_the_requested_number_of_seats(client, admin, empty_theater):
    response = add_rows(client, admin, empty_theater.id, [row_config("A", 10), row_config("B", 8, "VIP")])

    assert response.status_code == 201
    assert response.json() == {"total_seats": 18, "rows": ["A", "B"]}


def test_seat_types_are_stored_and_reach_the_seat_map(client, db_session, admin, empty_theater):
    add_rows(client, admin, empty_theater.id, [row_config("A", 2), row_config("B", 2, "COUPLE")])
    showtime = make_showtime(db_session, make_movie(db_session), empty_theater)

    seat_map = client.get(f"/showtimes/{showtime.id}/seats").json()

    assert {s["seat_number"]: s["seat_type"] for s in seat_map} == {
        "A1": "STANDARD", "A2": "STANDARD", "B1": "COUPLE", "B2": "COUPLE",
    }


def test_row_letters_are_normalised_to_uppercase(client, admin, empty_theater):
    response = add_rows(client, admin, empty_theater.id, [row_config("a", 3)])

    assert response.json()["rows"] == ["A"]


def test_an_existing_row_cannot_be_extended(client, admin, empty_theater):
    add_rows(client, admin, empty_theater.id, [row_config("A", 5)])

    response = add_rows(client, admin, empty_theater.id, [row_config("A", 8)])

    assert response.status_code == 400
    assert "already exist" in response.json()["detail"]
    assert seat_summary(client, admin, empty_theater.id)["total_seats"] == 5   # unchanged


def test_the_same_row_twice_in_one_request_is_rejected(client, admin, empty_theater):
    response = add_rows(client, admin, empty_theater.id, [row_config("A", 5), row_config("A", 3)])

    assert response.status_code == 400
    assert "more than once" in response.json()["detail"]
    assert seat_summary(client, admin, empty_theater.id)["total_seats"] == 0


@pytest.mark.parametrize(
    "bad_row",
    [row_config("", 5), row_config("1", 5), row_config("ABC", 5),
     row_config("A", 0), row_config("A", 51), row_config("A", -1)],
    ids=["empty-letter", "numeric-letter", "too-long-letter", "zero-seats", "too-many-seats", "negative-seats"],
)
def test_invalid_rows_are_rejected(client, admin, empty_theater, bad_row):
    assert add_rows(client, admin, empty_theater.id, [bad_row]).status_code == 422


def test_one_invalid_row_rejects_the_whole_request(client, admin, empty_theater):
    response = add_rows(client, admin, empty_theater.id, [row_config("A", 5), row_config("B", 0)])

    assert response.status_code == 422
    assert seat_summary(client, admin, empty_theater.id)["total_seats"] == 0   # row A was not kept


def test_adding_a_row_leaves_existing_seats_and_bookings_alone(client, db_session, admin, customer):
    theater = make_theater(db_session)   # A1..A5
    showtime = make_showtime(db_session, make_movie(db_session), theater)
    (a1,) = seat_ids(db_session, theater.id, "A1")
    assert book_seats(client, customer, showtime.id, [a1]).status_code == 201

    response = add_rows(client, admin, theater.id, [row_config("B", 4)])

    assert response.status_code == 201
    assert response.json() == {"total_seats": 9, "rows": ["A", "B"]}
    assert seat_ids(db_session, theater.id, "A1") == [a1]   # same row in the table, not recreated
    seat_map = client.get(f"/showtimes/{showtime.id}/seats").json()
    assert {s["seat_number"]: s["status"] for s in seat_map}["A1"] == "BOOKED"