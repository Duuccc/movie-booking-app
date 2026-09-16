"""
Covers the mock payment flow: successful payment, failed payment,
retry after failure, double-payment rejection, paying a cancelled
booking, and ownership enforcement.
"""
from datetime import datetime

from app.models.movie import Movie
from app.models.theater import Theater
from app.models.seat import Seat
from app.models.showtime import Showtime


def _register_and_login(client, email, password="secret123"):
    client.post("/auth/register", json={"name": "Test", "email": email, "password": password})
    login = client.post("/auth/login", data={"username": email, "password": password})
    return login.json()["access_token"]


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def _seed_showtime_with_seats(db_session, seat_count=4, price=75000):
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

    showtime = Showtime(
        movie_id=movie.id, theater_id=theater.id, start_time=datetime.now(), price=price
    )
    db_session.add(showtime)
    db_session.commit()
    db_session.refresh(showtime)
    return showtime, seats


def _book(client, token, showtime_id, seat_ids):
    return client.post(
        "/bookings",
        json={"showtime_id": showtime_id, "seat_ids": seat_ids},
        headers=_auth_headers(token),
    )


def test_new_booking_starts_pending_with_correct_amount(client, db_session):
    token = _register_and_login(client, "alice@example.com")
    showtime, seats = _seed_showtime_with_seats(db_session, price=75000)

    response = _book(client, token, showtime.id, [seats[0].id, seats[1].id])
    assert response.status_code == 201
    body = response.json()
    assert body["payment_status"] == "PENDING"
    assert body["total_amount"] == 150000  # 2 seats x 75,000 VND


def test_successful_payment_marks_booking_paid(client, db_session):
    token = _register_and_login(client, "bob@example.com")
    showtime, seats = _seed_showtime_with_seats(db_session)
    booking_id = _book(client, token, showtime.id, [seats[0].id]).json()["id"]

    response = client.post(
        f"/bookings/{booking_id}/pay",
        json={"method": "MOMO"},
        headers=_auth_headers(token),
    )
    assert response.status_code == 200
    payment = response.json()
    assert payment["succeeded"] is True
    assert payment["amount"] == 75000
    assert payment["reference"].startswith("MOMO-")

    booking = client.get(f"/bookings/{booking_id}", headers=_auth_headers(token)).json()
    assert booking["payment_status"] == "PAID"


def test_failed_payment_leaves_booking_pending_and_retryable(client, db_session):
    token = _register_and_login(client, "carol@example.com")
    showtime, seats = _seed_showtime_with_seats(db_session)
    booking_id = _book(client, token, showtime.id, [seats[0].id]).json()["id"]

    failed = client.post(
        f"/bookings/{booking_id}/pay",
        json={"method": "VNPAY", "simulate_failure": True},
        headers=_auth_headers(token),
    )
    assert failed.status_code == 200
    assert failed.json()["succeeded"] is False

    # Still PENDING, not permanently FAILED -- the customer keeps their
    # seats and can try again.
    booking = client.get(f"/bookings/{booking_id}", headers=_auth_headers(token)).json()
    assert booking["payment_status"] == "PENDING"

    retry = client.post(
        f"/bookings/{booking_id}/pay",
        json={"method": "CARD"},
        headers=_auth_headers(token),
    )
    assert retry.status_code == 200
    assert retry.json()["succeeded"] is True

    booking = client.get(f"/bookings/{booking_id}", headers=_auth_headers(token)).json()
    assert booking["payment_status"] == "PAID"


def test_cannot_pay_twice(client, db_session):
    token = _register_and_login(client, "dave@example.com")
    showtime, seats = _seed_showtime_with_seats(db_session)
    booking_id = _book(client, token, showtime.id, [seats[0].id]).json()["id"]

    client.post(
        f"/bookings/{booking_id}/pay", json={"method": "MOMO"}, headers=_auth_headers(token)
    )
    second = client.post(
        f"/bookings/{booking_id}/pay", json={"method": "MOMO"}, headers=_auth_headers(token)
    )
    assert second.status_code == 400


def test_cannot_pay_for_cancelled_booking(client, db_session):
    token = _register_and_login(client, "erin@example.com")
    showtime, seats = _seed_showtime_with_seats(db_session)
    booking_id = _book(client, token, showtime.id, [seats[0].id]).json()["id"]

    client.post(f"/bookings/{booking_id}/cancel", headers=_auth_headers(token))

    response = client.post(
        f"/bookings/{booking_id}/pay", json={"method": "MOMO"}, headers=_auth_headers(token)
    )
    assert response.status_code == 400


def test_cannot_pay_for_someone_elses_booking(client, db_session):
    token_a = _register_and_login(client, "frank@example.com")
    token_b = _register_and_login(client, "grace@example.com")
    showtime, seats = _seed_showtime_with_seats(db_session)
    booking_id = _book(client, token_a, showtime.id, [seats[0].id]).json()["id"]

    response = client.post(
        f"/bookings/{booking_id}/pay", json={"method": "MOMO"}, headers=_auth_headers(token_b)
    )
    assert response.status_code == 404


def test_payment_requires_authentication(client, db_session):
    token = _register_and_login(client, "heidi@example.com")
    showtime, seats = _seed_showtime_with_seats(db_session)
    booking_id = _book(client, token, showtime.id, [seats[0].id]).json()["id"]

    response = client.post(f"/bookings/{booking_id}/pay", json={"method": "MOMO"})
    assert response.status_code == 401