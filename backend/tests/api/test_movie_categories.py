from datetime import date, timedelta

from app.models.booking import BookingStatus
from tests.factories import make_booking, make_movie, make_showtime, make_theater, seat_ids


def titles(response):
    assert response.status_code == 200
    return [m["title"] for m in response.json()]


def test_showing_lists_only_movies_with_a_future_showtime(client, db_session):
    theater = make_theater(db_session)
    upcoming = make_movie(db_session, title="Has Upcoming Showtime")
    finished = make_movie(db_session, title="Run Is Over")
    make_movie(db_session, title="Nothing Scheduled")
    make_showtime(db_session, upcoming, theater, starts_in=timedelta(hours=3))
    make_showtime(db_session, finished, theater, starts_in=timedelta(hours=-3))

    assert titles(client.get("/movies", params={"category": "showing"})) == ["Has Upcoming Showtime"]


def test_coming_soon_lists_only_movies_releasing_in_the_future(client, db_session):
    # Regression test for the bug where `query.filter(...)` was never assigned
    # back, so every movie came back. It needs movies on BOTH sides of the
    # filter: with only matching data the bug would have gone unnoticed.
    make_movie(db_session, title="Released Last Month", release_date=date.today() - timedelta(days=30))
    make_movie(db_session, title="Releases Next Month", release_date=date.today() + timedelta(days=30))
    make_movie(db_session, title="No Release Date")

    assert titles(client.get("/movies", params={"category": "coming_soon"})) == ["Releases Next Month"]


def test_without_a_category_every_movie_is_listed(client, db_session):
    make_movie(db_session, title="One")
    make_movie(db_session, title="Two")

    assert sorted(titles(client.get("/movies"))) == ["One", "Two"]


def test_an_unknown_category_falls_back_to_every_movie(client, db_session):
    # Characterization test: documents today's leniency. If you decide that
    # a typo'd category should be a 400, change this test on purpose.
    make_movie(db_session, title="One")
    make_movie(db_session, title="Two")

    assert sorted(titles(client.get("/movies", params={"category": "bogus"}))) == ["One", "Two"]


# ---------- trending ----------

def test_trending_is_empty_when_nothing_is_booked(client, db_session):
    make_movie(db_session)
    assert titles(client.get("/movies", params={"category": "trending"})) == []


def test_trending_ranks_movies_by_booked_seats(client, db_session, customer, other_customer):
    theater = make_theater(db_session)
    popular = make_movie(db_session, title="Popular")
    niche = make_movie(db_session, title="Niche")
    unbooked = make_movie(db_session, title="Unbooked")
    popular_showtime = make_showtime(db_session, popular, theater, starts_in=timedelta(hours=2))
    niche_showtime = make_showtime(db_session, niche, theater, starts_in=timedelta(hours=3))
    unbooked_showtime = make_showtime(db_session, unbooked, theater, starts_in=timedelta(hours=4))
    a1, a2, a3 = seat_ids(db_session, theater.id, "A1", "A2", "A3")
    make_booking(db_session, customer, popular_showtime, [a1, a2, a3])
    make_booking(db_session, other_customer, niche_showtime, [a1])

    assert titles(client.get("/movies", params={"category": "trending"})) == ["Popular", "Niche"]


def test_trending_ignores_cancelled_bookings(client, db_session, customer):
    theater = make_theater(db_session)
    popular = make_movie(db_session, title="Popular")
    cancelled_hit = make_movie(db_session, title="Only Cancelled")
    popular_showtime = make_showtime(db_session, popular, theater, starts_in=timedelta(hours=2))
    cancelled_showtime = make_showtime(db_session, cancelled_hit, theater, starts_in=timedelta(hours=3))
    a1, a2, a3 = seat_ids(db_session, theater.id, "A1", "A2", "A3")
    # Unrealistic on purpose: a cancelled booking normally has no seats left.
    # Giving it seats isolates the status filter, so removing that filter fails this test.
    make_booking(db_session, customer, cancelled_showtime, [a1, a2], status=BookingStatus.CANCELLED)
    make_booking(db_session, customer, popular_showtime, [a3])

    assert titles(client.get("/movies", params={"category": "trending"})) == ["Popular"]