#!/bin/bash
set -e

echo "Bot Hub starting..."

# Start API server (background)
echo "Starting API server on port ${PORT:-3001}..."
PORT=${PORT:-3001} node /app/api/dist/index.js &
API_PID=$!

# Start web server (Nitro reads PORT for its listen port)
echo "Starting web server on port ${WEB_PORT:-3000}..."
PORT=${WEB_PORT:-3000} node /app/.output/server/index.mjs &
WEB_PID=$!

# Wait for either to exit
wait -n $API_PID $WEB_PID
EXIT_CODE=$?

# Kill remaining
kill $API_PID $WEB_PID 2>/dev/null || true
exit $EXIT_CODE
