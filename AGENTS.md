# AGENTS.md

## Stack
FastAPI + SQLAlchemy + PostgreSQL 16 (Docker). React (Vite) frontend, plain
fetch, no CSS framework. No Alembic — schema changes need a hand-written
SQL migration or a full `docker compose down -v` reset.

## Core decisions — do not relitigate without being explicitly asked
- Double-booking prevention: a DB UNIQUE constraint on
  `(showtime_id, seat_id)` + catching IntegrityError on insert. Not
  app-level locking.
- Mock payments only — no real gateway, deliberately out of scope.
- Work file-by-file, milestone-by-milestone. No zip files — inline code.
  Flag scope creep before implementing anything not asked for.