"""Schema migrations (Alembic), run programmatically at startup and by ``python -m backend.migrate``.

Databases created before Alembic (``create_all`` era, schema == revision 0001) are stamped at 0001 first,
then upgraded, so existing SQLite files keep their data."""
from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect
from sqlalchemy.engine import Engine

HERE = Path(__file__).resolve().parent
BASELINE = "0001_baseline"


def _config(connection=None) -> Config:
    cfg = Config()
    cfg.set_main_option("script_location", str(HERE / "migrations"))
    if connection is not None:
        cfg.attributes["connection"] = connection
    return cfg


def upgrade(engine: Engine, revision: str = "head") -> None:
    with engine.begin() as conn:
        tables = set(inspect(conn).get_table_names())
        cfg = _config(conn)
        if "alembic_version" not in tables and "users" in tables:
            command.stamp(cfg, BASELINE)
        command.upgrade(cfg, revision)


if __name__ == "__main__":
    from .db import engine
    upgrade(engine)
    print("database at head")
