"""
Oracle router — resolution automatique des paris via pipeline spectral multi-indice.

POST /oracle/resolve/{bet_slug}
  → execute SpectralPipeline (NDVI/NBR/NDWI/BSI/NDSI/NDBI/EVI)
  → stocke l'analyse + preuves SHA-256
  → regle les user_bets (WON/LOST)
  → retourne OracleResult (format smart contract)
"""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models import Bet, Analysis, UserBet, UserMock
from app.services.copernicus_client import CopernicusClient
from app.services.spectral_pipeline import SpectralPipeline, PipelineConfig
from app.schemas.analysis import OracleResult

router = APIRouter()


@router.get("/status")
def oracle_status():
    client = CopernicusClient(
        client_id=settings.COPERNICUS_CLIENT_ID,
        client_secret=settings.COPERNICUS_CLIENT_SECRET,
        use_mock=settings.USE_MOCK_SENTINEL,
    )
    ok, message = client.is_authenticated()
    return {
        "mode": "mock" if client.use_mock else "live",
        "copernicus_authenticated": ok,
        "copernicus_message": message,
        "stac_url": CopernicusClient.STAC_URL,
        "data_dir": settings.DATA_DIR,
    }


@router.post("/resolve/{bet_slug}", response_model=OracleResult)
def resolve_bet(bet_slug: str, db: Session = Depends(get_db)):
    bet = db.query(Bet).filter(Bet.slug == bet_slug).first()
    if not bet:
        raise HTTPException(status_code=404, detail="Bet not found")
    if bet.status not in ("OPEN", "CLOSED"):
        raise HTTPException(status_code=400, detail=f"Bet already {bet.status}")

    region_wkt = db.scalar(
        text("SELECT ST_AsText(region_geom) FROM bets WHERE id = :bid"),
        {"bid": bet.id},
    )

    config = PipelineConfig(
        bet_slug=bet.slug,
        period_start=bet.period_start,
        period_end=bet.period_end,
        region_geom_wkt=region_wkt,
        index_type=bet.index_type or "NDVI",
        change_direction=bet.change_direction or "decrease",
        change_threshold=float(bet.change_threshold) if bet.change_threshold else 0.3,
        threshold_value=float(bet.threshold_value),
        threshold_unit=bet.threshold_unit or "km2",
        ground_truth_source=bet.ground_truth_source or "PRODES",
        proof_layers=bet.proof_layers or [],
        max_cloud_cover=20.0,
    )

    r = SpectralPipeline(config).run()

    analysis = Analysis(
        bet_id=bet.id,
        status="SUCCESS" if r.success else "FAILED",
        params=r.params,
        sentinel_products_t0=r.sentinel_products_t0 or None,
        sentinel_products_t1=r.sentinel_products_t1 or None,
        stac_uris=r.stac_uris or None,
        surface_deforestee_km2=r.surface_value,
        pixels_deforested=r.pixels_affected,
        cloud_coverage_mean=r.cloud_coverage_mean,
        script_hash=r.script_hash,
        ndvi_t0_hash=r.index_t0_hash,
        ndvi_t1_hash=r.index_t1_hash,
        delta_hash=r.delta_hash,
        mask_hash=r.mask_hash,
        ipfs_cid=r.ipfs_cid,
        error_message=r.error or None,
        duration_seconds=r.duration_seconds,
    )
    db.add(analysis)

    now = datetime.now(timezone.utc)
    if r.success:
        bet.status = "RESOLVED_YES" if r.outcome_yes else "RESOLVED_NO"
        bet.result_bool = r.outcome_yes
        bet.resolved_value = r.surface_value
        bet.resolved_at = now

        winning = "YES" if r.outcome_yes else "NO"
        db.execute(
            text("""
                UPDATE user_bets
                SET status = CASE WHEN position = :winning THEN 'WON' ELSE 'LOST' END,
                    settled_at = :now
                WHERE bet_id = :bet_id AND status = 'PENDING'
            """),
            {"winning": winning, "now": now, "bet_id": bet.id},
        )
        db.flush()

        for ub in db.query(UserBet).filter(UserBet.bet_id == bet.id, UserBet.status == "WON").all():
            user = db.query(UserMock).get(ub.user_id)
            if user:
                user.balance += ub.potential_payout
                user.total_won += ub.potential_payout
        for ub in db.query(UserBet).filter(UserBet.bet_id == bet.id, UserBet.status == "LOST").all():
            user = db.query(UserMock).get(ub.user_id)
            if user:
                user.total_lost += ub.amount
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
        resolution_timestamp=bet.resolved_at or now,
        evidence={
            "script_hash": analysis.script_hash,
            "ndvi_t0_hash": analysis.ndvi_t0_hash,
            "ndvi_t1_hash": analysis.ndvi_t1_hash,
            "delta_hash": analysis.delta_hash,
            "mask_hash": analysis.mask_hash,
            "sentinel_products_t0": analysis.sentinel_products_t0 or [],
            "sentinel_products_t1": analysis.sentinel_products_t1 or [],
            "stac_uris": analysis.stac_uris or [],
            "ipfs_cid": analysis.ipfs_cid or "",
            "period": {
                "start": bet.period_start.isoformat(),
                "end": bet.period_end.isoformat(),
            },
            "analysis_id": str(analysis.id),
            "index_type": config.index_type,
            "change_direction": config.change_direction,
            "bands": r.params.get("bands", []),
        },
    )
