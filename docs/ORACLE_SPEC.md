# Oracle Spec — ParaOracle on-chain

## Format JSON produit par le backend

Apres `POST /oracle/resolve/{bet_slug}` :

```json
{
  "bet_id": "para-deforestation-2025-s1",
  "resolved_outcome": "YES",
  "surface_deforestee_km2": 4867.32,
  "threshold_km2": 4200.0,
  "resolution_timestamp": "2025-07-02T14:30:00Z",
  "evidence": {
    "script_hash": "sha256:1a2b3c4d...",
    "ndvi_t0_hash": "sha256:e5f6g7h8...",
    "ndvi_t1_hash": "sha256:i9j0k1l2...",
    "delta_hash": "sha256:m3n4o5p6...",
    "mask_hash": "sha256:q7r8s9t0...",
    "sentinel_products_t0": ["S2A_MSIL2A_20250105T134201_N0511_R124_T22LDH_...", "..."],
    "sentinel_products_t1": ["S2B_MSIL2A_20250628T134159_N0511_R124_T22LDH_...", "..."],
    "stac_uris": ["https://catalogue.dataspace.copernicus.eu/stac/collections/SENTINEL-2/items/...", "..."],
    "ipfs_cid": "bafybeigxy123...",
    "period": { "start": "2025-01-01", "end": "2025-06-30" },
    "analysis_id": "uuid-..."
  }
}
```

## Smart contract (pseudo-Solidity)

Interface minimale a consommer cote on-chain :

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ParaOracle {
    enum Outcome { UNRESOLVED, YES, NO }

    struct Resolution {
        bytes32 scriptHash;
        bytes32 evidenceRoot;     // Merkle root of all evidence hashes
        uint256 surfaceKm2x100;   // km2 * 100 to keep precision
        uint256 thresholdKm2;
        uint64  resolutionTs;
        string  ipfsCid;
        Outcome outcome;
    }

    address public immutable oracleSigner;
    mapping(bytes32 => Resolution) public resolutions;  // key = keccak256(betId)

    event Resolved(bytes32 indexed betKey, Outcome outcome, uint256 surfaceKm2x100, string ipfsCid);

    constructor(address _oracleSigner) {
        oracleSigner = _oracleSigner;
    }

    /// Le backend signe un message (EIP-712) puis le publie on-chain
    function publishResolution(
        string calldata betId,
        Outcome outcome,
        uint256 surfaceKm2x100,
        uint256 thresholdKm2,
        uint64 resolutionTs,
        bytes32 scriptHash,
        bytes32 evidenceRoot,
        string calldata ipfsCid,
        bytes calldata signature
    ) external {
        require(outcome != Outcome.UNRESOLVED, "invalid");

        bytes32 digest = keccak256(abi.encodePacked(
            betId, outcome, surfaceKm2x100, thresholdKm2, resolutionTs, scriptHash, evidenceRoot, ipfsCid
        ));
        address signer = _recover(digest, signature);
        require(signer == oracleSigner, "bad signer");

        bytes32 key = keccak256(bytes(betId));
        require(resolutions[key].outcome == Outcome.UNRESOLVED, "already resolved");

        resolutions[key] = Resolution({
            scriptHash: scriptHash,
            evidenceRoot: evidenceRoot,
            surfaceKm2x100: surfaceKm2x100,
            thresholdKm2: thresholdKm2,
            resolutionTs: resolutionTs,
            ipfsCid: ipfsCid,
            outcome: outcome
        });

        emit Resolved(key, outcome, surfaceKm2x100, ipfsCid);
    }

    function getResolution(string calldata betId) external view returns (Resolution memory) {
        return resolutions[keccak256(bytes(betId))];
    }

    function _recover(bytes32 digest, bytes memory sig) internal pure returns (address) {
        // ecrecover avec EIP-191 prefix... (simplifie)
    }
}
```

## Verification publique

N'importe qui peut :

1. Recuperer les rasters via IPFS (CID)
2. Re-executer le pipeline (meme hash script = code identique)
3. Recalculer les hashes → comparer a `resolutions[betId].evidenceRoot`
4. Si identique → la resolution est auditable et reproductible

## Flux complet

```
Backend pipeline               Smart contract
──────────────────             ──────────────

POST /oracle/resolve
  │
  ├─► NDVIPipeline.run()
  │     ├─► Sentinel-2 fetch
  │     ├─► NDVI composites
  │     ├─► Delta + mask
  │     └─► Hashes SHA-256
  │
  ├─► Insert analyses (DB)
  ├─► Update bet (status, result)
  │
  ├─► Upload raster archive → IPFS
  │     └─► CID obtenu
  │
  ├─► Sign EIP-712 payload
  │     (privkey du oracleSigner)
  │
  └─► Call publishResolution() ───► on-chain verification
                                     ├─► Check signer == oracleSigner
                                     ├─► Check not already resolved
                                     └─► Emit Resolved event
                                          │
                                          ▼
                                     Indexers / markets
                                     reagissent au YES/NO
```
