"""
Pydantic schemas — Analyses
"""
from datetime import datetime
from typing import Optional
from uuid import UUID
from decimal import Decimal
from pydantic import BaseModel


class AnalysisRead(BaseModel):
    id: UUID
    bet_id: UUID
    executed_at: datetime
    status: str
    params: dict
    sentinel_products_t0: Optional[list[str]] = None
    sentinel_products_t1: Optional[list[str]] = None
    stac_uris: Optional[list[str]] = None
    surface_deforestee_km2: Optional[Decimal] = None
    pixels_deforested: Optional[int] = None
    cloud_coverage_mean: Optional[Decimal] = None
    script_hash: Optional[str] = None
    ndvi_t0_hash: Optional[str] = None
    ndvi_t1_hash: Optional[str] = None
    delta_hash: Optional[str] = None
    mask_hash: Optional[str] = None
    ipfs_cid: Optional[str] = None
    error_message: Optional[str] = None
    duration_seconds: Optional[Decimal] = None

    class Config:
        from_attributes = True


class OracleResult(BaseModel):
    """Structure JSON envoyee au smart contract"""
    bet_id: str  # slug
    resolved_outcome: str  # YES | NO
    surface_deforestee_km2: float
    threshold_km2: float
    resolution_timestamp: datetime
    evidence: dict  # hashes, CIDs, sentinel products, period
