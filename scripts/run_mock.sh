#!/usr/bin/env bash
# Run with the offline demo analysis backend (deterministic fake scoring, no
# Firebase). RevenueCat still runs LIVE if a REVENUECAT_API_KEY is present in
# .env — so this is the quickest way to exercise the real RevenueCat paywall and
# Customer Center without standing up Firebase.
#
# Usage:  ./scripts/run_mock.sh [flutter run args...]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT}/.env"

RC_KEY=""
if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
  RC_KEY="${REVENUECAT_API_KEY:-}"
fi

cd "${ROOT}/app"

exec flutter run \
  --dart-define=USE_MOCK=true \
  --dart-define=REVENUECAT_API_KEY="${RC_KEY}" \
  "$@"
