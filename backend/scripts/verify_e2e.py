#!/usr/bin/env python3
"""End-to-End Live Integration Verification Script for Chetna Mini Market."""

import sys
import os
import httpx
from decimal import Decimal

# Ensure backend root is on sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.core.config import settings
from app.core.security import hash_password
from app.database import SessionLocal
from app.models.user import User

BASE_URL = "http://localhost:8000"


def log(msg, success=True):
    symbol = "✔" if success else "✖"
    print(f"[{symbol}] {msg}")


def run_e2e_verification():
    print("=" * 60)
    print("CHETNA MINI MARKET — LIVE END-TO-END VERIFICATION")
    print(f"Target API Base URL: {BASE_URL}")
    print("=" * 60)

    client = httpx.Client(base_url=BASE_URL, timeout=10.0)

    # 1. Verify /health
    resp = client.get("/health")
    assert resp.status_code == 200, f"/health failed: {resp.text}"
    log(f"Backend Health Check 200 OK: {resp.json()['app']} (v{resp.json()['version']})")

    # 2. Verify CORS preflight
    options_resp = client.options(
        "/products",
        headers={
            "Origin": "http://localhost:8081",
            "Access-Control-Request-Method": "GET"
        }
    )
    assert options_resp.status_code == 200
    assert "access-control-allow-origin" in options_resp.headers
    log(f"CORS Preflight Verified (Origin: {options_resp.headers['access-control-allow-origin']})")

    # 3. Create or verify a test regular user directly in PostgreSQL
    db = SessionLocal()
    try:
        user_pwd = "UserSecurePass123!"
        regular_user = db.query(User).filter(User.username == "e2e_shopper").first()
        if not regular_user:
            regular_user = User(
                username="e2e_shopper",
                hashed_password=hash_password(user_pwd),
                role="user",
                is_active=True,
            )
            db.add(regular_user)
            db.commit()
            db.refresh(regular_user)
        else:
            regular_user.hashed_password = hash_password(user_pwd)
            regular_user.is_active = True
            db.commit()
        log("Test Regular User ('e2e_shopper') prepared in PostgreSQL")
    finally:
        db.close()

    # 4. Admin Login
    admin_login_resp = client.post(
        "/auth/login",
        json={
            "username": settings.INITIAL_ADMIN_USERNAME,
            "password": settings.INITIAL_ADMIN_PASSWORD,
        }
    )
    assert admin_login_resp.status_code == 200, f"Admin login failed: {admin_login_resp.text}"
    admin_data = admin_login_resp.json()
    assert "access_token" in admin_data
    assert admin_data["user"]["role"] == "admin"
    assert "hashed_password" not in admin_data["user"]
    admin_token = admin_data["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    log("Admin Login 200 OK — JWT received with role 'admin' (password hash excluded)")

    # 5. Regular User Login
    user_login_resp = client.post(
        "/auth/login",
        json={
            "username": "e2e_shopper",
            "password": user_pwd,
        }
    )
    assert user_login_resp.status_code == 200, f"User login failed: {user_login_resp.text}"
    user_data = user_login_resp.json()
    assert "access_token" in user_data
    assert user_data["user"]["role"] == "user"
    user_token = user_data["access_token"]
    user_headers = {"Authorization": f"Bearer {user_token}"}
    log("Regular User Login 200 OK — JWT received with role 'user'")

    # 6. Invalid credentials check
    bad_login_resp = client.post(
        "/auth/login",
        json={"username": "admin", "password": "WrongPassword999!"}
    )
    assert bad_login_resp.status_code == 401
    log("Invalid credentials rejected with HTTP 401 Unauthorized")

    # 7. GET /auth/me profile verification
    me_resp = client.get("/auth/me", headers=admin_headers)
    assert me_resp.status_code == 200
    assert me_resp.json()["username"] == settings.INITIAL_ADMIN_USERNAME
    log(f"Profile /auth/me 200 OK for {me_resp.json()['username']}")

    # 8. Admin Creates a Product
    test_product_payload = {
        "name": "E2E Organic Honey",
        "category": "Grocery",
        "rate": "249.50",
        "unit": "bottle",
        "description": "Pure wild organic honey from test farm",
        "is_active": True,
    }
    create_resp = client.post("/products", json=test_product_payload, headers=admin_headers)
    assert create_resp.status_code == 201, f"Create failed: {create_resp.text}"
    created_product = create_resp.json()
    product_id = created_product["id"]
    assert created_product["name"] == "E2E Organic Honey"
    assert Decimal(str(created_product["rate"])) == Decimal("249.50")
    log(f"Admin Product Creation 201 OK: '{created_product['name']}' (ID: {product_id})")

    # 9. Regular User Views Products & Searches
    list_resp = client.get("/products?search=Honey", headers=user_headers)
    assert list_resp.status_code == 200
    items = list_resp.json()
    assert any(p["id"] == product_id for p in items)
    log(f"Regular User Search 200 OK — found '{created_product['name']}'")

    # 10. Admin Updates Rate
    update_rate_resp = client.put(
        f"/products/{product_id}",
        json={"rate": "279.00"},
        headers=admin_headers
    )
    assert update_rate_resp.status_code == 200
    assert Decimal(str(update_rate_resp.json()["rate"])) == Decimal("279.00")
    log(f"Admin Rate Update 200 OK — new price ₹279.00 / {created_product['unit']}")

    # 11. Admin Updates Category and Description
    update_desc_resp = client.put(
        f"/products/{product_id}",
        json={"category": "Organic Essentials", "description": "Raw unpasteurized forest honey"},
        headers=admin_headers
    )
    assert update_desc_resp.status_code == 200
    assert update_desc_resp.json()["category"] == "Organic Essentials"
    log("Admin Category & Description Update 200 OK")

    # 12. Security Test: Regular User attempts Admin Actions (Must return 403 Forbidden)
    unauthorized_create = client.post(
        "/products",
        json={"name": "Hacked Product", "rate": "1.00", "unit": "piece"},
        headers=user_headers
    )
    assert unauthorized_create.status_code == 403, "User should be forbidden from creating products"

    unauthorized_update = client.put(
        f"/products/{product_id}",
        json={"rate": "0.01"},
        headers=user_headers
    )
    assert unauthorized_update.status_code == 403, "User should be forbidden from updating products"

    unauthorized_delete = client.delete(
        f"/products/{product_id}",
        headers=user_headers
    )
    assert unauthorized_delete.status_code == 403, "User should be forbidden from deleting products"
    log("Security Check Passed: Regular User rejected with HTTP 403 Forbidden on create, update, and delete")

    # 13. Inactive Product Visibility Check
    client.put(f"/products/{product_id}", json={"is_active": False}, headers=admin_headers)
    user_list_inactive = client.get("/products", headers=user_headers).json()
    assert not any(p["id"] == product_id for p in user_list_inactive), "Inactive product must not be visible to user"

    user_detail_inactive = client.get(f"/products/{product_id}", headers=user_headers)
    assert user_detail_inactive.status_code == 404, "Inactive product should return 404 for regular user"

    admin_detail_inactive = client.get(f"/products/{product_id}", headers=admin_headers)
    assert admin_detail_inactive.status_code == 200, "Admin must be able to view inactive product"
    log("Visibility Check Passed: Inactive product hidden from User (404), visible to Admin (200)")

    # 14. Admin Deletes the Test Product
    delete_resp = client.delete(f"/products/{product_id}", headers=admin_headers)
    assert delete_resp.status_code == 200
    log(f"Admin Delete 200 OK: Product ID {product_id} deleted successfully")

    # Verify 404 on deleted product
    verify_deleted = client.get(f"/products/{product_id}", headers=admin_headers)
    assert verify_deleted.status_code == 404
    log("Product deletion confirmed (subsequent GET returns HTTP 404 Not Found)")

    # 15. Clean up temporary test user
    db = SessionLocal()
    try:
        db.query(User).filter(User.username == "e2e_shopper").delete()
        db.commit()
        log("Test user cleaned up safely from PostgreSQL")
    finally:
        db.close()

    print("=" * 60)
    print("ALL LIVE END-TO-END VERIFICATION CHECKS PASSED SUCCESSFULLY!")
    print("=" * 60)


if __name__ == "__main__":
    try:
        run_e2e_verification()
    except Exception as e:
        print(f"Error during E2E verification: {e}", file=sys.stderr)
        sys.exit(1)
