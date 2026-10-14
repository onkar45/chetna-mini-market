from decimal import Decimal
import pytest
from sqlalchemy.exc import IntegrityError
from alembic.config import Config
from alembic.script import ScriptDirectory
from alembic.runtime.migration import MigrationContext

from app.core.config import settings
from app.database import engine, get_db
from app.models.user import User
from app.models.product import Product


def test_database_configuration():
    """Verify settings loads properly and points to a PostgreSQL connection."""
    assert settings.DATABASE_URL.startswith("postgresql://") or settings.DATABASE_URL.startswith("postgresql+psycopg2://")
    with engine.connect() as conn:
        result = conn.exec_driver_sql("SELECT 1").scalar()
        assert result == 1


def test_get_db_dependency():
    """Verify get_db generator yields a functional session and closes on exit."""
    db_gen = get_db()
    session = next(db_gen)
    try:
        assert session is not None
        result = session.execute(User.__table__.select()).all()
        assert isinstance(result, list)
    finally:
        try:
            next(db_gen)
        except StopIteration:
            pass


def test_create_and_query_user(db_session):
    """Verify User model can be created and queried."""
    user = User(
        username="shopkeeper_test",
        hashed_password="fake_hashed_password_123",
        role="admin",
        is_active=True,
    )
    db_session.add(user)
    db_session.flush()

    assert user.id is not None
    assert user.created_at is not None

    queried = db_session.query(User).filter_by(username="shopkeeper_test").first()
    assert queried is not None
    assert queried.role == "admin"


def test_user_uniqueness_constraint(db_session):
    """Verify username uniqueness constraint is enforced."""
    user1 = User(
        username="duplicate_user",
        hashed_password="hash1",
        role="user",
    )
    db_session.add(user1)
    db_session.flush()

    user2 = User(
        username="duplicate_user",
        hashed_password="hash2",
        role="user",
    )
    db_session.add(user2)
    with pytest.raises(IntegrityError):
        db_session.flush()
    db_session.rollback()


def test_user_role_constraint(db_session):
    """Verify user role check constraint rejects invalid roles."""
    invalid_user = User(
        username="invalid_role_user",
        hashed_password="hash",
        role="invalid_role",
    )
    db_session.add(invalid_user)
    with pytest.raises(IntegrityError):
        db_session.flush()
    db_session.rollback()


def test_create_and_query_product(db_session):
    """Verify Product model supports Decimal rates and correct fields."""
    product = Product(
        name="Basmati Rice Premium",
        category="Grains",
        rate=Decimal("125.50"),
        unit="kg",
        description="Aged long grain aromatic basmati rice",
        is_active=True,
    )
    db_session.add(product)
    db_session.flush()

    assert product.id is not None
    assert product.created_at is not None
    assert product.updated_at is not None

    queried = db_session.query(Product).filter_by(name="Basmati Rice Premium").first()
    assert queried is not None
    assert queried.rate == Decimal("125.50")
    assert queried.unit == "kg"
    assert queried.category == "Grains"


def test_product_rate_rejects_negative(db_session):
    """Verify check constraint rejects negative product rates."""
    invalid_product = Product(
        name="Negative Rate Item",
        category="General",
        rate=Decimal("-15.00"),
        unit="packet",
    )
    db_session.add(invalid_product)
    with pytest.raises(IntegrityError):
        db_session.flush()
    db_session.rollback()


def test_alembic_migration_validity():
    """Verify Alembic configuration is valid and can locate current revision."""
    alembic_cfg = Config("backend/alembic.ini")
    script = ScriptDirectory.from_config(alembic_cfg)
    heads = script.get_heads()
    assert len(heads) == 1, "There should be exactly one head revision"

    with engine.connect() as conn:
        context = MigrationContext.configure(conn)
        current_rev = context.get_current_revision()
        assert current_rev == heads[0], f"Database revision ({current_rev}) does not match Alembic head ({heads[0]})"
