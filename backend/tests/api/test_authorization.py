import pytest

from tests.factories import auth_headers, forge_token

# Every endpoint that must be admin-only. Adding a new admin endpoint to the
# app? Add one line here and it is covered for both "anonymous" and "customer".
ADMIN_ONLY = [
    ("GET", "/admin/bookings"),
    ("GET", "/admin/users"),
    ("PUT", "/admin/users/1/role"),
    ("DELETE", "/admin/users/1"),
    ("GET", "/admin/analytics?date_from=2026-01-01&date_to=2026-01-31"),
    ("POST", "/movies"),
    ("PUT", "/movies/1"),
    ("DELETE", "/movies/1"),
    ("POST", "/theaters"),
    ("DELETE", "/theaters/1"),
    ("POST", "/theaters/1/seats"),
    ("POST", "/showtimes"),
    ("POST", "/showtimes/batch"),
    ("DELETE", "/showtimes/1"),
]
IDS = [f"{method} {path}" for method, path in ADMIN_ONLY]


@pytest.mark.parametrize("method, path", ADMIN_ONLY, ids=IDS)
def test_admin_endpoints_reject_anonymous_requests(client, method, path):
    assert client.request(method, path).status_code == 401


@pytest.mark.parametrize("method, path", ADMIN_ONLY, ids=IDS)
def test_admin_endpoints_reject_customers(client, customer, method, path):
    # 403 (authenticated, not allowed), distinct from 401 (not authenticated).
    # The admin check runs before the request body is validated, so no body is needed.
    response = client.request(method, path, headers=auth_headers(customer))
    assert response.status_code == 403


def test_a_token_claiming_to_be_admin_does_not_make_a_customer_admin(client, customer):
    # Valid signature, but the role claim is a lie. require_admin must trust
    # the database, not the token.
    headers = forge_token(customer.id, role="ADMIN")
    assert client.get("/admin/bookings", headers=headers).status_code == 403


def test_admin_can_use_admin_endpoints(client, admin):
    assert client.get("/admin/bookings", headers=auth_headers(admin)).status_code == 200


@pytest.mark.parametrize("path", ["/movies", "/movies?category=showing", "/theaters", "/showtimes"])
def test_browsing_endpoints_are_public(client, path):
    assert client.get(path).status_code == 200