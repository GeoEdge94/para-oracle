#!/usr/bin/env bash
# audit-secrets.sh — scan the git history and the working tree for secrets.
# Exit 0 if clean, 1 if any leak is found.
#
# Usage:
#   bash scripts/security/audit-secrets.sh           # default scan
#   bash scripts/security/audit-secrets.sh --strict  # also fail on high-entropy strings
#
# Runs ~5s on this repo. Designed to be green even on fresh clones.
# Extend SECRET_PATTERNS as new secret families are introduced.
set -euo pipefail

STRICT=0
[ "${1:-}" = "--strict" ] && STRICT=1

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

found=0
report() { echo "[LEAK] $*" >&2; found=1; }

# ── 1. Must-not-track files ──────────────────────────────────────────────
BANNED_TRACKED=(
  ".env"
  ".env.local"
  ".env.production"
  ".env.staging"
  "*.key"
  "*.pem"
  "*.p12"
  "service-account*.json"
)
for pat in "${BANNED_TRACKED[@]}"; do
  # Let git-ls expand the pattern
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    # .env.example et veralith-pipeline/contracts/.env.example sont des templates légitimes
    case "$f" in
      *.env.example) continue ;;
    esac
    report "Tracked sensitive file: $f"
  done < <(git ls-files -- "$pat" 2>/dev/null || true)
done

# ── 2. Targeted pattern search in full history ────────────────────────────
# Each pattern is a high-signal regex (ignored if blockchain/public hash).
declare -A SECRET_PATTERNS=(
  [aws_access_key]='AKIA[0-9A-Z]{16}'
  [github_pat]='ghp_[a-zA-Z0-9]{30,}|gho_[a-zA-Z0-9]{30,}|github_pat_[a-zA-Z0-9_]{40,}'
  [jwt_bearer]='(Authorization:|Bearer\s+)[a-zA-Z0-9_.-]{30,}'
  [pinata_jwt_filled]='^\+PINATA_JWT=[a-zA-Z0-9]{10,}'
  [oracle_pk_filled]='^\+ORACLE_PRIVATE_KEY=(0x)?[a-fA-F0-9]{60,}'
  [priv_key_generic]='^\+PRIVATE_KEY=(0x)?[a-fA-F0-9]{60,}'
  [challenger_pk]='^\+CHALLENGER_PRIVATE_KEY=(0x)?[a-fA-F0-9]{60,}'
  [sentinel_hub_id]='SENTINEL_HUB_CLIENT_ID=sh-[a-fA-F0-9-]{20,}'
  [sentinel_hub_secret]='SENTINEL_HUB_CLIENT_SECRET=[A-Za-z0-9+/=]{20,}'
  [cds_api_key]='CDS_API_KEY=[a-zA-Z0-9-]{10,}'
  # Must be followed by a quoted literal or hex/base64 — blocks "= variable_name" false positives
  [generic_secret]='(api_secret|client_secret|password)\s*[=:]\s*["'"'"'][a-zA-Z0-9!@#$%^&*_+/=-]{16,}["'"'"']'
)

for name in "${!SECRET_PATTERNS[@]}"; do
  pat="${SECRET_PATTERNS[$name]}"
  # Full history, all branches, all remotes
  matches=$(git log --all -p 2>/dev/null | grep -E "$pat" | head -3 || true)
  if [ -n "$matches" ]; then
    report "Pattern [$name] matched in history:"
    echo "$matches" | sed 's/^/  /' >&2
  fi
done

# ── 3. Working tree .env file — must never be tracked ─────────────────────
if git ls-files --error-unmatch .env 2>/dev/null; then
  report ".env is currently tracked. Run: git rm --cached .env"
fi

# ── 4. Summary ────────────────────────────────────────────────────────────
if [ $found -eq 0 ]; then
  echo "[ok] audit-secrets: no leak detected in git history or tracked files"
  exit 0
else
  echo ""
  echo "[FAIL] secrets found. Rotate them IMMEDIATELY and clean history:"
  echo "   1. Rotate every leaked secret (new wallet, new JWT, etc.)"
  echo "   2. bfg-repo-cleaner --delete-files .env --no-blob-protection"
  echo "   3. git push --force --all && git push --force --tags"
  exit 1
fi
