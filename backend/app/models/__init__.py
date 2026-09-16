"""
Importing every model here means a single `from app import models` (or
`import app.models`) registers all tables on Base.metadata -- needed by
scripts/init_db.py's create_all() call, and convenient for the rest of
the app to import from one place.
"""
from app.models.user import User, UserRole
from app.models.movie import Movie
from app.models.theater import Theater
from app.models.seat import Seat
from app.models.showtime import Showtime
from app.models.booking import Booking, BookingStatus, PaymentStatus
from app.models.booking_seat import BookingSeat
from app.models.payment import Payment, PaymentMethod

__all__ = [
    "User",
    "UserRole",
    "Movie",
    "Theater",
    "Seat",
    "Showtime",
    "Booking",
    "BookingStatus",
    "PaymentStatus",
    "BookingSeat",
    "Payment",
    "PaymentMethod",
]
