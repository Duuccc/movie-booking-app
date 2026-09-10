"""
Creates all tables from the SQLAlchemy models.

Run once against a fresh database (from the backend/ directory):
    python -m scripts.init_db

We use Base.metadata.create_all() instead of Alembic migrations. That's a
deliberate simplification for a 2-week project: no migration history, and
no safe way to evolve an existing table's schema without dropping it.
Fine here; call it out in the README as a known limitation.
"""
from app.database import Base, engine
from app import models  # noqa: F401 - import registers all models on Base.metadata


def main():
    Base.metadata.create_all(engine)
    print("Tables created.")


if __name__ == "__main__":
    main()
