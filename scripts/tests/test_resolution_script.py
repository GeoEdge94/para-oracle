"""
Tests du script standalone resolution_script.py.

Verifie que :
  - Le script lit un data.json, recompute le fingerprint et applique le seuil.
  - Le fingerprint produit matche celui calcule par le module backend canonical.
  - Les exit codes sont corrects (0 OK, 1 mismatch, 2 erreur structurelle).
  - Les overrides --threshold et --direction fonctionnent.
"""
from __future__ import annotations
import json
import os
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent.parent
SCRIPT_PATH = SCRIPT_DIR / "resolution_script.py"


def _run(manifest_path: Path, *extra_args: str) -> tuple[int, dict]:
    cmd = [sys.executable, str(SCRIPT_PATH), str(manifest_path), *extra_args]
    r = subprocess.run(cmd, capture_output=True, text=True)
    out = r.stdout.strip()
    parsed = json.loads(out) if out else {}
    return r.returncode, parsed


def _write_manifest(tmp_path: Path, manifest: dict) -> Path:
    p = tmp_path / "data.json"
    p.write_text(json.dumps(manifest), encoding="utf-8")
    return p


WEATHER_MANIFEST = {
    "schema_version": "v1",
    "pipeline_kind": "weather",
    "bet_slug": "test-weather-01",
    "period": {"start": "2025-01-01", "end": "2025-01-31"},
    "region_bbox": [2.20, 48.80, 2.50, 48.95],
    "fingerprint_inputs": {
        "variable": "total_precipitation",
        "aggregation": "max",
        "values": [1.2, 3.4, 84.4, 0.0, 12.5],
        "grid_resolution_deg": 0.1,
        "source": "ERA5-Land (mock)",
        "request": {"variable": "total_precipitation"},
    },
    "result": {
        "outcome_yes": True,
        "observed_value": 84.4,
        "threshold_value": 30.0,
        "threshold_unit": "mm",
        "direction": "gte",
    },
}


def test_happy_path_weather(tmp_path):
    p = _write_manifest(tmp_path, WEATHER_MANIFEST)
    code, out = _run(p)
    assert code == 0, out
    assert out["outcome_yes"] is True
    assert out["observed_value"] == 84.4
    assert out["threshold_value"] == 30.0
    assert out["direction"] == "gte"
    assert out["fingerprint_sha256"].startswith("sha256:")
    assert out["fingerprint_verified"] is True  # not-checked defaults to True


def test_fingerprint_matches_backend_canonical(tmp_path):
    """Le fingerprint calcule par le script doit etre identique a celui du module backend."""
    p = _write_manifest(tmp_path, WEATHER_MANIFEST)
    code, out = _run(p)
    assert code == 0
    script_fp = out["fingerprint_sha256"]

    # Import du module backend pour comparer
    sys.path.insert(0, str(SCRIPT_DIR.parent / "backend"))
    from app.services.canonical import fingerprint_sha256 as backend_fp
    sys.path.pop(0)

    assert script_fp == backend_fp(WEATHER_MANIFEST), \
        f"script {script_fp} != backend {backend_fp(WEATHER_MANIFEST)}"


def test_expected_fingerprint_match(tmp_path):
    p = _write_manifest(tmp_path, WEATHER_MANIFEST)
    code0, out0 = _run(p)
    fp = out0["fingerprint_sha256"]

    code, out = _run(p, "--expected-fingerprint", fp)
    assert code == 0
    assert out["fingerprint_verified"] is True
    assert out["fingerprint_verify_detail"] == "match"


def test_expected_fingerprint_mismatch(tmp_path):
    p = _write_manifest(tmp_path, WEATHER_MANIFEST)
    code, out = _run(p, "--expected-fingerprint", "sha256:deadbeef")
    assert code == 1  # mismatch -> exit 1
    assert out["fingerprint_verified"] is False
    assert out["fingerprint_verify_detail"] == "mismatch"


def test_threshold_override(tmp_path):
    p = _write_manifest(tmp_path, WEATHER_MANIFEST)
    # Override a 100mm -> observed 84.4 < 100 -> NO (gte 100)
    code, out = _run(p, "--threshold", "100")
    assert code == 0
    assert out["threshold_value"] == 100.0
    assert out["outcome_yes"] is False


def test_direction_override(tmp_path):
    p = _write_manifest(tmp_path, WEATHER_MANIFEST)
    # 84.4 <= 30 -> False
    code, out = _run(p, "--direction", "lte")
    assert code == 0
    assert out["direction"] == "lte"
    assert out["outcome_yes"] is False


def test_unsupported_schema(tmp_path):
    bad = dict(WEATHER_MANIFEST, schema_version="v2")
    p = _write_manifest(tmp_path, bad)
    code, out = _run(p)
    assert code == 2
    assert "unsupported schema_version" in out["error"]


def test_missing_field(tmp_path):
    bad = dict(WEATHER_MANIFEST)
    del bad["result"]
    p = _write_manifest(tmp_path, bad)
    code, out = _run(p)
    assert code == 2
    assert "result" in out["error"]


def test_spectral_manifest(tmp_path):
    """Le script doit fonctionner aussi pour les manifests spectral."""
    manifest = {
        "schema_version": "v1",
        "pipeline_kind": "spectral",
        "bet_slug": "test-spectral-01",
        "period": {"start": "2025-01-01", "end": "2025-06-30"},
        "region_bbox": [-59.0, -9.5, -46.0, 2.5],
        "fingerprint_inputs": {
            "rasters": [
                {"kind": "ndvi_t0", "cid": "bafybei...", "sha256": "sha256:abc", "bbox": [-59.0, -9.5, -46.0, 2.5]},
                {"kind": "ndvi_t1", "cid": "bafybei...", "sha256": "sha256:def", "bbox": [-59.0, -9.5, -46.0, 2.5]},
                {"kind": "delta", "cid": "bafybei...", "sha256": "sha256:ghi", "bbox": [-59.0, -9.5, -46.0, 2.5]},
                {"kind": "mask", "cid": "bafybei...", "sha256": "sha256:jkl", "bbox": [-59.0, -9.5, -46.0, 2.5]},
            ],
            "bands": ["B04", "B08"],
            "index_type": "NDVI",
            "script_version": "spectral-pipeline-v2.0.0",
        },
        "result": {
            "outcome_yes": True,
            "observed_value": 4884.37,
            "threshold_value": 4200.0,
            "threshold_unit": "km2",
            "direction": "gt",
        },
    }
    p = _write_manifest(tmp_path, manifest)
    code, out = _run(p)
    assert code == 0
    assert out["outcome_yes"] is True
    assert out["pipeline_kind"] == "spectral"
    assert out["observed_value"] == 4884.37
