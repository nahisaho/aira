#!/usr/bin/env bash
# Build the AIRA agent container image.
# Usage: bash container/build.sh [tag]
set -euo pipefail

TAG="${1:-aira-agent:latest}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[build] Building Docker image: $TAG"
docker build -t "$TAG" "$SCRIPT_DIR"
echo "[build] Done: $TAG"
