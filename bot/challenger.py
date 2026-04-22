"""
challenger.py — challenge bot open-source pour ParaOracle.

Ce process est volontairement decouple du backend :
  - Aucune dependance sur app.*, SQLAlchemy, FastAPI.
  - Dependances minimales : httpx (feed + IPFS gateway), stdlib.
  - web3 sera ajoute en M4bis pour dispute on-chain reel.

Flux :
  1. Poll GET {BACKEND_URL}/oracle/pending
  2. Pour chaque item :
     a. Fetch data.json depuis {GATEWAY_BASE}/{data_cid}
     b. Recompute le fingerprint canonique (via resolution_script.py subprocess)
     c. Compare au fingerprint_sha256 attendu
     d. Compare l'outcome au outcome_claimed
     e. Si divergence, log DISPUTE (en M4bis : appel contract.dispute())

N'importe qui peut faire tourner ce bot. Il n'a pas besoin d'acces privilegie
au backend ni a la DB. Le seul secret en vrai (M4bis) sera CHALLENGER_PRIVATE_KEY
pour signer les tx dispute.
"""
from __future__ import annotations
import argparse
import json
import os
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

import httpx


BACKEND_URL   = os.environ.get("BACKEND_URL", "http://backend:8000")
GATEWAY_BASE  = os.environ.get("IPFS_GATEWAY_URL", "http://backend:8000/ipfs-mock/")
POLL_SECONDS  = int(os.environ.get("CHALLENGER_POLL_SECONDS", "30"))
SCRIPT_PATH   = Path(os.environ.get("RESOLUTION_SCRIPT_PATH", "/scripts/resolution_script.py"))
MOCK_IPFS_DIR = Path(os.environ.get("MOCK_IPFS_DIR", "/data/ipfs-mock"))


@dataclass
class Verdict:
    analysis_id: str
    bet_slug: str
    matches: bool                 # True = bot confirms the oracle; False = would dispute
    reason: str
    expected_fp: str
    computed_fp: str
    outcome_claimed: Optional[bool]
    outcome_recomputed: Optional[bool]


def _fetch_pending(limit: int = 50) -> dict:
    url = f"{BACKEND_URL.rstrip('/')}/oracle/pending?limit={limit}"
    r = httpx.get(url, timeout=30)
    r.raise_for_status()
    return r.json()


def _fetch_data_json(cid: str) -> bytes:
    """Recupere data.json via gateway HTTP, ou mock local si pas de gateway."""
    if MOCK_IPFS_DIR.exists():
        candidate = MOCK_IPFS_DIR / cid
        if candidate.exists():
            return candidate.read_bytes()
    # Fallback gateway HTTP
    url = f"{GATEWAY_BASE.rstrip('/')}/{cid}"
    r = httpx.get(url, timeout=60)
    r.raise_for_status()
    return r.content


def _run_resolution_script(manifest_path: Path, expected_fp: str) -> dict:
    """Execute resolution_script.py et retourne le JSON parse."""
    r = subprocess.run(
        [sys.executable, str(SCRIPT_PATH), str(manifest_path), "--expected-fingerprint", expected_fp],
        capture_output=True, text=True, timeout=30,
    )
    # Le script ecrit sur stdout un JSON (exit 0=match, 1=mismatch, 2=structural)
    if not r.stdout.strip():
        raise RuntimeError(f"resolution_script empty stdout, stderr={r.stderr!r}")
    return json.loads(r.stdout.strip())


def verify_item(item: dict[str, Any], tmp_dir: Path) -> Verdict:
    bet_slug = item["bet_slug"]
    analysis_id = item["analysis_id"]
    expected_fp = item["fingerprint_sha256"]
    data_cid = item["data_cid"]
    outcome_claimed = item.get("outcome_claimed")

    if not expected_fp or not data_cid:
        return Verdict(analysis_id, bet_slug, False, "missing fingerprint or data_cid",
                       expected_fp or "", "", outcome_claimed, None)

    # 1. Download data.json
    try:
        data_bytes = _fetch_data_json(data_cid)
    except Exception as e:
        return Verdict(analysis_id, bet_slug, False, f"fetch data.json failed: {e}",
                       expected_fp, "", outcome_claimed, None)

    # 2. Ecrire sur disque temporaire pour que le script le lise
    tmp_file = tmp_dir / f"{analysis_id}.json"
    tmp_file.write_bytes(data_bytes)

    # 3. Run resolution_script.py standalone
    try:
        out = _run_resolution_script(tmp_file, expected_fp)
    except Exception as e:
        return Verdict(analysis_id, bet_slug, False, f"resolution_script error: {e}",
                       expected_fp, "", outcome_claimed, None)

    computed_fp = out.get("fingerprint_sha256", "")
    recomputed_outcome = out.get("outcome_yes")

    if not out.get("fingerprint_verified", False):
        return Verdict(
            analysis_id, bet_slug, False,
            f"fingerprint mismatch ({out.get('fingerprint_verify_detail','?')})",
            expected_fp, computed_fp, outcome_claimed, recomputed_outcome,
        )

    if outcome_claimed is not None and recomputed_outcome != outcome_claimed:
        return Verdict(
            analysis_id, bet_slug, False,
            f"outcome divergence: claimed={outcome_claimed} recomputed={recomputed_outcome}",
            expected_fp, computed_fp, outcome_claimed, recomputed_outcome,
        )

    return Verdict(
        analysis_id, bet_slug, True,
        "match (fingerprint + outcome)",
        expected_fp, computed_fp, outcome_claimed, recomputed_outcome,
    )


def run_once(tmp_dir: Path, limit: int = 50) -> list[Verdict]:
    feed = _fetch_pending(limit=limit)
    items = feed.get("items", [])
    verdicts = [verify_item(it, tmp_dir) for it in items]
    return verdicts


def fmt_verdict(v: Verdict) -> str:
    status = "[OK]" if v.matches else "[DISPUTE]"
    return (
        f"{status} {v.bet_slug} (analysis={v.analysis_id[:8]}): {v.reason} | "
        f"expected={v.expected_fp[:24]}... computed={v.computed_fp[:24]}..."
    )


def main() -> int:
    ap = argparse.ArgumentParser(description="ParaOracle challenge bot")
    ap.add_argument("--once", action="store_true", help="run one pass then exit")
    ap.add_argument("--limit", type=int, default=50, help="max items per poll")
    args = ap.parse_args()

    if not SCRIPT_PATH.exists():
        print(f"[FATAL] resolution_script.py not found at {SCRIPT_PATH}", file=sys.stderr)
        return 2

    tmp_dir = Path("/tmp/challenger")
    tmp_dir.mkdir(parents=True, exist_ok=True)

    print(f"[challenger] backend={BACKEND_URL} gateway={GATEWAY_BASE} script={SCRIPT_PATH}")
    print(f"[challenger] mock_ipfs_dir={MOCK_IPFS_DIR} (exists={MOCK_IPFS_DIR.exists()})")

    dispute_count = 0
    match_count = 0

    while True:
        try:
            verdicts = run_once(tmp_dir, limit=args.limit)
        except Exception as e:
            print(f"[challenger] poll error: {e}", file=sys.stderr)
            verdicts = []

        for v in verdicts:
            if v.matches:
                match_count += 1
            else:
                dispute_count += 1
            print(fmt_verdict(v), flush=True)

        if verdicts:
            print(f"[challenger] summary: {match_count} match / {dispute_count} dispute", flush=True)

        if args.once:
            return 1 if dispute_count > 0 else 0

        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    sys.exit(main())
