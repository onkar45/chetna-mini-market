import os
import pytest
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool
from app.main import app
from app.database import get_db, Base
import app.database as app_db

# Use in-memory SQLite for fast, isolated, reliable automated test runs
TEST_DB_URL = os.environ.get("TEST_DATABASE_URL", "sqlite:///:memory:")

test_engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False} if "sqlite" in TEST_DB_URL else {},
    poolclass=StaticPool if "sqlite" in TEST_DB_URL else None,
)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    """Ensure database schema is created before running tests."""
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    """Provides an isolated database session that cleanly rolls back changes,
    and overrides FastAPI get_db dependency during tests."""
    connection = test_engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection)

    def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db

    yield session

    app.dependency_overrides.pop(get_db, None)
    session.close()
    if transaction.is_active:
        transaction.rollback()
    connection.close()
