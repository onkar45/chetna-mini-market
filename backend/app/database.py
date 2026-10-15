import logging
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings

logger = logging.getLogger(__name__)

# Enforce PostgreSQL for production/development; allow SQLite for automated testing environments
is_postgres = settings.DATABASE_URL.startswith("postgresql://") or settings.DATABASE_URL.startswith("postgresql+psycopg2://")
is_sqlite = settings.DATABASE_URL.startswith("sqlite")

if not (is_postgres or is_sqlite):
    raise ValueError(
        f"Invalid database dialect in DATABASE_URL: {settings.DATABASE_URL.split('://')[0]}. "
        "PostgreSQL is required (e.g., postgresql://user:pass@host:5432/dbname)."
    )

# Connection arguments & pool configuration
connect_args = {}
if is_sqlite:
    connect_args["check_same_thread"] = False
elif "neon.tech" in settings.DATABASE_URL or "sslmode=require" in settings.DATABASE_URL:
    connect_args["sslmode"] = "require"

if is_sqlite:
    from sqlalchemy.pool import StaticPool
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args=connect_args,
        poolclass=StaticPool,
    )
else:
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args=connect_args,
        pool_pre_ping=True,      # Tests connection liveness, vital for serverless/cold starts
        pool_size=5,             # Conservative connection pooling for free-tier limits
        max_overflow=10,
        pool_recycle=300,        # Recycle idle connections every 5 minutes
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that provides a SQLAlchemy session with guaranteed cleanup."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
