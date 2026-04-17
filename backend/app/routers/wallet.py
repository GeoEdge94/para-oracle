"""
Wallet router — simulateur avec 10 000 EUR de solde virtuel.

GET  /wallet/balance       — solde + stats (won/lost)
POST /wallet/place-bet     — placer un pari (deduit du solde, calcule la cote)
POST /wallet/reset         — reset a 10 000 EUR
"""
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import UserMock, Bet, UserBet

router = APIRouter()

INITIAL_BALANCE = Decimal("10000.00")
MIN_BET = Decimal("1.00")


class PlaceBetRequest(BaseModel):
    slug: str
    position: str = Field(pattern="^(YES|NO)$")
    amount: float = Field(gt=0)


def _get_user(token: str, db: Session) -> UserMock:
    user = db.query(UserMock).filter(UserMock.token == token).first()
    if not user:
        raise HTTPException(401, "Invalid token")
    return user


@router.get("/balance")
def get_balance(token: str = Query(...), db: Session = Depends(get_db)):
    user = _get_user(token, db)
    return {
        "balance": float(user.balance),
        "total_won": float(user.total_won),
        "total_lost": float(user.total_lost),
        "pseudo": user.pseudo,
        "email": user.email,
    }


@router.post("/place-bet")
def place_bet(req: PlaceBetRequest, token: str = Query(...), db: Session = Depends(get_db)):
    user = _get_user(token, db)
    amount = Decimal(str(req.amount))

    if amount < MIN_BET:
        raise HTTPException(400, f"Mise minimum {MIN_BET} EUR")
    if amount > user.balance:
        raise HTTPException(400, f"Solde insuffisant ({float(user.balance)} EUR)")

    bet = db.query(Bet).filter(Bet.slug == req.slug).first()
    if not bet:
        raise HTTPException(404, "Bet not found")
    if bet.status != "OPEN":
        raise HTTPException(400, f"Bet is {bet.status}, cannot place")

    # Dynamic odds based on pool ratio
    yes_vol = sum(
        float(ub.amount) for ub in db.query(UserBet).filter(
            UserBet.bet_id == bet.id, UserBet.position == "YES"
        ).all()
    )
    no_vol = sum(
        float(ub.amount) for ub in db.query(UserBet).filter(
            UserBet.bet_id == bet.id, UserBet.position == "NO"
        ).all()
    )
    total = yes_vol + no_vol + float(amount)
    if req.position == "YES":
        pool = yes_vol + float(amount)
    else:
        pool = no_vol + float(amount)
    odds = round(max(total / pool, 1.01), 3) if pool > 0 else 2.0

    user.balance -= amount

    ub = UserBet(
        user_id=user.id,
        bet_id=bet.id,
        position=req.position,
        amount=float(amount),
        odds=odds,
    )
    db.add(ub)
    db.commit()
    db.refresh(ub)

    return {
        "id": str(ub.id),
        "position": ub.position,
        "amount": float(ub.amount),
        "odds": float(ub.odds),
        "potential_payout": float(ub.potential_payout),
        "balance": float(user.balance),
    }


@router.post("/reset")
def reset_balance(token: str = Query(...), db: Session = Depends(get_db)):
    user = _get_user(token, db)
    user.balance = INITIAL_BALANCE
    user.total_won = Decimal("0.00")
    user.total_lost = Decimal("0.00")
    db.commit()
    return {"balance": float(user.balance), "message": "Balance reset to 10,000 EUR"}
