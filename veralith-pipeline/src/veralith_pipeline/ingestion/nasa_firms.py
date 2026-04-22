"""
NASA FIRMS — Fire Information for Resource Management System.

Endpoint: https://firms.modaps.eosdis.nasa.gov/api/area/csv/
Output : VIIRS detections fires (375m resolution).

Doc: https://firms.modaps.eosdis.nasa.gov/api/area/
"""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Any
import csv
import io
import uuid
import httpx

from veralith_pipeline.ingestion.base import (
    BaseConnector, BoundingBox, TimeRange, RawEvent, FetchResult
)


class NasaFirmsConnector(BaseConnector):
    SOURCE_NAME = "NASA_FIRMS"
    SUPPORTED_TYPES = ("wildfire",)
    BASE_URL = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"
    SENSOR = "VIIRS_SNPP_NRT"

    def fetch(self, bbox: BoundingBox, time_range: TimeRange) -> FetchResult:
        now = datetime.now(tz=timezone.utc)
        if self.mock:
            return self._fetch_mock(bbox, time_range, now)
        if not self.api_key:
            raise ValueError("NASA FIRMS requires api_key (https://firms.modaps.eosdis.nasa.gov/api/map_key/)")

        days = max(1, min(10, int(time_range.duration_seconds() / 86400)))
        start_iso = time_range.start.date().isoformat()
        url = (
            f"{self.BASE_URL}/{self.api_key}/{self.SENSOR}/"
            f"{bbox.west},{bbox.south},{bbox.east},{bbox.north}/{days}/{start_iso}"
        )
        try:
            r = httpx.get(url, timeout=30)
            r.raise_for_status()
            events = self._parse_csv(r.text, time_range)
            result = FetchResult(
                source=self.SOURCE_NAME, fetched_at=now,
                bbox=bbox, time_range=time_range, events=events,
            )
            result.raw_payload_hash = result.hash_payload(r.text)
            return result
        except httpx.HTTPError as e:
            return FetchResult(source=self.SOURCE_NAME, fetched_at=now,
                               bbox=bbox, time_range=time_range, error=str(e))

    # ── Parsing ──────────────────────────────────────────────────────────────

    def _parse_csv(self, body: str, tr: TimeRange) -> list[RawEvent]:
        events: list[RawEvent] = []
        reader = csv.DictReader(io.StringIO(body))
        for row in reader:
            try:
                lat = float(row["latitude"])
                lng = float(row["longitude"])
                acq_date = row["acq_date"]
                acq_time = row["acq_time"].zfill(4)
                ts = datetime.strptime(f"{acq_date} {acq_time}", "%Y-%m-%d %H%M").replace(tzinfo=timezone.utc)
                if not (tr.start <= ts <= tr.end):
                    continue
                conf_raw = row.get("confidence", "n")
                conf = self._normalize_confidence(conf_raw)
                events.append(RawEvent(
                    event_id=str(uuid.uuid4()),
                    source=self.SOURCE_NAME,
                    event_type="wildfire",
                    timestamp=ts,
                    longitude=lng,
                    latitude=lat,
                    confidence=conf,
                    raw_payload=row,
                ))
            except (KeyError, ValueError):
                continue
        return events

    @staticmethod
    def _normalize_confidence(raw: str | float) -> float:
        """FIRMS uses 'l'/'n'/'h' (low/nominal/high) or numeric 0-100."""
        if isinstance(raw, (int, float)):
            return max(0.0, min(1.0, float(raw) / 100.0))
        m = {"l": 0.30, "n": 0.65, "h": 0.92}
        return m.get(str(raw).strip().lower()[:1], 0.5)

    # ── Mock ─────────────────────────────────────────────────────────────────

    def _fetch_mock(self, bbox: BoundingBox, tr: TimeRange, now: datetime) -> FetchResult:
        cx, cy = (bbox.west + bbox.east) / 2, (bbox.south + bbox.north) / 2
        events = [
            RawEvent(
                event_id=f"firms-mock-{i}",
                source=self.SOURCE_NAME,
                event_type="wildfire",
                timestamp=tr.start,
                longitude=cx + (i - 1) * 0.1,
                latitude=cy + (i - 1) * 0.1,
                confidence=0.65 + i * 0.1,
                raw_payload={"mock": True, "index": i},
            )
            for i in range(3)
        ]
        result = FetchResult(source=self.SOURCE_NAME, fetched_at=now,
                             bbox=bbox, time_range=tr, events=events)
        result.raw_payload_hash = result.hash_payload([e.raw_payload for e in events])
        return result
