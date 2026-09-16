from sqlalchemy import Column, Integer, String, Date
from sqlalchemy.orm import relationship

from app.database import Base


class Movie(Base):
    __tablename__ = "movies"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False, index=True)
    description = Column(String, nullable=True)
    duration = Column(Integer, nullable=False)  # minutes
    genre = Column(String, nullable=True)
    release_date = Column(Date, nullable=True)
    poster_url = Column(String, nullable=True)
    trailer_url = Column(String, nullable=True)

    showtimes = relationship(
        "Showtime", back_populates="movie", cascade="all, delete-orphan"
    )