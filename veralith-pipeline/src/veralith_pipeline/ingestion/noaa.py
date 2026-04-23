"""
NOAA — National Oceanic and Atmospheric Administration.

Severe weather events (storms, hurricanes, tornadoes, floods).
Endpoint: https://api.weather.gov/alerts/active

Doc: https://www.weather.gov/documentation/services-web-api
"""
from __future__ import annotations
from datetime import datetime, timezone
import uuid
import httpx

from veralith_pipeline.ingestion.base import (
    BaseConnector, BoundingBox, TimeRange, RawEvent, FetchResult
)


SEVERITY_MAP = {"Extreme": 0.98, "Severe": 0.85, "Moderate": 0.65, "Minor": 0.40, "Unknown": 0.30}

# NOAA event names → veralith taxonomy
EVENT_TYPE_MAP = {
    "tornado warning": "tornado",
    "severe thunderstorm warning": "storm",
    "flash flood warning": "flood",
    "flood warning": "flood",
    "hurricane warning": "hurricane",
    "tropical storm warning": "storm",
    "winter storm warning": "storm",
    "wildfire warning": "wildfire",
    "red flag warning": "wildfire",
}


class NoaaConnector(BaseConnector):
    SOURCE_NAME = "NOAA"
    SUPPORTED_TYPES = ("wildfire", "flood", "storm", "tornado", "hurricane")
    BASE_URL = "https://api.weather.gov/alerts"

    def fetch(self, bbox: BoundingBox, time_range: TimeRange) -> FetchResult:
        now = datetime.now(tz=timezone.utc)
        if self.mock:
            return self._fetch_mock(bbox, time_range, now)

        params = {
            "area": "US",  # NOAA covers US only; region filter applied via bbox post-fetch
            "status": "actual",
            "limit": 500,
        }
        try:
            r = httpx.get(f"{self.BASE_URL}/active", params=params, timeout=30,
                          headers={"User-Agent": "veralith-pipeline (tech@veralith.io)"})
            r.raise_for_status()
            data = r.json()
            events = self._parse_alerts(data, bbox, time_range)
            result = FetchResult(source=self.SOURCE_NAME, fetched_at=now,
                                 bbox=bbox, time_range=time_range, events=events)
            result.raw_payload_hash = result.hash_payload(data)
            return result
        except httpx.HTTPError as e:
            return FetchResult(source=self.SOURCE_NAME, fetched_at=now,
                               bbox=bbox, time_range=time_range, error=str(e))

    def _parse_alerts(self, data: dict, bbox: BoundingBox, tr: TimeRange) -> list[RawEvent]:
        events: list[RawEvent] = []
        for f in data.get("features", []):
            props = f.get("properties", {})
            geom = f.get("geometry") or {}
            try:
                event_name = (props.get("event") or "").lower()
                vtype = next((v for k, v in EVENT_TYPE_MAP.items() if k in event_name), None)
                if not vtype:
                    continue
                sent = props.get("sent")
                if not sent:
                    continue
                ts = datetime.fromisoformat(sent.replace("Z", "+00:00"))
                if not (tr.start <= ts <= tr.end):
                    continue
                lng, lat = self._approximate_center(geom, bbox)
                if not bbox.contains(lng, lat):
                    continue
                conf = SEVERITY_MAP.get(props.get("severity", "Unknown"), 0.3)
                events.append(RawEvent(
                    event_id=props.get("id") or str(uuid.uuid4()),
                    source=self.SOURCE_NAME,
                    event_type=vtype,
                    timestamp=ts,
                    longitude=lng,
                    latitude=lat,
                    confidence=conf,
                    raw_payload=props,
                ))
            except (KeyError, ValueError):
                continue
        return events

    @staticmethod
    def _approximate_center(geom: dict, fallback: BoundingBox) -> tuple[float, float]:
        if not geom or "coordinates" not in geom:
            return ((fallback.west + fallback.east) / 2, (fallback.south + fallback.north) / 2)
        try:
            from shapely.geometry import shape
            return shape(geom).centroid.x, shape(geom).centroid.y
        except Exception:
            return ((fallback.west + fallback.east) / 2, (fallback.south + fallback.north) / 2)

    def _fetch_mock(self, bbox: BoundingBox, tr: TimeRange, now: datetime) -> FetchResult:
        cx, cy = (bbox.west + bbox.east) / 2, (bbox.south + bbox.north) / 2
        events = [
            RawEvent(event_id="noaa-mock-1", source=self.SOURCE_NAME, event_type="flood",
                     timestamp=tr.start, longitude=cx, latitude=cy, confidence=0.85,
                     raw_payload={"mock": True, "severity": "Severe"}),
            RawEvent(event_id="noaa-mock-2", source=self.SOURCE_NAME, event_type="wildfire",
                     timestamp=tr.start, longitude=cx + 0.1, latitude=cy + 0.1, confidence=0.65,
                     raw_payload={"mock": True, "severity": "Moderate"}),
        ]
        result = FetchResult(source=self.SOURCE_NAME, fetched_at=now,
                             bbox=bbox, time_range=tr, events=events)
        result.raw_payload_hash = result.hash_payload([e.raw_payload for e in events])
        return result
