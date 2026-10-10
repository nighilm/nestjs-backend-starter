#!/bin/sh

set -eu

echo "📦 Applying Prisma migrations..."

npx prisma migrate deploy

echo "✅ Prisma migrations completed successfully."

echo "🚀 Starting application..."

exec "$@"
