from sqlalchemy import Column, Integer, ForeignKey, DateTime, Enum
from sqlalchemy.orm import relationship
import enum

from app.database import Base

class ShowtimeFormat(str, enum.Enum):
    TWO_D = "2D"
    THREE_D = "3D"
    IMAX = "IMAX"


class Showtime(Base):
    __tablename__ = "showtimes"

    id = Column(Integer, primary_key=True, index=True)
    movie_id = Column(
        Integer, ForeignKey("movies.id", ondelete="CASCADE"), nullable=False
    )
    theater_id = Column(
        Integer, ForeignKey("theaters.id", ondelete="CASCADE"), nullable=False
    )
    start_time = Column(DateTime(timezone=True), nullable=False)
    # Whole VND (dong) -- no fractional unit in practical use, unlike
    # USD cents, so this is a plain Integer rather than Numeric(x, 2).
    price = Column(Integer, nullable=False, default=75000)
    format = Column(Enum(ShowtimeFormat, values_callable=lambda obj: [e.value for e in obj]), nullable=False, default=ShowtimeFormat.TWO_D)

    movie = relationship("Movie", back_populates="showtimes")
    theater = relationship("Theater", back_populates="showtimes")
    bookings = relationship("Booking", back_populates="showtime")
    booking_seats = relationship("BookingSeat", back_populates="showtime")