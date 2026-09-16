# Movie Booking -- Technical Specification

This is the contract for what the system does and the rules it
enforces -- distinct from `README.md`, which covers how to run it.
Where this document and the code disagree, the code is correct and
this document is stale; it reflects the state of the project as
actually built through Milestone 10 plus the poster-upload addition.

## 1. Purpose and Scope

A small, complete movie ticket booking application, built to
demonstrate backend fundamentals (REST API design, relational schema
design, auth, transactional correctness under concurrency) and a
minimal working frontend. It is explicitly **not** a production system
-- see [Section 8, Non-Goals](#8-non-goals).

## 2. Actors

| Role | Can do |
|---|---|
| **Anonymous** | Register, log in, browse movies/theaters/showtimes, view seat availability |
| **Customer** | Everything Anonymous can, plus: book seats, view/cancel their own bookings |
| **Admin** | Everything Customer can, plus: CRUD movies/theaters/showtimes, upload posters, view every booking in the system |

Role is a single enum column on `User` (`CUSTOMER` \| `ADMIN`), not a
permissions/roles table. There is no path from Customer to Admin
through the API -- `POST /auth/register` always creates a `CUSTOMER`;
admins only exist via the seed script or a direct database edit. This
is a deliberate invariant: privilege escalation via the API must be
structurally impossible, not just policy-forbidden.

## 3. Entities and Invariants

```
User ──< Booking >── Showtime >── Movie
                        │            
                        v            
                      Theater ──< Seat
                        │
                        v
                    BookingSeat >── Seat
```

| Entity | Exists to represent | Key invariants |
|---|---|---|
| `User` | An account | `email` unique; `password_hash` never returned by any API response |
| `Movie` | Catalog entry | `duration` in minutes; no pricing lives here |
| `Theater` | A physical venue | Owns a fixed `Seat` layout |
| `Seat` | One physical seat | `(theater_id, row, seat_number)` unique |
| `Showtime` | One screening: movie + theater + time + price | Flat price per seat, no tiers |
| `Booking` | A customer's reservation for a showtime | `status`: `CONFIRMED` \| `CANCELLED`; never hard-deleted |
| `BookingSeat` | One seat, reserved for one booking, for one showtime | `(showtime_id, seat_id)` **unique** -- see Section 4 |

`BookingSeat.showtime_id` is denormalized from its parent `Booking` on
purpose: without it, this table alone can't express "which showtime is
this seat reserved for," which is the entire mechanism Section 4
depends on.

## 4. Core Business Rule: Double-Booking Prevention

**Invariant:** for a given `(showtime_id, seat_id)` pair, at most one
`BookingSeat` row may exist at any time.

**Enforcement:** a database-level unique constraint on
`booking_seats(showtime_id, seat_id)` -- not an application-level
check. `create_booking()` does not verify availability and then
insert as two separate steps; it attempts the insert directly inside a
transaction and lets Postgres reject a conflicting row via
`IntegrityError`. On conflict, the entire booking is rolled back --
partial bookings (some seats reserved, others silently dropped) are
not a possible outcome. The client receives `409 Conflict`.

This means the same physical seat can be booked for two *different*
showtimes without conflict (the constraint is on the pair, not the
seat alone), and it means the guarantee holds under genuinely
concurrent requests, which an app-level "check, then write" could not
promise regardless of how carefully it were written.

**Cancellation** deletes the booking's `BookingSeat` rows (freeing the
seat for that showtime) but keeps the `Booking` row itself, marked
`CANCELLED`, so booking history isn't destroyed by cancelling.

## 5. Other Enforced Rules

- **Ownership.** A customer can `GET`/`cancel` only bookings where
  `booking.user_id == current_user.id`. A booking that exists but
  belongs to someone else returns `404`, not `403` -- the API does not
  confirm that a given booking ID exists to a non-owner.
- **Admin-gated mutation.** All create/update/delete on movies,
  theaters, and showtimes, plus poster upload and the all-bookings
  view, require `role == ADMIN`. Enforced by a FastAPI dependency
  (`require_admin`) that runs before the route body, not by an `if`
  inside the handler.
- **Delete guards.** A movie, theater, or showtime with any
  `CONFIRMED` booking against it cannot be deleted (`400`). Without
  this, the FK `ondelete="CASCADE"` relationships would silently
  delete real customer bookings as a side effect of an admin deleting
  a movie. Cancelling first is required before delete succeeds.
- **Idempotent cancellation.** Cancelling an already-`CANCELLED`
  booking is rejected (`400`), not a silent no-op.
- **Booking seat validation.** `POST /bookings` verifies the showtime
  exists, every requested seat exists, and every requested seat
  belongs to that showtime's *theater* (not just any theater) before
  attempting the insert.

## 6. API Contract

All error responses are `{"detail": "<message>"}`.

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/register` | - | Always creates role `CUSTOMER` |
| POST | `/auth/login` | - | Form-encoded (`username`=email, `password`); returns JWT |
| GET | `/auth/me` | any | |
| GET | `/movies` | - | |
| GET | `/movies/{id}` | - | `404` if missing |
| POST | `/movies` | admin | |
| PUT | `/movies/{id}` | admin | Partial update (only sent fields change) |
| DELETE | `/movies/{id}` | admin | `400` if active bookings exist against its showtimes |
| POST | `/movies/{id}/poster` | admin | Multipart; JPEG/PNG/WEBP only, 5MB max |
| GET | `/theaters` | - | |
| GET | `/theaters/{id}` | - | |
| POST/PUT | `/theaters[/{id}]` | admin | |
| DELETE | `/theaters/{id}` | admin | `400` if active bookings exist against its showtimes |
| GET | `/showtimes` | - | No server-side filtering |
| GET | `/showtimes/{id}` | - | |
| GET | `/showtimes/{id}/seats` | - | Every seat in the theater, `AVAILABLE`\|`BOOKED` for *this* showtime |
| POST/PUT | `/showtimes[/{id}]` | admin | `404` if `movie_id`/`theater_id` don't exist |
| DELETE | `/showtimes/{id}` | admin | `400` if active bookings exist |
| POST | `/bookings` | customer | `{showtime_id, seat_ids[]}` → `409` on any seat conflict |
| GET | `/bookings` | customer | Own bookings only |
| GET | `/bookings/{id}` | customer, owner | `404` if not found or not owned |
| POST | `/bookings/{id}/cancel` | customer, owner | `400` if already cancelled |
| GET | `/admin/bookings` | admin | Every booking, all users |

## 7. Frontend Route Map

| Route | Guard | Page |
|---|---|---|
| `/` | none | Movie list |
| `/movies/:id` | none | Movie details |
| `/movies/:id/showtimes` | none | Showtime selection |
| `/showtimes/:id/seats` | logged in | Seat selection + booking |
| `/bookings/:id/confirmation` | logged in | Booking confirmation |
| `/bookings` | logged in | My bookings + cancel |
| `/login`, `/register` | none | Auth |
| `/admin`, `/admin/movies`, `/admin/theaters`, `/admin/showtimes`, `/admin/bookings` | admin role | Admin dashboard |

`ProtectedRoute` redirects unauthenticated users to `/login`.
`AdminRoute` redirects non-admins to `/` (they're authenticated, just
not authorized -- different from the unauthenticated case).


