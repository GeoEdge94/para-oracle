"""
Layers router — expose la config des couches carto.
Wrappe QGIS Server / GeoJSON / XYZ dans une API uniforme.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Layer
from app.schemas.layer import LayerRead

router = APIRouter()


@router.get("", response_model=List[LayerRead])
def list_layers(db: Session = Depends(get_db)):
    """Liste toutes les couches disponibles, ordonnees par display_order."""
    return db.query(Layer).order_by(Layer.display_order).all()


@router.get("/{slug}", response_model=LayerRead)
def get_layer(slug: str, db: Session = Depends(get_db)):
    """Metadata + style pour une couche."""
    layer = db.query(Layer).filter(Layer.slug == slug).first()
    if not layer:
        raise HTTPException(status_code=404, detail="Layer not found")
    return layer


@router.get("/{slug}/style")
def get_layer_style(slug: str, db: Session = Depends(get_db)):
    """Style MapLibre d'une couche."""
    layer = db.query(Layer).filter(Layer.slug == slug).first()
    if not layer:
        raise HTTPException(status_code=404, detail="Layer not found")
    return layer.style or {}
