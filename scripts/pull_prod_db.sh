#!/usr/bin/env bash
# pull_prod_db.sh — dump prod Postgres, restore into local dev DB
# Fill in the ALL_CAPS placeholders before running.
# Usage: ./scripts/pull_prod_db.sh

set -euo pipefail

# ── Fill these in ────────────────────────────────────────────────────────────
PROD_DB_URL="postgresql://USER:PASSWORD@HOST:PORT/DBNAME"   # Render internal DB URL
LOCAL_DB_URL="postgresql://USER:PASSWORD@localhost:5432/photoblog"
# ─────────────────────────────────────────────────────────────────────────────

DUMP_FILE="/tmp/prod_dump_$(date +%Y%m%d_%H%M%S).sql"

echo "→ Dumping prod database..."
pg_dump "$PROD_DB_URL" \
  --data-only \
  --no-owner \
  --no-privileges \
  --exclude-table=django_migrations \
  -f "$DUMP_FILE"

echo "→ Dump written to $DUMP_FILE"

echo "→ Truncating local tables (preserving schema and migrations)..."
psql "$LOCAL_DB_URL" -c "
  DO \$\$
  DECLARE
    r RECORD;
  BEGIN
    FOR r IN
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename != 'django_migrations'
    LOOP
      EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
  END \$\$;
"

echo "→ Restoring prod data into local DB..."
psql "$LOCAL_DB_URL" -f "$DUMP_FILE"

echo "→ Scrubbing OTP requests (prod auth data not needed locally)..."
psql "$LOCAL_DB_URL" -c "
  DELETE FROM blog_otprequest;
"

echo "→ Cleaning up dump file..."
rm "$DUMP_FILE"

echo "✓ Done. Local DB now mirrors prod (OTP requests scrubbed)."
