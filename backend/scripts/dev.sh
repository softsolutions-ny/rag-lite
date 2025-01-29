#!/bin/bash
set -e

# Ensure we're in the backend directory
cd "$(dirname "$0")/.."

# Set environment variables
export ENV=development
export PYTHONPATH=.

# Start the server
uvicorn app.main:app --reload 