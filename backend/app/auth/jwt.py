"""
Create and decode JWT access tokens.

The payload carries two claims: `sub` (the user's id, as a string per
JWT spec) and `role` (so later role checks don't need a DB hit on every
request). This file only does encode/decode -- the "who is this request
from, and are they allowed to do this" logic lives in dependencies.py.
"""
from datetime import datetime, timedelta, timezone

from jose import jwt

from app.config import settings


def create_access_token(user_id: int, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    """
    Raises jose.JWTError if the token is invalid, tampered with, or
    expired. Callers (see dependencies.py) turn that into a 401.
    """
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
