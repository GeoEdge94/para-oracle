import uuid
from sqlalchemy import Column, String, Numeric, Date, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.core.database import Base


class DeforestationZone(Base):
    __tablename__ = "deforestation_zones"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    analysis_id = Column(UUID(as_uuid=True), ForeignKey("analyses.id"), nullable=True)
    bet_id = Column(UUID(as_uuid=True), ForeignKey("bets.id"), nullable=False)
    zone_name = Column(String(100), nullable=False)
    source = Column(String(20), nullable=False)
    surface_km2 = Column(Numeric, nullable=False)
    confidence = Column(Numeric, nullable=False)
    detected_at = Column(Date, nullable=False)
    geojson = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
