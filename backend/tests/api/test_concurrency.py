import threading
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from datetime import timedelta
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import app as fastapi_app
from app.models.booking import Booking, BookingStatus, PaymentStatus
from app.models.booking_seat import BookingSeat
from app.models.payment import Payment, PaymentMethod
from app.services.booking_service import cancel_booking, expire_booking_if_needed
from app.services.payment_service import pay_for_booking
from tests.factories import (
    auth_headers,
    make_booking,
    make_movie,
    make_showtime,
    make_theater,
    make_user,
    seat_ids,
)

SEAT_LABELS = ["A1", "A2", "A3", "A4", "A5"]


# ---------- helpers ----------

def run_concurrently(tasks):
    """Run callables in separate threads, released together by a barrier; results come back in order."""
    barrier = threading.Barrier(len(tasks), timeout=15)

    def start(task):
        barrier.wait()   # everyone is ready: go
        return task()

    with ThreadPoolExecutor(max_workers=len(tasks)) as pool:
        futures = [pool.submit(start, task) for task in tasks]
        return [f.result(timeout=60) for f in futures]


def post_booking(headers, showtime_id, seats):
    # each thread builds its own TestClient: don't share one HTTP client between threads
    return TestClient(fastapi_app).post(
        "/bookings", json={"showtime_id": showtime_id, "seat_ids": seats}, headers=headers
    )


def post_pay(headers, booking_id):
    return TestClient(fastapi_app).post(
        f"/bookings/{booking_id}/pay", json={"method": "MOMO"}, headers=headers
    )


def seed_world(factory, n_users):
    """n users plus one showtime in a theater with seats A1..A5, all really committed."""
    with factory() as s:
        users = [make_user(s, email=f"user{i}@test.com", name=f"User {i}") for i in range(n_users)]
        showtime = make_showtime(s, make_movie(s), make_theater(s))
        seats = dict(zip(SEAT_LABELS, seat_ids(s, showtime.theater_id, *SEAT_LABELS)))
        return SimpleNamespace(
            showtime_id=showtime.id,
            headers=[auth_headers(u) for u in users],
            seats=seats,
        )


def seed_booking(factory, **booking_kwargs):
    """One committed booking for A1; returns its id."""
    with factory() as s:
        user = make_user(s)
        showtime = make_showtime(s, make_movie(s), make_theater(s))
        (a1,) = seat_ids(s, showtime.theater_id, "A1")
        return make_booking(s, user, showtime, [a1], **booking_kwargs).id


def count(factory, model, **filters):
    with factory() as s:
        return s.query(model).filter_by(**filters).count()


@contextmanager
def two_requests(factory):
    """Two independent sessions: what two simultaneous HTTP requests each get from get_db."""
    first, second = factory(), factory()
    try:
        yield first, second
    finally:
        first.close()
        second.close()


# ---------- the unique constraint under real contention ----------

RACERS = 8


def test_only_one_of_many_simultaneous_bookings_for_the_same_seat_wins(committed_sessions):
    world = seed_world(committed_sessions, RACERS)
    a1 = world.seats["A1"]

    responses = run_concurrently(
        [lambda h=h: post_booking(h, world.showtime_id, [a1]) for h in world.headers]
    )

    # who wins is not predictable, so assert on the SET of outcomes
    assert sorted(r.status_code for r in responses) == [201] + [409] * (RACERS - 1)
    assert count(committed_sessions, BookingSeat, showtime_id=world.showtime_id, seat_id=a1) == 1
    assert count(committed_sessions, Booking) == 1   # the losers left no half-created booking behind


def test_competing_multi_seat_bookings_are_all_or_nothing(committed_sessions):
    world = seed_world(committed_sessions, 6)
    a1, a2 = world.seats["A1"], world.seats["A2"]

    responses = run_concurrently(
        [lambda h=h: post_booking(h, world.showtime_id, [a1, a2]) for h in world.headers]
    )

    assert sorted(r.status_code for r in responses) == [201] + [409] * 5
    # exactly the winner's two seats are held; nothing leaked from the five losers
    assert count(committed_sessions, BookingSeat, showtime_id=world.showtime_id) == 2


def test_a_loser_of_a_partial_overlap_does_not_keep_its_free_seat(committed_sessions):
    world = seed_world(committed_sessions, 2)
    a1, a2, a3 = world.seats["A1"], world.seats["A2"], world.seats["A3"]

    # the two requests only collide on A2
    responses = run_concurrently([
        lambda: post_booking(world.headers[0], world.showtime_id, [a1, a2]),
        lambda: post_booking(world.headers[1], world.showtime_id, [a2, a3]),
    ])

    assert sorted(r.status_code for r in responses) == [201, 409]
    # the winner holds 2 seats; the loser's A1 (or A3) must NOT have stayed behind
    assert count(committed_sessions, BookingSeat, showtime_id=world.showtime_id) == 2


def test_bookings_for_different_seats_do_not_conflict(committed_sessions):
    world = seed_world(committed_sessions, 5)

    responses = run_concurrently([
        lambda h=h, label=label: post_booking(h, world.showtime_id, [world.seats[label]])
        for h, label in zip(world.headers, SEAT_LABELS)
    ])

    assert [r.status_code for r in responses] == [201] * 5
    assert count(committed_sessions, BookingSeat, showtime_id=world.showtime_id) == 5


# ---------- two simultaneous payments, end to end ----------

def test_two_simultaneous_payments_for_one_booking_charge_only_once(committed_sessions):
    world = seed_world(committed_sessions, 1)
    booking = post_booking(world.headers[0], world.showtime_id, [world.seats["A1"]]).json()

    responses = run_concurrently([lambda: post_pay(world.headers[0], booking["id"]) for _ in range(2)])

    assert sorted(r.status_code for r in responses) == [200, 400]
    assert count(committed_sessions, Payment, booking_id=booking["id"]) == 1


# ---------- deterministic interleavings ----------
# The tests above hope threads collide. These script the exact bad ordering:
# request A loads the booking, request B changes it and commits, then A
# carries on. If A trusts what it loaded earlier, it acts on stale data.

def test_paying_a_booking_that_was_cancelled_after_the_payment_request_loaded_it(committed_sessions):
    booking_id = seed_booking(committed_sessions)

    with two_requests(committed_sessions) as (paying, cancelling):
        loaded_by_payment = paying.get(Booking, booking_id)   # the router's get_owned_booking_or_404
        cancel_booking(cancelling, cancelling.get(Booking, booking_id))   # the other request commits first

        with pytest.raises(HTTPException) as error:
            pay_for_booking(paying, loaded_by_payment, PaymentMethod.MOMO)

    assert error.value.status_code == 400
    assert "cancelled" in error.value.detail
    assert count(committed_sessions, Payment, booking_id=booking_id) == 0
    with committed_sessions() as check:
        assert check.get(Booking, booking_id).status == BookingStatus.CANCELLED


def test_a_second_payment_that_loaded_the_booking_before_the_first_one_finished(committed_sessions):
    booking_id = seed_booking(committed_sessions)

    with two_requests(committed_sessions) as (first, second):
        loaded_by_first = first.get(Booking, booking_id)
        loaded_by_second = second.get(Booking, booking_id)   # both requests saw an unpaid booking

        pay_for_booking(first, loaded_by_first, PaymentMethod.MOMO)   # the first one pays and commits

        with pytest.raises(HTTPException) as error:
            pay_for_booking(second, loaded_by_second, PaymentMethod.MOMO)

    assert error.value.status_code == 400
    assert "already been paid" in error.value.detail
    assert count(committed_sessions, Payment, booking_id=booking_id) == 1   # charged once


def test_cancelling_a_booking_that_was_paid_after_the_cancel_request_loaded_it(committed_sessions):
    booking_id = seed_booking(committed_sessions)

    with two_requests(committed_sessions) as (cancelling, paying):
        loaded_by_cancel = cancelling.get(Booking, booking_id)
        pay_for_booking(paying, paying.get(Booking, booking_id), PaymentMethod.MOMO)

        with pytest.raises(HTTPException) as error:
            cancel_booking(cancelling, loaded_by_cancel)

    assert error.value.status_code == 400
    assert "paid" in error.value.detail
    with committed_sessions() as check:
        booking = check.get(Booking, booking_id)
        assert (booking.status, booking.payment_status) == (BookingStatus.CONFIRMED, PaymentStatus.PAID)
    assert count(committed_sessions, BookingSeat, booking_id=booking_id) == 1   # seats still held


def test_a_payment_that_landed_just_before_the_hold_ran_out_survives_the_cleanup(committed_sessions):
    booking_id = seed_booking(committed_sessions, expires_in=timedelta(minutes=-1))

    with two_requests(committed_sessions) as (cleanup, payment):
        # GET /bookings loaded the booking and is about to self-heal it...
        loaded_by_cleanup = cleanup.get(Booking, booking_id)
        # ...but a payment that went through just before the deadline commits first
        paid = payment.get(Booking, booking_id)
        paid.payment_status = PaymentStatus.PAID
        payment.commit()

        assert expire_booking_if_needed(cleanup, booking_id) is False
        # keep a reference alive until here: the Session's identity map holds objects weakly
        assert loaded_by_cleanup is not None

    with committed_sessions() as check:
        booking = check.get(Booking, booking_id)
        assert (booking.status, booking.payment_status) == (BookingStatus.CONFIRMED, PaymentStatus.PAID)
    assert count(committed_sessions, BookingSeat, booking_id=booking_id) == 1