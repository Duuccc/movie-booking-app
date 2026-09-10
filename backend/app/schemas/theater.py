from typing import Optional

from pydantic import BaseModel, ConfigDict


class TheaterBase(BaseModel):
    name: str
    location: str


class TheaterCreate(TheaterBase):
    pass


class TheaterUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None


class TheaterOut(TheaterBase):
    id: int

    model_config = ConfigDict(from_attributes=True)