"""
Canonical JSON normalization + SHA-256 fingerprinting.

Ce module est la brique critique du pipeline Web3 : il transforme un dict Python
en bytes JSON canoniques et deterministes, puis calcule un SHA-256 reproductible
par n'importe quel tiers.

Contraintes figees (schema_v1) :
  - sort_keys=True (ordre alphabetique des cles)
  - separators=(",", ":") (pas d'espaces)
  - allow_nan=False (NaN/Infinity interdits)
  - floats arrondis a 6 decimales avant serialisation
  - pas d'encodage ASCII-only (on garde UTF-8 brut)

Tout changement de ce module doit bumper schema_version a v2.
"""
from __future__ import annotations
import hashlib
import json
from typing import Any

SCHEMA_VERSION = "v1"
FLOAT_PRECISION = 6


def _round_floats(value: Any) -> Any:
    """Recursivement arrondit les floats a FLOAT_PRECISION decimales."""
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
    """
    Serialise un dict en JSON canonique deterministe.

    Exemple :
      >>> canonicalize({"b": 2, "a": 1.123456789})
      b'{"a":1.123457,"b":2}'
    """
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
    """
    Calcule le SHA-256 du JSON canonique d'un dict.

    Retourne un prefixe "sha256:" pour eviter toute ambiguite sur l'algo.
    """
    digest = hashlib.sha256(canonicalize(data)).hexdigest()
    return f"sha256:{digest}"


def verify_fingerprint(data: dict, expected: str) -> bool:
    """Verifie qu'un dict produit bien le fingerprint attendu."""
    return fingerprint_sha256(data) == expected
