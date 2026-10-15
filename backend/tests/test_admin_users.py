import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.core.security import hash_password, create_access_token, verify_password
from app.models.user import User


@pytest.fixture
def auth_tokens(db_session):
    """Seed an admin and regular user and return valid authorization headers."""
    admin = User(
        username="admin_manager",
        hashed_password=hash_password("AdminPass123!"),
        role="admin",
        is_active=True,
    )
    user = User(
        username="regular_worker",
        hashed_password=hash_password("UserPass123!"),
        role="user",
        is_active=True,
    )
    db_session.add_all([admin, user])
    db_session.flush()

    admin_token = create_access_token({"sub": str(admin.id), "username": admin.username, "role": admin.role})
    user_token = create_access_token({"sub": str(user.id), "username": user.username, "role": user.role})

    return {
        "admin_headers": {"Authorization": f"Bearer {admin_token}"},
        "user_headers": {"Authorization": f"Bearer {user_token}"},
        "admin": admin,
        "user": user,
    }


@pytest.mark.anyio
async def test_admin_successfully_creates_user(auth_tokens, db_session):
    """Scenario 1 & 8 & 9: Admin creates a user; verify response format, password hashing, no hash in output."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/auth/users",
            headers=auth_tokens["admin_headers"],
            json={
                "username": "new_clerk",
                "password": "SecurePassword123!",
                "role": "user",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["username"] == "new_clerk"
        assert data["role"] == "user"
        assert data["is_active"] is True
        assert "id" in data
        # Ensure password hash is NEVER leaked in response
        assert "password" not in data
        assert "hashed_password" not in data

        # Check DB directly to ensure password was hashed with bcrypt
        created_user = db_session.query(User).filter_by(username="new_clerk").first()
        assert created_user is not None
        assert created_user.hashed_password != "SecurePassword123!"
        assert verify_password("SecurePassword123!", created_user.hashed_password) is True


@pytest.mark.anyio
async def test_admin_can_list_users(auth_tokens):
    """Scenario 2 & 9: Admin lists user accounts; verify safe response without secrets."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(
            "/auth/users",
            headers=auth_tokens["admin_headers"],
        )
        assert response.status_code == 200
        users_list = response.json()
        assert isinstance(users_list, list)
        assert len(users_list) >= 2

        usernames = [u["username"] for u in users_list]
        assert "admin_manager" in usernames
        assert "regular_worker" in usernames

        for user_item in users_list:
            assert "hashed_password" not in user_item
            assert "password" not in user_item


@pytest.mark.anyio
async def test_unauthenticated_creation_rejected():
    """Scenario 3: Unauthenticated user creation returns 401."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/auth/users",
            json={"username": "unauth_user", "password": "Password123!", "role": "user"},
        )
        assert response.status_code == 401


@pytest.mark.anyio
async def test_regular_user_cannot_create_users(auth_tokens):
    """Scenario 4: Regular User cannot create accounts (403 Forbidden)."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/auth/users",
            headers=auth_tokens["user_headers"],
            json={"username": "escalated_user", "password": "Password123!", "role": "user"},
        )
        assert response.status_code == 403
        assert "Admin privileges required" in response.json()["detail"]


@pytest.mark.anyio
async def test_regular_user_cannot_list_all_users(auth_tokens):
    """Scenario 5: Regular User cannot list accounts (403 Forbidden)."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(
            "/auth/users",
            headers=auth_tokens["user_headers"],
        )
        assert response.status_code == 403
        assert "Admin privileges required" in response.json()["detail"]


@pytest.mark.anyio
async def test_duplicate_username_is_rejected(auth_tokens):
    """Scenario 6: Duplicate username returns 409 Conflict."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Try creating existing username 'regular_worker'
        response = await client.post(
            "/auth/users",
            headers=auth_tokens["admin_headers"],
            json={"username": "regular_worker", "password": "AnotherPassword123!", "role": "user"},
        )
        assert response.status_code == 409
        assert "already exists" in response.json()["detail"].lower()


@pytest.mark.anyio
async def test_invalid_input_is_rejected(auth_tokens):
    """Scenario 7: Short passwords or empty usernames return 422 Unprocessable Entity."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Password too short (< 6 chars)
        res1 = await client.post(
            "/auth/users",
            headers=auth_tokens["admin_headers"],
            json={"username": "valid_user", "password": "123", "role": "user"},
        )
        assert res1.status_code == 422

        # Username too short (< 3 chars)
        res2 = await client.post(
            "/auth/users",
            headers=auth_tokens["admin_headers"],
            json={"username": "ab", "password": "ValidPassword123!", "role": "user"},
        )
        assert res2.status_code == 422

        # Invalid role pattern (neither 'admin' nor 'user')
        res3 = await client.post(
            "/auth/users",
            headers=auth_tokens["admin_headers"],
            json={"username": "bad_role_user", "password": "ValidPassword123!", "role": "superadmin"},
        )
        assert res3.status_code == 422


@pytest.mark.anyio
async def test_newly_created_user_can_authenticate(auth_tokens):
    """Scenario 10: Newly created user can immediately log in with their credentials."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Admin creates user
        create_res = await client.post(
            "/auth/users",
            headers=auth_tokens["admin_headers"],
            json={"username": "cashier_john", "password": "CashierPass123!", "role": "user"},
        )
        assert create_res.status_code == 201

        # 2. Created user logs in
        login_res = await client.post(
            "/auth/login",
            json={"username": "cashier_john", "password": "CashierPass123!"},
        )
        assert login_res.status_code == 200
        data = login_res.json()
        assert "access_token" in data
        assert data["user"]["username"] == "cashier_john"
        assert data["user"]["role"] == "user"
