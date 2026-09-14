#!/usr/bin/env bash
set -euo pipefail

if ! command -v gitleaks >/dev/null 2>&1; then
  printf '%s\n' "gitleaks is required for scan:secrets; install the pinned CI binary first." >&2
  exit 127
fi

gitleaks detect --redact --no-banner --config .gitleaks.toml --source .

scan_dir="$(mktemp -d)"
scan_archive="$(mktemp)"
cleanup() {
  rm -rf "$scan_dir" "$scan_archive"
}
trap cleanup EXIT

git ls-files -co --exclude-standard -z \
  | tar --null --exclude='node_modules' --exclude='node_modules/**' --files-from=- -cf "$scan_archive"
tar -xf "$scan_archive" -C "$scan_dir"
gitleaks dir --redact --no-banner --config .gitleaks.toml "$scan_dir"
