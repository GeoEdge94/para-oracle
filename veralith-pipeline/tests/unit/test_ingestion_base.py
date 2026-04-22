"""Tests pour les types de base d'ingestion."""
import pytest
from datetime import datetime, timezone, timedelta

from veralith_pipeline.ingestion.base import BoundingBox, TimeRange, RawEvent


class TestBoundingBox:
    def test_valid(self):
        bb = BoundingBox(-125, 32, -114, 42)
        assert bb.contains(-120, 37)
        assert not bb.contains(-100, 37)

    def test_out_of_range_lng(self):
        with pytest.raises(ValueError, match="Longitude"):
            BoundingBox(-200, 32, -114, 42)

    def test_out_of_range_lat(self):
        with pytest.raises(ValueError, match="Latitude"):
            BoundingBox(-125, -100, -114, 42)

    def test_inverted_lat(self):
        with pytest.raises(ValueError, match="South > North"):
            BoundingBox(-125, 42, -114, 32)


class TestTimeRange:
    def test_valid(self):
        now = datetime.now(tz=timezone.utc)
        tr = TimeRange(start=now - timedelta(days=1), end=now)
        assert tr.duration_seconds() > 0

    def test_naive_tz_rejected(self):
        with pytest.raises(ValueError, match="timezone-aware"):
            TimeRange(start=datetime(2025, 1, 1), end=datetime.now(tz=timezone.utc))

    def test_inverted(self):
        now = datetime.now(tz=timezone.utc)
        with pytest.raises(ValueError, match="start > end"):
            TimeRange(start=now, end=now - timedelta(days=1))


class TestRawEvent:
    def test_stable_id_deterministic(self):
        ts = datetime(2026, 4, 21, 12, 0, tzinfo=timezone.utc)
        a = RawEvent(event_id="x", source="NASA_FIRMS", event_type="wildfire",
                     timestamp=ts, longitude=-120.5, latitude=37.5, confidence=0.8)
        b = RawEvent(event_id="y", source="NASA_FIRMS", event_type="wildfire",
                     timestamp=ts, longitude=-120.5, latitude=37.5, confidence=0.8)
        # Same source/type/ts/coords → same stable_id, even if event_id differs
        assert a.stable_id() == b.stable_id()

    def test_stable_id_varies_with_coords(self):
        ts = datetime(2026, 4, 21, 12, 0, tzinfo=timezone.utc)
        a = RawEvent(event_id="x", source="NASA_FIRMS", event_type="wildfire",
                     timestamp=ts, longitude=-120.5, latitude=37.5, confidence=0.8)
        b = RawEvent(event_id="x", source="NASA_FIRMS", event_type="wildfire",
                     timestamp=ts, longitude=-120.6, latitude=37.5, confidence=0.8)
        assert a.stable_id() != b.stable_id()
