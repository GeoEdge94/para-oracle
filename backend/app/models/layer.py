"""
Layer — couche carto (WMS/WFS/XYZ/GeoJSON).
"""
import uuid
from sqlalchemy import Column, String, Text, Integer, Boolean, DateTime, func
from sqlalchemy.dialects.postgresql import UUID, JSONB

from app.core.database import Base


class Layer(Base):
    __tablename__ = "layers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    type = Column(String(20), nullable=False)  # wms|wfs|xyz|geojson|tilejson
    url = Column(Text)
    local_path = Column(Text)
    style = Column(JSONB)
    display_order = Column(Integer, default=0)
    visible_default = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
