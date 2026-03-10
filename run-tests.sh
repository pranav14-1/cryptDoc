#!/bin/bash
echo "Starting Server..."
npx tsx src/index.ts > server.log 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

echo "Waiting for server to start..."
sleep 3

echo "Running Tests..."
npx tsx scripts/test-lifecycle.ts > test.log 2>&1
TEST_EXIT=$?

echo "Test Exit Code: $TEST_EXIT"

echo "Killing Server..."
kill -9 $SERVER_PID

echo "Server Log:"
cat server.log

echo "Test Log:"
cat test.log

exit $TEST_EXIT
