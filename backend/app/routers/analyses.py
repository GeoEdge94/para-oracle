"""
Analyses router — historique des runs du pipeline.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Analysis, Bet
from app.schemas.analysis import AnalysisRead

router = APIRouter()


@router.get("", response_model=List[AnalysisRead])
def list_analyses(db: Session = Depends(get_db), bet_slug: str | None = None):
    """Historique des analyses, filtrable par bet_slug."""
    q = db.query(Analysis).order_by(Analysis.executed_at.desc())
    if bet_slug:
        bet = db.query(Bet).filter(Bet.slug == bet_slug).first()
        if not bet:
            raise HTTPException(status_code=404, detail="Bet not found")
        q = q.filter(Analysis.bet_id == bet.id)
    return q.limit(50).all()


@router.get("/{analysis_id}", response_model=AnalysisRead)
def get_analysis(analysis_id: str, db: Session = Depends(get_db)):
    """Detail d'une analyse — preuves completes."""
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return analysis
