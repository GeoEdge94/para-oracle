"""
Analysis — execution du pipeline NDVI pour resoudre un bet.
"""
import uuid
from sqlalchemy import Column, String, Text, Numeric, BigInteger, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY
from geoalchemy2 import Geometry

from app.core.database import Base


class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bet_id = Column(UUID(as_uuid=True), ForeignKey("bets.id", ondelete="CASCADE"), nullable=False, index=True)
    executed_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    status = Column(String(20), nullable=False)  # PENDING|RUNNING|SUCCESS|FAILED
    params = Column(JSONB, nullable=False)

    sentinel_products_t0 = Column(ARRAY(String))
    sentinel_products_t1 = Column(ARRAY(String))
    stac_uris = Column(ARRAY(String))

    surface_deforestee_km2 = Column(Numeric)
    pixels_deforested = Column(BigInteger)
    cloud_coverage_mean = Column(Numeric)

    # Proofs (legacy M0)
    script_hash = Column(String(128))
    ndvi_t0_hash = Column(String(128))
    ndvi_t1_hash = Column(String(128))
    delta_hash = Column(String(128))
    mask_hash = Column(String(128))
    ipfs_cid = Column(String(100))  # alias de data_cid, conserve pour compat frontend

    # Proofs Web3 (M2+)
    data_cid = Column(String(100))
    script_cid = Column(String(100))
    schema_cid = Column(String(100))
    tls_proof_cid = Column(String(100))
    fingerprint_sha256 = Column(String(80))

    # On-chain (M3+)
    chain_tx_hash = Column(String(80))
    bond_amount_usdc = Column(Numeric(18, 6))
    dispute_window_end = Column(DateTime(timezone=True))
    dispute_status = Column(String(20), default="NONE")  # NONE|PENDING|DISPUTED|FINALIZED

    error_message = Column(Text)
    duration_seconds = Column(Numeric)


class RasterSnapshot(Base):
    __tablename__ = "raster_snapshots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    analysis_id = Column(UUID(as_uuid=True), ForeignKey("analyses.id", ondelete="CASCADE"), nullable=False, index=True)
    kind = Column(String(30), nullable=False)  # ndvi_t0|ndvi_t1|delta|mask
    file_path = Column(Text, nullable=False)
    file_hash = Column(String(128), nullable=False)
    bbox_geom = Column(Geometry("POLYGON", srid=4326))
    nodata_value = Column(Numeric)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
