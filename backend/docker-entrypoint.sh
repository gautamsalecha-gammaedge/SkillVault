#!/bin/sh
set -e

echo "Ensuring database schema exists..."
python setup_db.py

echo "Starting server..."
exec uvicorn main:app --host 0.0.0.0 --port 8000