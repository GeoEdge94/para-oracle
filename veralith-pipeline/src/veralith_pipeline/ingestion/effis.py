"""
EFFIS — European Forest Fire Information System (Copernicus EMS).

Endpoint: https://maps.effis.emergency.copernicus.eu/effis
WMS / WFS GetFeature for current burnt areas.

Doc: https://effis.jrc.ec.europa.eu/about-effis/data-license
"""
from __future__ import annotations
from datetime import datetime, timezone
import uuid
import httpx

from veralith_pipeline.ingestion.base import (
    BaseConnector, BoundingBox, TimeRange, RawEvent, FetchResult
)


class EffisConnector(BaseConnector):
    SOURCE_NAME = "EFFIS"
    SUPPORTED_TYPES = ("wildfire",)
    BASE_URL = "https://maps.effis.emergency.copernicus.eu/effis"

    def fetch(self, bbox: BoundingBox, time_range: TimeRange) -> FetchResult:
        now = datetime.now(tz=timezone.utc)
        if self.mock:
            return self._fetch_mock(bbox, time_range, now)

        params = {
            "service": "WFS",
            "version": "2.0.0",
            "request": "GetFeature",
            "typeNames": "ms:ba_currentyear",
            "outputFormat": "application/json",
            "bbox": f"{bbox.south},{bbox.west},{bbox.north},{bbox.east},EPSG:4326",
        }
        try:
            r = httpx.get(f"{self.BASE_URL}/ows", params=params, timeout=30)
            r.raise_for_status()
            data = r.json()
            events = self._parse_geojson(data, time_range)
            result = FetchResult(source=self.SOURCE_NAME, fetched_at=now,
                                 bbox=bbox, time_range=time_range, events=events)
            result.raw_payload_hash = result.hash_payload(data)
            return result
        except httpx.HTTPError as e:
            return FetchResult(source=self.SOURCE_NAME, fetched_at=now,
                               bbox=bbox, time_range=time_range, error=str(e))

    def _parse_geojson(self, data: dict, tr: TimeRange) -> list[RawEvent]:
        events: list[RawEvent] = []
        for f in data.get("features", []):
            props = f.get("properties", {})
            geom = f.get("geometry", {})
            try:
                lng, lat = self._centroid(geom)
                first_date = props.get("firstdate") or props.get("FIRSTDATE")
                if not first_date:
                    continue
                ts = datetime.fromisoformat(first_date.replace("Z", "+00:00"))
                if not (tr.start <= ts <= tr.end):
                    continue
                area_ha = float(props.get("area_ha", props.get("AREA_HA", 0)))
                # Confidence proxy: large burnt areas are more reliable
                conf = min(0.99, 0.6 + min(area_ha / 10000.0, 0.4))
                events.append(RawEvent(
                    event_id=str(props.get("id", uuid.uuid4())),
                    source=self.SOURCE_NAME,
                    event_type="wildfire",
                    timestamp=ts,
                    longitude=lng,
                    latitude=lat,
                    confidence=conf,
                    raw_payload=props,
                ))
            except (KeyError, ValueError, TypeError):
                continue
        return events

    @staticmethod
    def _centroid(geom: dict) -> tuple[float, float]:
        """Compute approximate centroid from GeoJSON geometry."""
        if geom.get("type") == "Point":
            c = geom["coordinates"]
            return c[0], c[1]
        if geom.get("type") in ("Polygon", "MultiPolygon"):
            from shapely.geometry import shape
            g = shape(geom)
            return g.centroid.x, g.centroid.y
        raise ValueError(f"Unsupported geometry: {geom.get('type')}")

    def _fetch_mock(self, bbox: BoundingBox, tr: TimeRange, now: datetime) -> FetchResult:
        cx, cy = (bbox.west + bbox.east) / 2, (bbox.south + bbox.north) / 2
        events = [
            RawEvent(
                event_id=f"effis-mock-{i}",
                source=self.SOURCE_NAME,
                event_type="wildfire",
                timestamp=tr.start,
                longitude=cx + (i - 1) * 0.05,
                latitude=cy + (i - 1) * 0.05,
                confidence=0.85,
                raw_payload={"mock": True, "area_ha": 1500 + i * 500},
            )
            for i in range(2)
        ]
        result = FetchResult(source=self.SOURCE_NAME, fetched_at=now,
                             bbox=bbox, time_range=tr, events=events)
        result.raw_payload_hash = result.hash_payload([e.raw_payload for e in events])
        return result
