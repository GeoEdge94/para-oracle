"""Tests des 5 connectors en mode mock (pas de reseau)."""
import pytest

from veralith_pipeline.ingestion import (
    NasaFirmsConnector, EffisConnector, NoaaConnector, UsgsConnector, VigicruesConnector,
)


@pytest.mark.parametrize("ConnectorCls,expected_type", [
    (NasaFirmsConnector, "wildfire"),
    (EffisConnector, "wildfire"),
    (UsgsConnector, "earthquake"),
    (VigicruesConnector, "flood"),
])
def test_mock_returns_events_in_bbox(ConnectorCls, expected_type, bbox_california, time_range_30d):
    c = ConnectorCls(mock=True)
    res = c.fetch(bbox_california, time_range_30d)
    assert res.error is None
    assert len(res.events) > 0
    for e in res.events:
        assert e.event_type == expected_type
        assert bbox_california.contains(e.longitude, e.latitude)
        assert 0.0 <= e.confidence <= 1.0


def test_noaa_mock_multiple_types(bbox_california, time_range_30d):
    res = NoaaConnector(mock=True).fetch(bbox_california, time_range_30d)
    assert res.error is None
    types = {e.event_type for e in res.events}
    assert "flood" in types or "wildfire" in types


def test_payload_hash_present(bbox_california, time_range_30d):
    """Toute reponse mock doit avoir un hash de payload pour tracability."""
    for ConnectorCls in [NasaFirmsConnector, EffisConnector, NoaaConnector, UsgsConnector, VigicruesConnector]:
        res = ConnectorCls(mock=True).fetch(bbox_california, time_range_30d)
        assert res.raw_payload_hash, f"{ConnectorCls.__name__} missing payload hash"
        assert len(res.raw_payload_hash) == 64   # SHA-256 hex


def test_nasa_firms_confidence_normalization():
    c = NasaFirmsConnector(mock=True)
    assert c._normalize_confidence("h") == 0.92
    assert c._normalize_confidence("n") == 0.65
    assert c._normalize_confidence("l") == 0.30
    assert c._normalize_confidence(75) == pytest.approx(0.75)
    assert c._normalize_confidence(150) == 1.0
