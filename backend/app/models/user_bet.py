import uuid
from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey, Computed, func
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class UserBet(Base):
    __tablename__ = "user_bets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users_mock.id"), nullable=False)
    bet_id = Column(UUID(as_uuid=True), ForeignKey("bets.id"), nullable=False)
    position = Column(String(3), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    odds = Column(Numeric(5, 3), nullable=False)
    potential_payout = Column(Numeric(10, 2), Computed("amount * odds"))
    status = Column(String(10), nullable=False, default="PENDING")
    placed_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    settled_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
