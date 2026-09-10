from sqlalchemy import Column, Integer, ForeignKey, DateTime, Numeric
from sqlalchemy.orm import relationship

from app.database import Base


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
    price = Column(Numeric(6, 2), nullable=False, default=10.00)

    movie = relationship("Movie", back_populates="showtimes")
    theater = relationship("Theater", back_populates="showtimes")
    bookings = relationship("Booking", back_populates="showtime")
    booking_seats = relationship("BookingSeat", back_populates="showtime")
