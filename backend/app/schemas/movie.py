from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict


class MovieBase(BaseModel):
    title: str
    description: Optional[str] = None
    duration: int  # minutes
    genre: Optional[str] = None
    release_date: Optional[date] = None
    poster_url: Optional[str] = None


class MovieCreate(MovieBase):
    pass


class MovieUpdate(BaseModel):
    """
    Every field is optional here (unlike MovieCreate) so PUT can accept
    a partial payload -- only the fields the client actually sends get
    changed. See routers/movies.py's use of model_dump(exclude_unset=True).
    """
    title: Optional[str] = None
    description: Optional[str] = None
    duration: Optional[int] = None
    genre: Optional[str] = None
    release_date: Optional[date] = None
    poster_url: Optional[str] = None


class MovieOut(MovieBase):
    id: int

    model_config = ConfigDict(from_attributes=True)