"""
UserMock — users mockes (pas de vraie auth).
"""
import uuid
from sqlalchemy import Column, String, Numeric, DateTime, func
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class UserMock(Base):
    __tablename__ = "users_mock"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False)
    pseudo = Column(String(100))
    token = Column(String(255))
    balance = Column(Numeric(12, 2), nullable=False, default=10000.00)
    total_won = Column(Numeric(12, 2), nullable=False, default=0.00)
    total_lost = Column(Numeric(12, 2), nullable=False, default=0.00)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
