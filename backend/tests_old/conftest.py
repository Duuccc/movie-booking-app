"""
Test fixtures: a fresh in-memory SQLite database per test, with FastAPI's
`get_db` dependency swapped to point at it instead of the real Postgres
database.

Using SQLite here (instead of a second Postgres) keeps `pytest` fast and
dependency-free -- no Docker required just to run the test suite. The
trade-off is that a couple of Postgres-specific behaviors aren't
exercised by these tests. Acceptable for a project this size; worth
knowing if you ever see a test pass here but fail against real Postgres.
"""
import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.main import app
from app.database import Base, get_db
from app import models  # noqa: F401 - import registers all models on Base.metadata


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # SQLite ignores foreign keys unless you turn them on explicitly --
    # do that so tests exercise the same FK behavior Postgres enforces.
    @event.listens_for(engine, "connect")
    def _enable_foreign_keys(dbapi_connection, _):
        dbapi_connection.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(bind=engine)
    testing_session_local = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = testing_session_local()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass  # db_session fixture above owns closing the session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
