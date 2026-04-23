#!/usr/bin/env bash
# E2E challenger — resolve un pari, lance le bot (match case), tamper la
# data.json sur le mock IPFS, relance le bot (dispute case), restaure.
#
# Prerequis :
#   docker compose up -d db backend
#   docker compose --profile bot build bot
#
# Helpers JSON/HTTP executes dans le container backend (pas besoin de python
# ni jq sur l'hote). Le fichier scripts/_e2e_helpers.py est monte via
# ./scripts:/scripts:ro dans le backend.
#
# Usage :
#   bash scripts/e2e_challenger.sh [bet_slug]
#
# Exit codes :
#   0 = match + dispute detectes comme attendu
#   1 = assertion failed
set -euo pipefail

BET_SLUG="${1:-precip-amoy-testnet-01}"
BACKEND_IN_CONTAINER="${BACKEND_IN_CONTAINER:-http://127.0.0.1:8000}"

step() { echo; echo "=== $* ==="; }
fail() { echo "FAIL: $*"; exit 1; }

be_py() { docker compose exec -T backend python3 /scripts/_e2e_helpers.py "$@"; }

# ── 1. Reset bet ───────────────────────────────────────────────────────────
step "1. Reset bet $BET_SLUG"
docker compose exec -T db psql -U paraoracle -d paraoracle >/dev/null <<SQL
DELETE FROM analyses WHERE bet_id = (SELECT id FROM bets WHERE slug='$BET_SLUG');
UPDATE bets SET status='OPEN', result_bool=NULL, resolved_value=NULL, resolved_at=NULL
 WHERE slug='$BET_SLUG';
SQL
echo "  done"

# ── 2. Resolve ──────────────────────────────────────────────────────────────
step "2. POST /oracle/resolve/$BET_SLUG"
read -r RESOLVED FP DCID < <(be_py resolve "$BACKEND_IN_CONTAINER/oracle/resolve/$BET_SLUG")
echo "  resolved_outcome = $RESOLVED"
echo "  fingerprint      = $FP"
echo "  data_cid         = $DCID"
[[ -n "$FP" && -n "$DCID" ]] || fail "missing fingerprint or data_cid"

# ── 3. Pending feed ─────────────────────────────────────────────────────────
step "3. GET /oracle/pending"
read -r DATA_CID EXPECTED_FP < <(be_py pending "$BACKEND_IN_CONTAINER/oracle/pending?limit=20" "$BET_SLUG")
echo "  data_cid    = $DATA_CID"
echo "  expected_fp = $EXPECTED_FP"
[[ "$DATA_CID" == "$DCID" ]] || fail "pending.data_cid != resolve.data_cid"
[[ "$EXPECTED_FP" == "$FP" ]] || fail "pending.fingerprint != resolve.fingerprint"

# ── 4. Bot match case ──────────────────────────────────────────────────────
step "4. Run challenger bot (expect MATCH, exit 0)"
set +e
docker compose --profile bot run --rm --no-deps -T bot python challenger.py --once --limit 10
BOT_RC=$?
set -e
echo "  bot exit = $BOT_RC"
[[ "$BOT_RC" -eq 0 ]] || fail "bot match-case: exit $BOT_RC, expected 0"

# ── 5. Tamper ──────────────────────────────────────────────────────────────
step "5. Tamper data.json (flip observed_value)"
be_py tamper "$DATA_CID"

# ── 6. Bot dispute case ────────────────────────────────────────────────────
step "6. Run challenger bot (expect DISPUTE, exit 1)"
set +e
docker compose --profile bot run --rm --no-deps -T bot python challenger.py --once --limit 10
BOT_RC=$?
set -e
echo "  bot exit = $BOT_RC"
if [[ "$BOT_RC" -ne 1 ]]; then
    be_py restore "$DATA_CID" || true
    fail "bot dispute-case: exit $BOT_RC, expected 1"
fi

# ── 7. Restore ─────────────────────────────────────────────────────────────
step "7. Restore original data.json"
be_py restore "$DATA_CID"

echo
echo "=== E2E CHALLENGER: PASS ==="
echo "  - resolve.fingerprint == pending.fingerprint"
echo "  - bot match-case  exit 0"
echo "  - tamper detected, bot dispute-case exit 1"
echo "  - original data.json restored"
