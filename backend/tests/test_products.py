from decimal import Decimal
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.core.security import hash_password, create_access_token
from app.models.user import User
from app.models.product import Product


@pytest.fixture
def auth_tokens(db_session):
    """Seed test admin and user accounts and generate valid JWT Bearer tokens."""
    admin_user = User(
        username="prod_admin",
        hashed_password=hash_password("admin_pass"),
        role="admin",
        is_active=True,
    )
    regular_user = User(
        username="prod_user",
        hashed_password=hash_password("user_pass"),
        role="user",
        is_active=True,
    )
    db_session.add_all([admin_user, regular_user])
    db_session.flush()

    admin_token = create_access_token(
        data={"sub": str(admin_user.id), "username": admin_user.username, "role": "admin"}
    )
    user_token = create_access_token(
        data={"sub": str(regular_user.id), "username": regular_user.username, "role": "user"}
    )

    return {
        "admin_headers": {"Authorization": f"Bearer {admin_token}"},
        "user_headers": {"Authorization": f"Bearer {user_token}"},
        "admin_user": admin_user,
        "regular_user": regular_user,
    }


@pytest.fixture
def seeded_products(db_session):
    """Seed sample active and inactive products across different categories."""
    p1 = Product(
        name="Tata Salt",
        category="Grocery",
        rate=Decimal("28.00"),
        unit="packet",
        description="Iodized table salt",
        is_active=True,
    )
    p2 = Product(
        name="Basmati Rice",
        category="Grains",
        rate=Decimal("120.00"),
        unit="kg",
        description="Premium long grain",
        is_active=True,
    )
    p3 = Product(
        name="Amul Butter",
        category="Dairy",
        rate=Decimal("56.00"),
        unit="packet",
        description="Pasteurized salted butter",
        is_active=True,
    )
    p4 = Product(
        name="Discontinued Tea",
        category="Beverages",
        rate=Decimal("90.00"),
        unit="packet",
        description="Old brand no longer stocked",
        is_active=False,
    )
    db_session.add_all([p1, p2, p3, p4])
    db_session.flush()
    return [p1, p2, p3, p4]


# 1. Admin can create a product
@pytest.mark.anyio
async def test_admin_create_product(auth_tokens):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "name": "Sugar",
            "category": "Grocery",
            "rate": "45.00",
            "unit": "kg",
            "description": "White sugar",
            "is_active": True,
        }
        response = await client.post("/products", json=payload, headers=auth_tokens["admin_headers"])
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Sugar"
        assert data["category"] == "Grocery"
        assert Decimal(str(data["rate"])) == Decimal("45.00")
        assert data["unit"] == "kg"
        assert data["id"] is not None


# 2. Regular User cannot create a product
@pytest.mark.anyio
async def test_user_cannot_create_product(auth_tokens):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "name": "Unauthorized Sugar",
            "category": "Grocery",
            "rate": "45.00",
            "unit": "kg",
        }
        response = await client.post("/products", json=payload, headers=auth_tokens["user_headers"])
        assert response.status_code == 403
        assert "Admin privileges required" in response.json()["detail"]


# 3. Admin can retrieve products
@pytest.mark.anyio
async def test_admin_can_retrieve_all_products(auth_tokens, seeded_products):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/products", headers=auth_tokens["admin_headers"])
        assert response.status_code == 200
        data = response.json()
        # Admin sees both active and inactive
        names = [item["name"] for item in data]
        assert "Tata Salt" in names
        assert "Discontinued Tea" in names


# 4. Regular User sees only active products
@pytest.mark.anyio
async def test_user_sees_only_active_products(auth_tokens, seeded_products):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/products", headers=auth_tokens["user_headers"])
        assert response.status_code == 200
        data = response.json()
        names = [item["name"] for item in data]
        assert "Tata Salt" in names
        assert "Basmati Rice" in names
        # Inactive product MUST be hidden
        assert "Discontinued Tea" not in names
        for item in data:
            assert item["is_active"] is True


# 5. Admin can update product details and rates
@pytest.mark.anyio
async def test_admin_update_product(auth_tokens, seeded_products):
    salt = seeded_products[0]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        update_payload = {
            "rate": "30.00",
            "description": "Updated iodized salt rate",
        }
        response = await client.put(f"/products/{salt.id}", json=update_payload, headers=auth_tokens["admin_headers"])
        assert response.status_code == 200
        data = response.json()
        assert Decimal(str(data["rate"])) == Decimal("30.00")
        assert data["description"] == "Updated iodized salt rate"
        assert data["name"] == salt.name


# 6. Regular User cannot update products
@pytest.mark.anyio
async def test_user_cannot_update_product(auth_tokens, seeded_products):
    salt = seeded_products[0]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.put(f"/products/{salt.id}", json={"rate": "99.00"}, headers=auth_tokens["user_headers"])
        assert response.status_code == 403


# 7. Admin can delete a product
@pytest.mark.anyio
async def test_admin_delete_product(auth_tokens, seeded_products):
    butter = seeded_products[2]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.delete(f"/products/{butter.id}", headers=auth_tokens["admin_headers"])
        assert response.status_code == 200
        assert response.json()["id"] == butter.id

        # Verify it's gone
        get_resp = await client.get(f"/products/{butter.id}", headers=auth_tokens["admin_headers"])
        assert get_resp.status_code == 404


# 8. Regular User cannot delete products
@pytest.mark.anyio
async def test_user_cannot_delete_product(auth_tokens, seeded_products):
    salt = seeded_products[0]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.delete(f"/products/{salt.id}", headers=auth_tokens["user_headers"])
        assert response.status_code == 403


# 9. Searching by product name works (case-insensitive)
@pytest.mark.anyio
async def test_search_by_product_name(auth_tokens, seeded_products):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/products?search=salt", headers=auth_tokens["admin_headers"])
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert any(item["name"] == "Tata Salt" for item in data)
        assert all("salt" in item["name"].lower() for item in data)


# 10. Category filtering works
@pytest.mark.anyio
async def test_category_filtering(auth_tokens, seeded_products):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/products?category=Dairy", headers=auth_tokens["admin_headers"])
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Amul Butter"
        assert data[0]["category"] == "Dairy"


# 11. Pagination works (skip and limit)
@pytest.mark.anyio
async def test_pagination(auth_tokens, seeded_products):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        page1 = await client.get("/products?skip=0&limit=2", headers=auth_tokens["admin_headers"])
        assert page1.status_code == 200
        assert len(page1.json()) == 2

        page2 = await client.get("/products?skip=2&limit=2", headers=auth_tokens["admin_headers"])
        assert page2.status_code == 200
        assert len(page2.json()) == 2

        names_p1 = [p["name"] for p in page1.json()]
        names_p2 = [p["name"] for p in page2.json()]
        # Disjoint pages
        assert set(names_p1).isdisjoint(set(names_p2))


# 12. Negative rates are rejected
@pytest.mark.anyio
async def test_negative_rates_rejected(auth_tokens):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "name": "Negative Price Oil",
            "category": "Oils",
            "rate": "-10.00",
            "unit": "litre",
        }
        response = await client.post("/products", json=payload, headers=auth_tokens["admin_headers"])
        assert response.status_code == 422


# 13. Missing products return 404
@pytest.mark.anyio
async def test_missing_product_returns_404(auth_tokens):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/products/99999", headers=auth_tokens["admin_headers"])
        assert response.status_code == 404
        assert response.json()["detail"] == "Product not found"


# 14. Unauthenticated requests return 401
@pytest.mark.anyio
async def test_unauthenticated_requests_return_401():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        get_resp = await client.get("/products")
        assert get_resp.status_code == 401

        post_resp = await client.post("/products", json={"name": "Tea", "rate": "50.00", "unit": "kg"})
        assert post_resp.status_code == 401

        put_resp = await client.put("/products/1", json={"rate": "60.00"})
        assert put_resp.status_code == 401

        del_resp = await client.delete("/products/1")
        assert del_resp.status_code == 401


# 15. Product responses contain no sensitive user data
@pytest.mark.anyio
async def test_product_response_contains_no_sensitive_data(auth_tokens, seeded_products):
    salt = seeded_products[0]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(f"/products/{salt.id}", headers=auth_tokens["user_headers"])
        assert response.status_code == 200
        data = response.json()
        assert "password" not in data
        assert "hashed_password" not in data
        assert "user_id" not in data
        assert "token" not in data
        # Ensure correct product contract
        expected_keys = {"id", "name", "category", "rate", "unit", "description", "image_url", "image_public_id", "is_active", "created_at", "updated_at"}
        assert set(data.keys()) == expected_keys


# 16. Admin can successfully upload a valid product image
@pytest.mark.anyio
async def test_admin_upload_image_success(auth_tokens):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 100 bytes sample JPEG payload
        dummy_jpeg = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00" + b"\x00" * 100
        files = {"file": ("test_product.jpg", dummy_jpeg, "image/jpeg")}
        response = await client.post("/products/upload-image", files=files, headers=auth_tokens["admin_headers"])
        assert response.status_code == 201
        data = response.json()
        assert "image_url" in data
        assert "image_public_id" in data
        assert len(data["image_url"]) > 0
        assert len(data["image_public_id"]) > 0


# 17. Regular user is rejected from uploading images
@pytest.mark.anyio
async def test_user_cannot_upload_image(auth_tokens):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        dummy_png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 50
        files = {"file": ("test_product.png", dummy_png, "image/png")}
        response = await client.post("/products/upload-image", files=files, headers=auth_tokens["user_headers"])
        assert response.status_code == 403


# 18. Unauthenticated user upload is rejected with 401
@pytest.mark.anyio
async def test_unauthenticated_cannot_upload_image():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        dummy_png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 50
        files = {"file": ("test_product.png", dummy_png, "image/png")}
        response = await client.post("/products/upload-image", files=files)
        assert response.status_code == 401


# 19. Invalid image mime types are rejected
@pytest.mark.anyio
async def test_upload_invalid_mime_type_rejected(auth_tokens):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        files = {"file": ("document.pdf", b"%PDF-1.4...", "application/pdf")}
        response = await client.post("/products/upload-image", files=files, headers=auth_tokens["admin_headers"])
        assert response.status_code == 400
        assert "Invalid image type" in response.json()["detail"]


# 20. Oversized images (> 15MB) are rejected
@pytest.mark.anyio
async def test_upload_oversized_image_rejected(auth_tokens):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        oversized_data = b"\xff\xd8\xff\xe0" + b"\x00" * (16 * 1024 * 1024)  # 16MB
        files = {"file": ("huge.jpg", oversized_data, "image/jpeg")}
        response = await client.post("/products/upload-image", files=files, headers=auth_tokens["admin_headers"])
        assert response.status_code == 400
        assert "File size exceeds maximum allowed limit" in response.json()["detail"]


# 21. Product creation, editing, and photo removal with image attributes
@pytest.mark.anyio
async def test_product_crud_with_image_and_replacement(auth_tokens):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Create product with image
        payload = {
            "name": "Organic Honey",
            "category": "Organic",
            "rate": "250.00",
            "unit": "bottle",
            "image_url": "https://res.cloudinary.com/demo/image/upload/honey.jpg",
            "image_public_id": "chetna_products/honey_v1",
        }
        create_resp = await client.post("/products", json=payload, headers=auth_tokens["admin_headers"])
        assert create_resp.status_code == 201
        created_data = create_resp.json()
        product_id = created_data["id"]
        assert created_data["image_url"] == payload["image_url"]
        assert created_data["image_public_id"] == payload["image_public_id"]

        # Regular user can view the image URL
        user_get_resp = await client.get(f"/products/{product_id}", headers=auth_tokens["user_headers"])
        assert user_get_resp.status_code == 200
        assert user_get_resp.json()["image_url"] == payload["image_url"]

        # Admin replaces the image
        update_payload = {
            "image_url": "https://res.cloudinary.com/demo/image/upload/honey_v2.jpg",
            "image_public_id": "chetna_products/honey_v2",
        }
        update_resp = await client.put(f"/products/{product_id}", json=update_payload, headers=auth_tokens["admin_headers"])
        assert update_resp.status_code == 200
        assert update_resp.json()["image_url"] == update_payload["image_url"]
        assert update_resp.json()["image_public_id"] == update_payload["image_public_id"]

        # Admin removes the image
        remove_img_payload = {
            "image_url": None,
            "image_public_id": None,
        }
        remove_resp = await client.put(f"/products/{product_id}", json=remove_img_payload, headers=auth_tokens["admin_headers"])
        assert remove_resp.status_code == 200
        assert remove_resp.json()["image_url"] is None
        assert remove_resp.json()["image_public_id"] is None

        # Clean up
        del_resp = await client.delete(f"/products/{product_id}", headers=auth_tokens["admin_headers"])
        assert del_resp.status_code == 200


# 22. Search handles leading and trailing whitespace
@pytest.mark.anyio
async def test_search_handles_whitespace(auth_tokens, seeded_products):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/products?search=  salt  ", headers=auth_tokens["admin_headers"])
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert any(item["name"] == "Tata Salt" for item in data)


# 23. Search matches category names where appropriate
@pytest.mark.anyio
async def test_search_matches_category(auth_tokens, seeded_products):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Searching "Dairy" matches products with category "Dairy" even if "dairy" is not in name
        response = await client.get("/products?search=dairy", headers=auth_tokens["admin_headers"])
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert any(item["name"] == "Amul Butter" for item in data)


# 24. Distinct categories endpoint returns categories and respects active status
@pytest.mark.anyio
async def test_list_categories_endpoint(auth_tokens, seeded_products):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Admin sees categories for both active and inactive items
        admin_resp = await client.get("/products/categories", headers=auth_tokens["admin_headers"])
        assert admin_resp.status_code == 200
        admin_cats = admin_resp.json()
        assert "Grocery" in admin_cats
        assert "Dairy" in admin_cats
        assert "Grains" in admin_cats
        assert "Beverages" in admin_cats  # Discontinued Tea category

        # Regular user only sees categories of active products
        user_resp = await client.get("/products/categories", headers=auth_tokens["user_headers"])
        assert user_resp.status_code == 200
        user_cats = user_resp.json()
        assert "Grocery" in user_cats
        assert "Dairy" in user_cats
        assert "Grains" in user_cats
        assert "Beverages" not in user_cats  # Only inactive product was Beverages


# 25. Category filter with 'All' or 'all' returns all authorized items
@pytest.mark.anyio
async def test_category_all_returns_all_products(auth_tokens, seeded_products):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/products?category=All", headers=auth_tokens["user_headers"])
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3  # All 3 active products


