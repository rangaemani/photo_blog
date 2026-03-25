#!/usr/bin/env python3
"""
Run manage.py against prod by swapping DATABASE_URL to PROD_DATABASE_URL.
Usage: python scripts/prod_manage.py <command> [args...]
"""

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
BACKEND_ENV = ROOT / "backend" / "photo_blog" / ".env"

# Load backend .env into the environment (provides SECRET_KEY, R2 creds, etc.)
if BACKEND_ENV.exists():
    for line in BACKEND_ENV.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())

# Try env var first, fall back to PROD_DB_URL defined in pull_prod_db.py
prod_url = os.environ.get("PROD_DATABASE_URL")
if not prod_url:
    sys.path.insert(0, str(Path(__file__).parent))
    from pull_prod_db import PROD_DB_URL
    prod_url = PROD_DB_URL

if not prod_url or "USER:PASSWORD" in prod_url:
    sys.exit("ERROR: PROD_DATABASE_URL not set — fill in PROD_DB_URL in scripts/pull_prod_db.py or set the env var.")

env = {**os.environ, "DATABASE_URL": prod_url}
cmd = [sys.executable, "backend/photo_blog/manage.py"] + sys.argv[1:]
sys.exit(subprocess.run(cmd, env=env).returncode)
