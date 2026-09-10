from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class Theater(Base):
    __tablename__ = "theaters"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    location = Column(String, nullable=False)

    seats = relationship(
        "Seat", back_populates="theater", cascade="all, delete-orphan"
    )
    showtimes = relationship(
        "Showtime", back_populates="theater", cascade="all, delete-orphan"
    )
