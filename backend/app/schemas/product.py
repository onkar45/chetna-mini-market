from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class ProductBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200, description="Product name")
    category: Optional[str] = Field(None, max_length=100, description="Product category (e.g., Grocery, Dairy)")
    rate: Decimal = Field(..., ge=0, decimal_places=2, description="Current rate/selling price (non-negative)")
    unit: str = Field(..., min_length=1, max_length=50, description="Unit of measurement (e.g., kg, litre, packet, piece)")
    description: Optional[str] = Field(None, description="Optional product description")
    image_url: Optional[str] = Field(None, max_length=500, description="Product image URL")
    image_public_id: Optional[str] = Field(None, max_length=200, description="Cloud storage asset identifier")
    is_active: bool = Field(True, description="Whether the product is currently active")

    @field_validator("name")
    @classmethod
    def validate_name_not_empty(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Product name cannot be empty or whitespace only.")
        return stripped

    @field_validator("unit")
    @classmethod
    def validate_unit_not_empty(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("Unit cannot be empty or whitespace only.")
        return stripped


class ProductCreate(ProductBase):
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "Sugar",
                "category": "Grocery",
                "rate": "45.00",
                "unit": "kg",
                "description": "White sugar",
                "is_active": True,
            }
        }
    )


class ProductUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    category: Optional[str] = Field(None, max_length=100)
    rate: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    unit: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = None
    image_url: Optional[str] = Field(None, max_length=500)
    image_public_id: Optional[str] = Field(None, max_length=200)
    is_active: Optional[bool] = None

    @field_validator("name")
    @classmethod
    def validate_name_not_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            stripped = v.strip()
            if not stripped:
                raise ValueError("Product name cannot be empty or whitespace only.")
            return stripped
        return v

    @field_validator("unit")
    @classmethod
    def validate_unit_not_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            stripped = v.strip()
            if not stripped:
                raise ValueError("Unit cannot be empty or whitespace only.")
            return stripped
        return v

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "name": "Sugar (Refined)",
                "category": "Grocery",
                "rate": "48.00",
                "unit": "kg",
                "description": "Pure refined white crystal sugar",
                "is_active": True,
            }
        }
    )


class ProductResponse(BaseModel):
    id: int
    name: str
    category: Optional[str] = None
    rate: Decimal
    unit: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    image_public_id: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": 1,
                "name": "Sugar",
                "category": "Grocery",
                "rate": "45.00",
                "unit": "kg",
                "description": "White sugar",
                "is_active": True,
                "created_at": "2026-10-14T19:57:23Z",
                "updated_at": "2026-10-14T19:57:23Z",
            }
        }
    )
