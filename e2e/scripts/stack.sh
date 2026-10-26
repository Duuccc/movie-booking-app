#!/usr/bin/env bash
set -euo pipefail

# Run from the repo root no matter where the script is called from.
cd "$(dirname "$0")/../.."

DOCKER="${DOCKER:-docker}"            # DOCKER="sudo docker" if your user needs sudo
COMPOSE="$DOCKER compose -f docker-compose.e2e.yml"
ADMIN_EMAIL="${E2E_ADMIN_EMAIL:-e2e-admin@example.com}"
ADMIN_PASSWORD="${E2E_ADMIN_PASSWORD:-E2e-Admin-Pass-1}"

case "${1:-}" in
  up)
    $COMPOSE up -d --build --wait
    # -T: no TTY (needed in CI). The password comes from the environment, not a prompt.
    $COMPOSE exec -T -e ADMIN_PASSWORD="$ADMIN_PASSWORD" backend \
      python -m scripts.create_admin "$ADMIN_EMAIL" "E2E Admin"
    echo "E2E stack is up on http://localhost:8081"
    ;;
  down)
    $COMPOSE down -v
    ;;
  *)
    echo "usage: stack.sh up|down" >&2
    exit 1
    ;;
esac