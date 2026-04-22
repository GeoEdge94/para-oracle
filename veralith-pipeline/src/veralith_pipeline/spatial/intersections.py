"""
Intersections + surface area calculations.

Surface en km² : on utilise Shapely en degres puis on multiplie par cos(lat) pour approx.
Pour grande precision, projeter en EPSG:5880 (Brasil) ou local UTM.
"""
from __future__ import annotations
from shapely.geometry import shape, mapping
from shapely.ops import unary_union

import math


def polygon_intersection(geom_a: dict, geom_b: dict) -> dict | None:
    """Retourne le GeoJSON de l'intersection, ou None si vide."""
    a = shape(geom_a)
    b = shape(geom_b)
    inter = a.intersection(b)
    if inter.is_empty:
        return None
    return mapping(inter)


def polygons_union(geoms: list[dict]) -> dict | None:
    if not geoms:
        return None
    geom_objs = [shape(g) for g in geoms]
    u = unary_union(geom_objs)
    if u.is_empty:
        return None
    return mapping(u)


def geom_area_km2(geom: dict) -> float:
    """
    Approximation rapide en km² pour un polygone WGS84.
    Pour precision : reprojeter en CRS metrique (UTM zone locale).
    """
    g = shape(geom)
    if g.is_empty:
        return 0.0
    centroid = g.centroid
    # 1 deg lat = 110.574 km, 1 deg lng = 111.320 * cos(lat) km
    lat_factor = 110.574
    lng_factor = 111.320 * math.cos(math.radians(centroid.y))
    deg2_to_km2 = lat_factor * lng_factor
    return float(g.area * deg2_to_km2)
