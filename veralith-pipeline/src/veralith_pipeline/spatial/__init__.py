"""Spatial operations — matching, buffers, intersections via Shapely."""
from veralith_pipeline.spatial.matching import filter_within_region, events_in_polygon
from veralith_pipeline.spatial.buffers import buffer_around_event, buffer_around_point
from veralith_pipeline.spatial.intersections import polygon_intersection, geom_area_km2

__all__ = [
    "filter_within_region", "events_in_polygon",
    "buffer_around_event", "buffer_around_point",
    "polygon_intersection", "geom_area_km2",
]
