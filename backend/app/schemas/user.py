from datetime import datetime

from pydantic import BaseModel, EmailStr, ConfigDict

from app.models.user import UserRole


class UserCreate(BaseModel):
    """Body for POST /auth/register."""
    name: str
    email: EmailStr
    password: str


class UserOut(BaseModel):
    """
    What we send back for a user -- deliberately excludes password_hash.
    Used as the response_model for /auth/register and /auth/me so it's
    structurally impossible to leak the hash by accident.
    """
    id: int
    name: str
    email: EmailStr
    role: UserRole
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    """Body returned by POST /auth/login."""
    access_token: str
    token_type: str = "bearer"
