"""
ConflictResolver — detecte et resout les desaccords entre sources.

Cas concrets :
- NASA FIRMS detecte un feu, EFFIS ne detecte rien sur la meme zone/periode → quel est le verdict ?
- USGS publie M5.2, EMSC publie M4.8 sur le meme epicenter → quelle magnitude retenir ?

Approche : pondere par confiance + age. Retourne ConflictReport pour audit.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Iterable

from veralith_pipeline.normalization.schemas import NormalizedEvent


# Source priority : valeurs >= 1.0, multiplicateur de poids.
# Override possible via ConflictResolver(custom_weights=...)
DEFAULT_SOURCE_WEIGHTS = {
    "USGS": 1.0,           # earthquakes : autorite mondiale
    "NASA_FIRMS": 1.0,     # fires : quasi-temps reel global
    "EFFIS": 0.95,         # fires Europe : valide officiel mais delai 24h
    "NOAA": 0.90,          # weather : US only
    "VIGICRUES": 0.85,     # floods France : autorite officielle locale
}


@dataclass
class ConflictReport:
    cluster_id: str                                  # group key (event_type + spatial bin + time bucket)
    events: list[NormalizedEvent] = field(default_factory=list)
    has_conflict: bool = False
    chosen_event_id: str | None = None
    diagnostics: dict[str, float] = field(default_factory=dict)


class ConflictResolver:
    """Cluster spatially + temporally, then pick a winner if multiple sources clash."""

    def __init__(self, *,
                 spatial_bin_deg: float = 0.1,    # ~11 km au niveau equateur
                 time_bucket_minutes: int = 30,
                 custom_weights: dict[str, float] | None = None) -> None:
        self.spatial_bin_deg = spatial_bin_deg
        self.time_bucket_minutes = time_bucket_minutes
        self.weights = {**DEFAULT_SOURCE_WEIGHTS, **(custom_weights or {})}

    # ── Cluster ──────────────────────────────────────────────────────────────

    def cluster(self, events: Iterable[NormalizedEvent]) -> dict[str, list[NormalizedEvent]]:
        clusters: dict[str, list[NormalizedEvent]] = {}
        for e in events:
            key = self._cluster_key(e)
            clusters.setdefault(key, []).append(e)
        return clusters

    def _cluster_key(self, e: NormalizedEvent) -> str:
        lng, lat = e.location.coordinates
        lng_bin = round(lng / self.spatial_bin_deg) * self.spatial_bin_deg
        lat_bin = round(lat / self.spatial_bin_deg) * self.spatial_bin_deg
        bucket_minutes = (e.timestamp.timestamp() // (self.time_bucket_minutes * 60))
        evt_type = e.event_type.value if hasattr(e.event_type, "value") else e.event_type
        return f"{evt_type}|{lng_bin:.4f},{lat_bin:.4f}|{int(bucket_minutes)}"

    # ── Resolve ──────────────────────────────────────────────────────────────

    def resolve(self, events: Iterable[NormalizedEvent]) -> tuple[list[NormalizedEvent], list[ConflictReport]]:
        """
        Returns (winners, reports). For each cluster :
          - 1 event → trivial winner
          - N events same source → keep best confidence
          - N events different sources → weighted vote, attach ConflictReport
        """
        clusters = self.cluster(events)
        winners: list[NormalizedEvent] = []
        reports: list[ConflictReport] = []

        for key, batch in clusters.items():
            if len(batch) == 1:
                winners.append(batch[0])
                continue
            sources = {e.source for e in batch}
            chosen = self._pick_winner(batch)
            report = ConflictReport(
                cluster_id=key,
                events=batch,
                has_conflict=len(sources) > 1,
                chosen_event_id=chosen.event_id,
                diagnostics={
                    "n_events": float(len(batch)),
                    "n_sources": float(len(sources)),
                    "chosen_score": self._score(chosen),
                },
            )
            reports.append(report)
            winners.append(chosen)
        return winners, reports

    def _pick_winner(self, batch: list[NormalizedEvent]) -> NormalizedEvent:
        scored = [(self._score(e), e) for e in batch]
        scored.sort(key=lambda x: x[0], reverse=True)
        return scored[0][1]

    def _score(self, e: NormalizedEvent) -> float:
        weight = self.weights.get(e.source, 0.5)
        # Recency bonus: events recents > anciens (age en heures)
        age_hours = max(0.0, (datetime.now(tz=timezone.utc) - e.timestamp).total_seconds() / 3600.0)
        recency = 1.0 / (1.0 + age_hours / 24.0)        # 1 jour → 0.5, 7 jours → 0.125
        return weight * e.confidence * (1 + (e.severity or 0.0)) * recency
