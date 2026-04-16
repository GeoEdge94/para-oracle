from datetime import datetime
from typing import Optional
from uuid import UUID
from decimal import Decimal
from pydantic import BaseModel


class UserBetRead(BaseModel):
    id: UUID
    user_id: UUID
    bet_id: UUID
    position: str
    amount: Decimal
    odds: Decimal
    potential_payout: Optional[Decimal] = None
    status: str
    placed_at: datetime
    settled_at: Optional[datetime] = None
    user_pseudo: Optional[str] = None

    class Config:
        from_attributes = True


class BetMarketStats(BaseModel):
    total_volume: Decimal
    total_bets: int
    yes_volume: Decimal
    no_volume: Decimal
    yes_count: int
    no_count: int
    yes_pct: float
    avg_odds_yes: Optional[float] = None
    avg_odds_no: Optional[float] = None


class UserBetSummary(BaseModel):
    total_staked: Decimal
    potential_payout: Decimal
    positions: list[UserBetRead]
