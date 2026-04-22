"""
Schemas Pydantic standardises pour les evenements normalises.

Le `NormalizedEvent` est l'unique format consomme par la layer Resolution.
Toute donnee provenant d'un connector doit etre transformee dans ce schema.
"""
from __future__ import annotations
from datetime import datetime
from enum import Enum
from typing import Any
from pydantic import BaseModel, Field, field_validator


class EventType(str, Enum):
    WILDFIRE = "wildfire"
    FLOOD = "flood"
    EARTHQUAKE = "earthquake"
    STORM = "storm"
    HURRICANE = "hurricane"
    TORNADO = "tornado"
    DROUGHT = "drought"
    LANDSLIDE = "landslide"


class EventLocation(BaseModel):
    """GeoJSON Point dans EPSG:4326."""
    type: str = Field(default="Point")
    coordinates: tuple[float, float]   # [lng, lat]

    @field_validator("type")
    @classmethod
    def _check_type(cls, v: str) -> str:
        if v != "Point":
            raise ValueError(f"location.type must be 'Point', got {v!r}")
        return v

    @field_validator("coordinates")
    @classmethod
    def _check_coords(cls, v: tuple[float, float]) -> tuple[float, float]:
        lng, lat = v
        if not (-180 <= lng <= 180):
            raise ValueError(f"longitude out of [-180,180]: {lng}")
        if not (-90 <= lat <= 90):
            raise ValueError(f"latitude out of [-90,90]: {lat}")
        return v


class NormalizedEvent(BaseModel):
    """
    Format canonique. Tous les events traverses par la pipeline sont des NormalizedEvent.
    Versionne pour garantir backward-compat.
    """
    schema_version: str = Field(default="1.0.0", frozen=True)
    event_id: str
    source: str                                  # "NASA_FIRMS" | "EFFIS" | ...
    source_event_id: str                         # ID natif fournisseur
    event_type: EventType
    timestamp: datetime
    location: EventLocation
    confidence: float = Field(ge=0.0, le=1.0)
    severity: float | None = Field(default=None, ge=0.0, le=1.0)
    raw_metadata: dict[str, Any] = Field(default_factory=dict)

    model_config = {
        "extra": "forbid",
        "use_enum_values": True,
    }

    @field_validator("timestamp")
    @classmethod
    def _check_tz(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            raise ValueError("timestamp must be timezone-aware")
        return v

    def canonical_dict(self) -> dict:
        """Output deterministe (sort_keys friendly) pour hashing."""
        return {
            "schema_version": self.schema_version,
            "event_id": self.event_id,
            "source": self.source,
            "source_event_id": self.source_event_id,
            "event_type": self.event_type.value if isinstance(self.event_type, EventType) else self.event_type,
            "timestamp": self.timestamp.isoformat(),
            "location": {"type": "Point", "coordinates": list(self.location.coordinates)},
            "confidence": round(self.confidence, 6),
            "severity": round(self.severity, 6) if self.severity is not None else None,
        }
