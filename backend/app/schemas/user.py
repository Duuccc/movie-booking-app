from datetime import datetime

from pydantic import BaseModel, EmailStr, ConfigDict, field_validator

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

class UserUpdate(BaseModel):
    name: str

    @field_validator('name')
    @classmethod
    def name_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError('Name cannot be blank')
        return value


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator('new_password')
    @classmethod
    def new_password_min_length(cls, value: str) -> str:
        if len(value) < 8:
            raise ValueError('New password must be at least 8 characters')
        return value

class UserRoleUpdate(BaseModel):
    role: UserRole