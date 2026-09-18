import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://contextguard:contextguard@localhost:5432/contextguard")

# Normalize postgres:// to postgresql:// if needed
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False
    # Ensure directory exists if SQLite file path is provided
    if ":///" in DATABASE_URL:
        db_path = DATABASE_URL.split(":///")[-1]
        db_dir = os.path.dirname(db_path)
        if db_dir:
            os.makedirs(db_dir, exist_ok=True)

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Dependency that yields a database session and ensures clean closure."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Creates all database tables defined in models."""
    from models import AccessAuditLog, User, ChallengeSession, LoginHistory  # noqa: F401
    Base.metadata.create_all(bind=engine)



def record_evaluation(result):
    """Persists an evaluation result."""
    from app.db.database import record_evaluation as _rec
    return _rec(result)


def query_audit_logs(*args, **kwargs):
    """Queries audit logs."""
    from app.db.database import query_audit_logs as _q
    return _q(*args, **kwargs)