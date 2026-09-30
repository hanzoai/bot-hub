#!/bin/sh
set -e

echo "Bot Hub starting..."

# Hanzo Base, on loopback: only the API beside it talks to it. Its address is
# fixed rather than read from BASE_PORT, because Kubernetes writes
# BASE_PORT=tcp://<ip>:<port> into every pod of a namespace holding a Service
# named base, and a port read from it is no port at all.
echo "Starting Base on 127.0.0.1:8090..."
base serve \
  --http 127.0.0.1:8090 \
  --dir /app/data \
  --migrationsDir /app/hz_migrations &
BASE_PID=$!

# The API reaches Base at http://127.0.0.1:8090 (api/src/lib/env.ts).
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
kill $BASE_PID $API_PID $WEB_PID 2>/dev/null || true
exit $EXIT_CODE
