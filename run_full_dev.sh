#!/bin/bash
echo "Starting Start Ichi Full Development Environment..."
echo

echo "Starting Flask backend in background..."
./run_dev.sh &
FLASK_PID=$!

export START_ICHI_PASSWORD=admin
export FLASK_SECRET_KEY=dev

echo "Starting React frontend..."
./run_react_dev.sh

# When React process is terminated, kill the Flask process
kill $FLASK_PID 