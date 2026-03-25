#!/usr/bin/env python3
"""
pull_prod_db.py — dump prod Postgres, restore into local dev DB.
Fill in the ALL_CAPS placeholders before running.
Usage: python scripts/pull_prod_db.py
"""

import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path

# ── Fill these in ─────────────────────────────────────────────────────────────
PROD_DB_URL  = "postgresql://USER:PASSWORD@HOST:PORT/DBNAME"  # Render external URL
LOCAL_DB_URL = "postgresql://photoblog_user:pick_a_password@localhost:5432/photoblog"
# ──────────────────────────────────────────────────────────────────────────────

# On Windows, pg_dump/psql may not be in PATH — search common install locations.
def _find_pg_bin(exe: str) -> str:
    if sys.platform != "win32":
        return exe
    pg_root = Path("C:/Program Files/PostgreSQL")
    if pg_root.exists():
        candidates = sorted(pg_root.iterdir(), reverse=True)  # newest version first
        for version_dir in candidates:
            candidate = version_dir / "bin" / exe
            if candidate.exists():
                return str(candidate)
    return exe  # fall back to PATH

PG_DUMP = _find_pg_bin("pg_dump.exe" if sys.platform == "win32" else "pg_dump")
PSQL    = _find_pg_bin("psql.exe"    if sys.platform == "win32" else "psql")


def run(cmd: list[str], **kwargs) -> None:
    result = subprocess.run(cmd, **kwargs)
    if result.returncode != 0:
        sys.exit(result.returncode)


def psql(db_url: str, sql: str) -> None:
    run([PSQL, db_url, "-c", sql])


def main() -> None:
    if "USER:PASSWORD" in PROD_DB_URL or "USER:PASSWORD" in LOCAL_DB_URL:
        print("ERROR: Fill in PROD_DB_URL and LOCAL_DB_URL before running.")
        sys.exit(1)

    dump_file = Path(tempfile.gettempdir()) / f"prod_dump_{datetime.now():%Y%m%d_%H%M%S}.sql"

    print("-> Dumping prod database...")
    run([
        PG_DUMP, PROD_DB_URL,
        "--data-only",
        "--no-owner",
        "--no-privileges",
        "--exclude-table=django_migrations",
        "-f", str(dump_file),
    ])
    print(f"-> Dump written to {dump_file}")

    print("-> Truncating local tables (preserving schema and migrations)...")
    psql(LOCAL_DB_URL, """
        DO $$
        DECLARE r RECORD;
        BEGIN
          FOR r IN
            SELECT tablename FROM pg_tables
            WHERE schemaname = 'public'
              AND tablename != 'django_migrations'
          LOOP
            EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
          END LOOP;
        END $$;
    """)

    print("-> Restoring prod data into local DB...")
    run([PSQL, LOCAL_DB_URL, "-f", str(dump_file)])

    print("-> Scrubbing OTP requests...")
    psql(LOCAL_DB_URL, "DELETE FROM blog_otprequest;")

    print("-> Cleaning up dump file...")
    dump_file.unlink()

    print("Done. Local DB now mirrors prod (OTP requests scrubbed).")


if __name__ == "__main__":
    main()
