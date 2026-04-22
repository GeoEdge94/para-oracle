"""Tests spatial layer."""
import pytest
from datetime import datetime, timezone

from veralith_pipeline.normalization.schemas import NormalizedEvent, EventType, EventLocation
from veralith_pipeline.spatial.matching import filter_within_region
from veralith_pipeline.spatial.buffers import buffer_around_point, buffer_around_event
from veralith_pipeline.spatial.intersections import (
    polygon_intersection, polygons_union, geom_area_km2,
)


def _evt(lng: float, lat: float) -> NormalizedEvent:
    return NormalizedEvent(
        event_id=f"e-{lng}-{lat}", source="NASA_FIRMS", source_event_id="x",
        event_type=EventType.WILDFIRE,
        timestamp=datetime(2026, 4, 21, 12, tzinfo=timezone.utc),
        location=EventLocation(coordinates=(lng, lat)),
        confidence=0.8,
    )


SQUARE_GEOJSON = {
    "type": "Polygon",
    "coordinates": [[[-120, 37], [-119, 37], [-119, 38], [-120, 38], [-120, 37]]],
}


class TestMatching:
    def test_event_inside_polygon(self):
        events = [_evt(-119.5, 37.5)]
        kept = filter_within_region(events, SQUARE_GEOJSON)
        assert len(kept) == 1

    def test_event_outside_polygon(self):
        events = [_evt(-118, 37.5)]
        kept = filter_within_region(events, SQUARE_GEOJSON)
        assert len(kept) == 0

    def test_feature_unwrapping(self):
        feature = {"type": "Feature", "properties": {}, "geometry": SQUARE_GEOJSON}
        kept = filter_within_region([_evt(-119.5, 37.5)], feature)
        assert len(kept) == 1


class TestBuffers:
    def test_buffer_around_point_returns_polygon(self):
        geom = buffer_around_point(0, 0, radius_km=10)
        assert geom["type"] == "Polygon"
        assert len(geom["coordinates"][0]) > 10   # 32 segments quadrant ≈ 33 pts

    def test_buffer_around_event(self):
        e = _evt(-120, 37)
        geom = buffer_around_event(e, 5)
        assert geom["type"] == "Polygon"


class TestIntersections:
    def test_intersection_overlap(self):
        a = {"type": "Polygon", "coordinates": [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]]}
        b = {"type": "Polygon", "coordinates": [[[1, 1], [3, 1], [3, 3], [1, 3], [1, 1]]]}
        inter = polygon_intersection(a, b)
        assert inter is not None
        assert inter["type"] == "Polygon"

    def test_intersection_disjoint(self):
        a = {"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]}
        b = {"type": "Polygon", "coordinates": [[[10, 10], [11, 10], [11, 11], [10, 11], [10, 10]]]}
        assert polygon_intersection(a, b) is None

    def test_union(self):
        a = {"type": "Polygon", "coordinates": [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]]}
        b = {"type": "Polygon", "coordinates": [[[1, 1], [3, 1], [3, 3], [1, 3], [1, 1]]]}
        u = polygons_union([a, b])
        assert u is not None

    def test_area_km2_equator(self):
        # 1 degre x 1 degre au niveau equateur ≈ 12300 km²
        sq = {"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]}
        area = geom_area_km2(sq)
        assert 12000 < area < 12500
