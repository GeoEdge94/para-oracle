"""
Pydantic schemas — Layers
"""
from typing import Optional
from uuid import UUID
from pydantic import BaseModel


class LayerRead(BaseModel):
    id: UUID
    slug: str
    name: str
    description: Optional[str] = None
    type: str
    url: Optional[str] = None
    local_path: Optional[str] = None
    style: Optional[dict] = None
    display_order: int = 0
    visible_default: bool = True

    class Config:
        from_attributes = True
