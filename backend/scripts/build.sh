#!/bin/bash
set -e

echo "Starting build process..."

# Ensure we're in the backend directory
cd "$(dirname "$0")/.."

# Install Python dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Run database migrations
echo "Running database migrations..."
ENV=production alembic upgrade head

echo "Build completed successfully!" 