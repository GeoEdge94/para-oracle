from typing import List
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Bet, UserMock, UserBet
from app.schemas.user_bet import UserBetRead, BetMarketStats, UserBetSummary

router = APIRouter()


def _to_read(ub: UserBet, pseudo: str | None = None) -> UserBetRead:
    return UserBetRead(
        id=ub.id,
        user_id=ub.user_id,
        bet_id=ub.bet_id,
        position=ub.position,
        amount=ub.amount,
        odds=ub.odds,
        potential_payout=ub.potential_payout,
        status=ub.status,
        placed_at=ub.placed_at,
        settled_at=ub.settled_at,
        user_pseudo=pseudo,
    )


@router.get("/by-bet/{slug}", response_model=List[UserBetRead])
def list_bets_for_market(slug: str, db: Session = Depends(get_db)):
    bet = db.query(Bet).filter(Bet.slug == slug).first()
    if not bet:
        raise HTTPException(status_code=404, detail="Bet not found")
    rows = (
        db.query(UserBet, UserMock.pseudo)
        .join(UserMock, UserBet.user_id == UserMock.id)
        .filter(UserBet.bet_id == bet.id)
        .order_by(UserBet.placed_at.asc())
        .all()
    )
    return [_to_read(ub, pseudo) for ub, pseudo in rows]


@router.get("/by-bet/{slug}/stats", response_model=BetMarketStats)
def market_stats(slug: str, db: Session = Depends(get_db)):
    bet = db.query(Bet).filter(Bet.slug == slug).first()
    if not bet:
        raise HTTPException(status_code=404, detail="Bet not found")
    rows = db.query(UserBet).filter(UserBet.bet_id == bet.id).all()
    yes_rows = [r for r in rows if r.position == "YES"]
    no_rows = [r for r in rows if r.position == "NO"]
    total_volume = sum(r.amount for r in rows) if rows else Decimal(0)
    return BetMarketStats(
        total_volume=total_volume,
        total_bets=len(rows),
        yes_volume=sum(r.amount for r in yes_rows) if yes_rows else Decimal(0),
        no_volume=sum(r.amount for r in no_rows) if no_rows else Decimal(0),
        yes_count=len(yes_rows),
        no_count=len(no_rows),
        yes_pct=round(len(yes_rows) / len(rows) * 100, 1) if rows else 0,
        avg_odds_yes=round(float(sum(r.odds for r in yes_rows) / len(yes_rows)), 3) if yes_rows else None,
        avg_odds_no=round(float(sum(r.odds for r in no_rows) / len(no_rows)), 3) if no_rows else None,
    )


@router.get("/my/{slug}", response_model=UserBetSummary)
def my_bets(slug: str, token: str = Query(""), db: Session = Depends(get_db)):
    user = db.query(UserMock).filter(UserMock.token == token).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    bet = db.query(Bet).filter(Bet.slug == slug).first()
    if not bet:
        raise HTTPException(status_code=404, detail="Bet not found")
    rows = (
        db.query(UserBet)
        .filter(UserBet.bet_id == bet.id, UserBet.user_id == user.id)
        .order_by(UserBet.placed_at.asc())
        .all()
    )
    total_staked = sum(r.amount for r in rows) if rows else Decimal(0)
    potential_payout = sum(r.potential_payout or (r.amount * r.odds) for r in rows) if rows else Decimal(0)
    return UserBetSummary(
        total_staked=total_staked,
        potential_payout=potential_payout,
        positions=[_to_read(r, user.pseudo) for r in rows],
    )
