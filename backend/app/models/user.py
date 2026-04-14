"""
UserMock — users mockes (pas de vraie auth).
"""
import uuid
from sqlalchemy import Column, String, DateTime, func
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class UserMock(Base):
    __tablename__ = "users_mock"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False)
    pseudo = Column(String(100))
    token = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
