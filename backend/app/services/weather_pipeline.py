"""
WeatherPipeline — pipeline deterministe pour bets meteo (ERA5-Land).

Etapes :
  1. CDSClient.retrieve_precipitation(...) -> liste de valeurs mm/jour
  2. Aggregation (max|mean|sum|min) sur la serie
  3. Comparaison au seuil selon direction (gte|gt|lte|lt)
  4. Construction du manifest schema_v1 + fingerprint SHA-256

Deterministe : memes inputs -> meme fingerprint.
"""
from __future__ import annotations
from dataclasses import dataclass
from datetime import date
from typing import Literal
import time

from app.core.config import settings
from app.services.canonical import fingerprint_sha256
from app.services.cds_client import CDSClient
from app.services.pipeline_base import BasePipelineResult, build_manifest


Variable = Literal["total_precipitation"]
Aggregation = Literal["max", "mean", "sum", "min"]
Direction = Literal["gte", "gt", "lte", "lt"]

SCRIPT_VERSION = "weather-pipeline-v1.0.0"


@dataclass
class WeatherPipelineConfig:
    bet_slug: str
    period_start: date
    period_end: date
    region_bbox: list[float]             # [minx, miny, maxx, maxy]
    variable: Variable = "total_precipitation"
    aggregation: Aggregation = "max"
    direction: Direction = "gte"
    threshold_value: float = 30.0        # mm pour precipitation
    threshold_unit: str = "mm"


def _aggregate(values: list[float], agg: Aggregation) -> float:
    if not values:
        return 0.0
    if agg == "max":
        return max(values)
    if agg == "min":
        return min(values)
    if agg == "sum":
        return sum(values)
    if agg == "mean":
        return sum(values) / len(values)
    raise ValueError(f"Unknown aggregation: {agg}")


def _evaluate(observed: float, threshold: float, direction: Direction) -> bool:
    if direction == "gte":
        return observed >= threshold
    if direction == "gt":
        return observed > threshold
    if direction == "lte":
        return observed <= threshold
    if direction == "lt":
        return observed < threshold
    raise ValueError(f"Unknown direction: {direction}")


class WeatherPipeline:
    """Pipeline ERA5-Land deterministe. blobs=[] car pas de fichiers binaires."""

    def __init__(self, config: WeatherPipelineConfig):
        self.config = config
        self.cds = CDSClient(
            api_url=settings.CDS_API_URL,
            api_key=settings.CDS_API_KEY,
            use_mock=settings.USE_MOCK_CDS,
        )

    def run(self) -> BasePipelineResult:
        start = time.time()
        cfg = self.config
        try:
            response = self.cds.retrieve_precipitation(
                bet_slug=cfg.bet_slug,
                bbox=cfg.region_bbox,
                date_start=cfg.period_start,
                date_end=cfg.period_end,
            )

            observed = _aggregate(response.values, cfg.aggregation)
            outcome = _evaluate(observed, cfg.threshold_value, cfg.direction)

            fingerprint_inputs = {
                "variable": cfg.variable,
                "aggregation": cfg.aggregation,
                "values": response.values,
                "grid_resolution_deg": response.grid_resolution_deg,
                "source": response.source,
                "request": response.request,
            }

            manifest = build_manifest(
                pipeline_kind="weather",
                bet_slug=cfg.bet_slug,
                period_start=cfg.period_start.isoformat(),
                period_end=cfg.period_end.isoformat(),
                region_bbox=cfg.region_bbox,
                fingerprint_inputs=fingerprint_inputs,
                outcome_yes=outcome,
                observed_value=observed,
                threshold_value=cfg.threshold_value,
                threshold_unit=cfg.threshold_unit,
                direction=cfg.direction,
            )

            return BasePipelineResult(
                success=True,
                outcome_yes=outcome,
                observed_value=observed,
                threshold_value=cfg.threshold_value,
                threshold_unit=cfg.threshold_unit,
                direction=cfg.direction,
                data_normalized=manifest,
                blobs=[],
                params={
                    "bet_slug": cfg.bet_slug,
                    "variable": cfg.variable,
                    "aggregation": cfg.aggregation,
                    "direction": cfg.direction,
                    "period_start": cfg.period_start.isoformat(),
                    "period_end": cfg.period_end.isoformat(),
                    "region_bbox": cfg.region_bbox,
                    "threshold_value": cfg.threshold_value,
                    "threshold_unit": cfg.threshold_unit,
                    "script_version": SCRIPT_VERSION,
                    "n_days": len(response.values),
                    "fingerprint_sha256": fingerprint_sha256(manifest),
                },
                duration_seconds=round(time.time() - start, 3),
            )
        except Exception as e:
            return BasePipelineResult(
                success=False,
                error=str(e),
                params={
                    "bet_slug": cfg.bet_slug,
                    "variable": cfg.variable,
                    "script_version": SCRIPT_VERSION,
                },
                duration_seconds=round(time.time() - start, 3),
            )
