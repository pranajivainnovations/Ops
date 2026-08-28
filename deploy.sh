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


# ── Deploy record ─────────────────────────────────────────────────────────────
# Appends one entry to DEPLOYED.md every time this script finishes.
#
# Why this exists: "is that change live?" was being answered from memory, by both a human and an
# assistant reading the repo, and memory was wrong often enough to waste real time — a fix sat in
# the working tree through two production builds while everyone believed it had shipped, and
# separately, work that HAD shipped was repeatedly described as pending.
#
# The file answers it from evidence instead. The decisive field is `tree`: `clean` means the commit
# named beside it is exactly what shipped, so `git log <sha>..HEAD` lists everything since. `dirty`
# means uncommitted files were part of the build, so the commit alone does not identify the deploy —
# then the timestamp is what to compare against, and anything modified after it is unshipped.
#
# Append-only, newest entry LAST. `tail -12 DEPLOYED.md` shows the most recent deploy.
record_deploy() {
  local outcome="$1"
  local log="DEPLOYED.md"

  local sha branch tree
  sha="$(git rev-parse --short HEAD 2>/dev/null || echo 'no-git')"
  branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '-')"
  if [ -n "$(git status --porcelain 2>/dev/null)" ]; then tree="dirty"; else tree="clean"; fi

  if [ ! -f "$log" ]; then
    {
      echo "# Deploy log — ${IMAGE_NAME}"
      echo
      echo "Written automatically by \`deploy.sh\`. Newest entry is at the **bottom**."
      echo
      echo "\`tree: clean\` means the commit beside it is exactly what shipped, so"
      echo "\`git log <sha>..HEAD\` lists everything not yet deployed."
      echo "\`tree: dirty\` means uncommitted files were built in, so compare file"
      echo "modification times against the deploy timestamp instead."
      echo
      echo "Do not edit by hand, and do not delete — it is the only record of what is live."
      echo
    } > "$log"
  fi

  {
    echo "---"
    # IST computed as a UTC offset, not via TZ=Asia/Kolkata: Git Bash on Windows ships no tzdata,
    # so the named zone silently resolves to GMT and stamps the wrong local time.
    echo "- when:    $(date -u '+%Y-%m-%d %H:%M:%S') UTC  /  $(date -u -d '+5 hours 30 minutes' '+%Y-%m-%d %H:%M') IST"
    echo "- outcome: ${outcome}"
    echo "- commit:  ${sha} (${branch})"
    echo "- tree:    ${tree}"
    echo "- image:   ${IMAGE_NAME}:latest"
    echo "- target:  ${REMOTE_HOST}:${REMOTE_DIR}"
    echo "- by:      $(git config user.name 2>/dev/null || echo "${USER:-unknown}")"
  } >> "$log"

  echo
  echo "Recorded in $(pwd)/${log}  —  ${outcome}, commit ${sha}, tree ${tree}"
  if [ "$tree" = "dirty" ]; then
    echo "  NOTE: uncommitted files were built into this image. Commit them so the next"
    echo "        deploy record identifies exactly what is live."
  fi
}


# Record every outcome, not just success: this must distinguish "deployed and failed" from
# "never ran". An EXIT trap catches the set -e aborts above as well as a clean finish.
trap 'rc=$?; record_deploy "$([ $rc -eq 0 ] && echo SUCCESS || echo "FAILED (exit $rc)")"' EXIT


# ── Build provenance ──────────────────────────────────────────────────────────────────────────
# Stamped into the image and served by the build endpoint, so OPS can report what is ACTUALLY
# running rather than what a log claims was deployed. Captured here, once, so the values echoed
# below and the values baked into the image cannot disagree.
BUILD_COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
BUILD_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
BUILD_TIME="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then BUILD_TREE="dirty"; else BUILD_TREE="clean"; fi

TARBALL="${IMAGE_NAME}.tgz"

# ── Server disk hygiene ───────────────────────────────────────────────────────
# Repeated deploys fill the server, and the failure lands at the worst possible moment: the image
# tarball has already been uploaded and `docker load` is halfway through extracting it. On a script
# that stopped the container first, the service is then down with no image to start.
#
# Two causes, both invisible until they bite:
#
#   1. Every `docker load` of the same :latest tag untags the previous image rather than deleting
#      it. Twenty-one of these had accumulated on the storefront host over three weeks, one per
#      deploy, ~280MB each. Nothing ever collects them.
#   2. The uploaded .tgz is never removed. Five of them, back to May, were sitting in the deploy
#      directories on one host — 498MB doing nothing.
#
# Note the prune below is deliberately NOT `-a`. `docker image prune -a` removes every image not
# used by a *running* container, and these hosts run several services side by side: if any other
# service happened to be stopped at that moment, its image would be deleted too and it could not
# restart without a fresh upload. `-a` also throws away the previous image, which is the only
# rollback available when a new one turns out to be broken. Dangling-only removes exactly the
# garbage and nothing that anything could still want.
DEPLOY_KEY="${PEM_PATH:-${SSH_KEY:-}}"

# Refuse to start if the server cannot comfortably hold the incoming image. Checked BEFORE the
# upload and before anything is stopped, so a failure here costs nothing but a message.
preflight_disk() {
  local tarball_bytes free_kb need_kb
  tarball_bytes="$(wc -c < "$TARBALL" 2>/dev/null || echo 0)"
  # Three times the tarball: the compressed upload, the extracted layers, and headroom for the
  # previous image to stay in place until the new one is running.
  need_kb=$(( (tarball_bytes / 1024) * 3 ))

  free_kb="$(ssh -i "$DEPLOY_KEY" "$REMOTE_HOST" "df -Pk ${REMOTE_DIR} | tail -1 | awk '{print \$4}'" 2>/dev/null || echo 0)"

  if [ "$free_kb" -lt "$need_kb" ]; then
    echo "REFUSING TO DEPLOY: not enough disk on ${REMOTE_HOST}."
    echo "  free:   $(( free_kb / 1024 )) MB"
    echo "  needed: $(( need_kb / 1024 )) MB (3x the ${IMAGE_NAME} image)"
    echo
    echo "Reclaim space without touching any running service:"
    echo "  ssh -i ${DEPLOY_KEY} ${REMOTE_HOST} 'sudo docker image prune -f; sudo rm -f ${REMOTE_DIR}/*.tgz'"
    echo
    echo "Only if that is not enough, review what else is there before removing anything:"
    echo "  ssh -i ${DEPLOY_KEY} ${REMOTE_HOST} 'sudo docker images -a; sudo du -sh /home/ubuntu/*'"
    exit 1
  fi
  echo "    OK — $(( free_kb / 1024 )) MB free, need ~$(( need_kb / 1024 )) MB."
}

# Runs only after the new container is confirmed up, so the previous image survives until the
# replacement has actually started.
cleanup_server() {
  echo "==> Reclaiming server disk (dangling images + uploaded tarball)..."
  ssh -i "$DEPLOY_KEY" "$REMOTE_HOST" \
    "rm -f ${REMOTE_DIR}/${TARBALL}; sudo docker image prune -f 2>/dev/null || docker image prune -f" \
    | tail -3 || echo "    (cleanup skipped — non-fatal)"
}

if [ ! -f "$PEM_PATH" ]; then
  echo "PEM key not found at: $PEM_PATH"
  echo "Set DEPLOY_PEM_PATH=/full/path/to/key.pem before running, or edit PEM_PATH in deploy.sh."
  exit 1
fi

echo "==> [1/4] Building ${IMAGE_NAME}:latest (--no-cache)..."
docker build --no-cache \
  --build-arg "BUILD_COMMIT=${BUILD_COMMIT}" \
  --build-arg "BUILD_BRANCH=${BUILD_BRANCH}" \
  --build-arg "BUILD_TREE=${BUILD_TREE}" \
  --build-arg "BUILD_TIME=${BUILD_TIME}" \
  -t "${IMAGE_NAME}:latest" .
echo "==> [2/4] Saving image to ${TARBALL}..."
docker save -o "$TARBALL" "${IMAGE_NAME}:latest"

echo "==> Checking the server has room for this image..."
preflight_disk

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

echo "==> [4/4] Loading image, then recreating..."
# Load FIRST, then recreate. The previous ordering ran `docker compose down` before
# `docker load`, so a load that failed - out of disk, corrupt tarball, interrupted transfer -
# left the service stopped with no image to start from. That is exactly how a full disk turned
# a failed deploy into an outage: the container was already gone when the extraction died.
# Loading first means a failure here leaves the OLD container still serving traffic.
ssh -i "$PEM_PATH" "$REMOTE_HOST" "cd ${REMOTE_DIR} && docker load -i ${TARBALL}"

echo "==> Recreating the container..."
ssh -i "$PEM_PATH" "$REMOTE_HOST" \
  "cd ${REMOTE_DIR} && docker compose up -d --force-recreate"

echo "==> Done. Tailing container status..."
ssh -i "$PEM_PATH" "$REMOTE_HOST" "cd ${REMOTE_DIR} && docker compose ps"

echo
echo "Deployed ${IMAGE_NAME}:latest to ${REMOTE_HOST}."

# Last, and only now: the container is confirmed running, so the image it replaced is safe to
# collect. Dangling-only - see the note on preflight_disk above for why -a is not used here.
cleanup_server
