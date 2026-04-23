"""
ChainClient — interface pour soumettre des resolutions au smart contract ParaOracle.

Deux backends :
  - mock : genere un tx_hash deterministe a partir du fingerprint + bet_slug.
           Aucun appel reseau. Utile pour E2E sans testnet.
  - real : web3.py + eth-account, signe et broadcaste submitResolution() sur
           Polygon Amoy (chain_id=80002). Gere l'approve USDC de facon lazy.

Le contrat ParaOracle attend :
  submitResolution(bytes32 fingerprint, string dataCID, string scriptCID,
                   bytes32 betSlugHash, uint256 threshold, uint256 observed,
                   bool outcome, uint64 periodEnd) -> bytes32 resolutionId

threshold/observed sont scales par 1e6 pour compatibilite USDC 6 decimales (le
contrat ne fait que stocker les valeurs, pas de math dessus).
"""
from __future__ import annotations
import hashlib
import json
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from app.core.config import settings

log = logging.getLogger(__name__)


# Scale pour passer threshold/observed en uint256 (6 decimales, comme USDC).
# Le contrat ne calcule rien avec, c'est juste un encodage consistant.
VALUE_SCALE = 10**6

CONTRACTS_DIR = Path(__file__).resolve().parent.parent / "contracts"


def _keccak256(data: bytes) -> bytes:
    """SHA3-256 standard (fallback deterministe mock-only, differe de keccak-256 Ethereum)."""
    return hashlib.sha3_256(data).digest()


@dataclass
class SubmitTxResult:
    """Resultat d'un submit on-chain. Persiste dans analyses."""
    tx_hash: str                 # "0x" + 64 hex chars
    resolution_id: str           # "0x" + 64 hex chars
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


def _load_abi(name: str) -> list:
    path = CONTRACTS_DIR / f"{name}.json"
    if not path.exists():
        raise FileNotFoundError(
            f"ABI {path} not found. Run `forge build` then copy "
            f"contracts/out/{name}.sol/{name}.json to backend/app/contracts/{name}.json"
        )
    return json.loads(path.read_text())


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
        # Lazy web3 handles
        self._w3 = None
        self._account = None
        self._contract = None
        self._usdc = None

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
        _ = _normalize_fingerprint(fingerprint_sha256)

        now = datetime.now(timezone.utc)
        seed = f"{fingerprint_sha256}|{bet_slug}|{int(period_end.timestamp())}".encode()
        tx_hash = "0x" + hashlib.sha256(seed).hexdigest()

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

    # ─── Real ───────────────────────────────────────────────────────────────

    def _init_web3(self):
        """Instancie le web3 client + contract bindings (lazy, une fois)."""
        if self._w3 is not None:
            return
        from web3 import Web3
        from eth_account import Account

        self._w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        if not self._w3.is_connected():
            raise RuntimeError(f"Cannot connect to RPC: {self.rpc_url}")

        # Polygon Amoy is PoA — block.extraData is 106 bytes instead of 32.
        # Inject the PoA middleware so web3.py doesn't reject blocks.
        try:
            from web3.middleware import ExtraDataToPOAMiddleware
            self._w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
        except ImportError:
            # web3.py < 7 fallback
            from web3.middleware import geth_poa_middleware
            self._w3.middleware_onion.inject(geth_poa_middleware, layer=0)

        pk = self.private_key if self.private_key.startswith("0x") else f"0x{self.private_key}"
        self._account = Account.from_key(pk)

        abi_para = _load_abi("ParaOracle")
        abi_erc20 = _load_abi("ERC20")
        self._contract = self._w3.eth.contract(
            address=Web3.to_checksum_address(self.contract_address),
            abi=abi_para,
        )
        # Read USDC address from contract (bondToken()). If env USDC_ADDRESS is
        # set, verify it matches (avoids accidental mismatch).
        onchain_usdc = self._contract.functions.bondToken().call()
        if self.usdc_address and Web3.to_checksum_address(self.usdc_address) != Web3.to_checksum_address(onchain_usdc):
            raise RuntimeError(
                f"USDC_ADDRESS={self.usdc_address} != contract.bondToken()={onchain_usdc}"
            )
        self._usdc = self._w3.eth.contract(
            address=Web3.to_checksum_address(onchain_usdc),
            abi=abi_erc20,
        )

    def _ensure_allowance(self, required: int) -> None:
        """Approve le contrat ParaOracle pour spend USDC si allowance < required.
        Utilise une approve "infinie" (2**256-1) pour eviter un approve par submit."""
        from web3 import Web3

        owner = self._account.address
        spender = Web3.to_checksum_address(self.contract_address)
        allowance = self._usdc.functions.allowance(owner, spender).call()
        if allowance >= required:
            return
        log.info("chain_client: allowance %s < %s, approving max uint256", allowance, required)

        max_uint = (1 << 256) - 1
        nonce = self._w3.eth.get_transaction_count(owner)
        tx = self._usdc.functions.approve(spender, max_uint).build_transaction({
            "from": owner,
            "nonce": nonce,
            "chainId": self.chain_id,
        })
        signed = self._account.sign_transaction(tx)
        raw = getattr(signed, "raw_transaction", None) or signed.rawTransaction
        tx_hash = self._w3.eth.send_raw_transaction(raw)
        receipt = self._w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)
        if receipt.status != 1:
            raise RuntimeError(f"approve tx failed: {tx_hash.hex()}")
        log.info("chain_client: approve OK tx=%s", tx_hash.hex())

    def _real_submit(
        self,
        *,
        fingerprint_sha256: str,
        data_cid: str,
        script_cid: str,
        bet_slug: str,
        threshold_value: float,
        observed_value: float,
        outcome_yes: bool,
        period_end: datetime,
    ) -> SubmitTxResult:
        from web3 import Web3

        self._init_web3()

        bond_raw = self._contract.functions.bondAmount().call()
        window_raw = self._contract.functions.disputeWindowSeconds().call()

        usdc_balance = self._usdc.functions.balanceOf(self._account.address).call()
        if usdc_balance < bond_raw:
            raise RuntimeError(
                f"oracle wallet {self._account.address} has {usdc_balance} tUSDC, "
                f"needs at least {bond_raw} for bond. Mint via Deploy or approve from deployer."
            )

        self._ensure_allowance(bond_raw)

        fingerprint_bytes = _normalize_fingerprint(fingerprint_sha256)
        bet_slug_hash = Web3.keccak(text=bet_slug)
        period_end_ts = int(period_end.timestamp())
        threshold_scaled = int(round(threshold_value * VALUE_SCALE))
        observed_scaled = int(round(observed_value * VALUE_SCALE))

        owner = self._account.address
        nonce = self._w3.eth.get_transaction_count(owner)
        tx = self._contract.functions.submitResolution(
            fingerprint_bytes,
            data_cid,
            script_cid,
            bet_slug_hash,
            threshold_scaled,
            observed_scaled,
            bool(outcome_yes),
            period_end_ts,
        ).build_transaction({
            "from": owner,
            "nonce": nonce,
            "chainId": self.chain_id,
        })
        signed = self._account.sign_transaction(tx)
        raw = getattr(signed, "raw_transaction", None) or signed.rawTransaction
        tx_hash = self._w3.eth.send_raw_transaction(raw)
        receipt = self._w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)
        if receipt.status != 1:
            raise RuntimeError(f"submitResolution tx reverted: {tx_hash.hex()}")

        # resolution_id via view computeResolutionId (match exact l'encodage du contrat)
        resolution_id_bytes = self._contract.functions.computeResolutionId(
            bet_slug_hash, period_end_ts
        ).call()
        resolution_id_hex = resolution_id_bytes.hex()
        resolution_id = resolution_id_hex if resolution_id_hex.startswith("0x") else "0x" + resolution_id_hex

        # dispute_window_end on-chain = block.timestamp + disputeWindowSeconds
        block_ts = self._w3.eth.get_block(receipt.blockNumber).timestamp
        dispute_end = datetime.fromtimestamp(block_ts + window_raw, tz=timezone.utc)
        submitted_at = datetime.fromtimestamp(block_ts, tz=timezone.utc)

        tx_hash_str = tx_hash.hex() if isinstance(tx_hash, bytes) else str(tx_hash)
        if not tx_hash_str.startswith("0x"):
            tx_hash_str = "0x" + tx_hash_str

        return SubmitTxResult(
            tx_hash=tx_hash_str,
            resolution_id=resolution_id,
            chain_id=self.chain_id,
            contract_address=self.contract_address,
            bond_amount_usdc=bond_raw / VALUE_SCALE,
            dispute_window_end=dispute_end,
            submitted_at=submitted_at,
            block_number=receipt.blockNumber,
            mock=False,
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
