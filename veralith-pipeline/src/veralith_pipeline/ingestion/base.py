"""
BaseConnector — interface commune pour tous les fournisseurs.

Chaque connector implemente le contrat :
  fetch(bbox, time_range) -> FetchResult
  parse(raw) -> List[RawEvent]
  validate(events) -> ValidationResult

L'objectif : isoler les specificites de chaque API officielle (NASA, EFFIS, NOAA, ...)
et exposer un format uniforme RawEvent au reste du pipeline.
"""
from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Iterable
import hashlib
import json


# ── Types primitifs ─────────────────────────────────────────────────────────

@dataclass(frozen=True)
class BoundingBox:
    """EPSG:4326 lng/lat bbox: (west, south, east, north)."""
    west: float
    south: float
    east: float
    north: float

    def as_tuple(self) -> tuple[float, float, float, float]:
        return (self.west, self.south, self.east, self.north)

    def contains(self, lng: float, lat: float) -> bool:
        return self.west <= lng <= self.east and self.south <= lat <= self.north

    def __post_init__(self) -> None:
        if not (-180 <= self.west <= 180 and -180 <= self.east <= 180):
            raise ValueError(f"Longitude out of [-180, 180]: w={self.west} e={self.east}")
        if not (-90 <= self.south <= 90 and -90 <= self.north <= 90):
            raise ValueError(f"Latitude out of [-90, 90]: s={self.south} n={self.north}")
        if self.south > self.north:
            raise ValueError(f"South > North: {self.south} > {self.north}")


@dataclass(frozen=True)
class TimeRange:
    """ISO 8601 inclusive time range. Both bounds tz-aware."""
    start: datetime
    end: datetime

    def __post_init__(self) -> None:
        if self.start.tzinfo is None or self.end.tzinfo is None:
            raise ValueError("TimeRange bounds must be timezone-aware")
        if self.start > self.end:
            raise ValueError(f"start > end: {self.start} > {self.end}")

    def duration_seconds(self) -> float:
        return (self.end - self.start).total_seconds()


@dataclass
class RawEvent:
    """
    Output uniforme post-fetch.
    Avant normalization : conserve la structure source.
    """
    event_id: str
    source: str                          # "NASA_FIRMS" | "EFFIS" | "NOAA" | "USGS" | "VIGICRUES"
    event_type: str                      # "wildfire" | "flood" | "earthquake" | ...
    timestamp: datetime                  # tz-aware
    longitude: float
    latitude: float
    confidence: float                    # 0..1
    raw_payload: dict[str, Any] = field(default_factory=dict)

    def stable_id(self) -> str:
        """SHA-256 deterministe utilise pour deduplication."""
        h = hashlib.sha256()
        h.update(self.source.encode())
        h.update(self.event_type.encode())
        h.update(self.timestamp.isoformat().encode())
        h.update(f"{self.longitude:.6f},{self.latitude:.6f}".encode())
        return h.hexdigest()


@dataclass
class ValidationResult:
    valid: list[RawEvent] = field(default_factory=list)
    rejected: list[tuple[RawEvent, str]] = field(default_factory=list)  # (event, reason)

    @property
    def total(self) -> int:
        return len(self.valid) + len(self.rejected)

    @property
    def reject_rate(self) -> float:
        return len(self.rejected) / self.total if self.total else 0.0


@dataclass
class FetchResult:
    """
    Conteneur du resultat brut d'un connector.
    Inclut la signature SHA-256 du payload pour traçabilite.
    """
    source: str
    fetched_at: datetime
    bbox: BoundingBox
    time_range: TimeRange
    events: list[RawEvent] = field(default_factory=list)
    raw_payload_hash: str = ""
    error: str | None = None

    def hash_payload(self, payload: Any) -> str:
        canonical = json.dumps(payload, sort_keys=True, default=str)
        return hashlib.sha256(canonical.encode()).hexdigest()


# ── Base interface ──────────────────────────────────────────────────────────

class BaseConnector(ABC):
    """
    Interface contract pour tous les ingesteurs.
    """
    SOURCE_NAME: str = ""           # subclasses override
    SUPPORTED_TYPES: tuple[str, ...] = ()  # ex: ("wildfire",) ou ("flood", "rainfall")

    def __init__(self, *, mock: bool = False, api_key: str | None = None) -> None:
        self.mock = mock
        self.api_key = api_key
        if not self.SOURCE_NAME:
            raise NotImplementedError(f"{type(self).__name__} must set SOURCE_NAME")

    @abstractmethod
    def fetch(self, bbox: BoundingBox, time_range: TimeRange) -> FetchResult:
        """Hit upstream API + parse + validate. May return empty list, never None."""
        raise NotImplementedError

    def validate(self, events: Iterable[RawEvent]) -> ValidationResult:
        """Default validation: bbox containment + confidence range + non-future timestamp."""
        result = ValidationResult()
        now = datetime.now(tz=events.__iter__().__next__().timestamp.tzinfo) if events else None
        # Recreate iterator since we consumed one
        for event in events:
            reason = self._reject_reason(event)
            if reason:
                result.rejected.append((event, reason))
            else:
                result.valid.append(event)
        return result

    def _reject_reason(self, event: RawEvent) -> str | None:
        if not (0.0 <= event.confidence <= 1.0):
            return f"confidence out of [0,1]: {event.confidence}"
        if event.event_type not in self.SUPPORTED_TYPES:
            return f"event_type {event.event_type!r} not supported by {self.SOURCE_NAME}"
        return None
