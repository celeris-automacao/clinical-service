#!/usr/bin/env bash
# check-brand-name.sh
# Fails if any banned brand name appears in user-visible strings.
#
# Banned names are listed in scripts/banned-brand-names.txt — one per line.
# Lines starting with # are treated as comments. Adding a new banned name
# requires only a one-line addition to that file, not a script change.
#
# ─── PROCESS: HOW TO RETIRE A BRAND NAME ─────────────────────────────────────
# When the product is renamed or a brand string is replaced:
#   1. Add the OLD name to scripts/banned-brand-names.txt BEFORE touching source.
#   2. Run this script to confirm it catches the old strings:
#          bash scripts/check-brand-name.sh
#   3. Replace all old-name occurrences in source until the check passes.
#   4. Keep the entry permanently — it guards against future regressions.
# ─────────────────────────────────────────────────────────────────────────────
#
# Scanned extensions: .ts .tsx .yaml .yml .html .mjml .hbs .ejs .txt .md .json
# JSON is included to catch push notification configs (e.g. app.json) and
# any other JSON files that may contain user-visible brand strings.
# node_modules and .expo directories are excluded to avoid false positives.
#
# Excluded (legitimate code identifiers and build-time platform config):
#   - Lines containing "ClinicaInBoxLogo"  (component name / import paths)
#   - Files named "ClinicaInBoxLogo.tsx"   (the logo component itself)
#   - Files named "app.json"             (Expo build-time config — the platform
#                                         brand name legitimately lives in the
#                                         `name` field here; runtime display
#                                         strings are fetched via the branding API)
#
# Any remaining match is a stale display string and causes a non-zero exit.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/banned-brand-names.txt"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "ERROR: Banned-names config not found: $CONFIG_FILE"
  exit 1
fi

# ── Validate the banned-names file itself ────────────────────────────────────

# Extract non-comment, non-blank entries
ENTRIES=$(grep -v '^\s*#' "$CONFIG_FILE" | grep -v '^\s*$' || true)

# 1. Require at least one entry so the file can never be emptied accidentally.
if [ -z "$ENTRIES" ]; then
  echo "ERROR: $CONFIG_FILE has no active (non-comment) entries."
  echo "When retiring a brand name, add the old name to this file first."
  exit 1
fi

# 2. Reject duplicate entries so the list stays clean.
DUPLICATES=$(echo "$ENTRIES" | sort | uniq -d || true)
if [ -n "$DUPLICATES" ]; then
  echo "ERROR: $CONFIG_FILE contains duplicate entries:"
  echo "$DUPLICATES"
  echo "Remove the duplicate lines and re-run."
  exit 1
fi

# ── Scan source directories ──────────────────────────────────────────────────

SEARCH_DIRS=(
  "artifacts/clinic-web/src"
  "artifacts/clinic-mobile"
  "artifacts/api-server/src"
  "lib/api-spec"
)

ALL_MATCHES=""
FAILED_NAMES=()

while IFS= read -r name; do
  # Skip blank lines and comment lines
  [[ -z "$name" || "$name" == \#* ]] && continue

  MATCHES=$(grep -rn "$name" "${SEARCH_DIRS[@]}" \
    --include="*.ts" \
    --include="*.tsx" \
    --include="*.yaml" \
    --include="*.yml" \
    --include="*.html" \
    --include="*.mjml" \
    --include="*.hbs" \
    --include="*.ejs" \
    --include="*.txt" \
    --include="*.md" \
    --include="*.json" \
    --exclude-dir=node_modules \
    --exclude-dir=.expo \
    --exclude="ClinicaInBoxLogo.tsx" \
    --exclude="app.json" \
    | grep -v "ClinicaInBoxLogo" \
    || true)

  if [ -n "$MATCHES" ]; then
    FAILED_NAMES+=("$name")
    ALL_MATCHES="${ALL_MATCHES}${MATCHES}"$'\n'
  fi
done < "$CONFIG_FILE"

if [ ${#FAILED_NAMES[@]} -gt 0 ]; then
  echo ""
  echo "ERROR: Banned brand name(s) found in display strings: ${FAILED_NAMES[*]}"
  echo "Fix each occurrence below (rename or replace the user-visible text):"
  echo ""
  echo "$ALL_MATCHES"
  echo ""
  exit 1
fi

echo "Brand name check passed — no banned brand names in display strings."
