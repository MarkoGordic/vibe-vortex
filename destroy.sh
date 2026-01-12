#!/usr/bin/env bash
set -euo pipefail

docker compose --env-file app/.env down -v --remove-orphans
