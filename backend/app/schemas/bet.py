"""
Pydantic schemas — Bets
"""
from datetime import date, datetime
from typing import Optional
from uuid import UUID
from decimal import Decimal
from pydantic import BaseModel, Field


class BetBase(BaseModel):
    slug: str
    question: str
    description: Optional[str] = None
    category: str
    region_name: str
    period_start: date
    period_end: date
    threshold_value: Decimal
    threshold_unit: str
    metric: str
    ndvi_drop_threshold: Decimal = Field(default=Decimal("0.3"))


class BetRead(BetBase):
    id: UUID
    status: str
    result_bool: Optional[bool] = None
    resolved_value: Optional[Decimal] = None
    resolved_at: Optional[datetime] = None
    region_geojson: Optional[dict] = None
    created_at: datetime

    class Config:
        from_attributes = True


class BetSummary(BaseModel):
    """Light version for list views"""
    id: UUID
    slug: str
    question: str
    category: str
    status: str
    period_start: date
    period_end: date
    threshold_value: Decimal
    threshold_unit: str
    result_bool: Optional[bool] = None
    resolved_value: Optional[Decimal] = None

    class Config:
        from_attributes = True
