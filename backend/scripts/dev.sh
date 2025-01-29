#!/bin/bash
set -e

# Ensure we're in the backend directory
cd "$(dirname "$0")/.."

# Set environment variables
export ENV=development
export PYTHONPATH=.

# Load development environment variables
if [ -f .env ]; then
    echo "Loading development environment variables..."
    set -a
    source .env
    set +a
fi

# Start the server
uvicorn app.main:app --reload --port 8000 