"""
web3_publisher — orchestrateur du chainage Web3 apres un pipeline.

Etapes :
  1. Pin chaque blob (BlobRef) sur IPFS, remplit BlobRef.cid
  2. Met a jour manifest.fingerprint_inputs.rasters[] avec les cids remplis (spectral)
  3. Calcule le fingerprint canonique SHA-256 sur le manifest FINAL
  4. Pin data.json (bytes canoniques du manifest)
  5. Pin resolution_script.py (script public de verification, stdlib-only)
  6. Pin schema_v1.json (schema v1, immuable)
  7. Soumet on-chain via ChainClient (mock-first, real en M3bis)
  8. Retourne un bundle avec tous les CIDs + fingerprint final + chain_tx_hash

Le pin de schema_v1.json et resolution_script.py est idempotent (Pinata dedup
par contenu ; mock dedup par SHA-256). Pas de cache explicite en MVP.

TLSNotary arrive en M4.
"""
from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from app.core.config import settings
from app.services.canonical import canonicalize, fingerprint_sha256
from app.services.chain_client import ChainClient, SubmitTxResult, get_default_client as get_default_chain
from app.services.ipfs_client import IPFSClient, get_default_client as get_default_ipfs
from app.services.pipeline_base import BasePipelineResult
from app.services.schema_v1 import SCHEMA_V1_JSON_BYTES
from app.services.tlsnotary_client import TLSNotaryClient, get_default_client as get_default_tlsnotary


# Chemin vers resolution_script.py. Dans le container Docker, on s'attend a
# trouver /scripts (volume monte). En local, on remonte depuis backend/.
_DEFAULT_SCRIPT_PATHS = [
    Path("/scripts/resolution_script.py"),
    Path(__file__).resolve().parents[3] / "scripts" / "resolution_script.py",
]


def _find_resolution_script() -> Path:
    for p in _DEFAULT_SCRIPT_PATHS:
        if p.exists():
            return p
    raise FileNotFoundError(
        f"resolution_script.py not found. Tried: {', '.join(str(p) for p in _DEFAULT_SCRIPT_PATHS)}. "
        "Mount ./scripts into the backend container or set RESOLUTION_SCRIPT_PATH."
    )


@dataclass
class PublishBundle:
    """Resultat du chainage Web3. Persiste dans la table analyses."""
    data_cid: str
    script_cid: str
    schema_cid: str
    tls_proof_cid: Optional[str]
    fingerprint_sha256: str
    manifest_final: dict
    gateway_base: str
    # On-chain (M3+)
    chain_tx: Optional[SubmitTxResult] = None


def _derive_tls_source(manifest: dict) -> tuple[str, str, bytes, bytes]:
    """Extrait server_name, request_url, request_body, response_body a notariser.

    Pour weather  : serveur CDS + request params + values (hash via canonicalize).
    Pour spectral : serveur CDSE STAC + rasters hashes (request body non preserve, vide).
    """
    kind = manifest.get("pipeline_kind", "")
    inputs = manifest.get("fingerprint_inputs", {})
    if kind == "weather":
        return (
            "cds.climate.copernicus.eu",
            "https://cds.climate.copernicus.eu/api/retrieve/v1/processes/reanalysis-era5-land/execute",
            canonicalize(inputs.get("request", {})),
            canonicalize({"values": inputs.get("values", [])}),
        )
    # spectral (ou autre pipeline futur)
    return (
        "catalogue.dataspace.copernicus.eu",
        "https://catalogue.dataspace.copernicus.eu/stac/search",
        b"",  # request body non preserve par SpectralPipeline (M4bis)
        canonicalize({"rasters": inputs.get("rasters", [])}),
    )


def publish_resolution(
    result: BasePipelineResult,
    *,
    bet_slug: str,
    period_end: datetime,
    ipfs: Optional[IPFSClient] = None,
    chain: Optional[ChainClient] = None,
    tlsnotary: Optional[TLSNotaryClient] = None,
) -> Optional[PublishBundle]:
    """
    Chaine Web3 d'une resolution. Retourne None si USE_WEB3_PUBLISHING=false.

    NB: mute `result.blobs[*].cid` et `result.data_normalized` en place.
    """
    if not settings.USE_WEB3_PUBLISHING:
        return None
    if not result.success:
        return None

    ipfs_client = ipfs or get_default_ipfs()
    chain_client = chain or get_default_chain()
    tls_client = tlsnotary or get_default_tlsnotary()

    # ── 1. Pin les blobs et remplir leurs CIDs ──
    for blob in result.blobs:
        blob.cid = ipfs_client.pin_file(blob.path, name=f"{blob.kind}.bin")

    # ── 2. Injecter les CIDs dans le manifest (spectral : rasters[]) ──
    manifest = result.data_normalized
    if result.blobs:
        manifest["fingerprint_inputs"]["rasters"] = [
            {
                "kind": b.kind,
                "cid": b.cid,
                "sha256": b.sha256,
                "bbox": b.bbox,
            }
            for b in result.blobs
        ]

    # ── 3. TLSNotary : notarize la requete source + pin la proof ──
    server, url, req_body, resp_body = _derive_tls_source(manifest)
    tls_proof = tls_client.notarize(
        server_name=server,
        request_url=url,
        request_body=req_body,
        response_body=resp_body,
    )
    tls_proof_cid = ipfs_client.pin_bytes("tls_proof.json", tls_proof.envelope_bytes)

    # Reference la proof dans le manifest (petit, facile a inspecter).
    # L'enveloppe complete reste sur IPFS via tls_proof_cid.
    manifest["tls_proof"] = {
        "cid": tls_proof_cid,
        "server_name": tls_proof.envelope["server_name"],
        "request_url": tls_proof.envelope["request_url"],
        "response_body_sha256": tls_proof.envelope["response_body_sha256"],
        "mock": tls_proof.is_mock,
    }

    # ── 4. Fingerprint final (post-injection CIDs + tls_proof.cid) ──
    data_bytes = canonicalize(manifest)
    fingerprint = fingerprint_sha256(manifest)

    # ── 5. Pin data.json ──
    data_cid = ipfs_client.pin_bytes("data.json", data_bytes)

    # ── 6. Pin resolution_script.py ──
    script_path = _find_resolution_script()
    script_cid = ipfs_client.pin_file(script_path, name="resolution_script.py")

    # ── 7. Pin schema_v1.json ──
    schema_cid = ipfs_client.pin_bytes("schema_v1.json", SCHEMA_V1_JSON_BYTES)

    # ── 8. Submit on-chain (mock-first, real en M3bis) ──
    # period_end peut etre un datetime naif (date.period_end) — on le force UTC.
    if period_end.tzinfo is None:
        period_end = period_end.replace(tzinfo=timezone.utc)

    chain_tx = chain_client.submit_resolution(
        fingerprint_sha256=fingerprint,
        data_cid=data_cid,
        script_cid=script_cid,
        bet_slug=bet_slug,
        threshold_value=result.threshold_value,
        observed_value=result.observed_value,
        threshold_unit=result.threshold_unit,
        outcome_yes=result.outcome_yes,
        period_end=period_end,
    )

    return PublishBundle(
        data_cid=data_cid,
        script_cid=script_cid,
        schema_cid=schema_cid,
        tls_proof_cid=tls_proof_cid,
        fingerprint_sha256=fingerprint,
        manifest_final=manifest,
        gateway_base=ipfs_client.gateway_url,
        chain_tx=chain_tx,
    )
