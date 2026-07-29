#!/usr/bin/env bash
# Install the latest towdow macOS build from GitHub Releases.
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/jakebodea/towdow/main/scripts/install.sh | bash
set -euo pipefail

REPO="jakebodea/towdow"
APP_NAME="towdow"
INSTALL_DIR="${TOWDOW_INSTALL_DIR:-/Applications}"
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

die() {
  echo "error: $*" >&2
  exit 1
}

need() {
  command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"
}

need curl
need tar
need uname

[[ "$(uname -s)" == "Darwin" ]] || die "towdow install script currently supports macOS only"

ARCH="$(uname -m)"
case "$ARCH" in
  arm64) ASSET_ARCH="aarch64" ;;
  x86_64) ASSET_ARCH="x86_64" ;;
  *) die "unsupported architecture: $ARCH" ;;
esac

API="https://api.github.com/repos/${REPO}/releases/latest"
echo "→ fetching latest release from ${REPO}…"

RELEASE_JSON="$(curl -fsSL \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "$API")" || die "could not fetch release (is the repo public?)"

TAG="$(printf '%s' "$RELEASE_JSON" | sed -n 's/.*"tag_name":[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)"
[[ -n "$TAG" ]] || die "no release tag found"

# Prefer the updater .app.tar.gz (easy to extract); fall back to .dmg.
ASSET_URL="$(printf '%s' "$RELEASE_JSON" | python3 -c '
import json, sys
arch = sys.argv[1]
rel = json.load(sys.stdin)
assets = rel.get("assets") or []

def pick(pred):
    for a in assets:
        name = a.get("name") or ""
        url = a.get("browser_download_url") or ""
        if url and pred(name):
            return url
    return ""

url = pick(lambda n: n.endswith(".app.tar.gz") and arch in n)
if not url:
    url = pick(lambda n: n.endswith(".app.tar.gz"))
if not url:
    url = pick(lambda n: n.endswith(".dmg") and arch in n)
if not url:
    url = pick(lambda n: n.endswith(".dmg"))
print(url)
' "$ASSET_ARCH")" || die "failed to parse release assets"

[[ -n "$ASSET_URL" ]] || die "no macOS .app.tar.gz or .dmg asset on ${TAG}"

FILENAME="${ASSET_URL##*/}"
DOWNLOAD_PATH="${TMP_DIR}/${FILENAME}"
echo "→ downloading ${FILENAME} (${TAG})…"
curl -fL --progress-bar -o "$DOWNLOAD_PATH" "$ASSET_URL"

APP_SRC=""
if [[ "$FILENAME" == *.app.tar.gz ]]; then
  echo "→ extracting…"
  tar -xzf "$DOWNLOAD_PATH" -C "$TMP_DIR"
  APP_SRC="$(find "$TMP_DIR" -maxdepth 2 -name "${APP_NAME}.app" -type d | head -n 1)"
elif [[ "$FILENAME" == *.dmg ]]; then
  need hdiutil
  echo "→ mounting dmg…"
  MOUNT_POINT="${TMP_DIR}/mnt"
  mkdir -p "$MOUNT_POINT"
  hdiutil attach "$DOWNLOAD_PATH" -mountpoint "$MOUNT_POINT" -nobrowse -quiet
  APP_SRC="$(find "$MOUNT_POINT" -maxdepth 2 -name "${APP_NAME}.app" -type d | head -n 1)"
  [[ -n "$APP_SRC" ]] || {
    hdiutil detach "$MOUNT_POINT" -quiet || true
    die "could not find ${APP_NAME}.app inside dmg"
  }
  DEST="${INSTALL_DIR}/${APP_NAME}.app"
  echo "→ installing to ${DEST}…"
  rm -rf "$DEST"
  ditto "$APP_SRC" "$DEST"
  hdiutil detach "$MOUNT_POINT" -quiet || true
  xattr -cr "$DEST" 2>/dev/null || true
  echo "✓ installed ${APP_NAME} ${TAG} → ${DEST}"
  echo "  first launch: right-click → Open (unsigned / Gatekeeper)"
  echo "  updates: open the app — it checks GitHub Releases on launch"
  exit 0
else
  die "unsupported asset type: ${FILENAME}"
fi

[[ -n "$APP_SRC" ]] || die "could not find ${APP_NAME}.app in archive"

DEST="${INSTALL_DIR}/${APP_NAME}.app"
echo "→ installing to ${DEST}…"
mkdir -p "$INSTALL_DIR"
rm -rf "$DEST"
ditto "$APP_SRC" "$DEST"
xattr -cr "$DEST" 2>/dev/null || true

echo "✓ installed ${APP_NAME} ${TAG} → ${DEST}"
echo "  first launch: right-click → Open (unsigned / Gatekeeper)"
echo "  updates: open the app — it checks GitHub Releases on launch"
