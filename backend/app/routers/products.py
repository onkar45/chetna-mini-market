from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session
from app.core.permissions import get_current_user, require_admin
from app.core.storage import upload_product_image, delete_product_image
from app.database import get_db
from app.models.user import User
from app.models.product import Product
from app.schemas.product import ProductCreate, ProductUpdate, ProductResponse

router = APIRouter(prefix="/products", tags=["Products"])


@router.get("", response_model=List[ProductResponse], summary="List products with search, category, and pagination")
def list_products(
    search: Optional[str] = Query(None, description="Case-insensitive search by product name"),
    category: Optional[str] = Query(None, description="Filter products by exact or case-insensitive category"),
    is_active: Optional[bool] = Query(None, description="Filter active/inactive items (Admin only)"),
    skip: int = Query(0, ge=0, description="Items to skip for pagination"),
    limit: int = Query(50, ge=1, le=100, description="Maximum items to return"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve products for authenticated users.
    
    - Regular Users see ONLY active products (`is_active=True`).
    - Admins see all products by default, or can explicitly filter by active status.
    - Supports search by product name and category filtering.
    """
    query = db.query(Product)

    # Enforce role-based visibility: Regular users can only see active products
    if current_user.role != "admin":
        query = query.filter(Product.is_active.is_(True))
    elif is_active is not None:
        query = query.filter(Product.is_active == is_active)

    # Search filter (case-insensitive)
    if search and search.strip():
        query = query.filter(Product.name.ilike(f"%{search.strip()}%"))

    # Category filter (case-insensitive)
    if category and category.strip():
        query = query.filter(Product.category.ilike(category.strip()))

    # Order products alphabetically by name, then apply pagination
    products = query.order_by(Product.name.asc()).offset(skip).limit(limit).all()
    return products


@router.get("/{product_id}", response_model=ProductResponse, summary="Get single product details by ID")
def get_product(
    product_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve details of a specific product.
    
    - Returns 404 if product does not exist.
    - Regular Users receive 404 for inactive products to prevent unauthorized discovery.
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    # Inactive products are hidden from regular users
    if current_user.role != "admin" and not product.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    return product


@router.post(
    "/upload-image",
    summary="Upload product image (Admin only)",
    status_code=status.HTTP_201_CREATED,
)
async def upload_image(
    file: UploadFile = File(...),
    current_user: User = Depends(require_admin),
):
    """Upload a product photo. Validates MIME type and file size, uploads to Cloudinary or local storage."""
    return await upload_product_image(file)


@router.post(
    "",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new product (Admin only)"
)
def create_product(
    product_in: ProductCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Create a new product record. Accessible by Administrator only."""
    new_product = Product(
        name=product_in.name,
        category=product_in.category,
        rate=product_in.rate,
        unit=product_in.unit,
        description=product_in.description,
        image_url=product_in.image_url,
        image_public_id=product_in.image_public_id,
        is_active=product_in.is_active,
    )
    db.add(new_product)
    db.commit()
    db.refresh(new_product)
    return new_product


@router.put("/{product_id}", response_model=ProductResponse, summary="Update an existing product (Admin only)")
def update_product(
    product_id: int,
    product_in: ProductUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Update product details or rates. Accessible by Administrator only."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    update_data = product_in.model_dump(exclude_unset=True)
    
    # If image asset is being replaced or explicitly removed, delete the old image asset
    old_public_id = product.image_public_id
    if "image_public_id" in update_data:
        new_public_id = update_data["image_public_id"]
        if old_public_id and old_public_id != new_public_id:
            delete_product_image(old_public_id)

    for field, value in update_data.items():
        setattr(product, field, value)

    # Explicitly update timestamp
    product.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(product)
    return product


@router.delete("/{product_id}", summary="Delete a product (Admin only)")
def delete_product(
    product_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Delete a product from inventory. Accessible by Administrator only."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found",
        )

    old_public_id = product.image_public_id
    db.delete(product)
    db.commit()

    if old_public_id:
        delete_product_image(old_public_id)

    return {"message": "Product deleted successfully", "id": product_id}
