from datetime import timedelta

import pytest
from jose import jwt

from app.config import settings
from app.models import User, UserRole
from tests.factories import DEFAULT_PASSWORD, auth_headers, forge_token

NEW_PASSWORD = "NewPassword456!"


def login(client, email, password):
    # OAuth2PasswordRequestForm: form-encoded, and the email goes in "username"
    return client.post("/auth/login", data={"username": email, "password": password})


# ---------- register ----------

def test_register_creates_a_customer_and_never_returns_the_password(client):
    response = client.post(
        "/auth/register",
        json={"name": "New Person", "email": "new@test.com", "password": "Password123!"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "new@test.com"
    assert body["role"] == "CUSTOMER"
    assert "password" not in body and "password_hash" not in body


def test_a_registered_user_can_log_in_with_the_same_credentials(client):
    client.post(
        "/auth/register",
        json={"name": "New Person", "email": "new@test.com", "password": "Password123!"},
    )
    assert login(client, "new@test.com", "Password123!").status_code == 200


def test_register_rejects_an_email_that_is_already_taken(client, customer):
    response = client.post(
        "/auth/register",
        json={"name": "Copycat", "email": customer.email, "password": "Password123!"},
    )

    assert response.status_code == 400
    assert "already registered" in response.json()["detail"]


def test_a_client_cannot_choose_its_own_role_at_registration(client, db_session):
    client.post(
        "/auth/register",
        json={"name": "Sneaky", "email": "sneaky@test.com", "password": "Password123!", "role": "ADMIN"},
    )

    # Assert the invariant, not the incidental status code: whether the extra
    # field is ignored (201) or rejected (422), nobody may end up as ADMIN.
    user = db_session.query(User).filter(User.email == "sneaky@test.com").first()
    assert user is None or user.role == UserRole.CUSTOMER


# ---------- login ----------

def test_login_returns_a_token_that_identifies_the_user(client, customer):
    response = login(client, customer.email, DEFAULT_PASSWORD)

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    payload = jwt.decode(body["access_token"], settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    assert payload["sub"] == str(customer.id)
    assert payload["role"] == "CUSTOMER"


def test_login_with_a_wrong_password_returns_401(client, customer):
    assert login(client, customer.email, "WrongPassword1!").status_code == 401


def test_login_errors_do_not_reveal_which_emails_exist(client, customer):
    wrong_password = login(client, customer.email, "WrongPassword1!")
    unknown_email = login(client, "nobody@test.com", DEFAULT_PASSWORD)

    # identical status AND body: an attacker can't tell "no such user" from "bad password"
    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.json() == unknown_email.json()


# ---------- GET /auth/me and token validation ----------

def test_me_returns_the_logged_in_user(client, customer):
    response = client.get("/auth/me", headers=auth_headers(customer))

    assert response.status_code == 200
    assert response.json()["email"] == customer.email


def test_me_without_a_token_returns_401(client):
    assert client.get("/auth/me").status_code == 401


def test_me_rejects_a_garbage_token(client):
    response = client.get("/auth/me", headers={"Authorization": "Bearer not-a-real-token"})
    assert response.status_code == 401


def test_me_rejects_an_expired_token(client, customer):
    headers = forge_token(customer.id, expires_in=timedelta(minutes=-1))
    assert client.get("/auth/me", headers=headers).status_code == 401


def test_me_rejects_a_token_signed_with_the_wrong_secret(client, customer):
    headers = forge_token(customer.id, secret="not-the-real-secret")
    assert client.get("/auth/me", headers=headers).status_code == 401


def test_me_rejects_a_valid_token_for_a_user_that_no_longer_exists(client):
    assert client.get("/auth/me", headers=forge_token(999999)).status_code == 401


# ---------- update profile ----------

def test_update_name_trims_whitespace(client, customer):
    response = client.put("/auth/me", json={"name": "  New Name  "}, headers=auth_headers(customer))

    assert response.status_code == 200
    assert response.json()["name"] == "New Name"


def test_update_name_rejects_a_blank_name(client, customer):
    response = client.put("/auth/me", json={"name": "   "}, headers=auth_headers(customer))
    assert response.status_code == 422


def test_update_name_requires_login(client):
    assert client.put("/auth/me", json={"name": "Anyone"}).status_code == 401


# ---------- change password ----------

def change_password(client, user, current, new):
    return client.put(
        "/auth/me/password",
        json={"current_password": current, "new_password": new},
        headers=auth_headers(user),
    )


def test_changing_the_password_switches_which_password_logs_in(client, customer):
    response = change_password(client, customer, DEFAULT_PASSWORD, NEW_PASSWORD)

    assert response.status_code == 204
    assert login(client, customer.email, NEW_PASSWORD).status_code == 200
    assert login(client, customer.email, DEFAULT_PASSWORD).status_code == 401


def test_change_password_requires_the_correct_current_password(client, customer):
    response = change_password(client, customer, "NotMyPassword1!", NEW_PASSWORD)

    assert response.status_code == 400
    assert "incorrect" in response.json()["detail"]
    # and nothing changed: the old password still works
    assert login(client, customer.email, DEFAULT_PASSWORD).status_code == 200


def test_change_password_rejects_reusing_the_current_password(client, customer):
    response = change_password(client, customer, DEFAULT_PASSWORD, DEFAULT_PASSWORD)

    assert response.status_code == 400
    assert "different" in response.json()["detail"]


def test_change_password_rejects_a_too_short_new_password(client, customer):
    assert change_password(client, customer, DEFAULT_PASSWORD, "short").status_code == 422


def test_change_password_requires_login(client):
    response = client.put(
        "/auth/me/password",
        json={"current_password": DEFAULT_PASSWORD, "new_password": NEW_PASSWORD},
    )
    assert response.status_code == 401