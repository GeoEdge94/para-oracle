"""
Vigicrues — service francais de prevision des crues.

Endpoint: https://www.vigicrues.gouv.fr/services/1/InfoVigiCru.json/

Doc: https://www.vigicrues.gouv.fr/services-info.php
"""
from __future__ import annotations
from datetime import datetime, timezone
import uuid
import httpx

from veralith_pipeline.ingestion.base import (
    BaseConnector, BoundingBox, TimeRange, RawEvent, FetchResult
)


# Vigicrues uses 4 alert levels: Vert (1), Jaune (2), Orange (3), Rouge (4)
LEVEL_TO_CONFIDENCE = {1: 0.20, 2: 0.55, 3: 0.80, 4: 0.95}


class VigicruesConnector(BaseConnector):
    SOURCE_NAME = "VIGICRUES"
    SUPPORTED_TYPES = ("flood",)
    BASE_URL = "https://www.vigicrues.gouv.fr/services/1/InfoVigiCru.json"

    def fetch(self, bbox: BoundingBox, time_range: TimeRange) -> FetchResult:
        now = datetime.now(tz=timezone.utc)
        if self.mock:
            return self._fetch_mock(bbox, time_range, now)

        try:
            r = httpx.get(self.BASE_URL, timeout=30,
                          headers={"User-Agent": "veralith-pipeline (tech@veralith.io)"})
            r.raise_for_status()
            data = r.json()
            events = self._parse_response(data, bbox, time_range)
            result = FetchResult(source=self.SOURCE_NAME, fetched_at=now,
                                 bbox=bbox, time_range=time_range, events=events)
            result.raw_payload_hash = result.hash_payload(data)
            return result
        except httpx.HTTPError as e:
            return FetchResult(source=self.SOURCE_NAME, fetched_at=now,
                               bbox=bbox, time_range=time_range, error=str(e))

    def _parse_response(self, data: dict, bbox: BoundingBox, tr: TimeRange) -> list[RawEvent]:
        events: list[RawEvent] = []
        sections = data.get("VicSecMer") or data.get("vic_sec_mer") or []
        for section in sections:
            try:
                level = int(section.get("vicNivSituVigCruEnt", 1))
                if level < 2:    # ignore "vert" (vigilance normale)
                    continue
                # Vigicrues sections cover river segments — use first coord as approx
                coords = section.get("vicGeo", {}).get("coordinates")
                if not coords or not isinstance(coords, list):
                    continue
                first = coords[0] if isinstance(coords[0], list) else coords
                lng, lat = float(first[0]), float(first[1])
                if not bbox.contains(lng, lat):
                    continue
                ts_str = section.get("vicHorAjr") or section.get("vicHorEnvVerVer")
                ts = (datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                      if ts_str else datetime.now(timezone.utc))
                if not (tr.start <= ts <= tr.end):
                    continue
                events.append(RawEvent(
                    event_id=section.get("vicIdEntVigCru") or str(uuid.uuid4()),
                    source=self.SOURCE_NAME,
                    event_type="flood",
                    timestamp=ts,
                    longitude=lng,
                    latitude=lat,
                    confidence=LEVEL_TO_CONFIDENCE[level],
                    raw_payload={**section, "alert_level": level},
                ))
            except (KeyError, ValueError, TypeError):
                continue
        return events

    def _fetch_mock(self, bbox: BoundingBox, tr: TimeRange, now: datetime) -> FetchResult:
        cx, cy = (bbox.west + bbox.east) / 2, (bbox.south + bbox.north) / 2
        events = [
            RawEvent(
                event_id=f"vigicrues-mock-{i}",
                source=self.SOURCE_NAME,
                event_type="flood",
                timestamp=tr.start,
                longitude=cx + i * 0.05,
                latitude=cy,
                confidence=LEVEL_TO_CONFIDENCE[3],
                raw_payload={"mock": True, "alert_level": 3, "river": f"Mock-River-{i}"},
            )
            for i in range(2)
        ]
        result = FetchResult(source=self.SOURCE_NAME, fetched_at=now,
                             bbox=bbox, time_range=tr, events=events)
        result.raw_payload_hash = result.hash_payload([e.raw_payload for e in events])
        return result
