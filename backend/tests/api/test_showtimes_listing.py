from types import SimpleNamespace

import pytest

from tests.factories import make_movie, make_showtime, make_theater, vn_time


def listed_ids(response):
    assert response.status_code == 200
    return [s["id"] for s in response.json()]


@pytest.fixture()
def catalog(db_session):
    """
    2 movies x 2 theaters, one showtime per pair, all on the same Vietnam day.
    Every filter below selects a strict subset of these four, so a filter
    that silently does nothing cannot pass.
    """
    movie_a = make_movie(db_session, title="Movie A")
    movie_b = make_movie(db_session, title="Movie B")
    theater_1 = make_theater(db_session, name="Theater 1")
    theater_2 = make_theater(db_session, name="Theater 2")

    def at(hour):
        return vn_time(2030, 6, 15, hour)

    # created out of time order on purpose, to prove the endpoint sorts
    b2 = make_showtime(db_session, movie_b, theater_2, start_time=at(16))
    a1 = make_showtime(db_session, movie_a, theater_1, start_time=at(10))
    b1 = make_showtime(db_session, movie_b, theater_1, start_time=at(14))
    a2 = make_showtime(db_session, movie_a, theater_2, start_time=at(12))
    return SimpleNamespace(
        movie_a=movie_a, movie_b=movie_b, theater_1=theater_1, theater_2=theater_2,
        a1=a1, a2=a2, b1=b1, b2=b2,
    )


def test_showtimes_come_back_in_start_time_order(client, catalog):
    ids = listed_ids(client.get("/showtimes"))
    assert ids == [catalog.a1.id, catalog.a2.id, catalog.b1.id, catalog.b2.id]


def test_filter_by_theater(client, catalog):
    ids = listed_ids(client.get("/showtimes", params={"theater_id": catalog.theater_1.id}))
    assert ids == [catalog.a1.id, catalog.b1.id]


def test_filter_by_movie(client, catalog):
    ids = listed_ids(client.get("/showtimes", params={"movie_id": catalog.movie_a.id}))
    assert ids == [catalog.a1.id, catalog.a2.id]


def test_filters_combine(client, catalog):
    params = {"theater_id": catalog.theater_1.id, "movie_id": catalog.movie_b.id}
    assert listed_ids(client.get("/showtimes", params=params)) == [catalog.b1.id]


def test_filters_that_match_nothing_return_an_empty_list(client, catalog):
    assert listed_ids(client.get("/showtimes", params={"theater_id": 999999})) == []
    assert listed_ids(client.get("/showtimes", params={"date": "2030-06-16"})) == []


@pytest.mark.parametrize(
    "start, queried_date, expected_listed",
    [
        # 00:30 in Vietnam is 17:30 the previous day in UTC: the classic timezone bug
        (vn_time(2030, 6, 15, 0, 30), "2030-06-15", True),
        (vn_time(2030, 6, 15, 0, 30), "2030-06-14", False),
        (vn_time(2030, 6, 15, 23, 59), "2030-06-15", True),   # last minute of the day
        (vn_time(2030, 6, 16, 0, 0), "2030-06-15", False),    # midnight belongs to the NEXT day
        (vn_time(2030, 6, 16, 0, 0), "2030-06-16", True),
    ],
    ids=["just-after-midnight", "same-showtime-day-before", "last-minute", "midnight-excluded", "midnight-included-next-day"],
)
def test_date_filter_uses_the_vietnam_calendar_day(client, db_session, start, queried_date, expected_listed):
    showtime = make_showtime(db_session, make_movie(db_session), make_theater(db_session), start_time=start)

    response = client.get("/showtimes", params={"date": queried_date})

    assert (showtime.id in listed_ids(response)) is expected_listed


def test_get_one_showtime(client, catalog):
    response = client.get(f"/showtimes/{catalog.a1.id}")

    assert response.status_code == 200
    body = response.json()
    assert body["movie_id"] == catalog.movie_a.id
    assert body["theater_id"] == catalog.theater_1.id


def test_unknown_showtime_returns_404(client):
    assert client.get("/showtimes/999999").status_code == 404