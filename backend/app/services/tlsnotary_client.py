"""
TLSNotaryClient — preuve cryptographique qu'une reponse HTTP vient bien d'un
serveur cible sans alteration, via le protocole TLSNotary MPC.

En prod : notaire PSE (Ethereum Foundation), open-source et self-hostable.
En MVP  : stub qui emet une enveloppe JSON *shape-compatible* avec la vraie
          proof, pour que le reste du pipeline puisse la pinner et la referencer
          dans data.json. La signature et les HMAC sont falsifies mais le format
          reste identique — on pourra brancher la vraie integration PSE en M4bis
          sans casser le manifest ni le fingerprint.

Structure de l'enveloppe stub (alignee approximativement sur PSE v0.x) :
  {
    "version": "paraoracle-stub/v1",
    "server_name": "cds.climate.copernicus.eu",
    "tls_version": "TLSv1.2",
    "request_url": "https://...",
    "request_body_sha256": "sha256:...",   // ce qui est prouve
    "response_body_sha256": "sha256:...",  // l'autre moitie du contrat TLSNotary
    "notary": {
        "name": "stub-notary",
        "pubkey": null,
        "signed_at": "2026-04-22T10:00:00Z"
    },
    "signature": "stub"
  }

TOUT changement de schema doit etre coordonne avec le format reel PSE quand
il sera integre (M4bis). Voir docs/tlsnotary.md pour le plan de migration.
"""
from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional
import hashlib
import json

from app.core.config import settings


STUB_VERSION = "paraoracle-stub/v1"


@dataclass
class TLSProof:
    """Enveloppe TLSNotary. `envelope_bytes` est ce qui est pinne sur IPFS."""
    envelope: dict
    envelope_bytes: bytes
    is_mock: bool


class TLSNotaryClient:
    def __init__(self, *, use_mock: bool = True, notary_url: str = ""):
        self.use_mock = use_mock or not notary_url
        self.notary_url = notary_url

    def is_ready(self) -> tuple[bool, str]:
        if self.use_mock:
            return True, "mock mode (stub envelope)"
        if not self.notary_url:
            return False, "missing TLSNOTARY_NOTARY_URL"
        return True, f"configured notary: {self.notary_url}"

    def notarize(
        self,
        *,
        server_name: str,
        request_url: str,
        request_body: bytes = b"",
        response_body: bytes = b"",
    ) -> TLSProof:
        """Produit une proof TLSNotary (ou stub si mock)."""
        if self.use_mock:
            return self._mock_proof(server_name, request_url, request_body, response_body)
        return self._real_proof(server_name, request_url, request_body, response_body)

    # ─── Mock ───────────────────────────────────────────────────────────────

    @staticmethod
    def _sha256_hex(content: bytes) -> str:
        return "sha256:" + hashlib.sha256(content).hexdigest()

    def _mock_proof(
        self,
        server_name: str,
        request_url: str,
        request_body: bytes,
        response_body: bytes,
    ) -> TLSProof:
        # En mock on veut un envelope DETERMINISTE : signed_at derive du contenu
        # (pas de `now()` qui casserait la reproductibilite du fingerprint).
        # En real, PSE inclura un vrai timestamp mais la proof sera alors signee.
        content_hash = hashlib.sha256(
            server_name.encode() + b"|" + request_url.encode() + b"|" + request_body + b"|" + response_body
        ).digest()
        pseudo_ts = int.from_bytes(content_hash[:4], "big")  # reproducible 32-bit int
        stub_signed_at = datetime.fromtimestamp(pseudo_ts, tz=timezone.utc).isoformat()

        envelope = {
            "version": STUB_VERSION,
            "server_name": server_name,
            "tls_version": "TLSv1.2",
            "request_url": request_url,
            "request_body_sha256": self._sha256_hex(request_body),
            "response_body_sha256": self._sha256_hex(response_body),
            "notary": {
                "name": "stub-notary",
                "pubkey": None,
                "signed_at": stub_signed_at,
            },
            "signature": "stub",
        }
        # Canonicaliser pour stabilite du fingerprint : sort_keys=True, separators compacts.
        envelope_bytes = json.dumps(
            envelope, sort_keys=True, separators=(",", ":"), ensure_ascii=False,
        ).encode("utf-8")
        return TLSProof(envelope=envelope, envelope_bytes=envelope_bytes, is_mock=True)

    # ─── Real (stub) ────────────────────────────────────────────────────────

    def _real_proof(self, *args, **kwargs) -> TLSProof:
        raise NotImplementedError(
            "Real TLSNotary integration (PSE MPC) not yet implemented. "
            "See docs/tlsnotary.md for the integration plan."
        )


def get_default_client() -> TLSNotaryClient:
    return TLSNotaryClient(
        use_mock=settings.USE_MOCK_TLSNOTARY,
        notary_url=getattr(settings, "TLSNOTARY_NOTARY_URL", ""),
    )
