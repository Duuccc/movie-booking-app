from app.models import UserRole
from tests.factories import (
    auth_headers,
    make_movie,
    make_showtime,
    make_theater,
    make_user,
    seat_ids,
)


def test_admin_can_list_users_without_password_hashes(client, admin, customer):
    response = client.get("/admin/users", headers=auth_headers(admin))

    assert response.status_code == 200
    users = response.json()
    assert {"admin@test.com", "customer@test.com"} <= {u["email"] for u in users}
    for u in users:
        assert "password_hash" not in u and "password" not in u


def test_admin_can_promote_a_customer(client, admin, customer):
    response = client.put(
        f"/admin/users/{customer.id}/role", json={"role": "ADMIN"}, headers=auth_headers(admin)
    )

    assert response.status_code == 200
    assert response.json()["role"] == "ADMIN"


def test_a_demoted_admin_loses_access_even_with_an_old_token(client, db_session, admin):
    second_admin = make_user(db_session, email="admin2@test.com", name="Admin Two", role=UserRole.ADMIN)
    old_headers = auth_headers(second_admin)  # this token claims role=ADMIN
    assert client.get("/admin/bookings", headers=old_headers).status_code == 200

    demote = client.put(
        f"/admin/users/{second_admin.id}/role", json={"role": "CUSTOMER"}, headers=auth_headers(admin)
    )
    assert demote.status_code == 200

    # Same token: still unexpired, still claims ADMIN. But the database says
    # CUSTOMER, so access ends immediately instead of lingering up to 60 minutes.
    assert client.get("/admin/bookings", headers=old_headers).status_code == 403


def test_an_admin_cannot_remove_their_own_admin_role(client, db_session, admin):
    response = client.put(
        f"/admin/users/{admin.id}/role", json={"role": "CUSTOMER"}, headers=auth_headers(admin)
    )

    assert response.status_code == 400
    db_session.refresh(admin)
    assert admin.role == UserRole.ADMIN  # nothing changed


def test_role_change_rejects_an_unknown_role(client, admin, customer):
    response = client.put(
        f"/admin/users/{customer.id}/role", json={"role": "SUPERUSER"}, headers=auth_headers(admin)
    )
    assert response.status_code == 422


def test_role_change_for_an_unknown_user_returns_404(client, admin):
    response = client.put("/admin/users/999999/role", json={"role": "ADMIN"}, headers=auth_headers(admin))
    assert response.status_code == 404


def test_an_admin_cannot_delete_their_own_account(client, admin):
    response = client.delete(f"/admin/users/{admin.id}", headers=auth_headers(admin))

    assert response.status_code == 400
    emails = {u["email"] for u in client.get("/admin/users", headers=auth_headers(admin)).json()}
    assert "admin@test.com" in emails


def test_admin_can_delete_another_user(client, admin, customer):
    customer_id = customer.id

    response = client.delete(f"/admin/users/{customer_id}", headers=auth_headers(admin))

    assert response.status_code == 204
    ids = {u["id"] for u in client.get("/admin/users", headers=auth_headers(admin)).json()}
    assert customer_id not in ids


def test_deleting_an_unknown_user_returns_404(client, admin):
    assert client.delete("/admin/users/999999", headers=auth_headers(admin)).status_code == 404


def test_deleting_a_user_also_deletes_their_bookings(client, db_session, admin, customer):
    # Characterization test: records today's behavior (hard delete + cascade),
    # which is destructive. If you ever switch to soft delete, change this test
    # on purpose rather than discovering the difference in production.
    showtime = make_showtime(db_session, make_movie(db_session), make_theater(db_session))
    (a1,) = seat_ids(db_session, showtime.theater_id, "A1")
    booked = client.post(
        "/bookings",
        json={"showtime_id": showtime.id, "seat_ids": [a1]},
        headers=auth_headers(customer),
    )
    assert booked.status_code == 201
    customer_id = customer.id

    assert client.delete(f"/admin/users/{customer_id}", headers=auth_headers(admin)).status_code == 204

    remaining = client.get("/admin/bookings", headers=auth_headers(admin)).json()
    assert [b for b in remaining if b["user_id"] == customer_id] == []