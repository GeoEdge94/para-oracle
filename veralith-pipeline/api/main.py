"""
Veralith API — HTTP layer exposing the resolution pipeline.

Endpoints:
  POST   /v1/resolve                      execute pipeline → return EvidenceBundle
  GET    /v1/evidence/{hash}              fetch stored bundle by SHA-256
  GET    /v1/markets/{market_id}/resolution   fetch by market id
  GET    /v1/catalog/sources              list available data sources
  GET    /v1/catalog/policies             list policies (id, version, description)
  GET    /health

Run:
  uvicorn api.main:app --reload --host 0.0.0.0 --port 8080

Env:
  VERALITH_POLICIES_DIR    default: src/veralith_pipeline/resolution/policies
  VERALITH_MOCK            default: true (no network calls)
  IPFS_API_TOKEN           optional
  FIRESTORE_PROJECT        optional
"""
from __future__ import annotations
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from veralith_pipeline.ingestion import (
    BoundingBox, TimeRange,
    NasaFirmsConnector, EffisConnector, NoaaConnector, UsgsConnector, VigicruesConnector,
)
from veralith_pipeline.normalization import normalize_batch, SchemaValidator
from veralith_pipeline.resolution import (
    Policy, PolicyEngine, ConflictResolver, EvidenceBuilder,
)
from veralith_pipeline.storage import IpfsClient, FirestoreClient


# ── Config ──────────────────────────────────────────────────────────────────

POLICIES_DIR = Path(
    os.getenv("VERALITH_POLICIES_DIR",
              str(Path(__file__).parent.parent / "src/veralith_pipeline/resolution/policies"))
)
MOCK_MODE = os.getenv("VERALITH_MOCK", "true").lower() == "true"
IPFS_TOKEN = os.getenv("IPFS_API_TOKEN") or None
FIRESTORE_PROJECT = os.getenv("FIRESTORE_PROJECT") or None


# ── Shared clients ──────────────────────────────────────────────────────────

ipfs = IpfsClient(mock=MOCK_MODE or not IPFS_TOKEN, api_token=IPFS_TOKEN)
store = FirestoreClient(mock=MOCK_MODE or not FIRESTORE_PROJECT, project_id=FIRESTORE_PROJECT)

CONNECTORS = {
    "NASA_FIRMS": NasaFirmsConnector,
    "EFFIS": EffisConnector,
    "NOAA": NoaaConnector,
    "USGS": UsgsConnector,
    "VIGICRUES": VigicruesConnector,
}


# ── Schemas ─────────────────────────────────────────────────────────────────

class BBoxIn(BaseModel):
    west: float = Field(ge=-180, le=180)
    south: float = Field(ge=-90, le=90)
    east: float = Field(ge=-180, le=180)
    north: float = Field(ge=-90, le=90)


class PeriodIn(BaseModel):
    start: datetime
    end: datetime


class ResolveRequest(BaseModel):
    market_id: str = Field(description="Unique bet identifier (e.g. 'flood-assam-2026')")
    policy_id: str = Field(description="Policy file name without .yaml (e.g. 'wildfire')")
    bbox: BBoxIn
    period: PeriodIn
    sources: list[str] | None = Field(
        default=None,
        description="Optional override list. Defaults to policy.allowed_sources.",
    )
    pin_ipfs: bool = True
    persist: bool = True


class EvidenceOut(BaseModel):
    market_id: str
    policy_id: str
    policy_version: str
    outcome: str
    aggregated_value: float
    threshold: float
    bundle_hash: str
    ipfs_cid: str | None
    timestamp: datetime
    events_count: int
    sources_summary: dict[str, dict[str, float]]


class SourceInfo(BaseModel):
    name: str
    event_types: list[str]
    requires_api_key: bool
    coverage: str


class PolicyInfo(BaseModel):
    id: str
    version: str
    event_type: str
    threshold: float
    aggregation: str
    allowed_sources: list[str]
    min_sources_agree: int


# ── App ─────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Veralith Resolution API",
    description=(
        "Geospatial oracle — ingest multi-source events, resolve via YAML policies, "
        "produce canonical EvidenceBundle + IPFS pin + EIP-712 ready hash."
    ),
    version="0.1.0",
    contact={"name": "Veralith", "url": "https://veralith.io"},
    license_info={"name": "MIT"},
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # lock down in production
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Endpoints ───────────────────────────────────────────────────────────────

@app.get("/health", tags=["meta"])
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "veralith-api",
        "mode": "mock" if MOCK_MODE else "live",
        "policies_dir": str(POLICIES_DIR),
    }


@app.get("/v1/catalog/sources", tags=["catalog"], response_model=list[SourceInfo])
def list_sources() -> list[SourceInfo]:
    return [
        SourceInfo(name="NASA_FIRMS", event_types=["wildfire"], requires_api_key=True, coverage="global"),
        SourceInfo(name="EFFIS", event_types=["wildfire"], requires_api_key=False, coverage="europe"),
        SourceInfo(name="NOAA", event_types=["wildfire", "flood", "storm", "tornado", "hurricane"],
                   requires_api_key=False, coverage="usa"),
        SourceInfo(name="USGS", event_types=["earthquake"], requires_api_key=False, coverage="global"),
        SourceInfo(name="VIGICRUES", event_types=["flood"], requires_api_key=False, coverage="france"),
    ]


@app.get("/v1/catalog/policies", tags=["catalog"], response_model=list[PolicyInfo])
def list_policies() -> list[PolicyInfo]:
    policies: list[PolicyInfo] = []
    if not POLICIES_DIR.exists():
        return policies
    for yf in sorted(POLICIES_DIR.glob("*.yaml")):
        p = Policy.from_yaml(yf)
        policies.append(PolicyInfo(
            id=p.id, version=p.version, event_type=p.event_type,
            threshold=p.threshold, aggregation=p.aggregation,
            allowed_sources=list(p.allowed_sources),
            min_sources_agree=p.min_sources_agree,
        ))
    return policies


@app.post("/v1/resolve", tags=["oracle"], response_model=EvidenceOut)
def resolve(req: ResolveRequest) -> EvidenceOut:
    # 1. Load policy
    policy_path = POLICIES_DIR / f"{req.policy_id}.yaml"
    if not policy_path.exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Policy {req.policy_id!r} not found")
    policy = Policy.from_yaml(policy_path)

    # 2. Pick sources
    sources = req.sources or list(policy.allowed_sources)
    unknown = [s for s in sources if s not in CONNECTORS]
    if unknown:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Unknown sources: {unknown}")

    # 3. Build domain types
    bbox = BoundingBox(west=req.bbox.west, south=req.bbox.south,
                       east=req.bbox.east, north=req.bbox.north)

    start = req.period.start if req.period.start.tzinfo else req.period.start.replace(tzinfo=timezone.utc)
    end = req.period.end if req.period.end.tzinfo else req.period.end.replace(tzinfo=timezone.utc)
    tr = TimeRange(start=start, end=end)

    # 4. Ingest
    raw_events = []
    for name in sources:
        ConnectorCls = CONNECTORS[name]
        api_key = os.getenv(f"{name}_API_KEY")
        try:
            res = ConnectorCls(mock=MOCK_MODE, api_key=api_key).fetch(bbox, tr)
            if res.error:
                continue
            raw_events.extend(res.events)
        except Exception:
            continue

    # 5. Normalize + validate + resolve conflicts
    normalized = normalize_batch(raw_events)
    valid, _ = SchemaValidator().validate_batch(normalized)
    winners, _ = ConflictResolver().resolve(valid)

    # 6. Evaluate policy
    result = PolicyEngine().evaluate(policy, winners)

    # 7. Build bundle
    bundle = EvidenceBuilder().build(bet_id=req.market_id, policy_result=result)

    # 8. Pin IPFS
    cid = None
    if req.pin_ipfs:
        cid = ipfs.pin_json(bundle.canonical_dict())

    # 9. Persist
    if req.persist:
        store.store(req.market_id, {
            "bundle": bundle.canonical_dict(),
            "ipfs_cid": cid,
            "bundle_hash": bundle.bundle_hash,
        })
        # Also index by hash for /v1/evidence lookup
        store.store(f"hash:{bundle.bundle_hash}", {
            "market_id": req.market_id,
            "bundle": bundle.canonical_dict(),
            "ipfs_cid": cid,
        })

    return EvidenceOut(
        market_id=req.market_id,
        policy_id=result.policy_id,
        policy_version=result.policy_version,
        outcome=result.outcome.value,
        aggregated_value=result.aggregated_value,
        threshold=result.threshold,
        bundle_hash=bundle.bundle_hash,
        ipfs_cid=cid,
        timestamp=bundle.timestamp,
        events_count=len(bundle.contributing_events),
        sources_summary=bundle.sources_summary,
    )


@app.get("/v1/evidence/{hash_value}", tags=["oracle"])
def get_evidence_by_hash(hash_value: str) -> dict[str, Any]:
    key = f"hash:{hash_value}" if not hash_value.startswith("hash:") else hash_value
    data = store.get(key)
    if data is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Evidence bundle not found")
    return data


@app.get("/v1/markets/{market_id}/resolution", tags=["oracle"])
def get_resolution_by_market(market_id: str) -> dict[str, Any]:
    data = store.get(market_id)
    if data is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No resolution for market {market_id!r}")
    return data
