#!/usr/bin/env bash
# Deploy the Growhelper integration to the local ha-test Home Assistant container
# after a green Docker E2E run (spec: issue #33).
#
# Chain: build the panel bundle (byte-reproducible check, so source and served
# bundle cannot drift) -> local Docker E2E on E2E_PORT (default 8124; ha-test
# occupies 8123 locally) with reset container state -> smoke test + browser
# panel test -> tear down the E2E container -> only on success: rsync the whole
# integration into the ha-test config, restart ha-test, verify (panel bundle
# served and identical, no integration errors in the container log since the
# restart).
#
# Any failure before the deploy exits non-zero and leaves ha-test untouched.
#
# Configuration via environment variables:
#   REPO_ROOT          repo checkout              (default: auto-detected from script location)
#   HA_TEST_CONFIG     ha-test config directory   (default: ~/ha-test/config)
#   HA_TEST_CONTAINER  ha-test container name     (default: ha-test)
#   HA_TEST_PORT       ha-test port on localhost  (default: 8123)
#   E2E_PORT           port for the local E2E HA  (default: 8124)
#   E2E_CONTAINER      name of the E2E container  (default: growhelper-e2e-local)
#   PYTHON             python for the smoke test  (default: .venv/bin/python, else python3)
#
# Usage: tests/e2e/deploy-ha-test.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${REPO_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
HA_TEST_CONFIG="${HA_TEST_CONFIG:-$HOME/ha-test/config}"
HA_TEST_CONTAINER="${HA_TEST_CONTAINER:-ha-test}"
HA_TEST_PORT="${HA_TEST_PORT:-8123}"
E2E_PORT="${E2E_PORT:-8124}"
E2E_CONTAINER="${E2E_CONTAINER:-growhelper-e2e-local}"
# Helper image for the state reset; pinned like every other image used here.
HELPER_IMAGE="alpine:3"

# Wait/verify tuning.
WAIT_TIMEOUT_SECONDS=120
POLL_INTERVAL_SECONDS=2
SETUP_SETTLE_SECONDS=10

PANEL_BUNDLE_REL="custom_components/growhelper/www/growhelper-panel.js"
PANEL_BUNDLE_URL_PATH="/growhelper_static/growhelper-panel.js"
HA_TEST_BASE_URL="http://127.0.0.1:$HA_TEST_PORT"
COMPOSE_BASE="$REPO_ROOT/tests/e2e/docker-compose.yml"

OVERRIDE_FILE=""
RESTART_SINCE=""

log() { printf '[deploy-ha-test] %s\n' "$*"; }
die() { printf '[deploy-ha-test] FAIL: %s\n' "$*" >&2; exit 1; }

cleanup() {
  # Always tear the E2E container down and remove the temp override file,
  # even when a check fails.
  if [ -n "$OVERRIDE_FILE" ]; then
    docker compose -f "$COMPOSE_BASE" -f "$OVERRIDE_FILE" down >/dev/null 2>&1 || true
    rm -f "$OVERRIDE_FILE"
  fi
}
trap cleanup EXIT

build_bundle() {
  log "building panel bundle (npm run build)"
  if [ ! -d "$REPO_ROOT/node_modules" ]; then
    (cd "$REPO_ROOT" && npm ci) >/dev/null
  fi
  (cd "$REPO_ROOT" && npm run build) >/dev/null
  # The committed bundle must match a fresh build (compared against HEAD, so
  # staged changes are caught too); otherwise panel source and the served
  # bundle have drifted apart.
  if ! git -C "$REPO_ROOT" diff HEAD --quiet -- "$PANEL_BUNDLE_REL"; then
    die "npm run build changed $PANEL_BUNDLE_REL — commit src/ and the www/ bundle together before deploying"
  fi
}

run_e2e() {
  log "starting local E2E container '$E2E_CONTAINER' on port $E2E_PORT"
  # Reuse the committed compose file; the temp override only changes project
  # name, container name and the host port, so the pinned HA image and the
  # mounts stay defined in one place.
  OVERRIDE_FILE="$(mktemp /tmp/growhelper-e2e-override-XXXXXX.yml)"
  cat > "$OVERRIDE_FILE" <<EOF
name: growhelper-e2e-local
services:
  homeassistant:
    container_name: $E2E_CONTAINER
    ports: !override
      - "127.0.0.1:$E2E_PORT:8123"
EOF

  # Reset the E2E container state via a root helper container: the config
  # files are container-owned (root), a plain rm as the user fails with
  # permission denied.
  docker run --rm -v "$REPO_ROOT/tests/e2e/config:/config" "$HELPER_IMAGE" \
    sh -c 'rm -rf /config/.storage /config/growhelper /config/home-assistant.log* /config/.HA_VERSION /config/known_devices.yaml' >/dev/null

  docker compose -f "$COMPOSE_BASE" -f "$OVERRIDE_FILE" up -d >/dev/null

  local base_url="http://127.0.0.1:$E2E_PORT"
  log "running smoke test against $base_url"
  (cd "$REPO_ROOT" && HA_BASE_URL="$base_url" "$PYTHON" tests/e2e/smoke.py)

  log "running browser panel test (playwright chromium install is idempotent)"
  (cd "$REPO_ROOT" && npx playwright install chromium >/dev/null)
  (cd "$REPO_ROOT" && HA_BASE_URL="$base_url" npm run test:e2e:panel)

  log "E2E green — tearing down E2E container"
  docker compose -f "$COMPOSE_BASE" -f "$OVERRIDE_FILE" down >/dev/null
  rm -f "$OVERRIDE_FILE"
  OVERRIDE_FILE=""
}

deploy_to_ha_test() {
  log "deploying integration to '$HA_TEST_CONTAINER' (config: $HA_TEST_CONFIG)"
  [ -d "$HA_TEST_CONFIG" ] || die "ha-test config dir not found: $HA_TEST_CONFIG (set HA_TEST_CONFIG)"
  docker inspect "$HA_TEST_CONTAINER" >/dev/null 2>&1 || die "container not found: $HA_TEST_CONTAINER (set HA_TEST_CONTAINER)"
  rsync -a --exclude __pycache__ --delete \
    "$REPO_ROOT/custom_components/growhelper/" "$HA_TEST_CONFIG/custom_components/growhelper/"
  # Anchor the post-deploy log check to this restart, not to a wall-clock window.
  RESTART_SINCE="$(date '+%Y-%m-%dT%H:%M:%S%z')"
  docker restart "$HA_TEST_CONTAINER" >/dev/null
}

verify_deploy() {
  log "waiting for $HA_TEST_CONTAINER to answer on $HA_TEST_BASE_URL"
  local deadline=$((SECONDS + WAIT_TIMEOUT_SECONDS))
  until curl -s -o /dev/null "$HA_TEST_BASE_URL/api/"; do
    [ "$SECONDS" -lt "$deadline" ] || die "$HA_TEST_CONTAINER did not answer within ${WAIT_TIMEOUT_SECONDS}s"
    sleep "$POLL_INTERVAL_SECONDS"
  done
  sleep "$SETUP_SETTLE_SECONDS"  # let the integration set up after the restart

  local bundle="$REPO_ROOT/$PANEL_BUNDLE_REL"
  local url="$HA_TEST_BASE_URL$PANEL_BUNDLE_URL_PATH"
  local code repo_md5 served_md5
  code="$(curl -s -o /dev/null -w '%{http_code}' "$url")"
  [ "$code" = "200" ] || die "panel bundle not served by ha-test (HTTP $code)"
  repo_md5="$(md5sum "$bundle" | cut -d' ' -f1)"
  served_md5="$(curl -s "$url" | md5sum | cut -d' ' -f1)"
  [ "$repo_md5" = "$served_md5" ] || die "served bundle differs from repo bundle ($served_md5 != $repo_md5)"

  # Only log lines written since the restart count; the standard
  # "custom integration not tested" warning is not an error.
  if docker logs "$HA_TEST_CONTAINER" --since "$RESTART_SINCE" 2>&1 \
      | grep -i growhelper | grep -iE 'error|traceback|exception' | grep -v 'not been tested'; then
    die "growhelper errors in the $HA_TEST_CONTAINER log since restart"
  fi

  log "verified: panel bundle HTTP $code, md5 $served_md5 matches repo"
  log "deployed revision: $(git -C "$REPO_ROOT" rev-parse --short HEAD)"
}

main() {
  command -v docker >/dev/null 2>&1 || die "docker not found"
  command -v rsync >/dev/null 2>&1 || die "rsync not found"
  command -v curl >/dev/null 2>&1 || die "curl not found"
  PYTHON="${PYTHON:-$REPO_ROOT/.venv/bin/python}"
  if [ ! -x "$PYTHON" ]; then
    PYTHON="$(command -v python3 || true)"
    [ -n "$PYTHON" ] || die "no python found for the smoke test (set PYTHON)"
  fi
  build_bundle
  run_e2e
  deploy_to_ha_test
  verify_deploy
  log "OK — $HA_TEST_CONTAINER runs the E2E-tested build"
}

main "$@"
