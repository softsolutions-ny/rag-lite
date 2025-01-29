#!/bin/bash
set -e

# Ensure we're in the backend directory
cd "$(dirname "$0")/.."

# Set environment variables
export ENV=production
export PYTHONPATH=.

# Start the production server
uvicorn app.main:app --host 0.0.0.0 --port $PORT 