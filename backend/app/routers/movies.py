"""
Movie endpoints.

Browsing (GET) is public -- no auth required, since a customer needs to
see the catalog before they've logged in. Create/update/delete require
require_admin (Milestone 3), so a non-admin request never even reaches
the function body -- it gets a 403 from the dependency itself.
"""
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.movie import Movie
from app.models.showtime import Showtime
from app.models.booking import Booking, BookingStatus
from app.models.booking_seat import BookingSeat
from app.schemas.movie import MovieCreate, MovieUpdate, MovieOut
from app.auth.dependencies import require_admin
from app.services.booking_service import movie_has_confirmed_bookings

from datetime import date as date_type, datetime, timezone, timedelta

router = APIRouter(prefix="/movies", tags=["movies"])

# backend/app/routers/movies.py -> backend/app -> backend, then static/posters
POSTERS_DIR = Path(__file__).resolve().parent.parent.parent / "static" / "posters"

# Only accept real image types, and map each to a fixed, safe extension --
# we never trust the filename the browser sends us.
ALLOWED_CONTENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
MAX_POSTER_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


def get_movie_or_404(movie_id: int, db: Session) -> Movie:
    movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if movie is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movie not found")
    return movie


def _delete_poster_file_if_local(poster_url: Optional[str]) -> None:
    """
    poster_url can be either a URL an admin pasted in (some external
    site) or a path under our own /static/posters/ from an upload. We
    only ever have a file on disk to clean up in the second case.
    """
    if not poster_url or not poster_url.startswith("/static/posters/"):
        return
    filename = poster_url.rsplit("/", 1)[-1]
    (POSTERS_DIR / filename).unlink(missing_ok=True)


@router.get("", response_model=List[MovieOut])
def list_movies(category: Optional[str] = None, db: Session = Depends(get_db)):
    if category == "trending":
        window_start = datetime.now(timezone.utc) - timedelta(days=14)

        trending_rows = (
            db.query(Showtime.movie_id, func.count(BookingSeat.id).label("seat_count"))
            .join(BookingSeat, BookingSeat.showtime_id == Showtime.id)
            .join(Booking, Booking.id == BookingSeat.booking_id)
            .filter(Booking.status == BookingStatus.CONFIRMED)
            .filter(Booking.created_at >= window_start)
            .group_by(Showtime.movie_id)
            .order_by(func.count(BookingSeat.id).desc())
            .limit(10).all()
        )

        trending_ids = [row.movie_id for row in trending_rows]
        if not trending_ids:
            return []

        movies_by_id = {
            m.id: m for m in db.query(Movie).filter(Movie.id.in_(trending_ids)).all()
        }
        return [movies_by_id[mid] for mid in trending_ids if mid in movies_by_id]
    
    query = db.query(Movie)

    if category == "showing":
        now = datetime.now(timezone.utc)
        showing_movie_ids = (
            db.query(Showtime.movie_id).filter(Showtime.start_time >= now).distinct()
        )
        query = query.filter(Movie.id.in_(showing_movie_ids))
    elif category == "coming_soon":
        today = date_type.today()
        query = query.filter(Movie.release_date > today)

    return query.all()


@router.get("/{movie_id}", response_model=MovieOut)
def get_movie(movie_id: int, db: Session = Depends(get_db)):
    return get_movie_or_404(movie_id, db)


@router.post("", response_model=MovieOut, status_code=status.HTTP_201_CREATED)
def create_movie(
    payload: MovieCreate,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    movie = Movie(**payload.model_dump())
    db.add(movie)
    db.commit()
    db.refresh(movie)
    return movie


@router.put("/{movie_id}", response_model=MovieOut)
def update_movie(
    movie_id: int,
    payload: MovieUpdate,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    movie = get_movie_or_404(movie_id, db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(movie, field, value)
    db.commit()
    db.refresh(movie)
    return movie


@router.post("/{movie_id}/poster", response_model=MovieOut)
async def upload_movie_poster(
    movie_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    """
    Uploads a poster image for an EXISTING movie. The image bytes get
    written to disk (backend/static/posters/); only the resulting URL
    path is saved on the movie row -- the database never stores image
    data itself. This is the same pattern production apps use with
    S3/GCS + a CDN; we're just using local disk as the "object storage"
    since there's no cloud infra in scope for this project.

    Why this is a separate endpoint from POST/PUT /movies rather than
    part of the JSON body: you can't attach a file to a movie that
    doesn't have an id yet. This mirrors how most real admin panels
    work too -- create the record first, then attach media to it.
    """
    movie = get_movie_or_404(movie_id, db)

    extension = ALLOWED_CONTENT_TYPES.get(file.content_type)
    if extension is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Poster must be a JPEG, PNG, or WEBP image",
        )

    contents = await file.read()
    if len(contents) > MAX_POSTER_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Poster must be smaller than 5MB",
        )

    POSTERS_DIR.mkdir(parents=True, exist_ok=True)
    # A random filename avoids collisions between different uploads and
    # means we never trust (or need) the client's original filename.
    filename = f"{uuid.uuid4().hex}{extension}"
    with open(POSTERS_DIR / filename, "wb") as f:
        f.write(contents)

    old_poster_url = movie.poster_url
    movie.poster_url = f"/static/posters/{filename}"
    db.commit()
    db.refresh(movie)

    # Clean up the previous file now that the new one is safely saved
    # and committed -- otherwise repeated re-uploads would just pile up
    # orphaned files on disk forever.
    _delete_poster_file_if_local(old_poster_url)

    return movie


@router.delete("/{movie_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_movie(
    movie_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    movie = get_movie_or_404(movie_id, db)
    if movie_has_confirmed_bookings(db, movie_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete a movie with active bookings against its showtimes",
        )
    poster_url = movie.poster_url
    db.delete(movie)
    db.commit()
    _delete_poster_file_if_local(poster_url)
    return None

print(date_type.today())