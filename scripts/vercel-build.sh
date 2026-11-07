#!/usr/bin/env bash
# Build used by Vercel: apply migrations and load medicines when a database is connected.
set -euo pipefail
if [ -n "${DATABASE_URL:-}" ]; then
  npx drizzle-kit migrate
  npx tsx scripts/import-medicines.ts
else
  echo "DATABASE_URL is not set: skipping migrations. Connect a Postgres database in Vercel and redeploy."
fi
npx next build
