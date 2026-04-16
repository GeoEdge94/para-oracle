"""
Tile caching proxy — serves external WMS/XYZ tiles from local filesystem cache.

GET /tiles/{layer_slug}/{z}/{x}/{y}.png?date=YYYY-MM-DD
  1. Lookup upstream URL template from `layers` table
  2. Check data/tile-cache/{slug}/{z}/{x}/{y}.png (or .../date/z/x/y.png)
  3. Cache miss → fetch upstream, save, return
  4. Cache hit → return from disk instantly

POST /tiles/warmup — pre-fills cache for Pará region at useful zoom levels.

Basemaps (OSM, ESRI, Carto) are NOT proxied — frontend loads them direct.
"""
from __future__ import annotations
import math
import os
import logging
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models import Layer

router = APIRouter()

CACHE_ROOT = Path(settings.DATA_DIR) / "tile-cache"
UPSTREAM_TIMEOUT = 15


def tile_to_bbox(z: int, x: int, y: int) -> tuple[float, float, float, float]:
    """Convert ZXY tile coords to EPSG:3857 bbox (minx, miny, maxx, maxy)."""
    n = 2 ** z
    def lng(tx: int) -> float:
        return tx / n * 360.0 - 180.0
    def lat(ty: int) -> float:
        lat_rad = math.atan(math.sinh(math.pi * (1 - 2 * ty / n)))
        return math.degrees(lat_rad)

    # Geographic bounds
    west = lng(x)
    east = lng(x + 1)
    north = lat(y)
    south = lat(y + 1)

    # Convert to EPSG:3857 (Web Mercator meters)
    def to_3857_x(lon: float) -> float:
        return lon * 20037508.34 / 180.0

    def to_3857_y(latitude: float) -> float:
        latitude = max(min(latitude, 85.06), -85.06)
        y_rad = math.radians(latitude)
        return 20037508.34 / math.pi * math.log(math.tan(math.pi / 4 + y_rad / 2))

    return (to_3857_x(west), to_3857_y(south), to_3857_x(east), to_3857_y(north))


def resolve_upstream_url(url_template: str, z: int, x: int, y: int, date: str | None) -> str:
    """Replace placeholders in the upstream URL template."""
    url = url_template
    url = url.replace("{z}", str(z)).replace("{x}", str(x)).replace("{y}", str(y))

    if "{bbox-epsg-3857}" in url:
        minx, miny, maxx, maxy = tile_to_bbox(z, x, y)
        url = url.replace("{bbox-epsg-3857}", f"{minx},{miny},{maxx},{maxy}")

    if "{date}" in url and date:
        url = url.replace("{date}", date)

    return url


def cache_path(slug: str, z: int, x: int, y: int, date: str | None) -> Path:
    if date:
        return CACHE_ROOT / slug / date / str(z) / str(x) / f"{y}.png"
    return CACHE_ROOT / slug / str(z) / str(x) / f"{y}.png"


# Layers that should NOT be proxied (frontend loads directly)
DIRECT_SLUGS = {"basemap-osm", "basemap-satellite", "basemap-carto-dark"}


@router.get("/{slug}/{z}/{x}/{y}.png")
def get_tile(
    slug: str,
    z: int,
    x: int,
    y: int,
    date: str | None = Query(None),
    db: Session = Depends(get_db),
):
    if slug in DIRECT_SLUGS:
        raise HTTPException(400, "Basemap tiles are not proxied")
    if z < 0 or z > 18 or x < 0 or y < 0:
        raise HTTPException(400, "Invalid tile coordinates")

    # Check cache
    cp = cache_path(slug, z, x, y, date)
    if cp.exists():
        return Response(content=cp.read_bytes(), media_type="image/png",
                        headers={"Cache-Control": "public, max-age=86400"})

    # Lookup upstream URL template
    layer = db.query(Layer).filter(Layer.slug == slug).first()
    if not layer or not layer.url:
        raise HTTPException(404, f"Layer {slug!r} not found")

    upstream_url = resolve_upstream_url(layer.url, z, x, y, date)

    try:
        resp = httpx.get(upstream_url, timeout=UPSTREAM_TIMEOUT, follow_redirects=True)
        resp.raise_for_status()
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Upstream error: {e}")

    content_type = resp.headers.get("content-type", "")
    if "image" not in content_type and len(resp.content) < 100:
        raise HTTPException(502, f"Upstream returned non-image: {content_type}")

    # Save to cache
    cp.parent.mkdir(parents=True, exist_ok=True)
    cp.write_bytes(resp.content)

    return Response(content=resp.content, media_type="image/png",
                    headers={"Cache-Control": "public, max-age=86400"})


@router.get("/{slug}/{z}/{x}/{y}.jpg")
def get_tile_jpg(slug: str, z: int, x: int, y: int,
                 date: str | None = Query(None), db: Session = Depends(get_db)):
    """Alias for JPEG tiles (NASA GIBS true color)."""
    if slug in DIRECT_SLUGS:
        raise HTTPException(400, "Basemap tiles are not proxied")

    cp = cache_path(slug, z, x, y, date)
    jpg_cp = cp.with_suffix(".jpg")

    if jpg_cp.exists():
        return Response(content=jpg_cp.read_bytes(), media_type="image/jpeg",
                        headers={"Cache-Control": "public, max-age=86400"})

    layer = db.query(Layer).filter(Layer.slug == slug).first()
    if not layer or not layer.url:
        raise HTTPException(404, f"Layer {slug!r} not found")

    upstream_url = resolve_upstream_url(layer.url, z, x, y, date)

    try:
        resp = httpx.get(upstream_url, timeout=UPSTREAM_TIMEOUT, follow_redirects=True)
        resp.raise_for_status()
    except httpx.HTTPError as e:
        raise HTTPException(502, f"Upstream error: {e}")

    jpg_cp.parent.mkdir(parents=True, exist_ok=True)
    jpg_cp.write_bytes(resp.content)

    return Response(content=resp.content, media_type="image/jpeg",
                    headers={"Cache-Control": "public, max-age=86400"})


# ── Warmup ────────────────────────────────────────────────────────────────

# Pará bounding box (approximate)
PARA_BBOX = (-59.0, -9.8, -46.0, 2.6)
WARMUP_SLUGS = ["prodes-accumulated", "deter-amz"]
WARMUP_ZOOMS = range(4, 9)  # z4..z8

log = logging.getLogger("tiles.warmup")


def _tiles_in_bbox(bbox: tuple[float, float, float, float], zoom: int):
    """Yield (z, x, y) for every tile intersecting the given lng/lat bbox."""
    west, south, east, north = bbox
    n = 2 ** zoom

    def lng_to_x(lng: float) -> int:
        return int((lng + 180.0) / 360.0 * n)

    def lat_to_y(lat: float) -> int:
        lat_rad = math.radians(lat)
        return int((1 - math.log(math.tan(lat_rad) + 1 / math.cos(lat_rad)) / math.pi) / 2 * n)

    x_min = max(0, lng_to_x(west))
    x_max = min(n - 1, lng_to_x(east))
    y_min = max(0, lat_to_y(north))
    y_max = min(n - 1, lat_to_y(south))

    for x in range(x_min, x_max + 1):
        for y in range(y_min, y_max + 1):
            yield zoom, x, y


@router.post("/warmup")
def warmup_cache(db: Session = Depends(get_db)):
    """
    Pre-fetch verified deforestation tiles for Pará at zoom 4-8.
    Runs in foreground (takes 1-5 min depending on upstream speed).
    """
    fetched, skipped, errors = 0, 0, 0
    client = httpx.Client(timeout=UPSTREAM_TIMEOUT, follow_redirects=True)

    for slug in WARMUP_SLUGS:
        layer = db.query(Layer).filter(Layer.slug == slug).first()
        if not layer or not layer.url:
            continue

        for z in WARMUP_ZOOMS:
            for _, x, y in _tiles_in_bbox(PARA_BBOX, z):
                cp = cache_path(slug, z, x, y, None)
                if cp.exists():
                    skipped += 1
                    continue

                url = resolve_upstream_url(layer.url, z, x, y, None)
                try:
                    resp = client.get(url)
                    if resp.status_code == 200 and len(resp.content) > 50:
                        cp.parent.mkdir(parents=True, exist_ok=True)
                        cp.write_bytes(resp.content)
                        fetched += 1
                except Exception as e:
                    log.warning("warmup %s z%d/%d/%d: %s", slug, z, x, y, e)
                    errors += 1

    client.close()
    return {"fetched": fetched, "skipped_cached": skipped, "errors": errors}
