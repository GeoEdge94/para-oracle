"""
Oracle router — resolution automatique des paris via pipeline adapte.

POST /oracle/resolve/{bet_slug}
  → execute SpectralPipeline (NDVI/NBR/NDWI/BSI/NDSI/NDBI/EVI) ou WeatherPipeline
    (total_precipitation ERA5-Land) selon bet.pipeline_kind
  → stocke l'analyse + preuves SHA-256 + fingerprint canonique
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
from app.services.canonical import fingerprint_sha256
from app.services.copernicus_client import CopernicusClient
from app.services.spectral_pipeline import SpectralPipeline, PipelineConfig
from app.services.weather_pipeline import WeatherPipeline, WeatherPipelineConfig
from app.services.web3_publisher import publish_resolution, PublishBundle
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


@router.get("/pending")
def list_pending_resolutions(limit: int = 50, db: Session = Depends(get_db)):
    """
    Feed public pour le challenge bot. Liste les resolutions recentes avec tous
    les pointeurs necessaires a la re-verification (CIDs, fingerprint attendu,
    tx_hash, fenetre de dispute).

    En M4bis le bot consommera les events on-chain directement ; pour l'instant
    il lit cet endpoint comme substitut aux logs Ethereum.
    """
    rows = db.execute(
        text("""
            SELECT a.id, b.slug, a.fingerprint_sha256, a.data_cid, a.script_cid,
                   a.schema_cid, a.tls_proof_cid, a.chain_tx_hash, a.bond_amount_usdc,
                   a.dispute_window_end, a.dispute_status, a.executed_at,
                   b.threshold_value, b.threshold_unit,
                   b.result_bool, b.resolved_value, b.pipeline_kind
              FROM analyses a
              JOIN bets b ON b.id = a.bet_id
             WHERE a.status = 'SUCCESS' AND a.data_cid IS NOT NULL
             ORDER BY a.executed_at DESC
             LIMIT :limit
        """),
        {"limit": limit},
    ).mappings().all()

    return {
        "count": len(rows),
        "gateway_base": settings.IPFS_GATEWAY_URL,
        "chain_id": settings.CHAIN_ID,
        "items": [
            {
                "analysis_id": str(r["id"]),
                "bet_slug": r["slug"],
                "pipeline_kind": r["pipeline_kind"],
                "fingerprint_sha256": r["fingerprint_sha256"],
                "data_cid": r["data_cid"],
                "script_cid": r["script_cid"],
                "schema_cid": r["schema_cid"],
                "tls_proof_cid": r["tls_proof_cid"],
                "chain_tx_hash": r["chain_tx_hash"],
                "bond_amount_usdc": float(r["bond_amount_usdc"]) if r["bond_amount_usdc"] is not None else None,
                "dispute_window_end": r["dispute_window_end"].isoformat() if r["dispute_window_end"] else None,
                "dispute_status": r["dispute_status"],
                "executed_at": r["executed_at"].isoformat() if r["executed_at"] else None,
                # L'oracle claim on-chain (le bot comparera a sa propre reverif)
                "outcome_claimed": bool(r["result_bool"]) if r["result_bool"] is not None else None,
                "observed_claimed": float(r["resolved_value"]) if r["resolved_value"] is not None else None,
                "threshold_value": float(r["threshold_value"]),
                "threshold_unit": r["threshold_unit"],
            }
            for r in rows
        ],
    }


def _wkt_to_bbox(wkt: str) -> list[float]:
    """Convertit un WKT MultiPolygon en bbox [minx, miny, maxx, maxy] EPSG:4326."""
    try:
        from shapely import wkt as shp_wkt
        return list(shp_wkt.loads(wkt).bounds)
    except Exception:
        return [-59.0, -9.5, -46.0, 2.5]


def _direction_from_change(change_direction: str) -> str:
    """Map spectral change_direction vers direction schema_v1."""
    return "lte" if change_direction == "decrease" else "gte"


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

    pipeline_kind = (bet.pipeline_kind or "spectral").lower()

    if pipeline_kind == "weather":
        bbox = _wkt_to_bbox(region_wkt)
        weather_cfg = WeatherPipelineConfig(
            bet_slug=bet.slug,
            period_start=bet.period_start,
            period_end=bet.period_end,
            region_bbox=bbox,
            variable=bet.index_type or "total_precipitation",
            aggregation="max",
            direction=_direction_from_change(bet.change_direction or "increase"),
            threshold_value=float(bet.threshold_value),
            threshold_unit=bet.threshold_unit or "mm",
        )
        r = WeatherPipeline(weather_cfg).run()
    else:
        spectral_cfg = PipelineConfig(
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
        r = SpectralPipeline(spectral_cfg).run()

    # Chainage Web3 (M2/M3) : pin blobs + data/script/schema + submit on-chain.
    # Le publisher mute r.blobs[].cid et r.data_normalized si spectral.
    period_end_dt = datetime(
        bet.period_end.year, bet.period_end.month, bet.period_end.day,
        tzinfo=timezone.utc,
    )
    bundle: PublishBundle | None = (
        publish_resolution(r, bet_slug=bet.slug, period_end=period_end_dt)
        if r.success else None
    )

    # Fingerprint final : celui du manifest POST-injection CIDs (bundle) ou
    # celui du pipeline si Web3 publishing desactive.
    if bundle is not None:
        fingerprint = bundle.fingerprint_sha256
    else:
        fingerprint = r.params.get("fingerprint_sha256") if r.success else None
        if not fingerprint and r.success:
            fingerprint = fingerprint_sha256(r.data_normalized)

    # Champs communs a toutes les analyses
    analysis_kwargs = dict(
        bet_id=bet.id,
        status="SUCCESS" if r.success else "FAILED",
        params=r.params,
        error_message=r.error or None,
        duration_seconds=r.duration_seconds,
        fingerprint_sha256=fingerprint,
    )
    if bundle is not None:
        analysis_kwargs.update(
            data_cid=bundle.data_cid,
            script_cid=bundle.script_cid,
            schema_cid=bundle.schema_cid,
            tls_proof_cid=bundle.tls_proof_cid,
            # ipfs_cid (legacy) pointe desormais sur data_cid
            ipfs_cid=bundle.data_cid,
        )
        if bundle.chain_tx is not None:
            analysis_kwargs.update(
                chain_tx_hash=bundle.chain_tx.tx_hash,
                bond_amount_usdc=bundle.chain_tx.bond_amount_usdc,
                dispute_window_end=bundle.chain_tx.dispute_window_end,
                dispute_status="PENDING",
            )
    # Champs specifiques spectral (double write pour backward compat)
    if pipeline_kind == "spectral" and r.success:
        analysis_kwargs.update(
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
        )
        # Si pas de bundle (USE_WEB3_PUBLISHING=false), conserver le mock ipfs_cid
        if bundle is None:
            analysis_kwargs["ipfs_cid"] = r.ipfs_cid
    elif pipeline_kind == "weather" and r.success:
        # Pour weather, on stocke observed_value dans surface_deforestee_km2 (reuse colonne).
        analysis_kwargs.update(
            surface_deforestee_km2=r.observed_value,
        )

    analysis = Analysis(**analysis_kwargs)
    db.add(analysis)

    now = datetime.now(timezone.utc)
    if r.success:
        bet.status = "RESOLVED_YES" if r.outcome_yes else "RESOLVED_NO"
        bet.result_bool = r.outcome_yes
        bet.resolved_value = r.observed_value if pipeline_kind == "weather" else r.surface_value
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

    chain_tx = bundle.chain_tx if bundle else None
    evidence: dict = {
        "pipeline_kind": pipeline_kind,
        "fingerprint_sha256": fingerprint or "",
        "schema_version": "v1",
        "ipfs_cid": analysis.ipfs_cid or "",
        "data_cid": analysis.data_cid or "",
        "script_cid": analysis.script_cid or "",
        "schema_cid": analysis.schema_cid or "",
        "tls_proof_cid": analysis.tls_proof_cid or "",
        "gateway_base": bundle.gateway_base if bundle else "",
        "period": {
            "start": bet.period_start.isoformat(),
            "end": bet.period_end.isoformat(),
        },
        "analysis_id": str(analysis.id),
        "observed_value": float(r.observed_value or 0) if r.success else 0.0,
        "threshold_value": float(bet.threshold_value),
        "threshold_unit": bet.threshold_unit or "",
        "direction": getattr(r, "direction", "gt"),
        # On-chain (M3)
        "chain_tx_hash": chain_tx.tx_hash if chain_tx else "",
        "chain_id": chain_tx.chain_id if chain_tx else 0,
        "contract_address": chain_tx.contract_address if chain_tx else "",
        "resolution_id": chain_tx.resolution_id if chain_tx else "",
        "bond_amount_usdc": chain_tx.bond_amount_usdc if chain_tx else 0.0,
        "dispute_window_end": chain_tx.dispute_window_end.isoformat() if chain_tx else "",
        "dispute_status": analysis.dispute_status or "NONE",
        "chain_mock": bool(chain_tx.mock) if chain_tx else False,
    }
    if pipeline_kind == "spectral" and r.success:
        evidence.update({
            "script_hash": analysis.script_hash,
            "ndvi_t0_hash": analysis.ndvi_t0_hash,
            "ndvi_t1_hash": analysis.ndvi_t1_hash,
            "delta_hash": analysis.delta_hash,
            "mask_hash": analysis.mask_hash,
            "sentinel_products_t0": analysis.sentinel_products_t0 or [],
            "sentinel_products_t1": analysis.sentinel_products_t1 or [],
            "stac_uris": analysis.stac_uris or [],
            "index_type": bet.index_type,
            "change_direction": bet.change_direction,
            "bands": r.params.get("bands", []),
        })
    elif pipeline_kind == "weather" and r.success:
        evidence.update({
            "variable": bet.index_type,
            "aggregation": r.params.get("aggregation", "max"),
            "n_days": r.params.get("n_days", 0),
            "source": r.data_normalized.get("fingerprint_inputs", {}).get("source", ""),
        })

    return OracleResult(
        bet_id=bet.slug,
        resolved_outcome="YES" if bet.result_bool else "NO",
        surface_deforestee_km2=float(bet.resolved_value or 0),
        threshold_km2=float(bet.threshold_value),
        resolution_timestamp=bet.resolved_at or now,
        evidence=evidence,
    )
