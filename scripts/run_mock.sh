#!/usr/bin/env bash
# Run the fully offline demo — no Firebase, no keys, deterministic fake analysis
# and a placeholder restyle. Great for screenshots and UI work.
#
# Usage:  ./scripts/run_mock.sh [flutter run args...]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}/app"

exec flutter run --dart-define=USE_MOCK=true "$@"
