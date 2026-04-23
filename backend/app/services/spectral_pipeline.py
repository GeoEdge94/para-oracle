"""
SpectralPipeline — pipeline deterministe multi-indice pour resolution de paris geospatiaux.

Supporte 8 indices spectraux Sentinel-2 :
  NDVI  — vegetation (deforestation, reforestation)
  EVI   — vegetation dense (forets tropicales)
  NBR   — zones brulees (feux de foret)
  NDWI  — eau / inondation
  MNDWI — eau en zone urbaine
  NDBI  — surfaces baties (urbanisation)
  BSI   — sol nu (mines, carrieres)
  NDSI  — neige / glace (glaciers)

Chaque indice est calcule sur deux fenetres temporelles (T0, T1) puis :
  delta = index_T1 - index_T0
  mask = delta depasse le seuil (direction configurable)
  surface = pixels masques * resolution^2
  outcome = surface > seuil du pari → YES / NO
"""
from __future__ import annotations
from dataclasses import dataclass, field, asdict
from datetime import date, timedelta
from pathlib import Path
import hashlib
import random
import time
import os

from app.core.config import settings
from app.services.canonical import fingerprint_sha256
from app.services.copernicus_client import CopernicusClient
from app.services.pipeline_base import BlobRef, build_manifest


SCRIPT_VERSION = "spectral-pipeline-v2.0.0"

# Bandes Sentinel-2 requises par indice
BANDS_NEEDED: dict[str, list[str]] = {
    "NDVI":  ["B04", "B08"],
    "EVI":   ["B02", "B04", "B08"],
    "NBR":   ["B08", "B12"],
    "NDWI":  ["B03", "B08"],
    "MNDWI": ["B03", "B11"],
    "NDBI":  ["B08", "B11"],
    "BSI":   ["B02", "B04", "B08", "B11"],
    "NDSI":  ["B03", "B11"],
}

# Surface de reference mock par categorie (km2, pour seed deterministe)
MOCK_BASE_SURFACES: dict[str, tuple[float, float]] = {
    "NDVI":  (4867.0, 400.0),   # deforestation ~4500-5300 km2
    "EVI":   (4200.0, 350.0),   # deforestation dense
    "NBR":   (12500.0, 3000.0), # feux, ha converti en km2 equiv
    "NDWI":  (580.0, 150.0),    # inondation
    "MNDWI": (520.0, 120.0),    # inondation urbaine
    "NDBI":  (6.5, 2.0),        # expansion urbaine km2
    "BSI":   (18.0, 5.0),       # mines km2
    "NDSI":  (0.8, 0.3),        # recul glacier km2
}


@dataclass
class PipelineConfig:
    bet_slug: str
    period_start: date
    period_end: date
    region_geom_wkt: str
    index_type: str = "NDVI"
    change_direction: str = "decrease"
    change_threshold: float = 0.3
    threshold_value: float = 4200.0
    threshold_unit: str = "km2"
    ground_truth_source: str = "PRODES"
    proof_layers: list[str] = field(default_factory=list)
    max_cloud_cover: float = 20.0
    composite_window_days: int = 15
    revisit_delay_days: int = 2


@dataclass
class PipelineResult:
    success: bool
    outcome_yes: bool = False
    surface_value: float = 0.0
    pixels_affected: int = 0
    cloud_coverage_mean: float = 0.0
    index_t0_hash: str = ""
    index_t1_hash: str = ""
    delta_hash: str = ""
    mask_hash: str = ""
    script_hash: str = ""
    ipfs_cid: str = ""
    sentinel_products_t0: list[str] = field(default_factory=list)
    sentinel_products_t1: list[str] = field(default_factory=list)
    stac_uris: list[str] = field(default_factory=list)
    params: dict = field(default_factory=dict)
    duration_seconds: float = 0.0
    error: str = ""

    # Champs Web3 (M1) — alignes avec BasePipelineResult
    observed_value: float = 0.0
    threshold_value: float = 0.0
    threshold_unit: str = ""
    direction: str = "gt"
    data_normalized: dict = field(default_factory=dict)
    blobs: list[BlobRef] = field(default_factory=list)


class SpectralPipeline:
    """Pipeline deterministe multi-indice. Memes entrees → memes sorties."""

    def __init__(self, config: PipelineConfig):
        self.config = config
        self.copernicus = CopernicusClient(
            client_id=settings.COPERNICUS_CLIENT_ID,
            client_secret=settings.COPERNICUS_CLIENT_SECRET,
            use_mock=settings.USE_MOCK_SENTINEL,
        )
        self.data_dir = Path(settings.DATA_DIR) / "rasters" / config.bet_slug
        self.data_dir.mkdir(parents=True, exist_ok=True)

    def run(self) -> PipelineResult:
        start = time.time()
        cfg = self.config
        try:
            bbox = self._wkt_to_bbox(cfg.region_geom_wkt)

            t0_start = cfg.period_start
            t0_end = t0_start + timedelta(days=cfg.composite_window_days)
            t1_center = cfg.period_end + timedelta(days=cfg.revisit_delay_days)
            t1_start = t1_center - timedelta(days=cfg.composite_window_days // 2)
            t1_end = t1_center + timedelta(days=cfg.composite_window_days // 2)

            products_t0 = self.copernicus.search_s2_l2a(
                bbox=bbox, date_start=t0_start, date_end=t0_end,
                max_cloud_cover=cfg.max_cloud_cover,
            )
            products_t1 = self.copernicus.search_s2_l2a(
                bbox=bbox, date_start=t1_start, date_end=t1_end,
                max_cloud_cover=cfg.max_cloud_cover,
            )

            if not products_t0 or not products_t1:
                raise RuntimeError(
                    f"No Sentinel-2 products: T0={len(products_t0)}, T1={len(products_t1)}"
                )

            if settings.USE_MOCK_SENTINEL:
                hashes, stats, blobs = self._mock_compute(bbox)
            else:
                hashes, stats, blobs = self._real_compute(products_t0, products_t1)

            surface = stats["surface"]
            outcome = self._evaluate_outcome(surface)
            script_hash = self._script_hash()

            manifest = self._build_manifest(
                bbox=bbox,
                blobs=blobs,
                outcome=outcome,
                observed=surface,
            )
            params = self._serialize_params()
            params["fingerprint_sha256"] = fingerprint_sha256(manifest)

            return PipelineResult(
                success=True,
                outcome_yes=outcome,
                surface_value=surface,
                pixels_affected=stats["pixels"],
                cloud_coverage_mean=stats["cloud_mean"],
                index_t0_hash=hashes[0],
                index_t1_hash=hashes[1],
                delta_hash=hashes[2],
                mask_hash=hashes[3],
                script_hash=script_hash,
                ipfs_cid=self._mock_ipfs_cid(script_hash),
                sentinel_products_t0=[p.id for p in products_t0],
                sentinel_products_t1=[p.id for p in products_t1],
                stac_uris=[p.stac_uri for p in products_t0 + products_t1],
                params=params,
                duration_seconds=round(time.time() - start, 2),
                # Champs Web3
                observed_value=surface,
                threshold_value=float(cfg.threshold_value),
                threshold_unit=cfg.threshold_unit,
                direction="gt",
                data_normalized=manifest,
                blobs=blobs,
            )
        except Exception as e:
            return PipelineResult(
                success=False,
                error=str(e),
                params=self._serialize_params(),
                duration_seconds=round(time.time() - start, 2),
            )

    def _evaluate_outcome(self, surface: float) -> bool:
        cfg = self.config
        if cfg.threshold_unit == "%":
            return surface > cfg.threshold_value
        return surface > cfg.threshold_value

    def _mock_compute(self, bbox: list[float]) -> tuple[tuple[str, str, str, str], dict, list[BlobRef]]:
        """Deterministic mock: PRNG seeded on bet_slug + index_type."""
        cfg = self.config
        rng = random.Random(f"{cfg.bet_slug}:{cfg.index_type}")

        base, spread = MOCK_BASE_SURFACES.get(cfg.index_type, (1000.0, 200.0))
        surface = round(base + rng.uniform(-spread, spread), 2)
        pixels = int(surface * 1_000_000 / 100)
        cloud_mean = round(8.0 + rng.uniform(0, 4), 2)

        idx_lower = cfg.index_type.lower()
        files = [
            (self.data_dir / f"{idx_lower}_t0.tif", f"{idx_lower}_t0"),
            (self.data_dir / f"{idx_lower}_t1.tif", f"{idx_lower}_t1"),
            (self.data_dir / "delta.tif", "delta"),
            (self.data_dir / "mask.tif", "mask"),
        ]
        for path, kind in files:
            content = f"{cfg.bet_slug}|{kind}|{cfg.index_type}|{SCRIPT_VERSION}".encode()
            path.write_bytes(content)

        hashes = tuple(self._hash_file(p) for p, _ in files)
        blobs = [
            BlobRef(kind=kind, path=path, sha256=hashes[i], bbox=list(bbox))
            for i, (path, kind) in enumerate(files)
        ]
        return hashes, {"surface": surface, "pixels": pixels, "cloud_mean": cloud_mean}, blobs

    def _real_compute(self, products_t0, products_t1):
        """Stub for real rioxarray processing. To be implemented with Sentinel Hub Process API."""
        raise NotImplementedError(
            f"Real compute not yet implemented for {self.config.index_type}. "
            f"Bands needed: {BANDS_NEEDED.get(self.config.index_type, [])}"
        )

    def _build_manifest(
        self,
        *,
        bbox: list[float],
        blobs: list[BlobRef],
        outcome: bool,
        observed: float,
    ) -> dict:
        """Construit le manifest schema_v1 pour ce pipeline spectral.

        Les `cid` des blobs sont None a ce stade ; web3_publisher les remplira
        apres le pinning IPFS, puis recomputera le fingerprint.
        """
        cfg = self.config
        return build_manifest(
            pipeline_kind="spectral",
            bet_slug=cfg.bet_slug,
            period_start=cfg.period_start.isoformat(),
            period_end=cfg.period_end.isoformat(),
            region_bbox=list(bbox),
            fingerprint_inputs={
                "rasters": [
                    {
                        "kind": b.kind,
                        "cid": b.cid,
                        "sha256": b.sha256,
                        "bbox": b.bbox,
                    }
                    for b in blobs
                ],
                "bands": BANDS_NEEDED.get(cfg.index_type, []),
                "index_type": cfg.index_type,
                "script_version": SCRIPT_VERSION,
            },
            outcome_yes=outcome,
            observed_value=observed,
            threshold_value=float(cfg.threshold_value),
            threshold_unit=cfg.threshold_unit,
            direction="gt",
        )

    def _serialize_params(self) -> dict:
        d = asdict(self.config)
        d["period_start"] = self.config.period_start.isoformat()
        d["period_end"] = self.config.period_end.isoformat()
        d["script_version"] = SCRIPT_VERSION
        d["bands"] = BANDS_NEEDED.get(self.config.index_type, [])
        return d

    @staticmethod
    def _wkt_to_bbox(wkt: str) -> list[float]:
        try:
            from shapely import wkt as shp_wkt
            return list(shp_wkt.loads(wkt).bounds)
        except Exception:
            return [-59.0, -9.5, -46.0, 2.5]

    @staticmethod
    def _hash_file(path: Path) -> str:
        return f"sha256:{hashlib.sha256(path.read_bytes()).hexdigest()}"

    def _script_hash(self) -> str:
        h = hashlib.sha256()
        h.update(SCRIPT_VERSION.encode())
        h.update(self.config.index_type.encode())
        try:
            h.update(Path(__file__).read_bytes())
        except Exception:
            pass
        return f"sha256:{h.hexdigest()}"

    @staticmethod
    def _mock_ipfs_cid(seed: str) -> str:
        return f"bafybei{hashlib.sha256(seed.encode()).hexdigest()[:52]}"
