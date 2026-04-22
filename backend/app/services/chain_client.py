"""
ChainClient — interface pour soumettre des resolutions au smart contract ParaOracle.

Deux backends :
  - mock : genere un tx_hash deterministe a partir du fingerprint + bet_slug.
           Aucun appel reseau. Utile pour E2E sans testnet.
  - real : (stub NotImplementedError en M3) utilisera web3.py + eth-account pour
           signer et broadcaster submitResolution() sur Polygon Amoy.

Le chain_id Amoy testnet est 80002. Le contrat ParaOracle attend :
  submitResolution(bytes32 fingerprint, string dataCID, string scriptCID,
                   bytes32 betSlugHash, uint256 threshold, uint256 observed,
                   bool outcome, uint64 periodEnd) -> bytes32 resolutionId

Note MVP : le mock ne "parle" pas au vrai contrat mais il doit mimer sa semantique :
tx_hash unique par (bet_slug, period_end), dispute_window_end = now + 48h,
resolution_id = keccak256(bet_slug_hash || period_end).
"""
from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional
import hashlib

from app.core.config import settings


def _keccak256(data: bytes) -> bytes:
    """Hash keccak256 (identique a bytes32 Solidity). Fallback SHA3-256 pour mock.

    MVP : on utilise SHA3-256 standard (proche mais pas identique a keccak-256
    Ethereum). OK pour le mock deterministe ; en prod, utiliser `eth_utils.keccak`.
    """
    return hashlib.sha3_256(data).digest()


@dataclass
class SubmitTxResult:
    """Resultat d'un submit on-chain. Persiste dans analyses."""
    tx_hash: str                 # "0x" + 64 hex chars
    resolution_id: str           # "0x" + 64 hex chars (keccak256(bet_slug_hash || period_end))
    chain_id: int
    contract_address: str
    bond_amount_usdc: float      # valeur numerique humaine (500.0, pas 500_000_000)
    dispute_window_end: datetime
    submitted_at: datetime
    block_number: Optional[int] = None
    mock: bool = False


def _normalize_fingerprint(fingerprint: str) -> bytes:
    """Convertit 'sha256:abcd...' en bytes32. Accepte aussi hex brut."""
    hex_str = fingerprint.split(":", 1)[1] if fingerprint.startswith("sha256:") else fingerprint
    b = bytes.fromhex(hex_str)
    if len(b) != 32:
        raise ValueError(f"fingerprint must be 32 bytes, got {len(b)}")
    return b


class ChainClient:
    def __init__(
        self,
        *,
        use_mock: bool = True,
        rpc_url: str = "",
        chain_id: int = 80002,
        private_key: str = "",
        contract_address: str = "",
        usdc_address: str = "",
        bond_amount_usdc: float = 500.0,
        dispute_window_seconds: int = 172800,
    ):
        self.use_mock = use_mock or not (private_key and contract_address)
        self.rpc_url = rpc_url
        self.chain_id = chain_id
        self.private_key = private_key
        self.contract_address = contract_address or "0x0000000000000000000000000000000000000000"
        self.usdc_address = usdc_address
        self.bond_amount_usdc = bond_amount_usdc
        self.dispute_window_seconds = dispute_window_seconds

    def is_ready(self) -> tuple[bool, str]:
        if self.use_mock:
            return True, "mock mode"
        if not self.private_key:
            return False, "missing ORACLE_PRIVATE_KEY"
        if not self.contract_address or self.contract_address == "0x0000000000000000000000000000000000000000":
            return False, "missing PARA_ORACLE_ADDRESS"
        return True, "credentials present"

    def submit_resolution(
        self,
        *,
        fingerprint_sha256: str,
        data_cid: str,
        script_cid: str,
        bet_slug: str,
        threshold_value: float,
        observed_value: float,
        threshold_unit: str,
        outcome_yes: bool,
        period_end: datetime,
    ) -> SubmitTxResult:
        """Soumet la resolution on-chain (ou mock). Retourne un SubmitTxResult."""
        if self.use_mock:
            return self._mock_submit(
                fingerprint_sha256=fingerprint_sha256,
                bet_slug=bet_slug,
                period_end=period_end,
            )
        return self._real_submit(
            fingerprint_sha256=fingerprint_sha256,
            data_cid=data_cid,
            script_cid=script_cid,
            bet_slug=bet_slug,
            threshold_value=threshold_value,
            observed_value=observed_value,
            threshold_unit=threshold_unit,
            outcome_yes=outcome_yes,
            period_end=period_end,
        )

    # ─── Mock ───────────────────────────────────────────────────────────────

    def _mock_submit(
        self,
        *,
        fingerprint_sha256: str,
        bet_slug: str,
        period_end: datetime,
    ) -> SubmitTxResult:
        # Validation precoce (meme comportement que le contrat)
        _ = _normalize_fingerprint(fingerprint_sha256)

        now = datetime.now(timezone.utc)
        # tx_hash deterministe par (fingerprint, bet_slug) + quelques bits du timestamp
        # On garde la reproductibilite entre runs : on ne melange PAS le timestamp.
        # Cela permet aux tests de verifier la stabilite du tx_hash.
        seed = f"{fingerprint_sha256}|{bet_slug}|{int(period_end.timestamp())}".encode()
        tx_hash = "0x" + hashlib.sha256(seed).hexdigest()

        # resolution_id = keccak256(keccak256(bet_slug) || uint64(period_end))
        bet_slug_hash = _keccak256(bet_slug.encode("utf-8"))
        period_end_ts = int(period_end.timestamp())
        resolution_id_bytes = _keccak256(bet_slug_hash + period_end_ts.to_bytes(8, "big"))
        resolution_id = "0x" + resolution_id_bytes.hex()

        dispute_end = now + timedelta(seconds=self.dispute_window_seconds)

        return SubmitTxResult(
            tx_hash=tx_hash,
            resolution_id=resolution_id,
            chain_id=self.chain_id,
            contract_address=self.contract_address,
            bond_amount_usdc=self.bond_amount_usdc,
            dispute_window_end=dispute_end,
            submitted_at=now,
            block_number=None,
            mock=True,
        )

    # ─── Real (stub) ────────────────────────────────────────────────────────

    def _real_submit(self, **kwargs) -> SubmitTxResult:
        raise NotImplementedError(
            "Real chain submit not implemented yet. Needs web3.py + eth-account + "
            "the ParaOracle ABI. See M3bis in planWeb3.md."
        )


def get_default_client() -> ChainClient:
    """Instancie depuis les settings courants."""
    return ChainClient(
        use_mock=settings.USE_MOCK_CHAIN,
        rpc_url=settings.CHAIN_RPC_URL,
        chain_id=settings.CHAIN_ID,
        private_key=settings.ORACLE_PRIVATE_KEY,
        contract_address=settings.PARA_ORACLE_ADDRESS,
        usdc_address=settings.USDC_ADDRESS,
        bond_amount_usdc=settings.BOND_AMOUNT_USDC,
        dispute_window_seconds=settings.DISPUTE_WINDOW_SECONDS,
    )
