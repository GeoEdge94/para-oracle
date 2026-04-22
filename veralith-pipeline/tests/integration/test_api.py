"""Tests HTTP API via TestClient (no real network)."""
import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient

from api.main import app


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def resolve_payload():
    end = datetime.now(timezone.utc)
    return {
        "market_id": "test-flood-assam-2026",
        "policy_id": "flood",
        "bbox": {"west": 89.0, "south": 25.0, "east": 97.0, "north": 28.5},
        "period": {
            "start": (end - timedelta(days=30)).isoformat(),
            "end": end.isoformat(),
        },
        "pin_ipfs": True,
        "persist": True,
    }


# ── Health + catalog ────────────────────────────────────────────────────────

def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["service"] == "veralith-api"


def test_list_sources(client):
    r = client.get("/v1/catalog/sources")
    assert r.status_code == 200
    names = {s["name"] for s in r.json()}
    assert names == {"NASA_FIRMS", "EFFIS", "NOAA", "USGS", "VIGICRUES"}


def test_list_policies(client):
    r = client.get("/v1/catalog/policies")
    assert r.status_code == 200
    ids = {p["id"] for p in r.json()}
    assert "wildfire-default-v1" in ids
    assert "flood-default-v1" in ids
    assert "earthquake-default-v1" in ids


# ── Resolve ─────────────────────────────────────────────────────────────────

def test_resolve_flood_returns_bundle(client, resolve_payload):
    r = client.post("/v1/resolve", json=resolve_payload)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["market_id"] == "test-flood-assam-2026"
    assert body["policy_id"] == "flood-default-v1"
    assert body["outcome"] in ("YES", "NO", "INDETERMINATE")
    assert body["bundle_hash"].startswith("sha256:")
    assert body["ipfs_cid"] is not None and body["ipfs_cid"].startswith("bafybei")


def test_resolve_unknown_policy(client, resolve_payload):
    resolve_payload["policy_id"] = "nonexistent"
    r = client.post("/v1/resolve", json=resolve_payload)
    assert r.status_code == 404


def test_resolve_unknown_source(client, resolve_payload):
    resolve_payload["sources"] = ["SPACEX"]
    r = client.post("/v1/resolve", json=resolve_payload)
    assert r.status_code == 400


def test_resolve_rejects_bad_bbox(client, resolve_payload):
    resolve_payload["bbox"]["west"] = 500
    r = client.post("/v1/resolve", json=resolve_payload)
    assert r.status_code == 422  # pydantic validation


# ── Lookups ─────────────────────────────────────────────────────────────────

def test_get_market_resolution_roundtrip(client, resolve_payload):
    submit = client.post("/v1/resolve", json=resolve_payload).json()
    r = client.get(f"/v1/markets/{resolve_payload['market_id']}/resolution")
    assert r.status_code == 200
    assert r.json()["bundle_hash"] == submit["bundle_hash"]


def test_get_evidence_by_hash(client, resolve_payload):
    submit = client.post("/v1/resolve", json=resolve_payload).json()
    bundle_hash = submit["bundle_hash"].replace("sha256:", "")
    # Index was stored with full hash including sha256: prefix as key suffix
    r = client.get(f"/v1/evidence/{submit['bundle_hash']}")
    assert r.status_code == 200
    assert r.json()["market_id"] == resolve_payload["market_id"]


def test_get_market_not_found(client):
    r = client.get("/v1/markets/nope-xxx/resolution")
    assert r.status_code == 404
