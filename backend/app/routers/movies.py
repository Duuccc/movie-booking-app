"""
Movie endpoints.

Browsing (GET) is public -- no auth required, since a customer needs to
see the catalog before they've logged in. Create/update/delete require
require_admin (Milestone 3), so a non-admin request never even reaches
the function body -- it gets a 403 from the dependency itself.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.movie import Movie
from app.schemas.movie import MovieCreate, MovieUpdate, MovieOut
from app.auth.dependencies import require_admin

router = APIRouter(prefix="/movies", tags=["movies"])


def get_movie_or_404(movie_id: int, db: Session) -> Movie:
    movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if movie is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movie not found")
    return movie


@router.get("", response_model=List[MovieOut])
def list_movies(db: Session = Depends(get_db)):
    return db.query(Movie).order_by(Movie.id).all()


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


@router.delete("/{movie_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_movie(
    movie_id: int,
    db: Session = Depends(get_db),
    _admin=Depends(require_admin),
):
    movie = get_movie_or_404(movie_id, db)
    db.delete(movie)
    db.commit()
    return None