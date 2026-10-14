from datetime import datetime, timedelta, timezone
import pytest
from httpx import ASGITransport, AsyncClient
from fastapi import HTTPException
import jwt

from app.main import app
from app.core.config import settings
from app.core.security import hash_password, create_access_token
from app.core.permissions import require_admin, require_user
from app.models.user import User


@pytest.fixture
def test_users(db_session):
    """Seed test admin and regular users in the isolated test transaction."""
    admin_user = User(
        username="test_admin",
        hashed_password=hash_password("admin_pass_123"),
        role="admin",
        is_active=True,
    )
    regular_user = User(
        username="test_user",
        hashed_password=hash_password("user_pass_123"),
        role="user",
        is_active=True,
    )
    inactive_user = User(
        username="test_inactive",
        hashed_password=hash_password("inactive_pass_123"),
        role="user",
        is_active=False,
    )
    db_session.add_all([admin_user, regular_user, inactive_user])
    db_session.flush()

    return {
        "admin": admin_user,
        "user": regular_user,
        "inactive": inactive_user,
    }


@pytest.mark.anyio
async def test_admin_login_success(test_users):
    """Verify Admin can login and receive a valid JWT access token."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/auth/login",
            json={"username": "test_admin", "password": "admin_pass_123"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["username"] == "test_admin"
        assert data["user"]["role"] == "admin"
        # Ensure password hash is NOT returned
        assert "hashed_password" not in data["user"]
        assert "password" not in data["user"]


@pytest.mark.anyio
async def test_user_login_success(test_users):
    """Verify regular User can login and receive a valid JWT access token."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/auth/login",
            json={"username": "test_user", "password": "user_pass_123"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["username"] == "test_user"
        assert data["user"]["role"] == "user"
        assert "hashed_password" not in data["user"]


@pytest.mark.anyio
async def test_login_incorrect_password(test_users):
    """Verify login fails with HTTP 401 when password does not match."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/auth/login",
            json={"username": "test_admin", "password": "wrong_password"},
        )
        assert response.status_code == 401
        assert response.json()["detail"] == "Incorrect username or password"


@pytest.mark.anyio
async def test_login_unknown_username(test_users):
    """Verify login fails with HTTP 401 when username does not exist."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/auth/login",
            json={"username": "non_existent_user", "password": "any_password"},
        )
        assert response.status_code == 401
        assert response.json()["detail"] == "Incorrect username or password"


@pytest.mark.anyio
async def test_login_inactive_user(test_users):
    """Verify inactive account cannot authenticate."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/auth/login",
            json={"username": "test_inactive", "password": "inactive_pass_123"},
        )
        assert response.status_code == 401
        assert "inactive" in response.json()["detail"].lower()


@pytest.mark.anyio
async def test_access_me_endpoint_success(test_users):
    """Verify /auth/me returns the profile of the authenticated user without password hash."""
    # First login to obtain token
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        login_resp = await client.post(
            "/auth/login",
            json={"username": "test_admin", "password": "admin_pass_123"},
        )
        token = login_resp.json()["access_token"]

        # Call /auth/me with Bearer token
        me_resp = await client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert me_resp.status_code == 200
        me_data = me_resp.json()
        assert me_data["username"] == "test_admin"
        assert me_data["role"] == "admin"
        assert me_data["is_active"] is True
        assert "hashed_password" not in me_data


@pytest.mark.anyio
async def test_access_me_missing_token():
    """Verify missing Authorization header returns HTTP 401."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/auth/me")
        assert response.status_code == 401


@pytest.mark.anyio
async def test_access_me_invalid_token():
    """Verify malformed or invalid JWT returns HTTP 401."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(
            "/auth/me",
            headers={"Authorization": "Bearer invalid.token.value"},
        )
        assert response.status_code == 401
        assert response.json()["detail"] == "Could not validate credentials"


@pytest.mark.anyio
async def test_access_me_expired_token(test_users):
    """Verify expired token returns HTTP 401."""
    # Generate an expired token
    admin_id = str(test_users["admin"].id)
    expired_token = create_access_token(
        data={"sub": admin_id, "username": "test_admin", "role": "admin"},
        expires_delta=timedelta(minutes=-5),
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {expired_token}"},
        )
        assert response.status_code == 401
        assert "expired" in response.json()["detail"].lower()


def test_role_based_permissions(test_users):
    """Verify require_admin allows Admin and rejects regular User with HTTP 403."""
    admin = test_users["admin"]
    regular = test_users["user"]

    # Admin should pass require_admin
    admin_result = require_admin(admin)
    assert admin_result.username == "test_admin"

    # Regular user must be rejected with 403 Forbidden
    with pytest.raises(HTTPException) as exc_info:
        require_admin(regular)
    assert exc_info.value.status_code == 403
    assert "Admin privileges required" in exc_info.value.detail

    # Both should pass require_user
    assert require_user(admin).username == "test_admin"
    assert require_user(regular).username == "test_user"


@pytest.mark.anyio
async def test_login_via_form_urlencoded(test_users):
    """Verify OAuth2 form-urlencoded payload is supported alongside JSON."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/auth/login",
            data={"username": "test_admin", "password": "admin_pass_123"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["username"] == "test_admin"


@pytest.mark.anyio
async def test_access_me_inactive_user_token(test_users):
    """Verify an inactive user with a validly signed token is rejected upon accessing /auth/me."""
    inactive_id = str(test_users["inactive"].id)
    token = create_access_token(
        data={"sub": inactive_id, "username": "test_inactive", "role": "user"}
    )
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 401
        assert "inactive" in response.json()["detail"].lower()

