#!/bin/sh
set -e

echo "Bot Hub starting..."

# Start API server (background)
echo "Starting API server on port ${PORT:-3001}..."
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
kill $API_PID $WEB_PID 2>/dev/null || true
exit $EXIT_CODE
