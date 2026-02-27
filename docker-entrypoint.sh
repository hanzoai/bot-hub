#!/bin/sh
set -e

echo "Bot Hub starting..."

# Start Hanzo Base (serves admin UI + API on :8090)
echo "Starting Base on port ${BASE_PORT:-8090}..."
base serve \
  --http "0.0.0.0:${BASE_PORT:-8090}" \
  --migrationsDir /app/hz_migrations \
  --automigrate \
  --dev="${BASE_DEV:-false}" &
BASE_PID=$!

# Wait for Base to be ready
sleep 2

# Start API server (Hono, talks to Base via SDK)
echo "Starting API server on port ${PORT:-3001}..."
BASE_URL="http://127.0.0.1:${BASE_PORT:-8090}" \
PORT=${PORT:-3001} bun run /app/api/dist/index.js &
API_PID=$!

# Start web server (Nitro reads PORT for its listen port)
echo "Starting web server on port ${WEB_PORT:-3000}..."
PORT=${WEB_PORT:-3000} bun run /app/.output/server/index.mjs &
WEB_PID=$!

# Wait for any child to exit
wait
EXIT_CODE=$?

# Kill remaining
kill $BASE_PID $API_PID $WEB_PID 2>/dev/null || true
exit $EXIT_CODE
