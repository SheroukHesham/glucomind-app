#!/bin/bash
# Copies libs/event-contracts/*.ts into each service that uses them
# (a container only sees its own folder, so services keep their own copy).
#   scripts/sync-contracts.sh           copy
#   scripts/sync-contracts.sh --check   exit 1 if any copy is out of date (use in CI)
set -euo pipefail
cd "$(dirname "$0")/.."

SRC=libs/event-contracts
MODE="${1:-copy}"
STATUS=0

# sync <service> <contract file>...
sync() {
  local svc=$1
  shift
  local dest="services/$svc/src/kafka/contracts"
  local f
  for f in "$@"; do
    if [ "$MODE" = "--check" ]; then
      cmp -s "$SRC/$f" "$dest/$f" || { echo "OUT OF DATE: $dest/$f"; STATUS=1; }
    else
      mkdir -p "$dest"
      cp "$SRC/$f" "$dest/$f"
      echo "synced $dest/$f"
    fi
  done
}

sync user-service       topics.ts device-tokens.ts medication-creation-events.ts
sync cgm-service        topics.ts glucose-events.ts
sync emergency-service  topics.ts glucose-events.ts device-tokens.ts
sync medication-service topics.ts device-tokens.ts

exit $STATUS