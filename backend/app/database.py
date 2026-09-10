"""
SQLAlchemy setup: engine, session factory, and the declarative Base that
every model in app/models/ inherits from.

We use SQLAlchemy's classic "create tables from models" approach
(Base.metadata.create_all) instead of a full migrations tool like Alembic.
That's a deliberate simplification for a 2-week project — see README for
the trade-off.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.config import settings

engine = create_engine(settings.database_url, echo=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

def get_db():
    """
    FastAPI dependency: yields a DB session per-request and always closes it,
    even if the request raises an exception.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

