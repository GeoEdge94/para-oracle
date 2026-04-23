#!/usr/bin/env sh
# Backend entrypoint — runs pending migrations then starts uvicorn.
#
# On a fresh DB, Postgres auto-applies /docker-entrypoint-initdb.d/*.sql
# BEFORE this script runs, so the schema is already there. Alembic then
# stamps baseline and applies any newer revisions (noop for baseline).
#
# On an existing DB that hasn't been alembic-stamped yet, we stamp it to
# baseline before applying further revisions. This is idempotent.
set -e

export PYTHONPATH="/app:${PYTHONPATH}"

# Wait for DB (in case container starts faster than Postgres)
if [ -n "$DATABASE_URL" ] || [ "$POSTGRES_HOST" ] || true; then
  python - <<'PY'
import os, time
import psycopg2
for i in range(30):
    try:
        psycopg2.connect(
            dbname=os.getenv("POSTGRES_DB", "paraoracle"),
            user=os.getenv("POSTGRES_USER", "paraoracle"),
            password=os.getenv("POSTGRES_PASSWORD", "paraoracle_dev"),
            host="db",
            port=5432,
            connect_timeout=3,
        ).close()
        print("DB reachable")
        break
    except Exception as e:
        print(f"Waiting for DB ({i+1}/30): {e}")
        time.sleep(2)
else:
    raise SystemExit("DB unreachable after 60s")
PY
fi

# If the DB has tables but no alembic_version row, assume it's a legacy install
# from the SQL init scripts and stamp it to baseline.
python - <<'PY' || true
import os, sys
sys.path.insert(0, "/app")
from sqlalchemy import create_engine, text
from app.core.config import settings
engine = create_engine(settings.DATABASE_URL)
with engine.connect() as c:
    has_bets = c.execute(text("SELECT to_regclass('public.bets') IS NOT NULL")).scalar()
    has_alembic = c.execute(text("SELECT to_regclass('public.alembic_version') IS NOT NULL")).scalar()
    if has_bets and not has_alembic:
        print("Legacy schema detected, stamping baseline")
        import subprocess
        subprocess.check_call(["alembic", "stamp", "0001_baseline"])
    else:
        print(f"bets={has_bets} alembic_version={has_alembic}")
PY

# Apply any pending migrations
alembic upgrade head

# Start the app
exec "$@"
