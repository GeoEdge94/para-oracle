"""
IPFS client — pin EvidenceBundle to IPFS via web3.storage or Pinata.

Mock mode: deterministic CID derive de SHA-256(content).
"""
from __future__ import annotations
import hashlib
import json
from typing import Any
import httpx


class IpfsClient:
    WEB3_STORAGE_URL = "https://api.web3.storage/upload"

    def __init__(self, *, mock: bool = False, api_token: str | None = None) -> None:
        self.mock = mock
        self.api_token = api_token

    def pin_json(self, content: dict[str, Any]) -> str:
        """Returns IPFS CID. Format `bafybei...` or v0 `Qm...`."""
        if self.mock:
            return self._deterministic_cid(content)
        if not self.api_token:
            raise ValueError("IpfsClient requires api_token (web3.storage)")
        payload = json.dumps(content, sort_keys=True).encode()
        r = httpx.post(
            self.WEB3_STORAGE_URL,
            content=payload,
            headers={
                "Authorization": f"Bearer {self.api_token}",
                "Content-Type": "application/json",
            },
            timeout=60,
        )
        r.raise_for_status()
        return r.json()["cid"]

    def pin_bytes(self, content: bytes) -> str:
        if self.mock:
            return self._deterministic_cid(content)
        if not self.api_token:
            raise ValueError("IpfsClient requires api_token")
        r = httpx.post(
            self.WEB3_STORAGE_URL,
            content=content,
            headers={"Authorization": f"Bearer {self.api_token}"},
            timeout=60,
        )
        r.raise_for_status()
        return r.json()["cid"]

    @staticmethod
    def _deterministic_cid(content: Any) -> str:
        if isinstance(content, dict):
            data = json.dumps(content, sort_keys=True).encode()
        elif isinstance(content, bytes):
            data = content
        else:
            data = str(content).encode()
        h = hashlib.sha256(data).hexdigest()
        return f"bafybei{h[:52]}"
