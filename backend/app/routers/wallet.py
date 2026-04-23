"""
Wallet router — backed by real tUSDC balance on Polygon Amoy when
USE_MOCK_CHAIN=false, falls back to DB simulator when true.

Balance semantics:
  - /wallet/balance reads balanceOf(ORACLE_ADDRESS) on the MockERC20 tUSDC
    contract. Scaled to 6 decimals -> returned as float.
  - /wallet/place-bet executes a real on-chain transfer of `amount` tUSDC
    from the oracle wallet to the treasury (deployer wallet). The tx hash
    is returned and persisted on the UserBet row so the audit trail survives.
  - /wallet/reset mints fresh tUSDC to the oracle wallet (MockERC20's mint
    is public so anyone can restore their own balance — acceptable for a
    testnet demo, would be gated with a role on mainnet).

When USE_MOCK_CHAIN=true, the old DB simulator path is used verbatim. This
keeps dev loops fast and preserves deterministic tests.
"""
from __future__ import annotations
import logging
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.models import UserMock, Bet, UserBet

log = logging.getLogger(__name__)
router = APIRouter()

INITIAL_BALANCE = Decimal("10000.00")
MIN_BET = Decimal("1.00")

# ─── Treasury: receives placement transfers. Deployer wallet = Yanis multisig
#     in prod, hardcoded here for the Amoy demo. Safe because it's tUSDC. ──
_TREASURY_ADDRESS = "0x7345C1f74A12E00F18AcE5b624612131D5878828"

# Minimal ERC20 ABI used by this module (mint + balanceOf + transfer).
_ERC20_ABI = [
    {"name": "balanceOf", "type": "function", "stateMutability": "view",
     "inputs": [{"name": "", "type": "address"}], "outputs": [{"name": "", "type": "uint256"}]},
    {"name": "transfer", "type": "function", "stateMutability": "nonpayable",
     "inputs": [{"name": "to", "type": "address"}, {"name": "amount", "type": "uint256"}],
     "outputs": [{"name": "", "type": "bool"}]},
    {"name": "mint", "type": "function", "stateMutability": "nonpayable",
     "inputs": [{"name": "to", "type": "address"}, {"name": "amount", "type": "uint256"}],
     "outputs": []},
]


def _get_user(token: str, db: Session) -> UserMock:
    user = db.query(UserMock).filter(UserMock.token == token).first()
    if not user:
        raise HTTPException(401, "Invalid token")
    return user


# ─── Web3 helpers (lazy, cached) ───────────────────────────────────────────
_W3 = None
_ACCOUNT = None
_USDC = None


def _web3():
    """Return (w3, account, usdc_contract) tuple. Cached across calls."""
    global _W3, _ACCOUNT, _USDC
    if _W3 is not None:
        return _W3, _ACCOUNT, _USDC

    from web3 import Web3
    from web3.middleware import ExtraDataToPOAMiddleware
    from eth_account import Account

    w3 = Web3(Web3.HTTPProvider(settings.CHAIN_RPC_URL))
    w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)

    pk = settings.ORACLE_PRIVATE_KEY
    if not pk:
        raise HTTPException(500, "ORACLE_PRIVATE_KEY not configured")
    if not pk.startswith("0x"):
        pk = "0x" + pk
    acct = Account.from_key(pk)

    if not settings.USDC_ADDRESS:
        raise HTTPException(500, "USDC_ADDRESS not configured")
    usdc = w3.eth.contract(
        address=Web3.to_checksum_address(settings.USDC_ADDRESS),
        abi=_ERC20_ABI,
    )

    _W3, _ACCOUNT, _USDC = w3, acct, usdc
    return w3, acct, usdc


def _chain_balance_usdc() -> float:
    """Live tUSDC balance of the oracle wallet. Returns float (6 decimals)."""
    _, acct, usdc = _web3()
    raw = usdc.functions.balanceOf(acct.address).call()
    return raw / 1_000_000.0


def _send_transfer(to_addr: str, amount_usdc: float) -> tuple[str, int]:
    """Sign + broadcast an ERC20.transfer. Returns (tx_hash_hex, block_number).
    Scales amount * 10**6 for USDC decimals."""
    from web3 import Web3

    w3, acct, usdc = _web3()
    amount_raw = int(round(amount_usdc * 1_000_000))

    nonce = w3.eth.get_transaction_count(acct.address)
    tx = usdc.functions.transfer(Web3.to_checksum_address(to_addr), amount_raw).build_transaction({
        "from": acct.address,
        "nonce": nonce,
        "chainId": settings.CHAIN_ID,
    })
    signed = acct.sign_transaction(tx)
    raw = getattr(signed, "raw_transaction", None) or signed.rawTransaction
    tx_hash = w3.eth.send_raw_transaction(raw)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    if receipt.status != 1:
        raise HTTPException(500, f"Transfer reverted: {tx_hash.hex()}")
    return tx_hash.hex(), receipt.blockNumber


# ─── Routes ────────────────────────────────────────────────────────────────


class PlaceBetRequest(BaseModel):
    slug: str
    position: str = Field(pattern="^(YES|NO)$")
    amount: float = Field(gt=0)


@router.get("/balance")
def get_balance(token: str = Query(...), db: Session = Depends(get_db)):
    """
    Real on-chain balance when USE_MOCK_CHAIN=false, else DB simulator.
    Response is uniform so the frontend doesn't need to branch.
    """
    user = _get_user(token, db)

    if settings.USE_MOCK_CHAIN:
        return {
            "balance": float(user.balance),
            "total_won": float(user.total_won),
            "total_lost": float(user.total_lost),
            "pseudo": user.pseudo,
            "email": user.email,
            "currency": "EUR",
            "mode": "simulator",
        }

    try:
        live_balance = _chain_balance_usdc()
    except Exception as e:
        log.exception("web3 balance read failed, falling back to DB")
        return {
            "balance": float(user.balance),
            "total_won": float(user.total_won),
            "total_lost": float(user.total_lost),
            "pseudo": user.pseudo,
            "email": user.email,
            "currency": "EUR",
            "mode": "simulator_fallback",
            "error": str(e),
        }

    return {
        "balance": live_balance,
        "total_won": float(user.total_won),
        "total_lost": float(user.total_lost),
        "pseudo": user.pseudo,
        "email": user.email,
        "currency": "tUSDC",
        "mode": "onchain",
        "wallet_address": _ACCOUNT.address if _ACCOUNT else None,
        "chain_id": settings.CHAIN_ID,
        "token_contract": settings.USDC_ADDRESS,
        "treasury_address": _TREASURY_ADDRESS,
    }


@router.post("/place-bet")
def place_bet(req: PlaceBetRequest, token: str = Query(...), db: Session = Depends(get_db)):
    """
    When on-chain: transfers `amount` tUSDC from the oracle wallet to the
    treasury, then persists the UserBet row with the resulting tx hash so
    the audit trail survives. When mock: classic DB-only simulator.
    """
    user = _get_user(token, db)
    amount = Decimal(str(req.amount))

    if amount < MIN_BET:
        raise HTTPException(400, f"Minimum stake {MIN_BET}")

    bet = db.query(Bet).filter(Bet.slug == req.slug).first()
    if not bet:
        raise HTTPException(404, "Bet not found")
    if bet.status != "OPEN":
        raise HTTPException(400, f"Bet is {bet.status}, cannot place")

    # Dynamic odds based on pool ratio (unchanged from simulator logic).
    yes_vol = sum(float(ub.amount) for ub in db.query(UserBet).filter(
        UserBet.bet_id == bet.id, UserBet.position == "YES").all())
    no_vol = sum(float(ub.amount) for ub in db.query(UserBet).filter(
        UserBet.bet_id == bet.id, UserBet.position == "NO").all())
    total = yes_vol + no_vol + float(amount)
    pool = (yes_vol if req.position == "YES" else no_vol) + float(amount)
    odds = round(max(total / pool, 1.01), 3) if pool > 0 else 2.0

    tx_hash: str | None = None

    if settings.USE_MOCK_CHAIN:
        if amount > user.balance:
            raise HTTPException(400, f"Insufficient balance ({float(user.balance)})")
        user.balance -= amount
    else:
        try:
            live_balance = _chain_balance_usdc()
        except Exception as e:
            raise HTTPException(503, f"Chain unreachable: {e}")
        if float(amount) > live_balance:
            raise HTTPException(400, f"Insufficient tUSDC on-chain ({live_balance:.2f} tUSDC available)")
        try:
            tx_hash, _ = _send_transfer(_TREASURY_ADDRESS, float(amount))
        except Exception as e:
            raise HTTPException(502, f"Transfer failed: {e}")

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
        "balance": _chain_balance_usdc() if not settings.USE_MOCK_CHAIN else float(user.balance),
        "currency": "tUSDC" if not settings.USE_MOCK_CHAIN else "EUR",
        "chain_tx_hash": tx_hash,
        "explorer_url": f"https://amoy.polygonscan.com/tx/{tx_hash}" if tx_hash else None,
    }


@router.post("/reset")
def reset_balance(token: str = Query(...), db: Session = Depends(get_db)):
    """
    Mock mode: classic DB reset to 10 000 EUR.
    On-chain mode: MockERC20.mint(oracle, 1000e6) — restores 1000 tUSDC
    test tokens (MockERC20 has public mint, which is fine on testnet).
    """
    user = _get_user(token, db)

    if settings.USE_MOCK_CHAIN:
        user.balance = INITIAL_BALANCE
        user.total_won = Decimal("0.00")
        user.total_lost = Decimal("0.00")
        db.commit()
        return {"balance": float(user.balance), "currency": "EUR", "message": "Balance reset to 10,000 EUR"}

    from web3 import Web3
    try:
        w3, acct, usdc = _web3()
        amount_raw = 1_000 * 1_000_000  # 1000 tUSDC
        nonce = w3.eth.get_transaction_count(acct.address)
        tx = usdc.functions.mint(acct.address, amount_raw).build_transaction({
            "from": acct.address,
            "nonce": nonce,
            "chainId": settings.CHAIN_ID,
        })
        signed = acct.sign_transaction(tx)
        raw = getattr(signed, "raw_transaction", None) or signed.rawTransaction
        tx_hash = w3.eth.send_raw_transaction(raw)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        if receipt.status != 1:
            raise HTTPException(500, f"Mint reverted: {tx_hash.hex()}")
        live = _chain_balance_usdc()
        return {
            "balance": live,
            "currency": "tUSDC",
            "chain_tx_hash": tx_hash.hex(),
            "explorer_url": f"https://amoy.polygonscan.com/tx/{tx_hash.hex()}",
            "message": f"Minted 1000 tUSDC, new balance {live:.2f}",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(502, f"Reset failed: {e}")
