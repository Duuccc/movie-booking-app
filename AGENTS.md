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

## Testing
- Backend: `cd backend && pytest`. Needs TEST_DATABASE_URL pointing at a
  database whose name ends in `_test` (conftest refuses otherwise, because
  it drops all tables).
- Tests run against real Postgres, not SQLite: the code uses timezone(),
  extract(), tz-aware datetimes and FOR UPDATE.
- Every bug fix starts with a regression test: reproduce, watch it fail,
  then fix.
- Never sleep() to test expiry — create rows with expires_at in the past.