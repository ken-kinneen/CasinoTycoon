#!/bin/bash
# starts the preview server, runs a test script, stops the server
cd "$(dirname "$0")/.."
npx vite preview --port 4173 --strictPort > /tmp/preview.log 2>&1 &
PID=$!
for i in $(seq 1 30); do curl -s -o /dev/null http://localhost:4173/ && break; sleep 0.5; done
node "$1"
RC=$?
kill $PID 2>/dev/null
exit $RC
