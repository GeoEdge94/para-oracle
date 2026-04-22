"""Tests normalisation : transformers + validator + schemas."""
import pytest
from datetime import datetime, timezone, timedelta

from veralith_pipeline.ingestion.base import RawEvent
from veralith_pipeline.normalization.schemas import NormalizedEvent, EventType, EventLocation
from veralith_pipeline.normalization.transformers import normalize, normalize_batch
from veralith_pipeline.normalization.validator import SchemaValidator, ValidationError


@pytest.fixture
def raw_firms():
    return RawEvent(
        event_id="firms-1", source="NASA_FIRMS", event_type="wildfire",
        timestamp=datetime(2026, 4, 21, 12, tzinfo=timezone.utc),
        longitude=-120.5, latitude=37.5, confidence=0.9,
        raw_payload={"brightness": 350, "instrument": "VIIRS"},
    )


@pytest.fixture
def raw_usgs():
    return RawEvent(
        event_id="usgs-1", source="USGS", event_type="earthquake",
        timestamp=datetime(2026, 4, 21, 12, tzinfo=timezone.utc),
        longitude=-120.5, latitude=37.5, confidence=0.85,
        raw_payload={"magnitude": 5.2, "place": "20km E of Anza"},
    )


@pytest.fixture
def raw_vigicrues():
    return RawEvent(
        event_id="vc-1", source="VIGICRUES", event_type="flood",
        timestamp=datetime(2026, 4, 21, 12, tzinfo=timezone.utc),
        longitude=2.3, latitude=48.8, confidence=0.8,
        raw_payload={"alert_level": 3, "river": "Seine"},
    )


class TestSchemas:
    def test_normalized_event_construction(self):
        e = NormalizedEvent(
            event_id="00000000-0000-0000-0000-000000000001",
            source="NASA_FIRMS",
            source_event_id="firms-1",
            event_type=EventType.WILDFIRE,
            timestamp=datetime(2026, 4, 21, 12, tzinfo=timezone.utc),
            location=EventLocation(coordinates=(-120.5, 37.5)),
            confidence=0.9,
        )
        assert e.schema_version == "1.0.0"

    def test_naive_timestamp_rejected(self):
        with pytest.raises(ValueError, match="timezone-aware"):
            NormalizedEvent(
                event_id="x", source="NASA_FIRMS", source_event_id="firms-1",
                event_type=EventType.WILDFIRE,
                timestamp=datetime(2026, 4, 21, 12),
                location=EventLocation(coordinates=(-120.5, 37.5)),
                confidence=0.9,
            )

    def test_invalid_coordinates(self):
        with pytest.raises(ValueError):
            EventLocation(coordinates=(200, 0))
        with pytest.raises(ValueError):
            EventLocation(coordinates=(0, 100))


class TestTransformers:
    def test_nasa_firms_transformer(self, raw_firms):
        n = normalize(raw_firms)
        assert n.source == "NASA_FIRMS"
        # event_type may be enum value (str) or Enum depending on use_enum_values
        et = n.event_type.value if hasattr(n.event_type, "value") else n.event_type
        assert et == "wildfire"
        assert n.location.coordinates == (-120.5, 37.5)
        assert n.severity is not None and 0.0 <= n.severity <= 1.0

    def test_usgs_transformer(self, raw_usgs):
        n = normalize(raw_usgs)
        et = n.event_type.value if hasattr(n.event_type, "value") else n.event_type
        assert et == "earthquake"
        assert n.severity == pytest.approx((5.2 - 2.0) / 7.0, rel=0.01)

    def test_vigicrues_transformer(self, raw_vigicrues):
        n = normalize(raw_vigicrues)
        et = n.event_type.value if hasattr(n.event_type, "value") else n.event_type
        assert et == "flood"
        assert n.severity == pytest.approx((3 - 1) / 3.0)

    def test_unknown_source_raises(self):
        bad = RawEvent(event_id="x", source="UNKNOWN", event_type="wildfire",
                       timestamp=datetime(2026, 4, 21, 12, tzinfo=timezone.utc),
                       longitude=0, latitude=0, confidence=0.5)
        with pytest.raises(KeyError):
            normalize(bad)

    def test_batch_skips_invalid(self, raw_firms, raw_usgs):
        bad = RawEvent(event_id="x", source="UNKNOWN", event_type="wildfire",
                       timestamp=datetime(2026, 4, 21, 12, tzinfo=timezone.utc),
                       longitude=0, latitude=0, confidence=0.5)
        out = normalize_batch([raw_firms, bad, raw_usgs])
        assert len(out) == 2

    def test_event_id_deterministic(self, raw_firms):
        n1 = normalize(raw_firms)
        n2 = normalize(raw_firms)
        assert n1.event_id == n2.event_id   # uuid5 deterministic


class TestValidator:
    def test_valid_event_passes(self, raw_firms):
        n = normalize(raw_firms)
        SchemaValidator().validate_one(n)   # no exception

    def test_future_timestamp_rejected(self):
        future = NormalizedEvent(
            event_id="00000000-0000-0000-0000-000000000001",
            source="NASA_FIRMS", source_event_id="x",
            event_type=EventType.WILDFIRE,
            timestamp=datetime.now(tz=timezone.utc) + timedelta(days=2),
            location=EventLocation(coordinates=(0, 0)),
            confidence=0.5,
        )
        with pytest.raises(ValidationError, match="Future"):
            SchemaValidator().validate_one(future)

    def test_batch_split(self, raw_firms):
        good = normalize(raw_firms)
        bad = NormalizedEvent(
            event_id="00000000-0000-0000-0000-000000000002",
            source="NASA_FIRMS", source_event_id="x",
            event_type=EventType.WILDFIRE,
            timestamp=datetime.now(tz=timezone.utc) + timedelta(hours=1),
            location=EventLocation(coordinates=(0, 0)),
            confidence=0.5,
        )
        valid, rejected = SchemaValidator().validate_batch([good, bad])
        assert len(valid) == 1
        assert len(rejected) == 1
