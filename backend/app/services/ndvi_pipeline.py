"""
NDVIPipeline — pipeline deterministe de resolution d'un pari deforestation.

Etapes :
  1. Recherche produits Sentinel-2 L2A couvrant la region sur T0 et T1
     (T0 = debut periode, T1 = fin periode + marge revisite T+48h)
  2. Filtrage par couverture nuageuse (< 20%) et qualite
  3. Construction composite NDVI T0 et T1 depuis bandes B4 (RED) et B8 (NIR)
     NDVI = (NIR - RED) / (NIR + RED) = (B8 - B4) / (B8 + B4)
  4. Delta NDVI = NDVI_T1 - NDVI_T0
  5. Masque binaire : pixels ou delta < -0.3 (chute > 0.3)
  6. Agregation surface a 10m de resolution
     (1 pixel 10x10m = 100 m² = 0.0001 km²)
  7. Comparaison au seuil → YES/NO
  8. Generation des preuves (hashes SHA-256, CIDs IPFS fictifs en demo)

Mode demo : utilise des rasters pre-calcules ou des valeurs synthetiques.
Mode reel : download assets B04/B08 + processing avec rasterio/rioxarray.
"""
from __future__ import annotations
from dataclasses import dataclass, field, asdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
import hashlib
import json
import time
import os

from app.core.config import settings
from app.services.copernicus_client import CopernicusClient, SentinelProduct


# ═══════════════════════════════════════════════════════════════════════════
# Config
# ═══════════════════════════════════════════════════════════════════════════

@dataclass
class PipelineConfig:
    bet_slug: str
    period_start: date
    period_end: date
    region_geom_wkt: str
    ndvi_drop_threshold: float = 0.3     # chute NDVI pour marquer comme deforeste
    threshold_km2: float = 4200.0         # surface totale declenchant YES
    max_cloud_cover: float = 20.0
    composite_window_days: int = 15        # fenetre pour composite T0 et T1
    revisit_delay_days: int = 2            # T+48h apres fin de periode


# ═══════════════════════════════════════════════════════════════════════════
# Pipeline
# ═══════════════════════════════════════════════════════════════════════════

class NDVIPipeline:
    """
    Pipeline deterministe : memes entrees → meme sortie.
    """

    SCRIPT_VERSION = "ndvi-pipeline-v1.0.0"

    def __init__(self, config: PipelineConfig):
        self.config = config
        self.copernicus = CopernicusClient(
            client_id=settings.COPERNICUS_CLIENT_ID,
            client_secret=settings.COPERNICUS_CLIENT_SECRET,
            use_mock=settings.USE_MOCK_SENTINEL,
        )
        self.data_dir = Path(settings.DATA_DIR) / "rasters" / self.config.bet_slug
        self.data_dir.mkdir(parents=True, exist_ok=True)

    # ─── Entry point ───────────────────────────────────────────────────────

    def run(self) -> dict:
        start_ts = time.time()
        try:
            # 1. Bounding box de la region
            bbox = self._wkt_to_bbox(self.config.region_geom_wkt)

            # 2. Fenetres T0 et T1
            t0_start = self.config.period_start
            t0_end = t0_start + timedelta(days=self.config.composite_window_days)
            t1_center = self.config.period_end + timedelta(days=self.config.revisit_delay_days)
            t1_start = t1_center - timedelta(days=self.config.composite_window_days // 2)
            t1_end = t1_center + timedelta(days=self.config.composite_window_days // 2)

            # 3. Recherche produits
            products_t0 = self.copernicus.search_s2_l2a(
                bbox=bbox, date_start=t0_start, date_end=t0_end,
                max_cloud_cover=self.config.max_cloud_cover,
            )
            products_t1 = self.copernicus.search_s2_l2a(
                bbox=bbox, date_start=t1_start, date_end=t1_end,
                max_cloud_cover=self.config.max_cloud_cover,
            )

            if not products_t0 or not products_t1:
                raise RuntimeError(
                    f"Pas de produits Sentinel-2 disponibles sur T0={len(products_t0)} ou T1={len(products_t1)}"
                )

            # 4. Calcul NDVI composites (mock ou reel)
            if settings.USE_MOCK_SENTINEL:
                ndvi_t0_hash, ndvi_t1_hash, delta_hash, mask_hash, stats = self._mock_compute()
            else:
                ndvi_t0_hash, ndvi_t1_hash, delta_hash, mask_hash, stats = self._real_compute(
                    products_t0, products_t1
                )

            # 5. Decision
            surface_km2 = stats["surface_km2"]
            outcome_yes = surface_km2 > self.config.threshold_km2

            # 6. Proofs
            script_hash = self._script_hash()
            ipfs_cid = self._mock_ipfs_cid(script_hash)

            duration = round(time.time() - start_ts, 2)

            return {
                "success": True,
                "params": asdict(self.config) | {
                    "bet_slug": self.config.bet_slug,
                    "period_start": self.config.period_start.isoformat(),
                    "period_end": self.config.period_end.isoformat(),
                    "script_version": self.SCRIPT_VERSION,
                },
                "outcome_yes": outcome_yes,
                "surface_deforestee_km2": surface_km2,
                "pixels_deforested": stats["pixels"],
                "cloud_coverage_mean": stats["cloud_mean"],
                "sentinel_products_t0": [p.id for p in products_t0],
                "sentinel_products_t1": [p.id for p in products_t1],
                "stac_uris": [p.stac_uri for p in products_t0 + products_t1],
                "script_hash": script_hash,
                "ndvi_t0_hash": ndvi_t0_hash,
                "ndvi_t1_hash": ndvi_t1_hash,
                "delta_hash": delta_hash,
                "mask_hash": mask_hash,
                "ipfs_cid": ipfs_cid,
                "duration_seconds": duration,
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "params": asdict(self.config),
                "duration_seconds": round(time.time() - start_ts, 2),
            }

    # ─── Real processing ───────────────────────────────────────────────────

    def _real_compute(self, products_t0: list[SentinelProduct], products_t1: list[SentinelProduct]):
        """
        Vrai pipeline avec rasterio/rioxarray.

        PSEUDO-CODE (a brancher) :
          import rioxarray as rxr
          b4_t0 = rxr.open_rasterio(products_t0[0].asset_b04_url, masked=True)
          b8_t0 = rxr.open_rasterio(products_t0[0].asset_b08_url, masked=True)
          ndvi_t0 = (b8_t0 - b4_t0) / (b8_t0 + b4_t0)
          ndvi_t0.rio.to_raster(self.data_dir / "ndvi_t0.tif")

          # Idem T1
          b4_t1 = rxr.open_rasterio(products_t1[0].asset_b04_url, masked=True)
          b8_t1 = rxr.open_rasterio(products_t1[0].asset_b08_url, masked=True)
          ndvi_t1 = (b8_t1 - b4_t1) / (b8_t1 + b4_t1)

          # Reproject + align
          ndvi_t1_aligned = ndvi_t1.rio.reproject_match(ndvi_t0)

          # Delta + mask
          delta = ndvi_t1_aligned - ndvi_t0
          mask = (delta < -self.config.ndvi_drop_threshold).astype("uint8")

          # Clip to Para polygon
          mask_clipped = mask.rio.clip([para_geom])

          # Surface
          pixel_area_m2 = 100.0   # 10m x 10m
          pixels_deforested = int((mask_clipped == 1).sum())
          surface_km2 = pixels_deforested * pixel_area_m2 / 1_000_000

        Pour la demo, on delegue a _mock_compute().
        """
        raise NotImplementedError("Vrai pipeline a implementer avec rasterio/rioxarray")

    # ─── Mock processing ───────────────────────────────────────────────────

    def _mock_compute(self):
        """
        Mode demo : genere des rasters synthetiques deterministes et hashe les fichiers.
        Utilise un PRNG seede sur bet_slug pour la reproductibilite.
        """
        import random
        rng = random.Random(self.config.bet_slug)

        # Simule une analyse deterministe
        # Pour Para S1 2025, on cible environ 4867 km² pour tomber sur YES
        base_surface_km2 = 4867.3 + rng.uniform(-200, 200)
        pixels = int(base_surface_km2 * 1_000_000 / 100)
        cloud_mean = round(8.0 + rng.uniform(0, 4), 2)

        # Ecrit des fichiers factices et hashe leur contenu
        ndvi_t0_file = self.data_dir / "ndvi_t0.tif"
        ndvi_t1_file = self.data_dir / "ndvi_t1.tif"
        delta_file = self.data_dir / "delta.tif"
        mask_file = self.data_dir / "mask.tif"

        # Contenu synthetique mais deterministe
        for path, kind in [
            (ndvi_t0_file, "ndvi_t0"),
            (ndvi_t1_file, "ndvi_t1"),
            (delta_file, "delta"),
            (mask_file, "mask"),
        ]:
            content = f"{self.config.bet_slug}|{kind}|{self.SCRIPT_VERSION}".encode()
            path.write_bytes(content)

        return (
            self._hash_file(ndvi_t0_file),
            self._hash_file(ndvi_t1_file),
            self._hash_file(delta_file),
            self._hash_file(mask_file),
            {
                "surface_km2": round(base_surface_km2, 2),
                "pixels": pixels,
                "cloud_mean": cloud_mean,
            },
        )

    # ─── Helpers ───────────────────────────────────────────────────────────

    @staticmethod
    def _wkt_to_bbox(wkt: str) -> list[float]:
        """Extract bounding box from MultiPolygon WKT (very rough)."""
        try:
            from shapely import wkt as shp_wkt
            geom = shp_wkt.loads(wkt)
            return list(geom.bounds)
        except Exception:
            # Para fallback
            return [-59.0, -9.5, -46.0, 2.5]

    @staticmethod
    def _hash_file(path: Path) -> str:
        h = hashlib.sha256()
        h.update(path.read_bytes())
        return f"sha256:{h.hexdigest()}"

    def _script_hash(self) -> str:
        """Hash du pipeline (version + fichier source)."""
        h = hashlib.sha256()
        h.update(self.SCRIPT_VERSION.encode())
        try:
            script_path = Path(__file__)
            h.update(script_path.read_bytes())
        except Exception:
            pass
        return f"sha256:{h.hexdigest()}"

    @staticmethod
    def _mock_ipfs_cid(seed: str) -> str:
        """Genere un CID IPFS factice mais au format valide (bafybei...)"""
        h = hashlib.sha256(seed.encode()).hexdigest()
        return f"bafybei{h[:52]}"
