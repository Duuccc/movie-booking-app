"""
Same CRUD/permission pattern as movies -- kept intentionally small since
the interesting logic (require_admin, get_or_404 helper) is already
exercised in detail by test_movies.py.
"""
from app.models.user import User, UserRole


def _register_and_login(client, email, password="secret123"):
    client.post("/auth/register", json={"name": "Admin", "email": email, "password": password})
    login = client.post("/auth/login", data={"username": email, "password": password})
    return login.json()["access_token"]


def _make_admin(db_session, email):
    user = db_session.query(User).filter(User.email == email).first()
    user.role = UserRole.ADMIN
    db_session.commit()


def test_admin_can_create_and_list_theaters(client, db_session):
    token = _register_and_login(client, "theater-admin@example.com")
    _make_admin(db_session, "theater-admin@example.com")

    response = client.post(
        "/theaters",
        json={"name": "Test Theater", "location": "1 Test St"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201

    list_response = client.get("/theaters")
    assert len(list_response.json()) == 1


def test_non_admin_cannot_create_theater(client):
    token = _register_and_login(client, "regular-user@example.com")
    response = client.post(
        "/theaters",
        json={"name": "Nope", "location": "Nowhere"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403