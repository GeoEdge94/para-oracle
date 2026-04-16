"""
Bets router — CRUD read-only sur les paris.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from geoalchemy2.shape import to_shape
import json

from app.core.database import get_db
from app.models import Bet
from app.schemas.bet import BetRead, BetSummary

router = APIRouter()


def _bet_to_read(bet: Bet) -> dict:
    """Serialize bet + geom as GeoJSON."""
    shp = to_shape(bet.region_geom) if bet.region_geom is not None else None
    data = {
        "id": str(bet.id),
        "slug": bet.slug,
        "question": bet.question,
        "question_en": bet.question_en,
        "description": bet.description,
        "description_en": bet.description_en,
        "category": bet.category,
        "region_name": bet.region_name,
        "period_start": bet.period_start,
        "period_end": bet.period_end,
        "threshold_value": bet.threshold_value,
        "threshold_unit": bet.threshold_unit,
        "metric": bet.metric,
        "ndvi_drop_threshold": bet.ndvi_drop_threshold,
        "status": bet.status,
        "result_bool": bet.result_bool,
        "resolved_value": bet.resolved_value,
        "resolved_at": bet.resolved_at,
        "created_at": bet.created_at,
        "region_geojson": json.loads(json.dumps(shp.__geo_interface__)) if shp else None,
        "index_type": bet.index_type,
        "change_direction": bet.change_direction,
        "change_threshold": float(bet.change_threshold) if bet.change_threshold else 0.3,
        "ground_truth_source": bet.ground_truth_source,
        "proof_layers": bet.proof_layers or [],
    }
    return data


@router.get("")
def list_bets(db: Session = Depends(get_db), status: str | None = None):
    """Liste les paris avec geometrie, filtrables par status."""
    q = db.query(Bet).order_by(Bet.created_at.desc())
    if status:
        q = q.filter(Bet.status == status)
    return [_bet_to_read(b) for b in q.all()]


@router.get("/{slug}")
def get_bet(slug: str, db: Session = Depends(get_db)):
    """Detail d'un pari par slug, avec geom en GeoJSON."""
    bet = db.query(Bet).filter(Bet.slug == slug).first()
    if not bet:
        raise HTTPException(status_code=404, detail="Bet not found")
    return _bet_to_read(bet)
