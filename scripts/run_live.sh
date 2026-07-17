#!/usr/bin/env bash
# Run the Flutter app against the real backend, injecting client config from
# .env via --dart-define. Nothing secret is baked into the source tree.
#
# Usage:  ./scripts/run_live.sh [flutter run args...]
#   e.g.  ./scripts/run_live.sh -d <device-id>
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT}/.env"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}. Copy .env.example to .env and fill it in." >&2
  exit 1
fi

# Export the .env values.
set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

cd "${ROOT}/app"

exec flutter run \
  --dart-define=FIREBASE_API_KEY="${FIREBASE_API_KEY:-}" \
  --dart-define=FIREBASE_APP_ID="${FIREBASE_APP_ID:-}" \
  --dart-define=FIREBASE_PROJECT_ID="${FIREBASE_PROJECT_ID:-}" \
  --dart-define=FIREBASE_MESSAGING_SENDER_ID="${FIREBASE_MESSAGING_SENDER_ID:-}" \
  --dart-define=FIREBASE_STORAGE_BUCKET="${FIREBASE_STORAGE_BUCKET:-}" \
  --dart-define=FIREBASE_AUTH_DOMAIN="${FIREBASE_AUTH_DOMAIN:-}" \
  --dart-define=FIREBASE_IOS_BUNDLE_ID="${FIREBASE_IOS_BUNDLE_ID:-}" \
  --dart-define=REVENUECAT_API_KEY="${REVENUECAT_API_KEY:-}" \
  --dart-define=USE_MOCK="${USE_MOCK:-false}" \
  "$@"
