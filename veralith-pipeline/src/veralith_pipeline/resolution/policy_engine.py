"""
PolicyEngine — execute des policies YAML deterministes sur un batch d'events.

Une Policy declare :
  - quel event_type
  - quel seuil (count, severity, area)
  - quelles sources sont valides
  - quel quorum (min_sources_agree)

Le moteur retourne un PolicyResult avec outcome YES/NO/INDETERMINATE
+ evidence (events qui ont compte) + diagnostics.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Iterable
import yaml

from veralith_pipeline.normalization.schemas import NormalizedEvent


class Outcome(str, Enum):
    YES = "YES"
    NO = "NO"
    INDETERMINATE = "INDETERMINATE"   # quorum non atteint, sources insuffisantes


# ── Policy DSL ───────────────────────────────────────────────────────────────

@dataclass
class Policy:
    """
    Declaratif. Toute logique est portee par les valeurs (pas de code).

    Champs YAML :
      id, version, event_type, threshold, allowed_sources, min_sources_agree,
      min_confidence, min_severity, aggregation
    """
    id: str
    version: str
    event_type: str
    threshold: float                  # par defaut compte d'events
    allowed_sources: tuple[str, ...]
    min_sources_agree: int = 1
    min_confidence: float = 0.0
    min_severity: float = 0.0
    aggregation: str = "count"        # "count" | "sum_severity" | "max_severity" | "weighted_count"

    @classmethod
    def from_yaml(cls, path: str | Path) -> "Policy":
        data = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
        return cls.from_dict(data)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Policy":
        return cls(
            id=data["id"],
            version=data["version"],
            event_type=data["event_type"],
            threshold=float(data["threshold"]),
            allowed_sources=tuple(data["allowed_sources"]),
            min_sources_agree=int(data.get("min_sources_agree", 1)),
            min_confidence=float(data.get("min_confidence", 0.0)),
            min_severity=float(data.get("min_severity", 0.0)),
            aggregation=str(data.get("aggregation", "count")),
        )


@dataclass
class PolicyResult:
    policy_id: str
    policy_version: str
    outcome: Outcome
    aggregated_value: float           # value comparee au seuil
    threshold: float
    contributing_events: list[NormalizedEvent] = field(default_factory=list)
    sources_agreed: list[str] = field(default_factory=list)
    diagnostics: dict[str, Any] = field(default_factory=dict)


class PolicyEngine:
    AGGREGATIONS = ("count", "sum_severity", "max_severity", "weighted_count")

    def evaluate(self, policy: Policy, events: Iterable[NormalizedEvent]) -> PolicyResult:
        if policy.aggregation not in self.AGGREGATIONS:
            raise ValueError(f"Unknown aggregation: {policy.aggregation}")

        # 1. Filter par allowed_sources, type, confidence/severity threshold
        eligible = [
            e for e in events
            if e.source in policy.allowed_sources
            and (e.event_type.value if hasattr(e.event_type, "value") else e.event_type) == policy.event_type
            and e.confidence >= policy.min_confidence
            and (e.severity is None or e.severity >= policy.min_severity)
        ]

        # 2. Sources represented (quorum check)
        sources = sorted({e.source for e in eligible})

        # 3. Aggregate
        agg = self._aggregate(policy.aggregation, eligible)

        # 4. Decision
        if len(sources) < policy.min_sources_agree:
            outcome = Outcome.INDETERMINATE
        elif agg > policy.threshold:
            outcome = Outcome.YES
        else:
            outcome = Outcome.NO

        return PolicyResult(
            policy_id=policy.id,
            policy_version=policy.version,
            outcome=outcome,
            aggregated_value=agg,
            threshold=policy.threshold,
            contributing_events=eligible,
            sources_agreed=sources,
            diagnostics={
                "events_considered": len(list(events)),
                "events_eligible": len(eligible),
                "min_sources_agree": policy.min_sources_agree,
                "sources_count": len(sources),
                "aggregation": policy.aggregation,
            },
        )

    @staticmethod
    def _aggregate(method: str, events: list[NormalizedEvent]) -> float:
        if method == "count":
            return float(len(events))
        if method == "sum_severity":
            return float(sum((e.severity or 0.0) for e in events))
        if method == "max_severity":
            return max((e.severity or 0.0) for e in events) if events else 0.0
        if method == "weighted_count":
            # poids = confiance × (1 + severity)
            return float(sum(e.confidence * (1 + (e.severity or 0.0)) for e in events))
        raise ValueError(f"Unknown aggregation: {method}")
