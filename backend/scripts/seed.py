"""
Seeds the database with enough data to use the app immediately:

- 1 admin user, 1 customer user (documented dev passwords, printed below)
- 3 movies
- 2 theaters, each with a 4-row x 5-seat grid (20 seats/theater)
- 3 showtimes per movie, spread across the two theaters

Run after init_db, from the backend/ directory:
    python -m scripts.init_db
    python -m scripts.seed

Safe to re-run: it deletes its own seed rows first, so re-running doesn't
pile up duplicate movies/theaters. This is a dev-only script, so it's
fine to be blunt about wiping and recreating rather than diffing.
"""
from datetime import datetime, timedelta

from app.database import SessionLocal
from app.models import User, UserRole, Movie, Theater, Seat, Showtime
from app.auth.password import hash_password

ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "AdminPass123!"          # documented dev password, not for real use
CUSTOMER_EMAIL = "customer@example.com"
CUSTOMER_PASSWORD = "CustomerPass123!"

ROWS = ["A", "B", "C", "D"]
SEATS_PER_ROW = 5


def seed():
    db = SessionLocal()
    try:
        # Wipe existing seed data first (children before parents, to respect FKs).
        db.query(Seat).delete()
        db.query(Showtime).delete()
        db.query(Theater).delete()
        db.query(Movie).delete()
        db.query(User).delete()
        db.commit()

        # --- Users ---
        admin = User(
            name="Admin",
            email=ADMIN_EMAIL,
            password_hash=hash_password(ADMIN_PASSWORD),
            role=UserRole.ADMIN,
        )
        customer = User(
            name="Sample Customer",
            email=CUSTOMER_EMAIL,
            password_hash=hash_password(CUSTOMER_PASSWORD),
            role=UserRole.CUSTOMER,
        )
        db.add_all([admin, customer])

        # --- Movies ---
        movies = [
            Movie(
                title="The Silent Orbit",
                description="A crew drifts through deep space after losing contact with Earth.",
                duration=118,
                genre="Sci-Fi",
                release_date=datetime(2026, 3, 14).date(),
                poster_url="https://placehold.co/300x450?text=Silent+Orbit",
            ),
            Movie(
                title="Kitchen Confidential",
                description="Two rival chefs are forced to share one restaurant for a summer.",
                duration=104,
                genre="Comedy",
                release_date=datetime(2026, 5, 1).date(),
                poster_url="https://placehold.co/300x450?text=Kitchen+Confidential",
            ),
            Movie(
                title="Last Exit",
                description="A getaway driver takes one final job before retiring for good.",
                duration=97,
                genre="Thriller",
                release_date=datetime(2026, 6, 20).date(),
                poster_url="https://placehold.co/300x450?text=Last+Exit",
            ),
        ]
        db.add_all(movies)

        # --- Theaters ---
        theaters = [
            Theater(name="Downtown Cinema", location="123 Main St"),
            Theater(name="Riverside Multiplex", location="45 River Rd"),
        ]
        db.add_all(theaters)

        db.flush()  # assign IDs to movies/theaters before we reference them below

        # --- Seats: 4 rows x 5 seats = 20 seats per theater ---
        for theater in theaters:
            for row in ROWS:
                for number in range(1, SEATS_PER_ROW + 1):
                    db.add(Seat(theater_id=theater.id, row=row, seat_number=number))

        # --- Showtimes: 3 per movie, alternating theaters ---
        base_time = datetime.now().replace(minute=0, second=0, microsecond=0) + timedelta(days=1)
        showtime_hours = [10, 14, 19]

        for i, movie in enumerate(movies):
            theater = theaters[i % len(theaters)]
            for hour in showtime_hours:
                db.add(Showtime(
                    movie_id=movie.id,
                    theater_id=theater.id,
                    start_time=base_time.replace(hour=hour),
                    price=75000,
                ))

        db.commit()

        print("Seed data created:")
        print(f"  Admin login:    {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
        print(f"  Customer login: {CUSTOMER_EMAIL} / {CUSTOMER_PASSWORD}")
        print(
            f"  {len(movies)} movies, {len(theaters)} theaters, "
            f"{len(theaters) * len(ROWS) * SEATS_PER_ROW} seats, "
            f"{len(movies) * len(showtime_hours)} showtimes"
        )
    finally:
        db.close()


if __name__ == "__main__":
    seed()