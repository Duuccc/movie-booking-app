"""
FastAPI application entrypoint.

Routers are added milestone by milestone (auth, movies, theaters,
showtimes, bookings). For now this just proves the app boots and can
reach the database.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.database import engine
from app.routers import auth as auth_router
from app.routers import movies as movies_router
from app.routers import theaters as theaters_router
from app.routers import showtimes as showtimes_router
from app.routers import bookings as bookings_router
from app.routers import admin as admin_router

from pathlib import Path

app = FastAPI(
    title="Movie Booking API",
    description="A small movie ticket booking backend built for learning purposes.",
    version="0.1.0",
)

# Allow the local Vite dev server to call this API during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
(STATIC_DIR/"posters").mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

app.include_router(auth_router.router)
app.include_router(movies_router.router)
app.include_router(theaters_router.router)
app.include_router(showtimes_router.router)
app.include_router(bookings_router.router)
app.include_router(admin_router.router)

@app.get("/")
def root():
    return {"message": "Movie Booking API is running"}


@app.get("/health")
def health_check():
    """
    Confirms the API process is up AND can talk to Postgres.
    Useful for the first milestone and for docker-compose healthchecks later.
    """
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return {"status": "ok", "database": "connected"}
