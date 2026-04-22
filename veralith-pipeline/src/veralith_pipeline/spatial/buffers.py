"""
Buffers — generer un cercle (en degres approx) autour d'un point.
Pour calcul de surface precise, reprojeter en metre (EPSG:3857) puis buffer en metres.
"""
from __future__ import annotations
from shapely.geometry import Point, mapping

from veralith_pipeline.normalization.schemas import NormalizedEvent


# 1 degre lat ≈ 111 km. Pour buffer en km grossier au niveau equateur.
_KM_TO_DEG = 1 / 111.0


def buffer_around_point(lng: float, lat: float, radius_km: float) -> dict:
    """Retourne un GeoJSON Polygon (cercle approxime) en degres."""
    p = Point(lng, lat)
    poly = p.buffer(radius_km * _KM_TO_DEG, quad_segs=32)
    return mapping(poly)


def buffer_around_event(event: NormalizedEvent, radius_km: float) -> dict:
    lng, lat = event.location.coordinates
    return buffer_around_point(lng, lat, radius_km)
