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

# Verify database connection
echo "Verifying database connection..."
export ENV=production
python verify_db.py

if [ $? -eq 0 ]; then
    echo "Database connection verified successfully!"
    
    # Run database migrations
    echo "Running database migrations with production settings..."
    python -m alembic upgrade head
    
    echo "Build completed successfully!"
else
    echo "Failed to verify database connection. Check your SUPABASE_DATABASE_URL and network settings."
    exit 1
fi 