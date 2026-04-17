"""
Auth router — MOCK login (demo).
Pas de vraie authentification ; retourne un token factice.
"""
import secrets
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import UserMock
from app.schemas.auth import LoginRequest, LoginResponse

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
def login_mock(body: LoginRequest, db: Session = Depends(get_db)):
    """
    Mock login. Accepte n'importe quel couple email/password.
    Cree ou retrouve l'utilisateur par email.
    """
    user = db.query(UserMock).filter(UserMock.email == body.email).first()

    if not user:
        user = UserMock(
            email=body.email,
            pseudo=body.email.split("@")[0],
            token=f"mock-{secrets.token_urlsafe(16)}",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    elif not user.token:
        user.token = f"mock-{secrets.token_urlsafe(16)}"
        db.commit()
        db.refresh(user)

    return LoginResponse(token=user.token, email=user.email, pseudo=user.pseudo or "user")


@router.get("/me")
def me(token: str = "", db: Session = Depends(get_db)):
    """Retourne l'utilisateur associe au token (mock)."""
    user = db.query(UserMock).filter(UserMock.token == token).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    return {"email": user.email, "pseudo": user.pseudo}


@router.get("/leaderboard")
def leaderboard(db: Session = Depends(get_db)):
    """Classement des utilisateurs par PnL (total_won - total_lost)."""
    users = db.query(UserMock).all()
    entries = []
    for u in users:
        won = float(u.total_won or 0)
        lost = float(u.total_lost or 0)
        entries.append({
            "pseudo": u.pseudo or u.email.split("@")[0],
            "balance": float(u.balance or 10000),
            "total_won": won,
            "total_lost": lost,
        })
    entries.sort(key=lambda e: e["total_won"] - e["total_lost"], reverse=True)
    return entries
