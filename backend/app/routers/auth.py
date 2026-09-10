"""
Auth endpoints: register, login, "who am I".

Login uses FastAPI's OAuth2PasswordRequestForm (standard form-encoded
username/password) rather than a JSON body, because that's what makes
the Swagger "Authorize" button work out of the box. `username` is used
as the email field -- the frontend (Milestone 7) just POSTs form-encoded
data with those two field names.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserOut, Token
from app.auth.password import hash_password, verify_password
from app.auth.jwt import create_access_token
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        # Public registration always creates a CUSTOMER. There is no
        # "become an admin" endpoint -- admins only come from the seed
        # script or a direct DB action. This is intentional: it keeps
        # the permission model impossible to escalate through the API.
        role=UserRole.CUSTOMER,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        # Same error for "no such user" and "wrong password" -- don't
        # reveal which one it was, that would leak which emails are registered.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(user_id=user.id, role=user.role.value)
    return Token(access_token=access_token)


@router.get("/me", response_model=UserOut)
def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user
