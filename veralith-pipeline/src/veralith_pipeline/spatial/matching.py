"""
Matching spatial : filtrer les events qui tombent dans une region donnee.
"""
from __future__ import annotations
from typing import Iterable
from shapely.geometry import Point, Polygon, MultiPolygon, shape

from veralith_pipeline.normalization.schemas import NormalizedEvent


def filter_within_region(
    events: Iterable[NormalizedEvent],
    region_geojson: dict,
) -> list[NormalizedEvent]:
    """
    Garde uniquement les events dont le Point tombe DANS le polygone region.
    `region_geojson` peut etre un Feature ou directement une geometrie GeoJSON.
    """
    geom = _extract_geometry(region_geojson)
    region = shape(geom)
    if not isinstance(region, (Polygon, MultiPolygon)):
        raise ValueError(f"Region must be Polygon or MultiPolygon, got {type(region).__name__}")
    return [e for e in events if region.contains(Point(*e.location.coordinates))]


def events_in_polygon(
    events: Iterable[NormalizedEvent],
    polygon_coords: list[list[tuple[float, float]]],
) -> list[NormalizedEvent]:
    """Variante utilitaire avec coordinates brutes (rings extérieur + trous)."""
    region = Polygon(polygon_coords[0], holes=polygon_coords[1:])
    return [e for e in events if region.contains(Point(*e.location.coordinates))]


def _extract_geometry(gj: dict) -> dict:
    if gj.get("type") == "Feature":
        return gj["geometry"]
    if gj.get("type") in ("Polygon", "MultiPolygon"):
        return gj
    raise ValueError(f"Unsupported GeoJSON type: {gj.get('type')}")
