#!/usr/bin/env python3
"""Apply the SQL schema, functions, procedures, triggers, views and indexes.

The app talks to PostgreSQL through hand-written SQL (there are no Django
migrations), so a fresh database - e.g. a new Supabase project - must be
initialised with this script before first use.

The script is idempotent: every table uses CREATE TABLE IF NOT EXISTS and every
function / procedure / trigger / view is dropped-and-recreated, so it is also the
way to ROLL OUT SQL FIXES to an existing database (no data is touched). Take a
database backup first, and run it with --dry-run once to check it applies cleanly.

Usage (from BACKEND/, with DB_* variables set in .env or the environment):
    python scripts/setup_database.py            # apply everything
    python scripts/setup_database.py --dry-run  # run it all, then roll back
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import psycopg2
from decouple import RepositoryEnv, config

BACKEND_DIR = Path(__file__).resolve().parent.parent
SQL_DIR = BACKEND_DIR / "sql"

# Like core_buetians/settings.py: values in BACKEND/.env win over stale
# variables that may already exist in the shell environment.
_ENV_FILE = BACKEND_DIR / ".env"
_file_env = RepositoryEnv(str(_ENV_FILE)) if _ENV_FILE.exists() else None


def setting(key: str, default=None):
    if _file_env is not None and key in _file_env:
        return _file_env[key]
    return config(key, default=default)

# Order matters: tables first, then the objects that reference them.
SQL_FILES = [
    "DB_SCHEMA.sql",
    "functions/functions.sql",
    "functions/post_functions.sql",
    "functions/group_functions.sql",
    "functions/marketplace_functions.sql",
    "functions/forum_functions.sql",
    "procedures/procedures.sql",
    "triggers/triggers.sql",
    "views/views.sql",
    "indexes.sql",
]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="roll back instead of committing")
    args = parser.parse_args()

    conn = psycopg2.connect(
        dbname=setting("DB_NAME"),
        user=setting("DB_USER"),
        password=setting("DB_PASSWORD"),
        host=setting("DB_HOST"),
        port=setting("DB_PORT"),
        sslmode=setting("DB_SSLMODE", "prefer"),
    )
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            for name in SQL_FILES:
                path = SQL_DIR / name
                print(f"applying {name} ...", flush=True)
                # utf-8-sig: some of the SQL files start with a BOM
                cur.execute(path.read_text(encoding="utf-8-sig"))
        if args.dry_run:
            conn.rollback()
            print("dry run OK - rolled back")
        else:
            conn.commit()
            print("database initialised")
    except Exception as exc:  # noqa: BLE001
        conn.rollback()
        print(f"FAILED: {exc}", file=sys.stderr)
        return 1
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
