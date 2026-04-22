"""
Transformers — RawEvent (par source) → NormalizedEvent (canonique).

Une fonction par source pour mapping specifique. Tout passe ensuite
par `normalize()` qui dispatche selon `RawEvent.source`.
"""
from __future__ import annotations
import uuid
from typing import Iterable

from veralith_pipeline.ingestion.base import RawEvent
from veralith_pipeline.normalization.schemas import EventLocation, EventType, NormalizedEvent


def _from_nasa_firms(raw: RawEvent) -> NormalizedEvent:
    severity = float(raw.raw_payload.get("brightness", 0)) / 500.0  # 0-1 proxy
    return NormalizedEvent(
        event_id=str(uuid.uuid5(uuid.NAMESPACE_OID, f"{raw.source}:{raw.event_id}")),
        source=raw.source,
        source_event_id=raw.event_id,
        event_type=EventType.WILDFIRE,
        timestamp=raw.timestamp,
        location=EventLocation(coordinates=(raw.longitude, raw.latitude)),
        confidence=raw.confidence,
        severity=min(1.0, severity) if severity > 0 else None,
        raw_metadata={"sensor": raw.raw_payload.get("instrument", "VIIRS")},
    )


def _from_effis(raw: RawEvent) -> NormalizedEvent:
    area_ha = float(raw.raw_payload.get("area_ha", raw.raw_payload.get("AREA_HA", 0)))
    severity = min(1.0, area_ha / 5000.0) if area_ha else None
    return NormalizedEvent(
        event_id=str(uuid.uuid5(uuid.NAMESPACE_OID, f"{raw.source}:{raw.event_id}")),
        source=raw.source,
        source_event_id=raw.event_id,
        event_type=EventType.WILDFIRE,
        timestamp=raw.timestamp,
        location=EventLocation(coordinates=(raw.longitude, raw.latitude)),
        confidence=raw.confidence,
        severity=severity,
        raw_metadata={"area_ha": area_ha, "country": raw.raw_payload.get("country", "")},
    )


def _from_noaa(raw: RawEvent) -> NormalizedEvent:
    severity_map = {"Extreme": 1.0, "Severe": 0.75, "Moderate": 0.5, "Minor": 0.25}
    severity = severity_map.get(raw.raw_payload.get("severity"))
    return NormalizedEvent(
        event_id=str(uuid.uuid5(uuid.NAMESPACE_OID, f"{raw.source}:{raw.event_id}")),
        source=raw.source,
        source_event_id=raw.event_id,
        event_type=EventType(raw.event_type),
        timestamp=raw.timestamp,
        location=EventLocation(coordinates=(raw.longitude, raw.latitude)),
        confidence=raw.confidence,
        severity=severity,
        raw_metadata={"event_label": raw.raw_payload.get("event"),
                      "urgency": raw.raw_payload.get("urgency")},
    )


def _from_usgs(raw: RawEvent) -> NormalizedEvent:
    mag = float(raw.raw_payload.get("magnitude", 0))
    severity = min(1.0, max(0.0, (mag - 2.0) / 7.0))
    return NormalizedEvent(
        event_id=str(uuid.uuid5(uuid.NAMESPACE_OID, f"{raw.source}:{raw.event_id}")),
        source=raw.source,
        source_event_id=raw.event_id,
        event_type=EventType.EARTHQUAKE,
        timestamp=raw.timestamp,
        location=EventLocation(coordinates=(raw.longitude, raw.latitude)),
        confidence=raw.confidence,
        severity=severity,
        raw_metadata={"magnitude": mag, "place": raw.raw_payload.get("place", "")},
    )


def _from_vigicrues(raw: RawEvent) -> NormalizedEvent:
    level = int(raw.raw_payload.get("alert_level", 1))
    severity = (level - 1) / 3.0   # level 1..4 → 0..1
    return NormalizedEvent(
        event_id=str(uuid.uuid5(uuid.NAMESPACE_OID, f"{raw.source}:{raw.event_id}")),
        source=raw.source,
        source_event_id=raw.event_id,
        event_type=EventType.FLOOD,
        timestamp=raw.timestamp,
        location=EventLocation(coordinates=(raw.longitude, raw.latitude)),
        confidence=raw.confidence,
        severity=severity,
        raw_metadata={"alert_level": level, "river": raw.raw_payload.get("river", "")},
    )


# ── Dispatcher ──────────────────────────────────────────────────────────────

_SOURCE_MAP = {
    "NASA_FIRMS": _from_nasa_firms,
    "EFFIS": _from_effis,
    "NOAA": _from_noaa,
    "USGS": _from_usgs,
    "VIGICRUES": _from_vigicrues,
}


def normalize(raw: RawEvent) -> NormalizedEvent:
    """Dispatch a la bonne fonction selon `raw.source`. Levee KeyError si source inconnue."""
    if raw.source not in _SOURCE_MAP:
        raise KeyError(f"No transformer for source {raw.source!r}. "
                       f"Known: {sorted(_SOURCE_MAP.keys())}")
    return _SOURCE_MAP[raw.source](raw)


def normalize_batch(raws: Iterable[RawEvent]) -> list[NormalizedEvent]:
    """Best-effort batch: skip events qui font echouer la transformation."""
    out: list[NormalizedEvent] = []
    for raw in raws:
        try:
            out.append(normalize(raw))
        except (KeyError, ValueError):
            continue
    return out
