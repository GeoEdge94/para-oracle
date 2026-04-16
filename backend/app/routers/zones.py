from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Bet
from app.models.deforestation_zone import DeforestationZone
from app.schemas.deforestation_zone import DeforestationZoneRead

router = APIRouter()


@router.get("/by-bet/{slug}", response_model=List[DeforestationZoneRead])
def list_zones_for_bet(slug: str, db: Session = Depends(get_db)):
    bet = db.query(Bet).filter(Bet.slug == slug).first()
    if not bet:
        raise HTTPException(status_code=404, detail="Bet not found")
    zones = (
        db.query(DeforestationZone)
        .filter(DeforestationZone.bet_id == bet.id)
        .order_by(DeforestationZone.detected_at.asc())
        .all()
    )
    return zones
