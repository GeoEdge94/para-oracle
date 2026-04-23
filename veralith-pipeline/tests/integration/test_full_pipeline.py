"""
Tests integration : pipeline complet end-to-end.

Ingest (mock) → Normalize → Resolve (policy YAML) → Build evidence → Pin IPFS
"""
import pytest
from datetime import datetime, timezone
from pathlib import Path

from veralith_pipeline.ingestion import (
    NasaFirmsConnector, EffisConnector, NoaaConnector, VigicruesConnector, UsgsConnector,
)
from veralith_pipeline.normalization.transformers import normalize_batch
from veralith_pipeline.normalization.validator import SchemaValidator
from veralith_pipeline.resolution.policy_engine import Policy, PolicyEngine
from veralith_pipeline.resolution.evidence_builder import EvidenceBuilder
from veralith_pipeline.resolution.conflict_resolver import ConflictResolver
from veralith_pipeline.storage import IpfsClient, FirestoreClient


POLICIES_DIR = Path(__file__).parent.parent.parent / "src" / "veralith_pipeline" / "resolution" / "policies"


@pytest.mark.integration
def test_wildfire_pipeline_end_to_end(bbox_california, time_range_30d):
    """Pipeline complet pour un pari wildfire Californie."""
    # 1. Ingestion 3 sources
    raw_events = []
    for ConnectorCls in [NasaFirmsConnector, EffisConnector, NoaaConnector]:
        res = ConnectorCls(mock=True).fetch(bbox_california, time_range_30d)
        raw_events.extend(res.events)

    assert len(raw_events) >= 5

    # 2. Normalization
    normalized = normalize_batch(raw_events)
    assert all(n.schema_version == "1.0.0" for n in normalized)

    # 3. Validation
    valid, _ = SchemaValidator().validate_batch(normalized)
    assert len(valid) == len(normalized)

    # 4. Conflict resolution
    winners, _ = ConflictResolver().resolve(valid)

    # 5. Apply wildfire policy
    policy = Policy.from_yaml(POLICIES_DIR / "wildfire.yaml")
    result = PolicyEngine().evaluate(policy, winners)

    # 6. Build evidence bundle
    bundle = EvidenceBuilder().build(bet_id="california-wildfire-2026-test",
                                     policy_result=result,
                                     timestamp=datetime(2026, 4, 21, tzinfo=timezone.utc))
    assert bundle.bundle_hash.startswith("sha256:")
    assert bundle.outcome in ("YES", "NO", "INDETERMINATE")

    # 7. Pin IPFS (mock)
    cid = IpfsClient(mock=True).pin_json(bundle.canonical_dict())
    assert cid.startswith("bafybei")

    # 8. Persist Firestore (mock)
    fs = FirestoreClient(mock=True)
    fs.store(bundle.bet_id, {"bundle": bundle.canonical_dict(), "ipfs_cid": cid})
    retrieved = fs.get(bundle.bet_id)
    assert retrieved is not None
    assert retrieved["ipfs_cid"] == cid


@pytest.mark.integration
def test_flood_pipeline_with_vigicrues(bbox_france, time_range_30d):
    """Pari inondation France via Vigicrues seul (policy permet 1 source)."""
    raw_events = VigicruesConnector(mock=True).fetch(bbox_france, time_range_30d).events
    normalized = normalize_batch(raw_events)
    policy = Policy.from_yaml(POLICIES_DIR / "flood.yaml")
    result = PolicyEngine().evaluate(policy, normalized)

    # Mock Vigicrues retourne 2 events alert_level=3 → severity = (3-1)/3 = 0.667
    # Policy threshold max_severity > 0.66 → YES
    assert result.outcome.value == "YES"


@pytest.mark.integration
def test_earthquake_pipeline_usgs(bbox_california, time_range_30d):
    raw = UsgsConnector(mock=True).fetch(bbox_california, time_range_30d).events
    normalized = normalize_batch(raw)
    policy = Policy.from_yaml(POLICIES_DIR / "earthquake.yaml")
    result = PolicyEngine().evaluate(policy, normalized)
    assert result.outcome.value in ("YES", "NO", "INDETERMINATE")


@pytest.mark.integration
def test_pipeline_deterministic_3_runs(bbox_california, time_range_30d):
    """3 runs identiques → memes bundle_hashes."""
    policy = Policy.from_yaml(POLICIES_DIR / "wildfire.yaml")
    fixed_ts = datetime(2026, 4, 21, 12, tzinfo=timezone.utc)
    bundle_hashes = []

    for _ in range(3):
        # NB: connector mock genere les memes events car coords sont calcules depuis bbox
        raws = []
        for cls in [NasaFirmsConnector, EffisConnector, NoaaConnector]:
            raws.extend(cls(mock=True).fetch(bbox_california, time_range_30d).events)
        normalized = normalize_batch(raws)
        result = PolicyEngine().evaluate(policy, normalized)
        bundle = EvidenceBuilder().build(bet_id="repro-test", policy_result=result,
                                         timestamp=fixed_ts)
        bundle_hashes.append(bundle.bundle_hash)

    assert bundle_hashes[0] == bundle_hashes[1] == bundle_hashes[2], (
        f"Pipeline non-deterministic: {bundle_hashes}"
    )
