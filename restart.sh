#!/usr/bin/env bash
set -euo pipefail

docker compose --env-file app/.env down
docker compose --env-file app/.env up -d --build
