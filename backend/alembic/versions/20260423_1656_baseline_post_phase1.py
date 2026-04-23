"""baseline_post_phase1

Marks the starting point of Alembic-managed migrations. The schema prior to
this revision is created by the Postgres init scripts in `db/init/*.sql`
(runs on fresh volumes only). Every future schema change MUST be written as
a new Alembic revision — no more edits to the SQL init scripts.

Pattern:
- Fresh DB : Postgres auto-runs /docker-entrypoint-initdb.d/*.sql, then
            `alembic upgrade head` stamps this baseline (no-op) and applies
            subsequent revisions.
- Existing DB (dev laptops, staging, prod) : `alembic stamp 0001_baseline`
            once, then `alembic upgrade head` for new revisions.

Revision ID: 0001_baseline
Revises:
Create Date: 2026-04-23 16:56:40.542641+00:00
"""
from typing import Sequence, Union

from alembic import op  # noqa: F401
import sqlalchemy as sa  # noqa: F401


revision: str = "0001_baseline"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    No-op: the schema is fully materialized by the SQL init scripts
    (`db/init/01-extensions.sql` through `db/init/05-layers-and-proofs.sql`).
    This baseline exists only to anchor Alembic's revision graph so future
    migrations can `down_revision = '0001_baseline'`.
    """
    pass


def downgrade() -> None:
    """
    Intentionally empty. Going below baseline would require dropping the
    entire app schema, which is out of scope for Alembic and better handled
    by `docker compose down -v`.
    """
    pass
