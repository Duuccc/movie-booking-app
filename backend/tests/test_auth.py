"""
Covers the "Authentication" section of the test plan: register, login,
invalid login, and the protected /auth/me route.
"""


def test_register_creates_customer(client):
    response = client.post(
        "/auth/register",
        json={"name": "Alice", "email": "alice@example.com", "password": "secret123"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "alice@example.com"
    assert body["role"] == "CUSTOMER"
    assert "password" not in body
    assert "password_hash" not in body


def test_register_duplicate_email_rejected(client):
    payload = {"name": "Alice", "email": "alice@example.com", "password": "secret123"}
    client.post("/auth/register", json=payload)
    response = client.post("/auth/register", json=payload)
    assert response.status_code == 400


def test_login_with_correct_credentials_returns_token(client):
    client.post(
        "/auth/register",
        json={"name": "Bob", "email": "bob@example.com", "password": "secret123"},
    )
    response = client.post(
        "/auth/login",
        data={"username": "bob@example.com", "password": "secret123"},
    )
    assert response.status_code == 200
    body = response.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


def test_login_with_wrong_password_rejected(client):
    client.post(
        "/auth/register",
        json={"name": "Bob", "email": "bob@example.com", "password": "secret123"},
    )
    response = client.post(
        "/auth/login",
        data={"username": "bob@example.com", "password": "wrong-password"},
    )
    assert response.status_code == 401


def test_login_with_unknown_email_rejected(client):
    response = client.post(
        "/auth/login",
        data={"username": "nobody@example.com", "password": "whatever"},
    )
    assert response.status_code == 401


def test_me_requires_token(client):
    response = client.get("/auth/me")
    assert response.status_code == 401


def test_me_returns_current_user(client):
    client.post(
        "/auth/register",
        json={"name": "Carol", "email": "carol@example.com", "password": "secret123"},
    )
    login_response = client.post(
        "/auth/login",
        data={"username": "carol@example.com", "password": "secret123"},
    )
    token = login_response.json()["access_token"]

    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["email"] == "carol@example.com"
