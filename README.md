# Movie Booking (Learning Project)

A small, complete movie ticket booking web application. Built as an
incremental 2-week internship project to demonstrate backend fundamentals,
database design, REST APIs, authentication, booking logic, and a simple
frontend — **not** a production system.

> This README grows with each milestone. Right now it only documents
> Milestone 1: project scaffolding.

## Tech Stack

- **Backend:** Python, FastAPI, SQLAlchemy, PostgreSQL, Pydantic, JWT, pytest
- **Frontend:** React, Vite, JavaScript
- **Dev tooling:** Docker Compose (Postgres only), Git

## Project Structure

```
movie-booking/
├── backend/
│   ├── app/
│   │   ├── main.py        # FastAPI app + health check
│   │   ├── config.py       # Settings loaded from .env
│   │   ├── database.py     # SQLAlchemy engine/session
│   │   ├── models/         # SQLAlchemy models (Milestone 2)
│   │   ├── schemas/        # Pydantic schemas (Milestone 3+)
│   │   ├── routers/        # API route handlers (Milestone 3+)
│   │   ├── services/       # Business logic, e.g. booking logic (Milestone 6)
│   │   └── auth/           # Password hashing, JWT (Milestone 3)
│   ├── tests/
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/     # (Milestone 7+)
│   │   ├── pages/          # (Milestone 7+)
│   │   ├── services/       # API client (Milestone 7+)
│   │   ├── context/        # Auth context (Milestone 7+)
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
├── docker-compose.yml
└── README.md
```

## Milestone 1: Running the scaffolding locally

This milestone only proves the three pieces (Postgres, backend, frontend)
can start up and talk to each other. There are no real features yet.

### 1. Start Postgres

```bash
docker compose up -d
```

This starts Postgres 16 on `localhost:5432` with:
- user: `movieuser`
- password: `moviepass`
- database: `moviebooking`

Check it's healthy:

```bash
docker compose ps
```

### 2. Start the backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # defaults already match docker-compose.yml
uvicorn app.main:app --reload --port 8000
```

Visit:
- http://localhost:8000/ → `{"message": "Movie Booking API is running"}`
- http://localhost:8000/health → `{"status": "ok", "database": "connected"}`
- http://localhost:8000/docs → interactive Swagger UI (FastAPI gives you this for free)

If `/health` fails, double check `docker compose ps` shows Postgres as
healthy, and that `backend/.env` matches the credentials in
`docker-compose.yml`.

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Visit http://localhost:5173 — you should see "Movie Booking" and
`Backend status: ok (db: connected)`. If it says "backend unreachable",
make sure the backend is running on port 8000.

## Environment Variables

See `backend/.env.example`. Copy it to `backend/.env` and adjust if you
change the Postgres credentials in `docker-compose.yml`.

| Variable | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | SQLAlchemy connection string | matches docker-compose.yml |
| `JWT_SECRET` | Signs auth tokens | `dev-secret-change-me` (change for real use) |
| `JWT_ALGORITHM` | JWT signing algorithm | `HS256` |
| `JWT_EXPIRE_MINUTES` | Access token lifetime | `60` |

## Roadmap

- [x] Milestone 1 — Project scaffolding, Docker Compose, DB connectivity
- [ ] Milestone 2 — Database models, relationships, seed data
- [ ] Milestone 3 — Auth: register, login, JWT, role checking
- [ ] Milestone 4 — Movie + Theater APIs (admin CRUD)
- [ ] Milestone 5 — Showtime + Seat APIs
- [ ] Milestone 6 — Booking logic + double-booking prevention
- [ ] Milestone 7 — Frontend auth pages + movie browsing
- [ ] Milestone 8 — Seat selection + booking confirmation
- [ ] Milestone 9 — Booking history, cancellation, admin dashboard
- [ ] Milestone 10 — Testing, docs, seed data polish, demo prep

## Known Limitations (so far)

- No Alembic migrations yet — schema is created via
  `Base.metadata.create_all()`. Fine for a project this size; documented
  here so it's a conscious choice, not an oversight.
- No real features yet — this is scaffolding only.
