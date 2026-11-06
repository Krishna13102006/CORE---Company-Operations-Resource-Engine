#!/usr/bin/env bash
set -o errexit
echo '==> Upgrading pip...'
pip install --upgrade pip
echo '==> Installing dependencies with pre-built binary preference...'
pip install --prefer-binary -r requirements.txt
echo '==> Collecting static files...'
python manage.py collectstatic --no-input
echo '==> Running database migrations...'
python manage.py migrate --no-input || echo '==> Warning: Database migration failed during build (database may be sleeping or unreachable). Deployment will continue.'
echo '==> Build completed!'
