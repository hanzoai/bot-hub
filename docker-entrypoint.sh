#!/bin/sh
set -e

echo "Bot Hub starting..."

# Run database migrations if DATABASE_URL is set
if [ -n "$DATABASE_URL" ]; then
  echo "Running database migrations..."
  cd /app/api && npx drizzle-kit migrate 2>&1 || echo "Migration skipped or failed"
  cd /app
fi

# Start API server (background)
echo "Starting API server on port ${PORT:-3001}..."
node /app/api/dist/index.js &
API_PID=$!

# Start web server (foreground)
echo "Starting web server on port ${WEB_PORT:-3000}..."
node /app/.output/server/index.mjs &
WEB_PID=$!

# Wait for either to exit
wait -n $API_PID $WEB_PID
EXIT_CODE=$?

# Kill remaining
kill $API_PID $WEB_PID 2>/dev/null || true
exit $EXIT_CODE
