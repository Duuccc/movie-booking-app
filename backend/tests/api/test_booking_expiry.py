from datetime import timedelta

import pytest

from app.models.booking import BookingStatus, PaymentStatus
from app.models.booking_seat import BookingSeat
from app.services.booking_service import expire_booking_if_needed, expire_bookings_for_showtime
from tests.factories import (
    auth_headers,
    book_seats,
    make_booking,
    make_movie,
    make_showtime,
    make_theater,
    seat_ids,
)


def held_seats(db, booking):
    return db.query(BookingSeat).filter(BookingSeat.booking_id == booking.id).count()


# (expires_in, payment_status, expired, expected_status, expected_seats_still_held)
HOLD_CASES = [
    pytest.param(timedelta(minutes=-1), PaymentStatus.PENDING, True, BookingStatus.CANCELLED, 0, id="expired-and-unpaid"),
    pytest.param(timedelta(minutes=4), PaymentStatus.PENDING, False, BookingStatus.CONFIRMED, 1, id="still-within-the-hold"),
    pytest.param(timedelta(minutes=-1), PaymentStatus.PAID, False, BookingStatus.CONFIRMED, 1, id="expired-but-paid"),
]


# ---------- the service functions ----------

# STATE TRANSITION: 
# booking -> if expires && payment_status == Pending -> after payment -> expire that booking -> booking status = Cancelled
#         -> if not expire && payment_status == Pending -> after payment -> succeed -> payment_status becomes Paid && status becomes Confirmed
#         -> if expires but already paid -> 
@pytest.mark.parametrize("expires_in, payment_status, expired, expected_status, expected_seats", HOLD_CASES)
def test_expire_bookings_for_showtime(
    db_session, showtime, customer, expires_in, payment_status, expired, expected_status, expected_seats
):
    (a1,) = seat_ids(db_session, showtime.theater_id, "A1")
    booking = make_booking(db_session, customer, showtime, [a1], expires_in=expires_in, payment_status=payment_status)

    count = expire_bookings_for_showtime(db_session, showtime.id)

    assert (count == 1) is expired
    db_session.refresh(booking)
    assert booking.status == expected_status
    assert held_seats(db_session, booking) == expected_seats


def test_expire_bookings_returns_how_many_it_expired(db_session, showtime, customer, other_customer):
    a1, a2, a3 = seat_ids(db_session, showtime.theater_id, "A1", "A2", "A3")
    make_booking(db_session, customer, showtime, [a1], expires_in=timedelta(minutes=-1))
    make_booking(db_session, other_customer, showtime, [a2], expires_in=timedelta(minutes=-2))
    make_booking(db_session, customer, showtime, [a3], expires_in=timedelta(minutes=4))

    assert expire_bookings_for_showtime(db_session, showtime.id) == 2


def test_expire_bookings_only_touches_the_given_showtime(db_session, showtime, customer):
    other_theater = make_theater(db_session, name="Other Theater")
    other_showtime = make_showtime(db_session, make_movie(db_session, title="Other Movie"), other_theater)
    (mine,) = seat_ids(db_session, showtime.theater_id, "A1")
    (theirs,) = seat_ids(db_session, other_theater.id, "A1")
    expired_here = make_booking(db_session, customer, showtime, [mine], expires_in=timedelta(minutes=-1))
    expired_there = make_booking(db_session, customer, other_showtime, [theirs], expires_in=timedelta(minutes=-1))

    expire_bookings_for_showtime(db_session, showtime.id)

    db_session.refresh(expired_here)
    db_session.refresh(expired_there)
    assert expired_here.status == BookingStatus.CANCELLED
    assert expired_there.status == BookingStatus.CONFIRMED   # other showtime: left for its own cleanup


@pytest.mark.parametrize("expires_in, payment_status, expired, expected_status, expected_seats", HOLD_CASES)
def test_expire_booking_if_needed(
    db_session, showtime, customer, expires_in, payment_status, expired, expected_status, expected_seats
):
    (a1,) = seat_ids(db_session, showtime.theater_id, "A1")
    booking = make_booking(db_session, customer, showtime, [a1], expires_in=expires_in, payment_status=payment_status)

    result = expire_booking_if_needed(db_session, booking.id)

    assert result is expired
    db_session.refresh(booking)
    assert booking.status == expected_status
    assert held_seats(db_session, booking) == expected_seats

#edge case unknown booking
def test_expire_booking_if_needed_ignores_an_unknown_booking(db_session):
    assert expire_booking_if_needed(db_session, 999999) is False


# ---------- the entry points that trigger cleanup ----------

def test_seat_map_frees_expired_holds_but_keeps_live_ones(client, db_session, showtime, customer, other_customer):
    a1, a2 = seat_ids(db_session, showtime.theater_id, "A1", "A2")
    make_booking(db_session, customer, showtime, [a1], expires_in=timedelta(minutes=-1))
    make_booking(db_session, other_customer, showtime, [a2], expires_in=timedelta(minutes=4))

    response = client.get(f"/showtimes/{showtime.id}/seats")

    status_by_seat = {s["seat_number"]: s["status"] for s in response.json()}
    assert status_by_seat["A1"] == "AVAILABLE"   # hold expired, seat is free again
    assert status_by_seat["A2"] == "BOOKED"      # hold still valid


def test_a_seat_held_by_an_expired_booking_can_be_booked(client, db_session, showtime, customer, other_customer):
    (a1,) = seat_ids(db_session, showtime.theater_id, "A1")
    stale = make_booking(db_session, customer, showtime, [a1], expires_in=timedelta(minutes=-1))

    response = book_seats(client, other_customer, showtime.id, [a1])

    assert response.status_code == 201
    db_session.refresh(stale)
    assert stale.status == BookingStatus.CANCELLED


def test_a_seat_held_by_a_live_booking_still_conflicts(client, db_session, showtime, customer, other_customer):
    (a1,) = seat_ids(db_session, showtime.theater_id, "A1")
    make_booking(db_session, customer, showtime, [a1], expires_in=timedelta(minutes=4))

    assert book_seats(client, other_customer, showtime.id, [a1]).status_code == 409


def test_my_bookings_list_shows_expired_holds_as_cancelled(client, db_session, showtime, customer):
    (a1,) = seat_ids(db_session, showtime.theater_id, "A1")
    make_booking(db_session, customer, showtime, [a1], expires_in=timedelta(minutes=-1))

    response = client.get("/bookings", headers=auth_headers(customer))

    (item,) = response.json()
    assert item["status"] == "CANCELLED"
    assert item["seats"] == []


def test_a_single_booking_lookup_shows_an_expired_hold_as_cancelled(client, db_session, showtime, customer):
    (a1,) = seat_ids(db_session, showtime.theater_id, "A1")
    stale = make_booking(db_session, customer, showtime, [a1], expires_in=timedelta(minutes=-1))

    response = client.get(f"/bookings/{stale.id}", headers=auth_headers(customer))

    assert response.json()["status"] == "CANCELLED"


def test_my_bookings_list_leaves_a_paid_booking_alone_even_past_its_hold_time(
    client, db_session, showtime, customer
):
    (a1,) = seat_ids(db_session, showtime.theater_id, "A1")
    make_booking(
        db_session, customer, showtime, [a1],
        expires_in=timedelta(hours=-1), payment_status=PaymentStatus.PAID,
    )

    (item,) = client.get("/bookings", headers=auth_headers(customer)).json()

    assert item["status"] == "CONFIRMED"
    assert item["payment_status"] == "PAID"
    assert len(item["seats"]) == 1