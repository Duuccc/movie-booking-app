from datetime import timedelta

import pytest

from app.models.booking import BookingStatus, PaymentStatus
from app.models.booking_seat import BookingSeat
from app.models.payment import Payment
from tests.factories import auth_headers, book_seats, make_booking, seat_ids


def pay(client, user, booking_id, method="MOMO", simulate_failure=False):
    return client.post(
        f"/bookings/{booking_id}/pay",
        json={"method": method, "simulate_failure": simulate_failure},
        headers=auth_headers(user),
    )


def cancel(client, user, booking_id):
    return client.post(f"/bookings/{booking_id}/cancel", headers=auth_headers(user))


def get_booking(client, user, booking_id):
    return client.get(f"/bookings/{booking_id}", headers=auth_headers(user)).json()


def payment_rows(db, booking_id):
    return db.query(Payment).filter(Payment.booking_id == booking_id).order_by(Payment.id).all()


@pytest.fixture()
def booking(client, db_session, showtime, customer):
    """A fresh unpaid booking for A1 + A2 (150000 VND), made through the real API."""
    a1, a2 = seat_ids(db_session, showtime.theater_id, "A1", "A2")
    response = book_seats(client, customer, showtime.id, [a1, a2])
    assert response.status_code == 201
    return response.json()


# ---------- successful payment ----------

def test_successful_payment_marks_the_booking_paid(client, customer, booking):
    response = pay(client, customer, booking["id"])

    assert response.status_code == 200
    body = response.json()
    assert body["succeeded"] == 1
    assert body["amount"] == 150000
    assert body["booking_id"] == booking["id"]

    after = get_booking(client, customer, booking["id"])
    assert after["payment_status"] == "PAID"
    assert after["status"] == "CONFIRMED"


@pytest.mark.parametrize("method", ["MOMO", "VNPAY", "CARD"])
def test_payment_reference_is_prefixed_with_the_method(client, customer, booking, method):
    response = pay(client, customer, booking["id"], method=method)

    assert response.status_code == 200
    assert response.json()["reference"].startswith(f"{method}-")


def test_payment_amount_is_the_price_snapshot_not_the_current_price(
    client, db_session, showtime, customer, booking
):
    # An admin raising the price after the customer booked must not change what they owe.
    showtime.price = 200000
    db_session.commit()

    response = pay(client, customer, booking["id"])

    assert response.json()["amount"] == 150000


# ---------- declined payment ----------

def test_a_declined_payment_keeps_the_booking_pending_and_the_seats_held(client, customer, booking):
    declined = pay(client, customer, booking["id"], simulate_failure=True)

    # a decline is a normal business outcome, not an HTTP error
    assert declined.status_code == 200
    assert declined.json()["succeeded"] == 0

    state = get_booking(client, customer, booking["id"])
    assert state["payment_status"] == "PENDING"
    assert state["status"] == "CONFIRMED"
    assert len(state["seats"]) == 2


def test_retrying_after_a_decline_succeeds_and_keeps_every_attempt(client, db_session, customer, booking):
    pay(client, customer, booking["id"], simulate_failure=True)
    pay(client, customer, booking["id"], simulate_failure=True)
    retry = pay(client, customer, booking["id"])

    assert retry.json()["succeeded"] == 1
    attempts = payment_rows(db_session, booking["id"])
    assert [p.succeeded for p in attempts] == [0, 0, 1]   # one row per attempt, in order
    assert len({p.reference for p in attempts}) == 3   # each attempt has its own reference


# ---------- payments that must be refused ----------

def test_paying_twice_is_rejected_and_charges_only_once(client, db_session, customer, booking):
    assert pay(client, customer, booking["id"]).status_code == 200

    second = pay(client, customer, booking["id"])

    assert second.status_code == 400
    assert "already been paid" in second.json()["detail"]
    assert len(payment_rows(db_session, booking["id"])) == 1  # no double charge


def test_a_cancelled_booking_cannot_be_paid(client, db_session, customer, booking):
    assert cancel(client, customer, booking["id"]).status_code == 200

    response = pay(client, customer, booking["id"])

    assert response.status_code == 400
    assert "cancelled" in response.json()["detail"]
    assert payment_rows(db_session, booking["id"]) == []


def test_paying_an_expired_booking_is_rejected_and_releases_the_seats(client, db_session, showtime, customer):
    (a1,) = seat_ids(db_session, showtime.theater_id, "A1")
    expired = make_booking(db_session, customer, showtime, [a1], expires_in=timedelta(minutes=-1))
    expired_id = expired.id # expired booking id

    response = pay(client, customer, expired_id)

    assert response.status_code == 400
    assert "expired" in response.json()["detail"]
    # Check the database directly. Going through GET /bookings/{id} would let
    # that endpoint's own self-heal mask a bug in the pay path.
    db_session.refresh(expired)
    assert expired.status == BookingStatus.CANCELLED
    assert db_session.query(BookingSeat).filter(BookingSeat.booking_id == expired_id).count() == 0
    assert payment_rows(db_session, expired_id) == []


def test_a_paid_booking_past_its_hold_time_is_not_treated_as_expired(client, db_session, showtime, customer):
    (a1,) = seat_ids(db_session, showtime.theater_id, "A1")
    paid = make_booking(
        db_session, customer, showtime, [a1],
        expires_in=timedelta(hours=-1), payment_status=PaymentStatus.PAID,
    )
    paid_id = paid.id #paid booking id

    response = pay(client, customer, paid_id)

    # "already paid" must win over "expired", otherwise paying twice could cancel a paid booking
    assert response.status_code == 400
    assert "already been paid" in response.json()["detail"]
    db_session.refresh(paid)
    assert paid.status == BookingStatus.CONFIRMED
    assert db_session.query(BookingSeat).filter(BookingSeat.booking_id == paid_id).count() == 1


def test_another_customer_cannot_pay_for_my_booking(client, db_session, other_customer, booking):
    response = pay(client, other_customer, booking["id"])

    assert response.status_code == 404   # 404, not 403: don't reveal the booking exists
    assert payment_rows(db_session, booking["id"]) == []


def test_paying_requires_login(client, booking):
    response = client.post(f"/bookings/{booking['id']}/pay", json={"method": "MOMO"})
    assert response.status_code == 401


def test_paying_for_an_unknown_booking_returns_404(client, customer):
    assert pay(client, customer, 999999).status_code == 404


def test_an_unknown_payment_method_is_rejected(client, customer, booking):
    assert pay(client, customer, booking["id"], method="BITCOIN").status_code == 422


# ---------- cancelling around payments ----------

def test_a_paid_booking_cannot_be_cancelled(client, db_session, showtime, customer, other_customer, booking):
    pay(client, customer, booking["id"])

    response = cancel(client, customer, booking["id"])

    assert response.status_code == 400
    assert "paid" in response.json()["detail"]
    state = get_booking(client, customer, booking["id"])
    assert state["status"] == "CONFIRMED" and state["payment_status"] == "PAID"
    # and the seats really are still held
    (a1,) = seat_ids(db_session, showtime.theater_id, "A1")
    assert book_seats(client, other_customer, showtime.id, [a1]).status_code == 409


def test_a_booking_can_still_be_cancelled_after_a_declined_payment(
    client, db_session, showtime, customer, other_customer, booking
):
    pay(client, customer, booking["id"], simulate_failure=True)

    assert cancel(client, customer, booking["id"]).status_code == 200
    (a1,) = seat_ids(db_session, showtime.theater_id, "A1")
    assert book_seats(client, other_customer, showtime.id, [a1]).status_code == 201


def test_cancelling_twice_is_rejected(client, customer, booking):
    assert cancel(client, customer, booking["id"]).status_code == 200

    second = cancel(client, customer, booking["id"])

    assert second.status_code == 400
    assert "already cancelled" in second.json()["detail"]