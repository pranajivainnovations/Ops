#!/usr/bin/env bash
# One-click deploy for crossfriend-ops -> the pranajiva-ops production container.
# Automates the manual build -> save -> scp -> ssh -> load -> restart cycle exactly as it was being
# run by hand. Run from anywhere; paths below are resolved relative to this file, not the caller's cwd.
#
# Usage: ./deploy.sh          (Git Bash, or double-click deploy.bat on Windows)

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

# ── Configuration — edit these to match your setup ─────────────────────────────
IMAGE_NAME="pranajiva-ops"
PEM_PATH="${DEPLOY_PEM_PATH:-pranajivainnovationpem.pem}"   # override with: DEPLOY_PEM_PATH=/path/to/key.pem ./deploy.sh
REMOTE_HOST="ubuntu@13.62.195.167"
REMOTE_DIR="/home/ubuntu/pranajiva-ops"
# ─────────────────────────────────────────────────────────────────────────────

TARBALL="${IMAGE_NAME}.tgz"

if [ ! -f "$PEM_PATH" ]; then
  echo "PEM key not found at: $PEM_PATH"
  echo "Set DEPLOY_PEM_PATH=/full/path/to/key.pem before running, or edit PEM_PATH in deploy.sh."
  exit 1
fi

echo "==> [1/4] Building ${IMAGE_NAME}:latest (--no-cache)..."
docker build --no-cache -t "${IMAGE_NAME}:latest" .

echo "==> [2/4] Saving image to ${TARBALL}..."
docker save -o "$TARBALL" "${IMAGE_NAME}:latest"

echo "==> [3/4] Uploading to ${REMOTE_HOST}:${REMOTE_DIR}..."
scp -i "$PEM_PATH" "$TARBALL" "${REMOTE_HOST}:${REMOTE_DIR}/"

echo "==> [4/4] Restarting on the server (down -> load -> up)..."
ssh -i "$PEM_PATH" "$REMOTE_HOST" \
  "cd ${REMOTE_DIR} && docker compose down && docker load -i ${TARBALL} && docker compose up -d"

echo "==> Done. Tailing container status..."
ssh -i "$PEM_PATH" "$REMOTE_HOST" "cd ${REMOTE_DIR} && docker compose ps"

echo
echo "Deployed ${IMAGE_NAME}:latest to ${REMOTE_HOST}."
