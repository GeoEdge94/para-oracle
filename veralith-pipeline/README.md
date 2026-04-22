<!-- README replaces the stub from initial scaffolding -->

<p align="center">
  <img src="https://veralith.io/logo.svg" alt="Veralith" height="80" />
</p>

<h1 align="center">Veralith Resolution Pipeline</h1>

<p align="center">
  <b>Geospatial oracle infrastructure for prediction markets and parametric insurance.</b><br/>
  Multi-source ingestion · YAML-driven policies · canonical proofs · on-chain ready.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/python-3.12%2B-blue" />
  <img src="https://img.shields.io/badge/solidity-0.8.24-363636" />
  <img src="https://img.shields.io/badge/tests-91%20passing-brightgreen" />
  <img src="https://img.shields.io/badge/license-Open%20Core-blue" />
</p>

---

## Why Veralith

Prediction markets and parametric insurance settle environmental questions — *"Will Amazon deforestation exceed 4,200 km² in H1 2025?"*, *"Will a Category 3+ hurricane make landfall in Florida by Oct 1?"* — using **manual, opinionated oracles**: a human reads news articles and posts a resolution.

This creates three problems:
1. **Subjectivity** — resolutions depend on which article the oracle cites.
2. **Latency** — days or weeks between the event and the on-chain settlement.
3. **No audit trail** — users must trust that the oracle read the right source.

**Veralith fixes this with a deterministic pipeline:**

```
Official sources (NASA, NOAA, Copernicus, INPE, …)
          │
          ▼
Normalized event schema (versioned, strict, Pydantic-validated)
          │
          ▼
YAML-declared policy (multi-source quorum, aggregation, thresholds)
          │
          ▼
Canonical EvidenceBundle (SHA-256 hashed, IPFS-pinned)
          │
          ▼
EIP-712 signature → ResolutionOracle.sol → settlement
```

Same inputs → same SHA-256 hash → same on-chain outcome. Forever verifiable.

---

## Open Core model

| Component | License | Where |
|-----------|---------|-------|
| **SDK (TypeScript/Python)** | MIT | `packages/sdk/` *(roadmap)* |
| **Viewer (React extension)** | MIT | `packages/viewer/` *(roadmap)* |
| **Smart contracts** | MIT | `contracts/` ✅ |
| **Evidence & policy schemas** | MIT | `src/veralith_pipeline/normalization/`, `resolution/policies/` ✅ |
| **Demo app & docs** | MIT | `apps/demo/`, `docs/` ✅ |
| **Policy engine internals** | Proprietary | `src/veralith_pipeline/resolution/policy_engine.py`, `conflict_resolver.py` |
| **API service** | Proprietary | `api/` |
| **Premium connectors** | Proprietary | *(roadmap — Planet Labs, Maxar, private feeds)* |

Everything you need to **integrate, verify, and audit** is open source. The hosted service, advanced conflict resolution, and enterprise connectors are commercial.

---

## Quick start

### Run the pipeline locally (mock mode — no API keys needed)

```bash
git clone https://github.com/veralith/resolution-pipeline.git
cd resolution-pipeline

pip install -e ".[dev]"
pytest                                                   # 77 tests, ~2s

# Boot the API
pip install "fastapi" "uvicorn[standard]"
uvicorn api.main:app --reload --port 8080

# Resolve a wildfire market
curl -s -X POST http://localhost:8080/v1/resolve \
  -H 'Content-Type: application/json' \
  -d '{
    "market_id": "california-wildfire-2026-summer",
    "policy_id": "wildfire",
    "bbox": {"west": -125, "south": 32, "east": -114, "north": 42},
    "period": {"start": "2026-06-01T00:00:00Z", "end": "2026-09-30T23:59:59Z"}
  }' | jq
```

Response:

```json
{
  "market_id": "california-wildfire-2026-summer",
  "policy_id": "wildfire-default-v1",
  "policy_version": "1.0.0",
  "outcome": "YES",
  "aggregated_value": 6.82,
  "threshold": 5.0,
  "bundle_hash": "sha256:a3f9…",
  "ipfs_cid": "bafybei…",
  "events_count": 8,
  "sources_summary": {
    "NASA_FIRMS": { "event_count": 3, "mean_confidence": 0.73, "max_severity": 0.7 },
    "EFFIS": { "event_count": 2, "mean_confidence": 0.85, "max_severity": 0.60 },
    "NOAA": { "event_count": 3, "mean_confidence": 0.78, "max_severity": 0.75 }
  }
}
```

### Deploy the on-chain ledger

```bash
cd contracts
npm install --legacy-peer-deps
npx hardhat test                                          # 14 tests
cp .env.example .env                                      # add PRIVATE_KEY + BASESCAN_API_KEY
npx hardhat run scripts/deploy.ts --network baseSepolia
# → ✓ ResolutionOracle deployed at 0x…
```

Submit a resolution signed off-chain by any `RESOLVER_ROLE` key: anyone can relay the tx. The contract verifies the EIP-712 signature, stores the result with a 24h dispute window, then finalizes.

---

## Architecture

```
src/veralith_pipeline/
├── ingestion/           BaseConnector + 5 sources
│   ├── nasa_firms.py    NASA FIRMS (MODIS/VIIRS fires)       api key
│   ├── effis.py         Copernicus EMS (Europe fires)        no key
│   ├── noaa.py          NOAA alerts (US weather+floods)      no key
│   ├── usgs.py          USGS earthquake catalog              no key
│   └── vigicrues.py     France flood warnings                no key
├── normalization/       NormalizedEvent (Pydantic v2) + transformers + validator
├── resolution/          PolicyEngine · EvidenceBuilder · ConflictResolver
│   └── policies/        wildfire.yaml · flood.yaml · earthquake.yaml
├── spatial/             Shapely: matching / buffers / intersections
└── storage/             IPFS (web3.storage) · Firestore · in-memory cache
api/                     FastAPI HTTP layer
contracts/               Solidity 0.8.24 + Hardhat (EIP-712 oracle ledger)
tests/                   77 tests (unit + integration, offline)
```

### Evidence Bundle (canonical)

Every resolution produces a deterministic JSON bundle. The bundle is hashed (SHA-256) and pinned to IPFS; the hash is what the smart contract stores.

```jsonc
{
  "bet_id": "california-wildfire-2026-summer",
  "policy_id": "wildfire-default-v1",
  "policy_version": "1.0.0",
  "outcome": "YES",
  "aggregated_value": 6.82,
  "threshold": 5.0,
  "timestamp": "2026-04-22T09:14:22+00:00",
  "events": [ /* NormalizedEvent[] */ ],
  "sources_summary": {
    "NASA_FIRMS": { "event_count": 3, "mean_confidence": 0.73, "max_severity": 0.70 }
  }
}
```

### Policy DSL (YAML, versioned)

No code — just configuration. A policy is a declarative artifact you can pin to IPFS alongside a market.

```yaml
id: wildfire-default-v1
version: 1.0.0
event_type: wildfire

aggregation: weighted_count        # count | sum_severity | max_severity | weighted_count
threshold: 5.0

allowed_sources: [NASA_FIRMS, EFFIS, NOAA]
min_sources_agree: 2               # quorum — protects against single-source manipulation
min_confidence: 0.5
```

Full spec: [`docs/POLICIES.md`](docs/POLICIES.md).

### Smart contract

```solidity
function submitResolution(
  bytes32 marketId,
  uint8 outcome,           // 0=NO, 1=YES, 2=INDETERMINATE
  uint16 confidence,       // basis points (7000 = 70% minimum)
  bytes32 evidenceHash,    // sha256 of canonical bundle
  string calldata ipfsCid,
  uint256 submittedAt,
  bytes calldata signature // EIP-712 signed by a RESOLVER_ROLE key
) external;
```

- **AccessControl**: `RESOLVER_ROLE`, `DISPUTER_ROLE`, `DEFAULT_ADMIN_ROLE`
- **State machine**: `NONE → PENDING → {CONFIRMED_TRUE, CONFIRMED_FALSE, UNRESOLVABLE, DISPUTED}`
- **Dispute window**: configurable (24h default)
- **Minimum confidence**: 70% enforced on-chain

---

## Determinism guarantee

Given the same tuple `(sources_snapshot, policy_version, region, period)`, the pipeline always produces the same `bundle_hash`.

This is enforced by CI: the integration test `test_pipeline_deterministic_3_runs` runs the pipeline three times and asserts all three SHA-256 hashes are identical. Ship breakage would break CI.

---

## Roadmap

- [ ] `packages/sdk/` — JS & Python client SDKs (verify proofs, submit on-chain)
- [ ] `packages/viewer/` — React component + Chrome extension for Polymarket overlay
- [ ] `apps/demo/` — Next.js landing page with live resolutions
- [ ] Multi-chain deploy (Arbitrum, Optimism, Linea)
- [ ] Premium connectors (Planet Labs, Maxar high-res)
- [ ] Multi-sig resolvers (Safe + threshold signatures)
- [ ] Reputation system & operator staking

---

## Contributing

The open components welcome PRs. For the proprietary bits, please open an issue for enterprise questions or email `founders@veralith.io`.

Please check [`docs/API.md`](docs/API.md) and [`docs/POLICIES.md`](docs/POLICIES.md) before submitting changes. Run `pytest` + `hardhat test` — they must stay green.

---

## License

- Open components: **MIT License**. See [LICENSE](LICENSE).
- Proprietary components: **Veralith Commercial License** — contact `founders@veralith.io`.

---

<p align="center">
  Built with ☀️ by <a href="https://veralith.io">Veralith</a>.<br/>
  <sub>Geospatial oracles don't need to be black boxes.</sub>
</p>
