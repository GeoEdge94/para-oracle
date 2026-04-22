"""
EvidenceBuilder — assemble la preuve canonique pour publication on-chain / IPFS.
Contient :
  - le PolicyResult (avec outcome)
  - les NormalizedEvent contributeurs
  - la synthese par source (count, mean confidence)
  - le hash SHA-256 du bundle (pour signature EIP-712)
"""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
import hashlib
import json

from veralith_pipeline.normalization.schemas import NormalizedEvent
from veralith_pipeline.resolution.policy_engine import PolicyResult


@dataclass
class EvidenceBundle:
    bet_id: str
    policy_id: str
    policy_version: str
    outcome: str
    aggregated_value: float
    threshold: float
    timestamp: datetime
    contributing_events: list[NormalizedEvent] = field(default_factory=list)
    sources_summary: dict[str, dict[str, float]] = field(default_factory=dict)
    bundle_hash: str = ""              # filled by builder

    def canonical_dict(self) -> dict[str, Any]:
        """Output deterministe pour signature."""
        return {
            "bet_id": self.bet_id,
            "policy_id": self.policy_id,
            "policy_version": self.policy_version,
            "outcome": self.outcome,
            "aggregated_value": round(self.aggregated_value, 6),
            "threshold": round(self.threshold, 6),
            "timestamp": self.timestamp.isoformat(),
            "events": [e.canonical_dict() for e in self.contributing_events],
            "sources_summary": self.sources_summary,
        }


class EvidenceBuilder:
    """Stateless. Construit un bundle a partir d'un PolicyResult."""

    def build(self, *, bet_id: str, policy_result: PolicyResult,
              timestamp: datetime | None = None) -> EvidenceBundle:
        ts = timestamp or datetime.now(tz=timezone.utc)

        bundle = EvidenceBundle(
            bet_id=bet_id,
            policy_id=policy_result.policy_id,
            policy_version=policy_result.policy_version,
            outcome=policy_result.outcome.value,
            aggregated_value=policy_result.aggregated_value,
            threshold=policy_result.threshold,
            timestamp=ts,
            contributing_events=list(policy_result.contributing_events),
            sources_summary=self._summarize_sources(policy_result.contributing_events),
        )
        bundle.bundle_hash = self._hash_bundle(bundle)
        return bundle

    # ── Helpers ──────────────────────────────────────────────────────────────

    @staticmethod
    def _summarize_sources(events: list[NormalizedEvent]) -> dict[str, dict[str, float]]:
        summary: dict[str, dict[str, float]] = {}
        by_source: dict[str, list[NormalizedEvent]] = {}
        for e in events:
            by_source.setdefault(e.source, []).append(e)
        for source, batch in by_source.items():
            confidences = [e.confidence for e in batch]
            severities = [e.severity for e in batch if e.severity is not None]
            summary[source] = {
                "event_count": float(len(batch)),
                "mean_confidence": round(sum(confidences) / len(confidences), 6) if confidences else 0.0,
                "max_severity": round(max(severities), 6) if severities else 0.0,
            }
        return summary

    @staticmethod
    def _hash_bundle(bundle: EvidenceBundle) -> str:
        canonical = json.dumps(bundle.canonical_dict(), sort_keys=True, default=str)
        return f"sha256:{hashlib.sha256(canonical.encode()).hexdigest()}"
