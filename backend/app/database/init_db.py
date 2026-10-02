"""Create every table and the reference data (roles + permissions).

    python -m app.database.init_db            # create missing tables, seed roles/permissions
    python -m app.database.init_db --reset    # DROP everything first (development only!)
"""
import argparse

from sqlalchemy import text

import app.models  # noqa: F401  (registers all tables)
from app.core.config import get_settings
from app.database.base import Base
from app.database.connection import SessionLocal, engine
from app.services.bootstrap import seed_roles_and_permissions


def create_schema(reset: bool = False) -> None:
    if reset:
        if get_settings().is_production:
            raise SystemExit("Refusing to --reset in production.")
        with engine.begin() as conn:
            conn.execute(text("SET FOREIGN_KEY_CHECKS=0"))
            Base.metadata.drop_all(conn)
            conn.execute(text("SET FOREIGN_KEY_CHECKS=1"))
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed_roles_and_permissions(db)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--reset", action="store_true", help="drop all tables first (development only)")
    args = parser.parse_args()
    create_schema(reset=args.reset)
    print(f"Database '{engine.url.database}' ready ({len(Base.metadata.tables)} tables, roles and permissions seeded).")
