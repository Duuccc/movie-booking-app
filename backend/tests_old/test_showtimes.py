"""
Covers showtime CRUD (mirroring movies/theaters) plus the seat
availability endpoint -- the one genuinely new piece of logic in this
milestone.

Booking creation doesn't exist yet (Milestone 6), so the "seat is
BOOKED" tests insert Booking/BookingSeat rows directly into the test
database rather than going through an API endpoint.
"""
from datetime import datetime, timedelta

from app.models.user import User, UserRole
from app.models.movie import Movie
from app.models.theater import Theater
from app.models.seat import Seat
from app.models.showtime import Showtime
from app.models.booking import Booking, BookingStatus
from app.models.booking_seat import BookingSeat


def _register_and_login(client, email, password="secret123"):
    client.post("/auth/register", json={"name": "Test", "email": email, "password": password})
    login = client.post("/auth/login", data={"username": email, "password": password})
    return login.json()["access_token"]


def _make_admin(db_session, email):
    user = db_session.query(User).filter(User.email == email).first()
    user.role = UserRole.ADMIN
    db_session.commit()


def _seed_movie_and_theater(db_session):
    movie = Movie(title="Test Movie", duration=100)
    theater = Theater(name="Test Theater", location="Somewhere")
    db_session.add_all([movie, theater])
    db_session.commit()
    db_session.refresh(movie)
    db_session.refresh(theater)
    return movie, theater


def test_list_showtimes_is_public(client):
    response = client.get("/showtimes")
    assert response.status_code == 200
    assert response.json() == []


def test_admin_can_create_showtime(client, db_session):
    token = _register_and_login(client, "admin@example.com")
    _make_admin(db_session, "admin@example.com")
    movie, theater = _seed_movie_and_theater(db_session)

    response = client.post(
        "/showtimes",
        json={
            "movie_id": movie.id,
            "theater_id": theater.id,
            "start_time": (datetime.now() + timedelta(days=1)).isoformat(),
            "price": 75000,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    assert response.json()["movie_id"] == movie.id


def test_create_showtime_with_invalid_movie_returns_404(client, db_session):
    token = _register_and_login(client, "admin2@example.com")
    _make_admin(db_session, "admin2@example.com")
    _, theater = _seed_movie_and_theater(db_session)

    response = client.post(
        "/showtimes",
        json={
            "movie_id": 9999,
            "theater_id": theater.id,
            "start_time": datetime.now().isoformat(),
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == "Movie not found"


def test_non_admin_cannot_create_showtime(client, db_session):
    token = _register_and_login(client, "customer@example.com")
    movie, theater = _seed_movie_and_theater(db_session)

    response = client.post(
        "/showtimes",
        json={
            "movie_id": movie.id,
            "theater_id": theater.id,
            "start_time": datetime.now().isoformat(),
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403


def test_seats_all_available_when_none_booked(client, db_session):
    movie, theater = _seed_movie_and_theater(db_session)
    db_session.add_all([
        Seat(theater_id=theater.id, row="A", seat_number=1),
        Seat(theater_id=theater.id, row="A", seat_number=2),
    ])
    db_session.commit()

    showtime = Showtime(movie_id=movie.id, theater_id=theater.id, start_time=datetime.now(), price=10)
    db_session.add(showtime)
    db_session.commit()
    db_session.refresh(showtime)

    response = client.get(f"/showtimes/{showtime.id}/seats")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 2
    assert all(seat["status"] == "AVAILABLE" for seat in body)
    assert {seat["seat_number"] for seat in body} == {"A1", "A2"}


def test_booked_seat_shows_booked_only_for_its_own_showtime(client, db_session):
    """
    This is the core spec requirement: Seat A1 booked for the 10:00
    showtime must stay AVAILABLE for the 14:00 showtime of the same
    seat, same theater. If this test fails, the seat-availability query
    is filtering by seat_id alone instead of (showtime_id, seat_id).
    """
    movie, theater = _seed_movie_and_theater(db_session)
    seat = Seat(theater_id=theater.id, row="A", seat_number=1)
    db_session.add(seat)
    db_session.commit()
    db_session.refresh(seat)

    showtime_1 = Showtime(movie_id=movie.id, theater_id=theater.id, start_time=datetime.now(), price=10)
    showtime_2 = Showtime(
        movie_id=movie.id, theater_id=theater.id,
        start_time=datetime.now() + timedelta(hours=4), price=10,
    )
    db_session.add_all([showtime_1, showtime_2])
    db_session.commit()
    db_session.refresh(showtime_1)
    db_session.refresh(showtime_2)

    user = User(name="Booker", email="booker@example.com", password_hash="x", role=UserRole.CUSTOMER)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    booking = Booking(user_id=user.id, showtime_id=showtime_1.id, status=BookingStatus.CONFIRMED, total_seats=1)
    db_session.add(booking)
    db_session.commit()
    db_session.refresh(booking)

    db_session.add(BookingSeat(booking_id=booking.id, seat_id=seat.id, showtime_id=showtime_1.id))
    db_session.commit()

    response_1 = client.get(f"/showtimes/{showtime_1.id}/seats")
    assert response_1.json()[0]["status"] == "BOOKED"

    response_2 = client.get(f"/showtimes/{showtime_2.id}/seats")
    assert response_2.json()[0]["status"] == "AVAILABLE"


def test_showtime_seats_not_found_for_unknown_showtime(client):
    response = client.get("/showtimes/9999/seats")
    assert response.status_code == 404


def test_admin_cannot_delete_showtime_with_active_bookings(client, db_session):
    """
    Milestone 10 fix: deleting a showtime would otherwise cascade-delete
    any bookings against it via the FK. Confirmed bookings must block
    the delete with 400 instead.
    """
    token = _register_and_login(client, "admin3@example.com")
    _make_admin(db_session, "admin3@example.com")
    movie, theater = _seed_movie_and_theater(db_session)

    seat = Seat(theater_id=theater.id, row="A", seat_number=1)
    db_session.add(seat)
    db_session.commit()
    db_session.refresh(seat)

    showtime = Showtime(movie_id=movie.id, theater_id=theater.id, start_time=datetime.now(), price=10)
    db_session.add(showtime)
    db_session.commit()
    db_session.refresh(showtime)

    admin_user = db_session.query(User).filter(User.email == "admin3@example.com").first()
    booking = Booking(
        user_id=admin_user.id, showtime_id=showtime.id, status=BookingStatus.CONFIRMED, total_seats=1
    )
    db_session.add(booking)
    db_session.commit()
    db_session.refresh(booking)
    db_session.add(BookingSeat(booking_id=booking.id, seat_id=seat.id, showtime_id=showtime.id))
    db_session.commit()

    response = client.delete(f"/showtimes/{showtime.id}", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 400
    assert client.get(f"/showtimes/{showtime.id}").status_code == 200


def test_admin_can_delete_showtime_with_no_bookings(client, db_session):
    token = _register_and_login(client, "admin4@example.com")
    _make_admin(db_session, "admin4@example.com")
    movie, theater = _seed_movie_and_theater(db_session)

    showtime = Showtime(movie_id=movie.id, theater_id=theater.id, start_time=datetime.now(), price=10)
    db_session.add(showtime)
    db_session.commit()
    db_session.refresh(showtime)

    response = client.delete(f"/showtimes/{showtime.id}", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 204
    assert client.get(f"/showtimes/{showtime.id}").status_code == 404