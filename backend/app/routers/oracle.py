"""
Oracle router — declenche la resolution automatique d'un pari.

POST /oracle/resolve/{bet_slug}
  → execute le pipeline NDVI (mock ou reel)
  → stocke l'analyse + preuves
  → met a jour le bet avec le resultat
  → retourne OracleResult (format smart contract)
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Bet, Analysis
from app.services.ndvi_pipeline import NDVIPipeline, PipelineConfig
from app.schemas.analysis import OracleResult

router = APIRouter()


@router.post("/resolve/{bet_slug}", response_model=OracleResult)
def resolve_bet(bet_slug: str, db: Session = Depends(get_db)):
    """
    Declenche la resolution d'un pari via le pipeline NDVI Sentinel-2.
    Deterministe : memes entrees → meme sortie.
    """
    bet = db.query(Bet).filter(Bet.slug == bet_slug).first()
    if not bet:
        raise HTTPException(status_code=404, detail="Bet not found")

    if bet.status not in ("OPEN", "CLOSED"):
        raise HTTPException(status_code=400, detail=f"Bet already {bet.status}")

    # Run pipeline
    config = PipelineConfig(
        bet_slug=bet.slug,
        period_start=bet.period_start,
        period_end=bet.period_end,
        region_geom_wkt=db.scalar(
            f"SELECT ST_AsText(region_geom) FROM bets WHERE id = '{bet.id}'"
        ),
        ndvi_drop_threshold=float(bet.ndvi_drop_threshold),
        threshold_km2=float(bet.threshold_value),
    )

    pipeline = NDVIPipeline(config)
    result = pipeline.run()  # returns dict with all results + proofs

    # Persist analysis
    analysis = Analysis(
        bet_id=bet.id,
        status="SUCCESS" if result["success"] else "FAILED",
        params=result["params"],
        sentinel_products_t0=result.get("sentinel_products_t0"),
        sentinel_products_t1=result.get("sentinel_products_t1"),
        stac_uris=result.get("stac_uris"),
        surface_deforestee_km2=result.get("surface_deforestee_km2"),
        pixels_deforested=result.get("pixels_deforested"),
        cloud_coverage_mean=result.get("cloud_coverage_mean"),
        script_hash=result.get("script_hash"),
        ndvi_t0_hash=result.get("ndvi_t0_hash"),
        ndvi_t1_hash=result.get("ndvi_t1_hash"),
        delta_hash=result.get("delta_hash"),
        mask_hash=result.get("mask_hash"),
        ipfs_cid=result.get("ipfs_cid"),
        error_message=result.get("error"),
        duration_seconds=result.get("duration_seconds"),
    )
    db.add(analysis)

    # Update bet
    if result["success"]:
        outcome_yes = result["surface_deforestee_km2"] > float(bet.threshold_value)
        bet.status = "RESOLVED_YES" if outcome_yes else "RESOLVED_NO"
        bet.result_bool = outcome_yes
        bet.resolved_value = result["surface_deforestee_km2"]
        bet.resolved_at = datetime.now(timezone.utc)
    else:
        bet.status = "ERROR"

    db.commit()
    db.refresh(analysis)
    db.refresh(bet)

    return OracleResult(
        bet_id=bet.slug,
        resolved_outcome="YES" if bet.result_bool else "NO",
        surface_deforestee_km2=float(bet.resolved_value or 0),
        threshold_km2=float(bet.threshold_value),
        resolution_timestamp=bet.resolved_at or datetime.now(timezone.utc),
        evidence={
            "script_hash": analysis.script_hash,
            "ndvi_t0_hash": analysis.ndvi_t0_hash,
            "ndvi_t1_hash": analysis.ndvi_t1_hash,
            "delta_hash": analysis.delta_hash,
            "mask_hash": analysis.mask_hash,
            "sentinel_products_t0": analysis.sentinel_products_t0,
            "sentinel_products_t1": analysis.sentinel_products_t1,
            "stac_uris": analysis.stac_uris,
            "ipfs_cid": analysis.ipfs_cid,
            "period": {
                "start": bet.period_start.isoformat(),
                "end": bet.period_end.isoformat(),
            },
            "analysis_id": str(analysis.id),
        },
    )
