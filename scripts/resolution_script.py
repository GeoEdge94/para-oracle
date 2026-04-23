#!/usr/bin/env python3
"""
resolution_script.py — verification publique d'une resolution ParaOracle.

Ce script est publie sur IPFS a chaque resolution et reference on-chain via
son CID. N'importe qui peut le telecharger, l'executer sur les donnees pinnees,
et verifier independamment le resultat de l'oracle.

Contrat :
  1. Recupere le manifest (data.json) passe en argument.
  2. Recompute le fingerprint canonique SHA-256 du manifest.
  3. (Si --expected-fingerprint fourni) verifie qu'il matche.
  4. Applique la logique de seuil depuis manifest.result.
  5. Imprime un JSON : {outcome_yes, observed_value, fingerprint_sha256, verified}.

Usage :
  python resolution_script.py data.json
  python resolution_script.py data.json --expected-fingerprint sha256:abcd...
  python resolution_script.py data.json --threshold 30 --direction gte

Si --threshold et --direction sont fournis, ils override les valeurs du
manifest (mode challenge : qqn peut tester si un autre seuil aurait donne
un resultat different).

Stdlib only — pas de dependance externe. Une seule version figee ; toute
modification brise les audits historiques.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import sys
from typing import Any


SCRIPT_VERSION = "resolution-script-v1.0.0"
SCHEMA_VERSION = "v1"
FLOAT_PRECISION = 6


# ─── Canonicalisation (doit matcher backend/app/services/canonical.py v1) ──

def _round_floats(value: Any) -> Any:
    if isinstance(value, float):
        return round(value, FLOAT_PRECISION)
    if isinstance(value, dict):
        return {k: _round_floats(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_round_floats(v) for v in value]
    if isinstance(value, tuple):
        return [_round_floats(v) for v in value]
    return value


def canonicalize(data: dict) -> bytes:
    normalized = _round_floats(data)
    text = json.dumps(
        normalized,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
        ensure_ascii=False,
    )
    return text.encode("utf-8")


def fingerprint_sha256(data: dict) -> str:
    return "sha256:" + hashlib.sha256(canonicalize(data)).hexdigest()


# ─── Verification du seuil ─────────────────────────────────────────────────

def evaluate_threshold(observed: float, threshold: float, direction: str) -> bool:
    if direction == "gte":
        return observed >= threshold
    if direction == "gt":
        return observed > threshold
    if direction == "lte":
        return observed <= threshold
    if direction == "lt":
        return observed < threshold
    raise ValueError(f"Unknown direction: {direction!r}. Expected gte|gt|lte|lt.")


# ─── Main ──────────────────────────────────────────────────────────────────

def main() -> int:
    ap = argparse.ArgumentParser(description="ParaOracle public verification script")
    ap.add_argument("manifest", help="Path to data.json (downloaded from IPFS)")
    ap.add_argument("--expected-fingerprint", default=None,
                    help='Expected "sha256:..." fingerprint (e.g. from on-chain)')
    ap.add_argument("--threshold", type=float, default=None,
                    help="Override threshold value from manifest.result")
    ap.add_argument("--direction", default=None, choices=["gte", "gt", "lte", "lt"],
                    help="Override direction from manifest.result")
    args = ap.parse_args()

    with open(args.manifest, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    # Validation structurelle minimale
    schema_version = manifest.get("schema_version")
    if schema_version != SCHEMA_VERSION:
        print(json.dumps({
            "error": f"unsupported schema_version: {schema_version!r} (expected {SCHEMA_VERSION!r})",
        }))
        return 2

    required = {"pipeline_kind", "bet_slug", "period", "fingerprint_inputs", "result"}
    missing = required - set(manifest.keys())
    if missing:
        print(json.dumps({"error": f"missing required fields: {sorted(missing)}"}))
        return 2

    result_block = manifest["result"]
    observed = float(result_block["observed_value"])
    threshold = float(args.threshold if args.threshold is not None else result_block["threshold_value"])
    direction = args.direction or result_block.get("direction", "gt")

    # Recompute fingerprint
    computed_fp = fingerprint_sha256(manifest)

    # Verify against expected (if provided)
    verified = True
    verify_detail = "not-checked"
    if args.expected_fingerprint:
        verified = computed_fp == args.expected_fingerprint
        verify_detail = "match" if verified else "mismatch"

    # Apply threshold logic
    outcome_yes = evaluate_threshold(observed, threshold, direction)

    output = {
        "script_version": SCRIPT_VERSION,
        "schema_version": schema_version,
        "pipeline_kind": manifest["pipeline_kind"],
        "bet_slug": manifest["bet_slug"],
        "outcome_yes": outcome_yes,
        "observed_value": observed,
        "threshold_value": threshold,
        "threshold_unit": result_block.get("threshold_unit", ""),
        "direction": direction,
        "fingerprint_sha256": computed_fp,
        "expected_fingerprint": args.expected_fingerprint,
        "fingerprint_verified": verified,
        "fingerprint_verify_detail": verify_detail,
    }
    print(json.dumps(output, sort_keys=True, separators=(",", ":"), ensure_ascii=False))

    # Exit codes: 0 = OK (fingerprint matches or not checked), 1 = fingerprint mismatch, 2 = structural error
    if args.expected_fingerprint and not verified:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
