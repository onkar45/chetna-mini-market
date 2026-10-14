import pytest
from typing import Generator
from sqlalchemy.orm import Session
from app.main import app
from app.database import engine, get_db
from app.models import Base


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    """Ensure database schema is created before running tests."""
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture
def db_session() -> Generator[Session, None, None]:
    """Provides an isolated database session that cleanly rolls back changes,
    and overrides FastAPI get_db dependency during tests."""
    connection = engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection)

    # Override get_db for FastAPI tests
    def override_get_db():
        yield session

    app.dependency_overrides[get_db] = override_get_db

    yield session

    app.dependency_overrides.pop(get_db, None)
    session.close()
    if transaction.is_active:
        transaction.rollback()
    connection.close()
