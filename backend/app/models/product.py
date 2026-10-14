from sqlalchemy import Column, Integer, String, Text, Numeric, Boolean, DateTime, CheckConstraint, func
from app.database import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    category = Column(String(100), nullable=True, index=True)
    rate = Column(Numeric(10, 2), nullable=False)
    unit = Column(String(50), nullable=False)  # e.g., kg, gram, litre, ml, packet, piece
    description = Column(Text, nullable=True)
    image_url = Column(String(500), nullable=True)
    image_public_id = Column(String(200), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

    __table_args__ = (
        CheckConstraint("rate >= 0", name="check_product_rate_non_negative"),
    )

    def __repr__(self) -> str:
        return f"<Product id={self.id} name='{self.name}' rate={self.rate}/{self.unit}>"
