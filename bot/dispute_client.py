"""
dispute_client.py — web3 wrapper for the challenger bot to call
ParaOracle.dispute(bytes32) on Polygon Amoy.

Mirrors the backend's chain_client pattern but scoped to disputes only.

Behavior:
  - USE_MOCK_CHAIN=true (or missing CHALLENGER_PRIVATE_KEY): disabled,
    bot only logs "[DISPUTE]" as before. Exit code unchanged.
  - USE_MOCK_CHAIN=false: on each mismatch verdict we
      1. Extract the resolution_id from the submit tx receipt
         (ResolutionSubmitted event log) — avoids needing the bet period_end.
      2. Approve(max_uint) USDC to ParaOracle if allowance < bond (once).
      3. Call dispute(resolution_id), wait for receipt, return tx hash.

Public API:
  maybe_enable() -> DisputeClient | None
  DisputeClient.dispute_for(submit_tx_hash: str) -> str   # returns dispute tx hash
"""
from __future__ import annotations
import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional
import json

log = logging.getLogger("challenger.dispute")

# ─── ERC20 minimal ABI (approve + allowance + balanceOf + mint) ─────────────
_ERC20_ABI = [
    {"name": "balanceOf", "type": "function", "stateMutability": "view",
     "inputs": [{"name": "", "type": "address"}], "outputs": [{"name": "", "type": "uint256"}]},
    {"name": "allowance", "type": "function", "stateMutability": "view",
     "inputs": [{"name": "", "type": "address"}, {"name": "", "type": "address"}],
     "outputs": [{"name": "", "type": "uint256"}]},
    {"name": "approve", "type": "function", "stateMutability": "nonpayable",
     "inputs": [{"name": "spender", "type": "address"}, {"name": "amount", "type": "uint256"}],
     "outputs": [{"name": "", "type": "bool"}]},
    {"name": "mint", "type": "function", "stateMutability": "nonpayable",
     "inputs": [{"name": "to", "type": "address"}, {"name": "amount", "type": "uint256"}],
     "outputs": []},
]

# Inline the ParaOracle ABI subset we need. Keeps the bot repo-independent from
# the backend layout (so the public repo can ship a standalone challenger).
_PARAORACLE_ABI = [
    {"name": "dispute", "type": "function", "stateMutability": "nonpayable",
     "inputs": [{"name": "resolutionId", "type": "bytes32"}], "outputs": []},
    {"name": "bondAmount", "type": "function", "stateMutability": "view",
     "inputs": [], "outputs": [{"name": "", "type": "uint256"}]},
    {"name": "bondToken", "type": "function", "stateMutability": "view",
     "inputs": [], "outputs": [{"name": "", "type": "address"}]},
    {"name": "getResolution", "type": "function", "stateMutability": "view",
     "inputs": [{"name": "resolutionId", "type": "bytes32"}],
     "outputs": [{"name": "", "type": "tuple"}]},
    # ResolutionSubmitted event signature:
    #   event ResolutionSubmitted(bytes32 indexed resolutionId, ...)
    {"name": "ResolutionSubmitted", "type": "event", "anonymous": False,
     "inputs": [
        {"name": "resolutionId", "type": "bytes32", "indexed": True},
        {"name": "oracle", "type": "address", "indexed": True},
        {"name": "fingerprint", "type": "bytes32", "indexed": False},
        {"name": "dataCID", "type": "string", "indexed": False},
        {"name": "scriptCID", "type": "string", "indexed": False},
        {"name": "outcome", "type": "bool", "indexed": False},
        {"name": "threshold", "type": "uint256", "indexed": False},
        {"name": "observed", "type": "uint256", "indexed": False},
        {"name": "periodEnd", "type": "uint64", "indexed": False},
        {"name": "submittedAt", "type": "uint64", "indexed": False},
        {"name": "disputeWindowEnd", "type": "uint64", "indexed": False},
     ]},
]


@dataclass
class DisputeClient:
    w3: object
    account: object
    contract: object
    usdc: object
    chain_id: int
    explorer_base: str = "https://amoy.polygonscan.com/tx/"

    def ensure_allowance(self, required: int) -> None:
        """Approve max_uint once so subsequent disputes don't need re-approval."""
        owner = self.account.address
        spender = self.contract.address
        allowance = self.usdc.functions.allowance(owner, spender).call()  # type: ignore[attr-defined]
        if allowance >= required:
            return
        log.info("challenger: allowance %s < %s, approving max uint256", allowance, required)
        max_uint = (1 << 256) - 1
        nonce = self.w3.eth.get_transaction_count(owner)  # type: ignore[attr-defined]
        tx = self.usdc.functions.approve(spender, max_uint).build_transaction({  # type: ignore[attr-defined]
            "from": owner, "nonce": nonce, "chainId": self.chain_id,
        })
        signed = self.account.sign_transaction(tx)
        raw = getattr(signed, "raw_transaction", None) or signed.rawTransaction
        tx_hash = self.w3.eth.send_raw_transaction(raw)  # type: ignore[attr-defined]
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)  # type: ignore[attr-defined]
        if receipt.status != 1:
            raise RuntimeError(f"approve tx failed: {tx_hash.hex()}")
        log.info("challenger: approve OK tx=%s", tx_hash.hex())

    def resolution_id_from_submit_tx(self, submit_tx_hash: str) -> Optional[bytes]:
        """Extract resolutionId from the ResolutionSubmitted event log of a submit tx."""
        try:
            receipt = self.w3.eth.get_transaction_receipt(submit_tx_hash)  # type: ignore[attr-defined]
            logs = self.contract.events.ResolutionSubmitted().process_receipt(  # type: ignore[attr-defined]
                receipt, errors="WARN"
            )
            if not logs:
                log.warning("challenger: no ResolutionSubmitted event in tx %s", submit_tx_hash)
                return None
            return logs[0]["args"]["resolutionId"]
        except Exception as e:
            log.warning("challenger: receipt extraction failed for %s: %s", submit_tx_hash, e)
            return None

    def dispute_for(self, submit_tx_hash: str) -> Optional[str]:
        """Submit a real dispute() tx on-chain. Returns the dispute tx hash, or None on failure."""
        resolution_id = self.resolution_id_from_submit_tx(submit_tx_hash)
        if resolution_id is None:
            return None

        bond_raw = self.contract.functions.bondAmount().call()  # type: ignore[attr-defined]
        usdc_balance = self.usdc.functions.balanceOf(self.account.address).call()  # type: ignore[attr-defined]
        if usdc_balance < bond_raw:
            log.error(
                "challenger: wallet %s has %s tUSDC, needs %s for counter-bond. "
                "Mint or transfer USDC first.",
                self.account.address, usdc_balance, bond_raw,
            )
            return None

        self.ensure_allowance(bond_raw)

        owner = self.account.address
        nonce = self.w3.eth.get_transaction_count(owner)  # type: ignore[attr-defined]
        tx = self.contract.functions.dispute(resolution_id).build_transaction({  # type: ignore[attr-defined]
            "from": owner, "nonce": nonce, "chainId": self.chain_id,
        })
        signed = self.account.sign_transaction(tx)
        raw = getattr(signed, "raw_transaction", None) or signed.rawTransaction
        tx_hash = self.w3.eth.send_raw_transaction(raw)  # type: ignore[attr-defined]
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)  # type: ignore[attr-defined]
        if receipt.status != 1:
            log.error("challenger: dispute tx reverted: %s", tx_hash.hex())
            return None

        hex_hash = tx_hash.hex()
        if not hex_hash.startswith("0x"):
            hex_hash = "0x" + hex_hash
        log.info("challenger: DISPUTE SUBMITTED tx=%s %s%s", hex_hash, self.explorer_base, hex_hash)
        return hex_hash


def maybe_enable() -> Optional[DisputeClient]:
    """
    Returns a configured DisputeClient if all env vars are present and
    USE_MOCK_CHAIN=false; None otherwise (bot stays in log-only mode).
    """
    use_mock = os.environ.get("USE_MOCK_CHAIN", "true").lower() == "true"
    pk = os.environ.get("CHALLENGER_PRIVATE_KEY", "").strip()
    rpc_url = os.environ.get("CHAIN_RPC_URL", "").strip()
    oracle_addr = os.environ.get("PARA_ORACLE_ADDRESS", "").strip()
    usdc_addr = os.environ.get("USDC_ADDRESS", "").strip()
    chain_id = int(os.environ.get("CHAIN_ID", "80002"))

    if use_mock:
        log.info("challenger: USE_MOCK_CHAIN=true, real dispute disabled")
        return None
    if not pk:
        log.info("challenger: CHALLENGER_PRIVATE_KEY missing, real dispute disabled")
        return None
    if not (rpc_url and oracle_addr and usdc_addr):
        log.warning(
            "challenger: chain env incomplete (rpc=%s oracle=%s usdc=%s), disabling real dispute",
            bool(rpc_url), bool(oracle_addr), bool(usdc_addr),
        )
        return None

    try:
        from web3 import Web3
        from eth_account import Account
    except ImportError:
        log.error("challenger: web3/eth-account not installed — run `pip install web3 eth-account`")
        return None

    try:
        from web3.middleware import ExtraDataToPOAMiddleware
    except ImportError:
        try:
            from web3.middleware import geth_poa_middleware as ExtraDataToPOAMiddleware  # type: ignore
        except ImportError:
            ExtraDataToPOAMiddleware = None  # type: ignore

    w3 = Web3(Web3.HTTPProvider(rpc_url))
    if ExtraDataToPOAMiddleware is not None:
        w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
    if not w3.is_connected():
        log.error("challenger: cannot connect to RPC %s", rpc_url)
        return None

    pk_norm = pk if pk.startswith("0x") else "0x" + pk
    account = Account.from_key(pk_norm)
    contract = w3.eth.contract(address=Web3.to_checksum_address(oracle_addr), abi=_PARAORACLE_ABI)
    usdc = w3.eth.contract(address=Web3.to_checksum_address(usdc_addr), abi=_ERC20_ABI)

    log.info(
        "challenger: real dispute enabled · wallet=%s chain_id=%s oracle=%s",
        account.address, chain_id, oracle_addr,
    )
    return DisputeClient(w3=w3, account=account, contract=contract, usdc=usdc, chain_id=chain_id)
