"""Tests resolution layer : policy engine, evidence builder, conflict resolver."""
import pytest
from datetime import datetime, timezone
from pathlib import Path

from veralith_pipeline.normalization.schemas import NormalizedEvent, EventType, EventLocation
from veralith_pipeline.resolution.policy_engine import (
    Policy, PolicyEngine, Outcome,
)
from veralith_pipeline.resolution.evidence_builder import EvidenceBuilder
from veralith_pipeline.resolution.conflict_resolver import ConflictResolver


def _evt(source: str, etype: str, lng: float, lat: float, conf: float = 0.8,
         severity: float | None = None, ts: datetime | None = None) -> NormalizedEvent:
    return NormalizedEvent(
        event_id=f"{source}-{lng}-{lat}",
        source=source,
        source_event_id=f"{source}-1",
        event_type=EventType(etype),
        timestamp=ts or datetime(2026, 4, 21, 12, tzinfo=timezone.utc),
        location=EventLocation(coordinates=(lng, lat)),
        confidence=conf,
        severity=severity,
    )


# ── Policy from YAML ─────────────────────────────────────────────────────────

POLICIES_DIR = Path(__file__).parent.parent.parent / "src" / "veralith_pipeline" / "resolution" / "policies"


class TestPolicyLoading:
    def test_load_wildfire(self):
        p = Policy.from_yaml(POLICIES_DIR / "wildfire.yaml")
        assert p.id == "wildfire-default-v1"
        assert p.event_type == "wildfire"
        assert "NASA_FIRMS" in p.allowed_sources
        assert p.min_sources_agree == 2

    def test_load_flood(self):
        p = Policy.from_yaml(POLICIES_DIR / "flood.yaml")
        assert p.aggregation == "max_severity"

    def test_load_earthquake(self):
        p = Policy.from_yaml(POLICIES_DIR / "earthquake.yaml")
        assert p.allowed_sources == ("USGS",)


# ── Policy Engine ────────────────────────────────────────────────────────────

class TestPolicyEngine:
    def test_count_aggregation_yes(self):
        policy = Policy(id="t", version="1", event_type="wildfire", threshold=2.0,
                        allowed_sources=("NASA_FIRMS", "EFFIS"), min_sources_agree=1,
                        aggregation="count")
        events = [_evt("NASA_FIRMS", "wildfire", -120, 37, conf=0.9) for _ in range(5)]
        # Mais event_id doit etre unique pour Pydantic on n'a pas de check, on s'en fout
        result = PolicyEngine().evaluate(policy, events)
        assert result.outcome == Outcome.YES
        assert result.aggregated_value == 5.0

    def test_count_aggregation_no(self):
        policy = Policy(id="t", version="1", event_type="wildfire", threshold=10.0,
                        allowed_sources=("NASA_FIRMS",), min_sources_agree=1,
                        aggregation="count")
        events = [_evt("NASA_FIRMS", "wildfire", -120, 37, conf=0.9) for _ in range(3)]
        result = PolicyEngine().evaluate(policy, events)
        assert result.outcome == Outcome.NO

    def test_indeterminate_when_quorum_missing(self):
        policy = Policy(id="t", version="1", event_type="wildfire", threshold=1.0,
                        allowed_sources=("NASA_FIRMS", "EFFIS"), min_sources_agree=2,
                        aggregation="count")
        events = [_evt("NASA_FIRMS", "wildfire", -120, 37, conf=0.9) for _ in range(5)]
        result = PolicyEngine().evaluate(policy, events)
        assert result.outcome == Outcome.INDETERMINATE

    def test_min_confidence_filter(self):
        policy = Policy(id="t", version="1", event_type="wildfire", threshold=0.5,
                        allowed_sources=("NASA_FIRMS",), min_sources_agree=1,
                        min_confidence=0.7, aggregation="count")
        events = [
            _evt("NASA_FIRMS", "wildfire", -120, 37, conf=0.5),
            _evt("NASA_FIRMS", "wildfire", -121, 38, conf=0.8),
        ]
        result = PolicyEngine().evaluate(policy, events)
        assert result.aggregated_value == 1.0   # only the conf=0.8 one

    def test_max_severity_aggregation(self):
        policy = Policy(id="t", version="1", event_type="flood", threshold=0.7,
                        allowed_sources=("VIGICRUES",), min_sources_agree=1,
                        aggregation="max_severity", min_severity=0.5)
        events = [
            _evt("VIGICRUES", "flood", 2.3, 48.8, conf=0.9, severity=0.6),
            _evt("VIGICRUES", "flood", 2.5, 48.9, conf=0.9, severity=0.8),
        ]
        result = PolicyEngine().evaluate(policy, events)
        assert result.outcome == Outcome.YES
        assert result.aggregated_value == 0.8

    def test_weighted_count(self):
        policy = Policy(id="t", version="1", event_type="wildfire", threshold=2.0,
                        allowed_sources=("NASA_FIRMS",), min_sources_agree=1,
                        aggregation="weighted_count")
        events = [_evt("NASA_FIRMS", "wildfire", -120 + i*0.1, 37, conf=0.8, severity=0.5)
                  for i in range(2)]
        result = PolicyEngine().evaluate(policy, events)
        # weighted = sum(conf * (1+severity)) = 2 * 0.8 * 1.5 = 2.4
        assert result.aggregated_value == pytest.approx(2.4)
        assert result.outcome == Outcome.YES


# ── Evidence Builder ─────────────────────────────────────────────────────────

class TestEvidenceBuilder:
    def test_build_creates_canonical_hash(self):
        policy = Policy(id="wildfire-test", version="1.0.0", event_type="wildfire",
                        threshold=1.0, allowed_sources=("NASA_FIRMS", "EFFIS"),
                        min_sources_agree=1, aggregation="count")
        events = [
            _evt("NASA_FIRMS", "wildfire", -120, 37, conf=0.9),
            _evt("EFFIS", "wildfire", -119, 38, conf=0.85),
        ]
        result = PolicyEngine().evaluate(policy, events)
        bundle = EvidenceBuilder().build(bet_id="test-bet", policy_result=result)

        assert bundle.bundle_hash.startswith("sha256:")
        assert bundle.outcome == "YES"
        assert "NASA_FIRMS" in bundle.sources_summary
        assert "EFFIS" in bundle.sources_summary
        assert bundle.sources_summary["NASA_FIRMS"]["event_count"] == 1.0

    def test_bundle_deterministic(self):
        """Memes inputs → meme bundle_hash."""
        policy = Policy(id="t", version="1.0.0", event_type="wildfire",
                        threshold=0.5, allowed_sources=("NASA_FIRMS",),
                        min_sources_agree=1, aggregation="count")
        ts = datetime(2026, 4, 21, 12, tzinfo=timezone.utc)
        events = [_evt("NASA_FIRMS", "wildfire", -120, 37, conf=0.9, ts=ts)]
        b1 = EvidenceBuilder().build(bet_id="bet", policy_result=PolicyEngine().evaluate(policy, events), timestamp=ts)
        b2 = EvidenceBuilder().build(bet_id="bet", policy_result=PolicyEngine().evaluate(policy, events), timestamp=ts)
        assert b1.bundle_hash == b2.bundle_hash


# ── Conflict Resolver ────────────────────────────────────────────────────────

class TestConflictResolver:
    def test_no_conflict_single_event(self):
        events = [_evt("NASA_FIRMS", "wildfire", -120, 37)]
        winners, reports = ConflictResolver().resolve(events)
        assert len(winners) == 1
        assert len(reports) == 0

    def test_cluster_same_location(self):
        events = [
            _evt("NASA_FIRMS", "wildfire", -120.0, 37.0, conf=0.7),
            _evt("EFFIS", "wildfire", -120.01, 37.0, conf=0.85),  # same spatial bin
        ]
        winners, reports = ConflictResolver().resolve(events)
        assert len(winners) == 1
        assert len(reports) == 1
        assert reports[0].has_conflict is True
        # EFFIS has lower weight (0.95) but higher conf (0.85 vs 0.7)
        # NASA weight 1.0 * 0.7 = 0.70, EFFIS weight 0.95 * 0.85 = 0.8075
        assert winners[0].source == "EFFIS"

    def test_cluster_different_types_separate(self):
        events = [
            _evt("NASA_FIRMS", "wildfire", -120, 37),
            _evt("NOAA", "flood", -120, 37),
        ]
        winners, reports = ConflictResolver().resolve(events)
        assert len(winners) == 2   # different event types → different clusters

    def test_high_priority_source_wins(self):
        ts = datetime(2026, 4, 21, 12, tzinfo=timezone.utc)
        events = [
            _evt("USGS", "earthquake", 0, 0, conf=0.9, severity=0.8, ts=ts),
            _evt("NOAA", "earthquake", 0.01, 0, conf=0.9, severity=0.8, ts=ts),
        ]
        winners, reports = ConflictResolver(custom_weights={"USGS": 2.0, "NOAA": 0.5}).resolve(events)
        assert winners[0].source == "USGS"
