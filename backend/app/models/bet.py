"""
Bet — Question de marche (ex: Para deforestation 2025 S1).
"""
import uuid
from sqlalchemy import Column, String, Text, Date, Numeric, Boolean, DateTime, ARRAY, func
from sqlalchemy.dialects.postgresql import UUID
from geoalchemy2 import Geometry

from app.core.database import Base


class Bet(Base):
    __tablename__ = "bets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug = Column(String(150), unique=True, nullable=False, index=True)
    question = Column(Text, nullable=False)
    question_en = Column(Text)
    description = Column(Text)
    description_en = Column(Text)
    category = Column(String(50), nullable=False)
    region_name = Column(String(100), nullable=False)
    region_geom = Column(Geometry("MULTIPOLYGON", srid=4326), nullable=False)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    threshold_value = Column(Numeric, nullable=False)
    threshold_unit = Column(String(20), nullable=False)
    metric = Column(String(50), nullable=False)
    ndvi_drop_threshold = Column(Numeric, nullable=False, default=0.3)
    index_type = Column(String(50), nullable=False, default="NDVI")
    change_direction = Column(String(20), nullable=False, default="decrease")
    change_threshold = Column(Numeric, nullable=False, default=0.3)
    ground_truth_source = Column(String(50), nullable=False, default="PRODES")
    proof_layers = Column(ARRAY(String), nullable=False, default=[])
    status = Column(String(20), nullable=False, default="OPEN")
    result_bool = Column(Boolean)
    resolved_value = Column(Numeric)
    resolved_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
