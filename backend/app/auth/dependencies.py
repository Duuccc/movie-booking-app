"""
FastAPI dependencies for authentication and role checking.

Usage in a router:

    @router.get("/movies")
    def list_movies(db: Session = Depends(get_db)):
        ...  # public, no auth needed

    @router.get("/auth/me")
    def read_me(current_user: User = Depends(get_current_user)):
        ...  # any logged-in user

    @router.post("/movies")
    def create_movie(current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
        ...  # only admins reach this line -- everyone else gets a 403
             # before the function body ever runs
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole
from app.auth.jwt import decode_access_token

# tokenUrl only tells Swagger's "Authorize" button where to POST for a
# token -- it has no effect on how incoming tokens are validated below.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_error
    except JWTError:
        raise credentials_error

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        # Token is validly signed but the user no longer exists
        # (e.g. deleted after the token was issued).
        raise credentials_error
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user
