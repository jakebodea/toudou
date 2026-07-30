#!/usr/bin/env bash
# Build toudou locally, replace the installed app, and relaunch it.
set -euo pipefail

APP_BUNDLE_ID="dev.toudou.app"
APP_NAME="toudou"
APP_SOURCE="src-tauri/target/release/bundle/macos/${APP_NAME}.app"
INSTALL_PATH="/Applications/${APP_NAME}.app"
SIGNING_IDENTITY="toudou Development"
DATA_DIR="${HOME}/Library/Application Support/${APP_BUNDLE_ID}"
DATA_DB="${DATA_DIR}/toudou.sqlite3"
BACKUP_DIR="${DATA_DIR}/backups"

if ! security find-identity -v -p codesigning |
  grep -Fq "\"${SIGNING_IDENTITY}\""; then
  echo "error: missing trusted code-signing identity: ${SIGNING_IDENTITY}" >&2
  echo "create it in Keychain Access before rebuilding toudou" >&2
  exit 1
fi

if pgrep -x "$APP_NAME" >/dev/null; then
  echo "→ quitting ${APP_NAME}…"
  osascript -e "tell application id \"${APP_BUNDLE_ID}\" to quit" || true

  for _ in {1..30}; do
    if ! pgrep -x "$APP_NAME" >/dev/null; then
      break
    fi
    sleep 0.1
  done

  if pgrep -x "$APP_NAME" >/dev/null; then
    echo "error: ${APP_NAME} did not quit; close it before rebuilding" >&2
    exit 1
  fi
fi

if [[ -f "$DATA_DB" ]]; then
  command -v sqlite3 >/dev/null || {
    echo "error: sqlite3 is required to back up toudou data" >&2
    exit 1
  }

  mkdir -p "$BACKUP_DIR"
  BACKUP_PATH="${BACKUP_DIR}/toudou-$(date '+%Y%m%d-%H%M%S').sqlite3"
  sqlite3 "$DATA_DB" ".backup '${BACKUP_PATH}'"
  echo "→ backed up captures to ${BACKUP_PATH}"
fi

echo "→ building local release…"
bun run tauri build --bundles app --config \
  '{"bundle":{"createUpdaterArtifacts":false,"macOS":{"signingIdentity":"toudou Development"}}}'

[[ -d "$APP_SOURCE" ]] || {
  echo "error: could not find built app at ${APP_SOURCE}" >&2
  exit 1
}

echo "→ installing to ${INSTALL_PATH}…"
rm -rf "$INSTALL_PATH"
ditto "$APP_SOURCE" "$INSTALL_PATH"

echo "→ opening ${APP_NAME}…"
open "$INSTALL_PATH"
