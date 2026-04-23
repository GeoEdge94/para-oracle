"""
USGS — United States Geological Survey.

Earthquake Hazards Program API.
Endpoint: https://earthquake.usgs.gov/fdsnws/event/1/query

Doc: https://earthquake.usgs.gov/fdsnws/event/1/
"""
from __future__ import annotations
from datetime import datetime, timezone
import httpx

from veralith_pipeline.ingestion.base import (
    BaseConnector, BoundingBox, TimeRange, RawEvent, FetchResult
)


class UsgsConnector(BaseConnector):
    SOURCE_NAME = "USGS"
    SUPPORTED_TYPES = ("earthquake",)
    BASE_URL = "https://earthquake.usgs.gov/fdsnws/event/1/query"

    def fetch(self, bbox: BoundingBox, time_range: TimeRange) -> FetchResult:
        now = datetime.now(tz=timezone.utc)
        if self.mock:
            return self._fetch_mock(bbox, time_range, now)

        params = {
            "format": "geojson",
            "starttime": time_range.start.isoformat(),
            "endtime": time_range.end.isoformat(),
            "minlongitude": bbox.west,
            "minlatitude": bbox.south,
            "maxlongitude": bbox.east,
            "maxlatitude": bbox.north,
            "minmagnitude": 2.5,
            "orderby": "time",
        }
        try:
            r = httpx.get(self.BASE_URL, params=params, timeout=30)
            r.raise_for_status()
            data = r.json()
            events = self._parse_geojson(data)
            result = FetchResult(source=self.SOURCE_NAME, fetched_at=now,
                                 bbox=bbox, time_range=time_range, events=events)
            result.raw_payload_hash = result.hash_payload(data)
            return result
        except httpx.HTTPError as e:
            return FetchResult(source=self.SOURCE_NAME, fetched_at=now,
                               bbox=bbox, time_range=time_range, error=str(e))

    def _parse_geojson(self, data: dict) -> list[RawEvent]:
        events: list[RawEvent] = []
        for f in data.get("features", []):
            props = f.get("properties", {})
            geom = f.get("geometry", {})
            try:
                lng, lat, _ = geom["coordinates"]
                ts_ms = props["time"]
                ts = datetime.fromtimestamp(ts_ms / 1000, tz=timezone.utc)
                mag = float(props.get("mag", 0))
                # Confidence proxy from magnitude (M5+ ~ 0.95, M2.5 ~ 0.4)
                conf = max(0.0, min(1.0, (mag - 2.0) / 5.0))
                events.append(RawEvent(
                    event_id=f.get("id", props.get("code", "")),
                    source=self.SOURCE_NAME,
                    event_type="earthquake",
                    timestamp=ts,
                    longitude=lng,
                    latitude=lat,
                    confidence=conf,
                    raw_payload={**props, "magnitude": mag},
                ))
            except (KeyError, ValueError, TypeError):
                continue
        return events

    def _fetch_mock(self, bbox: BoundingBox, tr: TimeRange, now: datetime) -> FetchResult:
        cx, cy = (bbox.west + bbox.east) / 2, (bbox.south + bbox.north) / 2
        events = [
            RawEvent(
                event_id=f"usgs-mock-{i}",
                source=self.SOURCE_NAME,
                event_type="earthquake",
                timestamp=tr.start,
                longitude=cx + i * 0.2,
                latitude=cy + i * 0.2,
                confidence=0.7 + i * 0.05,
                raw_payload={"mock": True, "magnitude": 4.5 + i * 0.5},
            )
            for i in range(2)
        ]
        result = FetchResult(source=self.SOURCE_NAME, fetched_at=now,
                             bbox=bbox, time_range=tr, events=events)
        result.raw_payload_hash = result.hash_payload([e.raw_payload for e in events])
        return result
