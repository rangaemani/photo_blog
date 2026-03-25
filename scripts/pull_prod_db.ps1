# pull_prod_db.ps1 — dump prod Postgres, restore into local dev DB
# Fill in the ALL_CAPS placeholders before running.
# Usage: powershell -ExecutionPolicy Bypass -File scripts\pull_prod_db.ps1

$ErrorActionPreference = "Stop"

# ── Fill these in ────────────────────────────────────────────────────────────
$PROD_DB_URL  = "postgresql://USER:PASSWORD@HOST:PORT/DBNAME"  # Render external URL
$LOCAL_DB_URL = "postgresql://USER:PASSWORD@localhost:5432/photoblog"
# ─────────────────────────────────────────────────────────────────────────────

$DUMP_FILE = "$env:TEMP\prod_dump_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"

Write-Host "-> Dumping prod database..."
pg_dump $PROD_DB_URL `
  --data-only `
  --no-owner `
  --no-privileges `
  --exclude-table=django_migrations `
  -f $DUMP_FILE

Write-Host "-> Dump written to $DUMP_FILE"

Write-Host "-> Truncating local tables (preserving schema and migrations)..."
psql $LOCAL_DB_URL -c @"
DO `$`$
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
END `$`$;
"@

Write-Host "-> Restoring prod data into local DB..."
psql $LOCAL_DB_URL -f $DUMP_FILE

Write-Host "-> Scrubbing OTP requests..."
psql $LOCAL_DB_URL -c "DELETE FROM blog_otprequest;"

Write-Host "-> Cleaning up dump file..."
Remove-Item $DUMP_FILE

Write-Host "Done. Local DB now mirrors prod (OTP requests scrubbed)."
