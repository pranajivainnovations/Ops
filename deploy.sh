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

# Verify the target BEFORE uploading. A missing directory means REMOTE_DIR is wrong, and scp would
# otherwise fail halfway through a 150 MB upload. Find the real path with:
#   ssh -i KEY HOST "docker inspect crossfriend-ops --format '{{index .Config.Labels \"com.docker.compose.project.working_dir\"}}'"
echo "==> [3/4] Verifying ${REMOTE_DIR}, then uploading to ${REMOTE_HOST}..."
ssh -i "$PEM_PATH" "$REMOTE_HOST" "test -f ${REMOTE_DIR}/docker-compose.yml && test -f ${REMOTE_DIR}/.env" || {
  echo "ERROR: ${REMOTE_DIR} on ${REMOTE_HOST} is missing docker-compose.yml or .env."
  echo "Fix REMOTE_DIR in deploy.sh, or create the file that is missing on the server."
  exit 1
}
# Only the image ships — the server's docker-compose.yml and .env are the source of truth for how
# this deployment is wired, and are never overwritten from a developer machine. When compose needs a
# new variable, edit the server copy by hand and add it to that .env in the same sitting.
scp -i "$PEM_PATH" "$TARBALL" "${REMOTE_HOST}:${REMOTE_DIR}/"

echo "==> [4/4] Restarting on the server (down -> load -> up)..."
ssh -i "$PEM_PATH" "$REMOTE_HOST" \
  "cd ${REMOTE_DIR} && docker compose down && docker load -i ${TARBALL} && docker compose up -d"

echo "==> Done. Tailing container status..."
ssh -i "$PEM_PATH" "$REMOTE_HOST" "cd ${REMOTE_DIR} && docker compose ps"

echo
echo "Deployed ${IMAGE_NAME}:latest to ${REMOTE_HOST}."
