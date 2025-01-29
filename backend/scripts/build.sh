#!/bin/bash
set -e

echo "Starting build process..."

# Ensure we're in the backend directory
cd "$(dirname "$0")/.."

# Install Python dependencies
echo "Installing dependencies..."
pip install -r ./requirements/prod.txt

# Install alembic explicitly
echo "Installing alembic..."
pip install alembic

# Run database migrations
echo "Running database migrations..."
ENV=production python -m alembic upgrade head

echo "Build completed successfully!" 