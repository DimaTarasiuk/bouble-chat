#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"

migration_url="${DATABASE_MIGRATION_URL:-$DATABASE_URL}"

echo "Applying database migrations..."
/app/goose -dir /app/migrations postgres "$migration_url" up

echo "Starting chat server..."
exec /app/server
