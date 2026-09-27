"""Alembic environment: uses the connection handed over by backend.migrate, else the app engine."""
from alembic import context

from backend.db import Base, engine

target_metadata = Base.metadata


def _run(connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata,
                      render_as_batch=connection.dialect.name == "sqlite", compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


conn = context.config.attributes.get("connection")
if conn is not None:
    _run(conn)
else:
    with engine.begin() as c:
        _run(c)
