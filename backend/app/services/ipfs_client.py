"""
IPFSClient — pinning de blobs sur IPFS.

Deux backends :
  - mock   : CID deterministe base sur SHA-256 du contenu. Ecrit le fichier dans
             DATA_DIR/ipfs-mock/<cid> pour simuler une gateway locale. Utile pour
             tests E2E sans quota externe.
  - pinata : POST https://api.pinata.cloud/pinning/pinFileToIPFS avec JWT.
             Dedup automatique par contenu cote Pinata.

API unifiee :
  pin_bytes(name, content)  -> cid
  pin_file(path, name=None) -> cid
  pin_json(name, obj)       -> cid  (canonicalize d'abord, puis pin les bytes)
  cat_bytes(cid)            -> bytes (recupere le contenu)

Le CID mock est shape-compatible avec un CIDv1 base32 (prefixe "bafybei") pour
que les clients le parsent sans code conditionnel.
"""
from __future__ import annotations
import hashlib
import io
from pathlib import Path
from typing import Optional

import httpx

from app.core.config import settings
from app.services.canonical import canonicalize


class IPFSClient:
    PINATA_PIN_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS"

    def __init__(
        self,
        *,
        use_mock: bool = True,
        pinata_jwt: str = "",
        gateway_url: str = "",
        mock_dir: Optional[Path] = None,
    ):
        self.pinata_jwt = pinata_jwt
        self.gateway_url = gateway_url or "https://gateway.pinata.cloud/ipfs/"
        # Auto-fallback to mock if no JWT
        self.use_mock = use_mock or not pinata_jwt
        # Local "gateway" for mock mode
        self.mock_dir = mock_dir or (Path(settings.DATA_DIR) / "ipfs-mock")
        if self.use_mock:
            self.mock_dir.mkdir(parents=True, exist_ok=True)

    # ─── API publique ─────────────────────────────────────────────────────

    def pin_bytes(self, name: str, content: bytes) -> str:
        """Pin un blob arbitraire. Retourne un CID."""
        if self.use_mock:
            return self._mock_pin(name, content)
        return self._pinata_pin(name, content)

    def pin_file(self, path: Path, name: Optional[str] = None) -> str:
        """Lit le fichier et le pin. Convenience wrapper."""
        data = Path(path).read_bytes()
        return self.pin_bytes(name or Path(path).name, data)

    def pin_json(self, name: str, obj: dict) -> str:
        """Canonicalize le dict puis pin les bytes JSON."""
        return self.pin_bytes(name, canonicalize(obj))

    def cat_bytes(self, cid: str) -> bytes:
        """Recupere le contenu d'un CID. Utile pour tests locaux et challenge bot."""
        if self.use_mock:
            path = self.mock_dir / cid
            if not path.exists():
                raise FileNotFoundError(f"Mock IPFS: {cid} not in {self.mock_dir}")
            return path.read_bytes()
        resp = httpx.get(f"{self.gateway_url.rstrip('/')}/{cid}", timeout=60)
        resp.raise_for_status()
        return resp.content

    def gateway_link(self, cid: str) -> str:
        """URL publique pour afficher un CID (liens frontend)."""
        return f"{self.gateway_url.rstrip('/')}/{cid}"

    # ─── Mock backend ─────────────────────────────────────────────────────

    @staticmethod
    def _mock_cid(content: bytes) -> str:
        """CID deterministe: prefixe bafybei + 52 premiers hex chars du SHA-256."""
        digest = hashlib.sha256(content).hexdigest()
        return f"bafybei{digest[:52]}"

    def _mock_pin(self, name: str, content: bytes) -> str:
        cid = self._mock_cid(content)
        target = self.mock_dir / cid
        if not target.exists():
            target.write_bytes(content)
        return cid

    # ─── Pinata backend ────────────────────────────────────────────────────

    def _pinata_pin(self, name: str, content: bytes) -> str:
        files = {
            "file": (name, io.BytesIO(content), "application/octet-stream"),
        }
        headers = {"Authorization": f"Bearer {self.pinata_jwt}"}
        resp = httpx.post(
            self.PINATA_PIN_URL,
            headers=headers,
            files=files,
            timeout=60,
        )
        resp.raise_for_status()
        body = resp.json()
        cid = body.get("IpfsHash")
        if not cid:
            raise RuntimeError(f"Pinata response missing IpfsHash: {body}")
        return cid


def get_default_client() -> IPFSClient:
    """Instancie un IPFSClient avec les settings courants."""
    return IPFSClient(
        use_mock=settings.USE_MOCK_IPFS,
        pinata_jwt=settings.PINATA_JWT,
        gateway_url=settings.IPFS_GATEWAY_URL,
    )
