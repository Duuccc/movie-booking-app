import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

import app.models as _models  # noqa: F401 -- importing registers every model on Base.metadata
from app.database import Base, get_db
from app.main import app as fastapi_app
from app.models import UserRole

from tests.factories import auth_headers, make_movie, make_showtime, make_theater, seat_ids, make_user


@pytest.fixture(scope="session")
def engine():
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.exit("TEST_DATABASE_URL is not set.", returncode=2)

    # Safety rail: drop_all() below wipes every table in whatever database
    # this points at. Refuse to run unless it is clearly a test database,
    # so a copy-pasted dev URL can never be wiped by accident.
    db_name = make_url(url).database or ""
    if not db_name.endswith("_test"):
        pytest.exit(f"Refusing to run: database '{db_name}' does not end with '_test'.", returncode=2)

    engine = create_engine(url)
    Base.metadata.drop_all(engine)    # clear leftovers from an aborted earlier run
    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture()
def db_session(engine):
    """
    One outer transaction per test, rolled back at the end, so no test ever
    sees another test's data. The app code calls db.commit() freely; with
    join_transaction_mode="create_savepoint" those commits only release a
    SAVEPOINT inside our outer transaction instead of really committing.
    (Needs SQLAlchemy 2.0.)
    """
    connection = engine.connect()
    outer = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    yield session
    session.close()
    outer.rollback()
    connection.close()


@pytest.fixture()
def client(db_session):
    def override_get_db():
        yield db_session

    fastapi_app.dependency_overrides[get_db] = override_get_db
    yield TestClient(fastapi_app)
    fastapi_app.dependency_overrides.clear()


@pytest.fixture()
def customer(db_session):
    return make_user(db_session, email="customer@test.com", name="Customer One")


@pytest.fixture()
def other_customer(db_session):
    return make_user(db_session, email="other@test.com", name="Customer Two")


@pytest.fixture()
def admin(db_session):
    return make_user(db_session, email="admin@test.com", name="Admin", role=UserRole.ADMIN)

@pytest.fixture()
def showtime(db_session):
    """A 2D showtime, 2h from now, 75000 VND, in a theater with seats A1..A5 (all standard)."""
    return make_showtime(db_session, make_movie(db_session), make_theater(db_session))