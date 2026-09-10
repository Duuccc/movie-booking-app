"""
Password hashing, built on passlib's bcrypt backend.

Split into its own file (separate from JWT/token logic, which arrives in
Milestone 3) so the seed script can hash passwords without needing the
full auth system built yet.
"""
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)
