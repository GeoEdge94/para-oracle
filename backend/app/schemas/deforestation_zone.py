from datetime import date
from typing import Optional
from uuid import UUID
from decimal import Decimal
from pydantic import BaseModel


class DeforestationZoneRead(BaseModel):
    id: UUID
    analysis_id: Optional[UUID] = None
    bet_id: UUID
    zone_name: str
    source: str
    surface_km2: Decimal
    confidence: Decimal
    detected_at: date
    geojson: dict

    class Config:
        from_attributes = True
