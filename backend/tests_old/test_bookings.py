"""
Covers the "Booking" section of the test plan. test_cannot_double_book_seat
and test_partial_conflict_rolls_back_entire_booking are the two that
actually prove the double-booking constraint works end to end through
the real API -- not just at the database layer.
"""
from datetime import datetime

from app.models.user import User, UserRole
from app.models.movie import Movie
from app.models.theater import Theater
from app.models.seat import Seat
from app.models.showtime import Showtime


def _register_and_login(client, email, password="secret123"):
    client.post("/auth/register", json={"name": "Test", "email": email, "password": password})
    login = client.post("/auth/login", data={"username": email, "password": password})
    return login.json()["access_token"]


def _make_admin(db_session, email):
    user = db_session.query(User).filter(User.email == email).first()
    user.role = UserRole.ADMIN
    db_session.commit()


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def _seed_showtime_with_seats(db_session, seat_count=4):
    movie = Movie(title="Test Movie", duration=100)
    theater = Theater(name="Test Theater", location="Somewhere")
    db_session.add_all([movie, theater])
    db_session.commit()
    db_session.refresh(movie)
    db_session.refresh(theater)

    seats = [Seat(theater_id=theater.id, row="A", seat_number=n) for n in range(1, seat_count + 1)]
    db_session.add_all(seats)
    db_session.commit()
    for seat in seats:
        db_session.refresh(seat)

    showtime = Showtime(movie_id=movie.id, theater_id=theater.id, start_time=datetime.now(), price=10)
    db_session.add(showtime)
    db_session.commit()
    db_session.refresh(showtime)

    return showtime, seats


def test_user_can_book_available_seats(client, db_session):
    token = _register_and_login(client, "alice@example.com")
    showtime, seats = _seed_showtime_with_seats(db_session)

    response = client.post(
        "/bookings",
        json={"showtime_id": showtime.id, "seat_ids": [seats[0].id, seats[1].id]},
        headers=_auth_headers(token),
    )
    assert response.status_code == 201
    body = response.json()
    assert body["total_seats"] == 2
    assert body["status"] == "CONFIRMED"
    assert {s["seat_number"] for s in body["seats"]} == {"A1", "A2"}


def test_cannot_double_book_seat(client, db_session):
    """
    The core requirement: User A books A1 for a showtime, then User B
    tries to book the same seat for the same showtime. The second
    request must fail with 409, and User A's booking must remain intact.
    """
    token_a = _register_and_login(client, "usera@example.com")
    token_b = _register_and_login(client, "userb@example.com")
    showtime, seats = _seed_showtime_with_seats(db_session)
    seat_a1 = seats[0]

    first = client.post(
        "/bookings",
        json={"showtime_id": showtime.id, "seat_ids": [seat_a1.id]},
        headers=_auth_headers(token_a),
    )
    assert first.status_code == 201

    second = client.post(
        "/bookings",
        json={"showtime_id": showtime.id, "seat_ids": [seat_a1.id]},
        headers=_auth_headers(token_b),
    )
    assert second.status_code == 409

    my_bookings = client.get("/bookings", headers=_auth_headers(token_a)).json()
    assert len(my_bookings) == 1
    assert my_bookings[0]["status"] == "CONFIRMED"

    seats_response = client.get(f"/showtimes/{showtime.id}/seats").json()
    a1_status = next(s["status"] for s in seats_response if s["seat_number"] == "A1")
    assert a1_status == "BOOKED"


def test_partial_conflict_rolls_back_entire_booking(client, db_session):
    """
    If a user requests seats [A1, A2] and A1 is already taken, the whole
    booking must fail -- A2 must NOT get silently booked on its own.
    """
    token_a = _register_and_login(client, "usera2@example.com")
    token_b = _register_and_login(client, "userb2@example.com")
    showtime, seats = _seed_showtime_with_seats(db_session)
    seat_a1, seat_a2 = seats[0], seats[1]

    client.post(
        "/bookings",
        json={"showtime_id": showtime.id, "seat_ids": [seat_a1.id]},
        headers=_auth_headers(token_a),
    )

    response = client.post(
        "/bookings",
        json={"showtime_id": showtime.id, "seat_ids": [seat_a1.id, seat_a2.id]},
        headers=_auth_headers(token_b),
    )
    assert response.status_code == 409

    seats_response = client.get(f"/showtimes/{showtime.id}/seats").json()
    a2_status = next(s["status"] for s in seats_response if s["seat_number"] == "A2")
    assert a2_status == "AVAILABLE"  # not booked -- the whole request rolled back


def test_same_seat_bookable_for_different_showtime(client, db_session):
    token = _register_and_login(client, "carol@example.com")
    showtime_1, seats = _seed_showtime_with_seats(db_session)

    movie = db_session.query(Movie).first()
    theater = db_session.query(Theater).first()
    showtime_2 = Showtime(movie_id=movie.id, theater_id=theater.id, start_time=datetime.now(), price=10)
    db_session.add(showtime_2)
    db_session.commit()
    db_session.refresh(showtime_2)

    r1 = client.post(
        "/bookings",
        json={"showtime_id": showtime_1.id, "seat_ids": [seats[0].id]},
        headers=_auth_headers(token),
    )
    assert r1.status_code == 201

    r2 = client.post(
        "/bookings",
        json={"showtime_id": showtime_2.id, "seat_ids": [seats[0].id]},
        headers=_auth_headers(token),
    )
    assert r2.status_code == 201  # same seat, different showtime -- allowed


def test_booking_nonexistent_showtime_returns_404(client):
    token = _register_and_login(client, "dave@example.com")
    response = client.post(
        "/bookings",
        json={"showtime_id": 9999, "seat_ids": [1]},
        headers=_auth_headers(token),
    )
    assert response.status_code == 404


def test_booking_seat_from_wrong_theater_returns_400(client, db_session):
    token = _register_and_login(client, "erin@example.com")
    showtime, _ = _seed_showtime_with_seats(db_session)

    other_theater = Theater(name="Other Theater", location="Elsewhere")
    db_session.add(other_theater)
    db_session.commit()
    db_session.refresh(other_theater)
    foreign_seat = Seat(theater_id=other_theater.id, row="Z", seat_number=1)
    db_session.add(foreign_seat)
    db_session.commit()
    db_session.refresh(foreign_seat)

    response = client.post(
        "/bookings",
        json={"showtime_id": showtime.id, "seat_ids": [foreign_seat.id]},
        headers=_auth_headers(token),
    )
    assert response.status_code == 400


def test_user_can_view_and_cancel_booking(client, db_session):
    token = _register_and_login(client, "frank@example.com")
    showtime, seats = _seed_showtime_with_seats(db_session)

    create_response = client.post(
        "/bookings",
        json={"showtime_id": showtime.id, "seat_ids": [seats[0].id]},
        headers=_auth_headers(token),
    )
    booking_id = create_response.json()["id"]

    get_response = client.get(f"/bookings/{booking_id}", headers=_auth_headers(token))
    assert get_response.status_code == 200
    assert get_response.json()["status"] == "CONFIRMED"

    cancel_response = client.post(f"/bookings/{booking_id}/cancel", headers=_auth_headers(token))
    assert cancel_response.status_code == 200
    assert cancel_response.json()["status"] == "CANCELLED"

    # Cancelling frees the seat back up.
    seats_response = client.get(f"/showtimes/{showtime.id}/seats").json()
    assert seats_response[0]["status"] == "AVAILABLE"

    # Cancelling an already-cancelled booking is rejected.
    second_cancel = client.post(f"/bookings/{booking_id}/cancel", headers=_auth_headers(token))
    assert second_cancel.status_code == 400


def test_user_cannot_view_another_users_booking(client, db_session):
    token_a = _register_and_login(client, "grace@example.com")
    token_b = _register_and_login(client, "henry@example.com")
    showtime, seats = _seed_showtime_with_seats(db_session)

    create_response = client.post(
        "/bookings",
        json={"showtime_id": showtime.id, "seat_ids": [seats[0].id]},
        headers=_auth_headers(token_a),
    )
    booking_id = create_response.json()["id"]

    response = client.get(f"/bookings/{booking_id}", headers=_auth_headers(token_b))
    assert response.status_code == 404


def test_admin_can_view_all_bookings(client, db_session):
    customer_token = _register_and_login(client, "ivan@example.com")
    admin_token = _register_and_login(client, "admin@example.com")
    _make_admin(db_session, "admin@example.com")
    showtime, seats = _seed_showtime_with_seats(db_session)

    client.post(
        "/bookings",
        json={"showtime_id": showtime.id, "seat_ids": [seats[0].id]},
        headers=_auth_headers(customer_token),
    )

    response = client.get("/admin/bookings", headers=_auth_headers(admin_token))
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_non_admin_cannot_view_all_bookings(client):
    token = _register_and_login(client, "judy@example.com")
    response = client.get("/admin/bookings", headers=_auth_headers(token))
    assert response.status_code == 403