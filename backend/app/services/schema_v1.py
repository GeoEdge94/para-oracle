"""
schema_v1 — schema JSON versionne et fige pour le pipeline Web3.

Ce schema definit la structure du fichier data.json publie sur IPFS a chaque
resolution. Sa forme est identique pour les deux pipelines (weather et spectral)
au niveau top-level ; seul le contenu de `fingerprint_inputs` varie :

  - pipeline_kind="weather"  : fingerprint_inputs.values contient un array de
                                floats (precipitations, temperatures...).
  - pipeline_kind="spectral" : fingerprint_inputs.rasters contient une liste
                                de blobs IPFS {kind, cid, sha256}.

Tout changement de ce schema doit bumper SCHEMA_VERSION a "v2" et pinner
un nouveau schema_v2.json sur IPFS. schema_v1 ne doit JAMAIS etre modifie.
"""
from __future__ import annotations
from app.services.canonical import canonicalize

SCHEMA_VERSION = "v1"


SCHEMA_V1: dict = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://para-oracle.io/schemas/v1",
    "title": "ParaOracle Resolution Manifest v1",
    "type": "object",
    "required": [
        "schema_version",
        "pipeline_kind",
        "bet_slug",
        "period",
        "region_bbox",
        "fingerprint_inputs",
        "result",
    ],
    "properties": {
        "schema_version": {"const": "v1"},
        "pipeline_kind": {"enum": ["weather", "spectral"]},
        "bet_slug": {"type": "string", "minLength": 1},
        "period": {
            "type": "object",
            "required": ["start", "end"],
            "properties": {
                "start": {"type": "string", "format": "date"},
                "end": {"type": "string", "format": "date"},
            },
        },
        "region_bbox": {
            "type": "array",
            "items": {"type": "number"},
            "minItems": 4,
            "maxItems": 4,
            "description": "[minx, miny, maxx, maxy] en EPSG:4326",
        },
        "fingerprint_inputs": {
            "type": "object",
            "oneOf": [
                {
                    "required": ["variable", "aggregation", "values"],
                    "properties": {
                        "variable": {"type": "string"},
                        "aggregation": {"enum": ["max", "mean", "sum", "min"]},
                        "values": {
                            "type": "array",
                            "items": {"type": "number"},
                        },
                        "grid_resolution_deg": {"type": "number"},
                        "source": {"type": "string"},
                        "request": {"type": "object"},
                    },
                },
                {
                    "required": ["rasters", "bands"],
                    "properties": {
                        "rasters": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "required": ["kind", "sha256"],
                                "properties": {
                                    "kind": {"type": "string"},
                                    "cid": {"type": ["string", "null"]},
                                    "sha256": {"type": "string"},
                                    "bbox": {
                                        "type": "array",
                                        "items": {"type": "number"},
                                    },
                                },
                            },
                        },
                        "bands": {
                            "type": "array",
                            "items": {"type": "string"},
                        },
                        "script_version": {"type": "string"},
                    },
                },
            ],
        },
        "result": {
            "type": "object",
            "required": ["outcome_yes", "observed_value", "threshold_value"],
            "properties": {
                "outcome_yes": {"type": "boolean"},
                "observed_value": {"type": "number"},
                "threshold_value": {"type": "number"},
                "threshold_unit": {"type": "string"},
                "direction": {"enum": ["gte", "gt", "lte", "lt"]},
            },
        },
        "tls_proof": {
            "type": ["object", "null"],
            "description": "Enveloppe TLSNotary. null si USE_MOCK_TLSNOTARY et absent du fingerprint.",
        },
    },
}


SCHEMA_V1_JSON_BYTES: bytes = canonicalize(SCHEMA_V1)
"""Bytes canoniques du schema v1 — ce qui sera pinne sur IPFS."""
