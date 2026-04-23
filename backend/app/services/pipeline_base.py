"""
Interface commune pour tous les pipelines d'oracle (spectral, weather, ...).

Un pipeline ingere des donnees, calcule un outcome binaire, et emet :
  - data_normalized : le manifest JSON qui sera canonicalise + hashe + pinne
  - blobs          : les fichiers binaires a pinner separement (rasters)
  - outcome_yes    : le resultat binaire du seuil

Le web3_publisher s'occupe ensuite de :
  1. pinner chaque blob sur IPFS
  2. remplir les `cid` dans data_normalized.fingerprint_inputs.rasters
  3. canonicalize + hash -> fingerprint_sha256
  4. pinner data.json, resolution_script.py, schema_v1.json
  5. (optionnel) notariser la requete source via TLSNotary
  6. submit on-chain
"""
from __future__ import annotations
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class BlobRef:
    """Reference vers un fichier binaire a pinner sur IPFS."""
    kind: str               # ex: "ndvi_t0", "delta", "mask"
    path: Path              # chemin local sur disque
    sha256: str             # "sha256:<hex>"
    bbox: list[float] = field(default_factory=list)  # [minx, miny, maxx, maxy]
    cid: str | None = None  # rempli par web3_publisher apres pinning


@dataclass
class BasePipelineResult:
    """
    Resultat commun a tous les pipelines. Les champs legacy specifiques
    (ndvi_t0_hash, sentinel_products_t0, etc.) restent portes par
    PipelineResult dans spectral_pipeline.py pour ne pas casser la DB.

    Les nouveaux champs Web3 sont :
      - outcome_yes, observed_value, threshold_value : resultat standardise
      - data_normalized : dict pret a etre canonicalise (schema_v1)
      - blobs : liste de BlobRef a pinner
    """
    success: bool = True
    outcome_yes: bool = False
    observed_value: float = 0.0
    threshold_value: float = 0.0
    threshold_unit: str = ""
    direction: str = "gte"                           # gte | gt | lte | lt
    data_normalized: dict = field(default_factory=dict)
    blobs: list[BlobRef] = field(default_factory=list)
    params: dict = field(default_factory=dict)
    duration_seconds: float = 0.0
    error: str = ""


def build_manifest(
    *,
    pipeline_kind: str,
    bet_slug: str,
    period_start: str,
    period_end: str,
    region_bbox: list[float],
    fingerprint_inputs: dict,
    outcome_yes: bool,
    observed_value: float,
    threshold_value: float,
    threshold_unit: str = "",
    direction: str = "gte",
) -> dict:
    """
    Construit un manifest conforme schema_v1.

    `fingerprint_inputs` est specifique au pipeline_kind :
      - weather  : {variable, aggregation, values[], grid_resolution_deg, source, request}
      - spectral : {rasters: [{kind, cid, sha256, bbox}], bands[], script_version}
    """
    return {
        "schema_version": "v1",
        "pipeline_kind": pipeline_kind,
        "bet_slug": bet_slug,
        "period": {"start": period_start, "end": period_end},
        "region_bbox": region_bbox,
        "fingerprint_inputs": fingerprint_inputs,
        "result": {
            "outcome_yes": outcome_yes,
            "observed_value": observed_value,
            "threshold_value": threshold_value,
            "threshold_unit": threshold_unit,
            "direction": direction,
        },
    }
