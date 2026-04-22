# Veralith Resolution Pipeline

> Geospatial oracle pipeline: **Ingest → Normalize → Resolve → Sign → Publish**.
>
> Reusable across Veralith products (GeoEdge, TORA, future B2B). Designed to be packaged as a standalone repo.

## Architecture

```
ingestion ──► normalization ──► resolution ──► storage
   │              │                  │            │
   NASA         NormalizedEvent    PolicyEngine  IPFS
   FIRMS        schemas            (YAML rules)  Firestore
   EFFIS        validators         conflict      Redis
   NOAA         transformers       resolver      cache
   USGS                            evidence
   Vigicrues                       builder
```

## Quick start

```bash
pip install -e .[dev]
pytest                                    # 60+ tests
veralith resolve --policy wildfire \
  --bbox -125,32,-114,42 \
  --period 2026-06-01:2026-09-30
```

## Modules

| Module | Role |
|--------|------|
| `ingestion/` | Connectors fetching official sources (BaseConnector interface) |
| `normalization/` | Transform raw → `NormalizedEvent` standard schema |
| `resolution/` | YAML-driven policies, evidence bundles, conflict resolution |
| `spatial/` | Shapely operations: matching, buffers, intersections |
| `storage/` | IPFS pinning, Firestore persistence, Redis cache |

## Output: signed Resolution

Every pipeline run produces a `ResolutionBundle`:
- `outcome` (YES/NO/INDETERMINATE)
- `evidence` (events, sources, confidence per source)
- `proof_hash` (SHA-256 of the canonical bundle)
- `ipfs_cid` (web3.storage pin)
- `signature` (EIP-712 oracle signature)

This is the artifact consumed by:
- Polymarket smart contract (`submitResolution`)
- GeoEdge frontend (display proof)
- Insurance settlement systems

## Determinism

- Every connector returns timestamped raw payloads stored verbatim
- Normalization is pure (no I/O outside reading)
- Policies are version-pinned YAML
- Same `(sources_snapshot, policy_version, region, period)` → same `proof_hash`

CI runs each policy 3× and asserts identical bundle hashes.

## License

MIT
