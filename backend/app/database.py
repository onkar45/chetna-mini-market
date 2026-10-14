import logging
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings

logger = logging.getLogger(__name__)

# Enforce PostgreSQL - do not silently fall back
if not (settings.DATABASE_URL.startswith("postgresql://") or settings.DATABASE_URL.startswith("postgresql+psycopg2://")):
    raise ValueError(
        f"Invalid database dialect in DATABASE_URL: {settings.DATABASE_URL.split('://')[0]}. "
        "PostgreSQL is required (e.g., postgresql://user:pass@host:5432/dbname)."
    )

# Connection arguments & pool configuration
connect_args = {}
# For hosted PostgreSQL such as Neon, ensure sslmode is configured if required
if "neon.tech" in settings.DATABASE_URL or "sslmode=require" in settings.DATABASE_URL:
    connect_args["sslmode"] = "require"

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
