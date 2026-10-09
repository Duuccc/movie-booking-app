"""
Covers the "Movies" section of the test plan: get movies, admin creates
movie, non-admin cannot create movie.
"""
from app.models.user import User, UserRole


def _register_and_login(client, email, password="secret123"):
    client.post("/auth/register", json={"name": "Test User", "email": email, "password": password})
    login = client.post("/auth/login", data={"username": email, "password": password})
    return login.json()["access_token"]


def _make_admin(db_session, email):
    """
    There is no API endpoint to promote a user to admin (Milestone 3
    made that a deliberate omission), so tests that need an admin
    promote the user directly in the test database instead.
    """
    user = db_session.query(User).filter(User.email == email).first()
    user.role = UserRole.ADMIN
    db_session.commit()


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def test_list_movies_is_public(client):
    response = client.get("/movies")
    assert response.status_code == 200
    assert response.json() == []


def test_admin_can_create_movie(client, db_session):
    token = _register_and_login(client, "admin@example.com")
    _make_admin(db_session, "admin@example.com")

    response = client.post(
        "/movies",
        json={
            "title": "Test Movie",
            "description": "A movie for testing.",
            "duration": 100,
            "genre": "Drama",
        },
        headers=_auth_headers(token),
    )
    assert response.status_code == 201
    assert response.json()["title"] == "Test Movie"

    list_response = client.get("/movies")
    assert len(list_response.json()) == 1


def test_non_admin_cannot_create_movie(client):
    token = _register_and_login(client, "customer@example.com")

    response = client.post(
        "/movies",
        json={"title": "Nope", "duration": 90},
        headers=_auth_headers(token),
    )
    assert response.status_code == 403


def test_create_movie_without_token_rejected(client):
    response = client.post("/movies", json={"title": "Nope", "duration": 90})
    assert response.status_code == 401


def test_get_movie_not_found(client):
    response = client.get("/movies/999")
    assert response.status_code == 404


def test_admin_can_update_and_delete_movie(client, db_session):
    token = _register_and_login(client, "admin2@example.com")
    _make_admin(db_session, "admin2@example.com")

    create_response = client.post(
        "/movies",
        json={"title": "Original Title", "duration": 100},
        headers=_auth_headers(token),
    )
    movie_id = create_response.json()["id"]

    update_response = client.put(
        f"/movies/{movie_id}",
        json={"title": "Updated Title"},
        headers=_auth_headers(token),
    )
    assert update_response.status_code == 200
    assert update_response.json()["title"] == "Updated Title"
    # duration wasn't in the update payload -- confirm it's untouched
    assert update_response.json()["duration"] == 100

    delete_response = client.delete(f"/movies/{movie_id}", headers=_auth_headers(token))
    assert delete_response.status_code == 204

    get_response = client.get(f"/movies/{movie_id}")
    assert get_response.status_code == 404