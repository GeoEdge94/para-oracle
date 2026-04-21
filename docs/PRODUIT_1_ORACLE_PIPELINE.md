# Produit 1 — SpectralOracle Pipeline (repo autonome)

> **Nature** : Librairie + service + smart contract
> **Cible commerciale** : Polymarket, Kalshi, Augur, Gnosis, Drift
> **Positionnement** : Oracle geospatial deterministe as-a-Service
> **Statut** : Spec v1.0 — en attente de validation

---

## 1. VISION & PROPOSITION DE VALEUR

### Problematique actuelle des marches de prediction environnementaux

Les prediction markets comme Polymarket resolvent aujourd'hui **manuellement** les questions environnementales :
- "La deforestation du Para depassera-t-elle 4200 km² au S1 2025 ?"
- "Y aura-t-il plus de 10 000 ha brules en Californie en ete 2026 ?"
- "La surface du Great Salt Lake sera-t-elle < 2400 km² en septembre ?"

**Problemes actuels** :
1. **Subjectivite** : la resolution depend d'un oracle humain (Twitter, article de presse)
2. **Manipulation** : possible via sources d'information biaisees
3. **Delai** : jusqu'a plusieurs semaines entre la fin de la periode et la resolution
4. **Pas d'audit visuel** : l'utilisateur doit faire confiance, pas de preuve graphique

### Notre solution : SpectralOracle

Un **oracle deterministe** qui :
1. Prend en entree une question normalisee (region, periode, indice spectral, seuil)
2. Recupere les images satellite Sentinel-2 L2A de la periode
3. Calcule un indice spectral (NDVI, NBR, NDWI...) sur les composites T0 et T1
4. Applique un masque sur le changement (delta)
5. Agrege la surface affectee
6. Compare au seuil → retourne YES/NO avec **preuves SHA-256 + CID IPFS**
7. Signe le resultat en **EIP-712** pour publication on-chain

**Garanties** :
- **Deterministe** : memes entrees → memes sorties, rejouable indefiniment
- **Auditable** : 5 hashes + CID IPFS, tout le monde peut verifier
- **Rapide** : resolution en quelques minutes apres J+2 de la fin de periode
- **Sans confiance** : le smart contract verifie la signature et publie le resultat

---

## 2. CIBLE & MARCHE

### Clients primaires

| Client | Taille | Besoin | Prix cible |
|--------|--------|--------|-----------|
| Polymarket | 1B$ volume/an | Oracle auto pour ~50 marches environnementaux/an | 500-5 000 USD / resolution |
| Kalshi | Regulated US | Oracle CFTC-compliant | 1 000-10 000 USD / resolution |
| Augur / Gnosis | DeFi | Oracle on-chain EVM | 100-500 USD / resolution + gas |
| Drift / dYdX | Perp/futures | Oracle continu (streaming) | SaaS 5-50k USD / mois |
| ONGs / Institutions | WWF, Greenpeace, CNES | Monitoring deterministe | Licensing enterprise |

### Cible secondaire

- **Sociétés carbone** (verification offsets forestiers)
- **Assureurs parametriques** (Swiss Re, Munich Re, Skyline Partners)
- **Gouvernements** (IBAMA Bresil, NOAA, ESA)

### Marche total

- Prediction market environnemental : ~100M$ volume/an (estime)
- Carbon credits verification : ~500M$/an
- Parametric insurance : ~5B$/an

Notre TAM (Total Addressable Market) : ~5.6B$.
Notre SAM (Serviceable) : ~200M$ (prediction + carbon).
Notre SOM (Obtainable 3 ans) : ~5-10M$ ARR.

---

## 3. ANALYSE ARCHITECTURE

### 3.1 Separation repo actuel vs nouveau repo

**Repo actuel** `para-oracle` (conserver comme demo/vitrine) :
- Frontend + Backend + DB + Docker
- Objectif : demontrer la vision complete a un investisseur/client

**Nouveau repo** `spectral-oracle` (produit commercialisable) :
- **Monorepo** avec 4 packages
- Publiable npm + PyPI + Docker Hub + verifie Etherscan
- Licence : MIT pour le core, Commercial pour le service hosted

### 3.2 Architecture monorepo

```
spectral-oracle/
├── packages/
│   ├── core/                       # Python — SpectralPipeline
│   │   ├── spectral_oracle/
│   │   │   ├── __init__.py
│   │   │   ├── pipeline.py         # SpectralPipeline class (8 indices)
│   │   │   ├── formulas.py         # NDVI, EVI, NBR, NDWI, etc.
│   │   │   ├── copernicus.py       # STAC client + Sentinel Hub Process API
│   │   │   ├── raster.py           # rioxarray processing
│   │   │   ├── proof.py            # SHA-256, IPFS pinning, EIP-712
│   │   │   └── bets.py             # BetConfig dataclass + YAML loader
│   │   ├── tests/                  # pytest (28+ existing)
│   │   ├── pyproject.toml
│   │   └── README.md
│   │
│   ├── api/                        # FastAPI service
│   │   ├── app/
│   │   │   ├── main.py             # FastAPI app
│   │   │   ├── routers/
│   │   │   │   ├── resolve.py      # POST /resolve (sync + async)
│   │   │   │   ├── verify.py       # GET /verify/{proof_id}
│   │   │   │   └── catalog.py      # GET /catalog (bets pre-seeded)
│   │   │   └── services/
│   │   │       ├── pipeline.py     # wraps core/
│   │   │       └── queue.py        # Redis/RabbitMQ for async
│   │   ├── Dockerfile
│   │   └── docker-compose.yml
│   │
│   ├── cli/                        # spectral-oracle CLI
│   │   ├── bin/spectral-oracle
│   │   ├── commands/
│   │   │   ├── resolve.py          # spectral-oracle resolve bet.yaml
│   │   │   ├── verify.py           # spectral-oracle verify proof.json
│   │   │   └── init.py             # spectral-oracle init my-bet
│   │   └── pyproject.toml
│   │
│   └── contracts/                  # Solidity + Foundry
│       ├── src/
│       │   ├── SpectralOracle.sol  # Main contract
│       │   ├── OracleRegistry.sol  # Registered oracles
│       │   └── BetResolver.sol     # Per-bet resolution logic
│       ├── test/
│       ├── script/
│       │   └── Deploy.s.sol        # Deploy Sepolia/Base/Polygon
│       └── foundry.toml
│
├── sdks/
│   ├── js/                         # @spectral-oracle/client (npm)
│   │   ├── src/
│   │   │   ├── client.ts
│   │   │   ├── types.ts
│   │   │   └── verifier.ts
│   │   └── package.json
│   │
│   └── py/                         # spectral-oracle-client (PyPI)
│       └── pyproject.toml
│
├── specs/
│   ├── bet-config.schema.yaml      # JSON schema pour BetConfig
│   ├── proof.schema.yaml           # Schema de la preuve
│   └── eip712.typeddata.json       # Structure typed data signature
│
├── examples/
│   ├── deforestation-para.yaml
│   ├── wildfire-california.yaml
│   ├── flood-assam.yaml
│   ├── drought-great-salt-lake.yaml
│   └── glacier-aletsch.yaml
│
├── catalog/                        # Pre-seeded bets ready to use
│   ├── regions/                    # MultiPolygon GeoJSON par region
│   │   ├── para.geojson
│   │   ├── rondonia.geojson
│   │   ├── california.geojson
│   │   └── ...
│   └── bets/                       # Config templates par categorie
│       ├── deforestation.tmpl.yaml
│       ├── wildfire.tmpl.yaml
│       └── ...
│
└── docs/
    ├── ARCHITECTURE.md
    ├── API.md
    ├── INTEGRATION_POLYMARKET.md
    ├── DETERMINISM.md
    └── AUDIT_GUIDE.md
```

### 3.3 Schema BetConfig standardise

```yaml
# examples/deforestation-para.yaml
version: 1
id: para-deforestation-2025-s1
title:
  en: Will Para deforestation exceed 4,200 km² between Jan-Jun 2025?
  fr: La deforestation du Para depassera-t-elle 4 200 km² entre jan-jun 2025 ?

region:
  name: Para, Brazil
  geometry_ref: catalog/regions/para.geojson  # ou inline GeoJSON

period:
  start: 2025-01-01
  end: 2025-06-30
  revisit_delay_days: 2

spectral:
  index: NDVI                    # NDVI | EVI | NBR | NDWI | MNDWI | NDBI | BSI | NDSI
  change_direction: decrease     # decrease | increase | absolute
  change_threshold: 0.3          # par-pixel seuil
  composite_method: median       # median | mean | max
  composite_window_days: 15

resolution:
  threshold_value: 4200.0
  threshold_unit: km2            # km2 | ha | percent | pixels

data_source:
  provider: sentinel-hub         # copernicus-stac | sentinel-hub | nasa-hls
  max_cloud_cover: 20.0
  min_valid_pixels_pct: 80

ground_truth:
  sources:
    - PRODES
    - DETER
    - HANSEN

proof:
  hash_algo: sha256
  pin_to_ipfs: true
  sign_eip712: true
  chain_id: 11155111            # Sepolia par defaut

oracle_signer:
  address: 0x...                # wallet de l'oracle signer
```

### 3.4 Format de preuve standardise

```json
{
  "version": "1.0.0",
  "bet_id": "para-deforestation-2025-s1",
  "config_hash": "sha256:...",
  "resolved_at": "2025-07-02T14:23:11Z",
  "script_version": "spectral-pipeline-v2.0.0",
  "script_hash": "sha256:...",
  "outcome": {
    "value": true,
    "label": "YES",
    "measured_surface": 5052.79,
    "measured_unit": "km2",
    "threshold": 4200.0
  },
  "evidence": {
    "index_type": "NDVI",
    "bands": ["B04", "B08"],
    "t0_hash": "sha256:...",
    "t1_hash": "sha256:...",
    "delta_hash": "sha256:...",
    "mask_hash": "sha256:...",
    "sentinel_products_t0": ["S2A_MSIL2A_..."],
    "sentinel_products_t1": ["S2B_MSIL2A_..."],
    "stac_uris": [...],
    "cloud_coverage_mean": 8.42,
    "pixels_processed": 50527900,
    "ipfs_cid": "bafybei..."
  },
  "signature": {
    "type": "EIP-712",
    "chain_id": 11155111,
    "contract": "0x...",
    "signer": "0x...",
    "typed_data_hash": "0x...",
    "r": "0x...",
    "s": "0x...",
    "v": 27
  }
}
```

### 3.5 Smart contract SpectralOracle.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract SpectralOracle is EIP712 {
    struct Resolution {
        bytes32 betId;
        bool outcomeYes;
        uint256 measuredValue;
        bytes32 evidenceHash;
        string ipfsCid;
        uint256 timestamp;
    }

    bytes32 private constant RESOLUTION_TYPEHASH = keccak256(
        "Resolution(bytes32 betId,bool outcomeYes,uint256 measuredValue,bytes32 evidenceHash,string ipfsCid,uint256 timestamp)"
    );

    mapping(bytes32 => Resolution) public resolutions;
    mapping(address => bool) public authorizedOracles;

    event Resolved(bytes32 indexed betId, bool outcomeYes, uint256 measuredValue, string ipfsCid);

    constructor() EIP712("SpectralOracle", "1") {}

    function submitResolution(
        Resolution calldata res,
        bytes calldata signature
    ) external {
        bytes32 structHash = keccak256(abi.encode(
            RESOLUTION_TYPEHASH,
            res.betId,
            res.outcomeYes,
            res.measuredValue,
            res.evidenceHash,
            keccak256(bytes(res.ipfsCid)),
            res.timestamp
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);
        require(authorizedOracles[signer], "Unauthorized oracle");
        require(resolutions[res.betId].timestamp == 0, "Already resolved");

        resolutions[res.betId] = res;
        emit Resolved(res.betId, res.outcomeYes, res.measuredValue, res.ipfsCid);
    }
}
```

---

## 4. CAHIER DES CHARGES FONCTIONNEL

### 4.1 Fonctionnalites MVP (v1.0)

| ID | Fonctionnalite | Priorite |
|----|----------------|----------|
| F-01 | Chargement BetConfig YAML + validation JSON schema | P0 |
| F-02 | Pipeline spectral 8 indices (NDVI, NBR, NDWI, BSI, NDSI, NDBI, EVI, MNDWI) | P0 |
| F-03 | Mode mock deterministe (seed = bet_id) pour tests | P0 |
| F-04 | Mode reel via Sentinel Hub Process API | P0 |
| F-05 | Hash SHA-256 de tous les rasters intermediaires | P0 |
| F-06 | Pin IPFS des rasters (web3.storage ou Pinata) | P0 |
| F-07 | Signature EIP-712 du resultat | P0 |
| F-08 | REST API /resolve + /verify + /catalog | P0 |
| F-09 | CLI spectral-oracle resolve / verify / init | P0 |
| F-10 | 31 bets pre-seedes dans le catalog | P1 |
| F-11 | SDK JavaScript (@spectral-oracle/client) | P1 |
| F-12 | SDK Python (spectral-oracle-client) | P1 |
| F-13 | Smart contract SpectralOracle.sol deploye Sepolia | P1 |
| F-14 | Async queue pour resolutions longues (Redis + Celery) | P1 |
| F-15 | Dashboard metriques (Prometheus + Grafana) | P2 |
| F-16 | Multi-chain deploy (Base, Polygon, Arbitrum) | P2 |

### 4.2 User stories oracle provider

**US-01** : *En tant qu'operateur de prediction market, je veux envoyer une BetConfig YAML et recevoir une preuve signee prete pour le smart contract.*

**US-02** : *En tant que developpeur, je veux integrer l'oracle via npm install @spectral-oracle/client en 5 lignes.*

**US-03** : *En tant que user, je veux verifier independamment une resolution en telechargeant la preuve IPFS et en rejouant le hash.*

**US-04** : *En tant que DAO/multisig, je veux que les resolutions ne puissent etre soumises que par des oracles autorises on-chain.*

### 4.3 Critères d'acceptation

- Reproductibilite : 3 runs identiques → memes hashes (verifie par CI)
- Latence : resolution < 5 minutes pour un bet sur une region de 1M km²
- Disponibilite : 99.5% (SLO)
- Couverture test : > 85%
- Documentation : 100% endpoints + 100% fonctions publiques

---

## 5. CAHIER DES CHARGES TECHNIQUE

### 5.1 Stack

| Layer | Technologie | Justification |
|-------|-------------|---------------|
| Core lang | Python 3.12 | Ecosysteme geospatial (rasterio, rioxarray, shapely) |
| Raster proc | rioxarray + dask | Scaling sur grands rasters |
| API | FastAPI + Pydantic v2 | Auto-docs OpenAPI, validation |
| Async | Celery + Redis | Resolutions longues en background |
| Container | Docker + Docker Compose | Deploy trivial |
| DB (optional) | PostgreSQL + PostGIS | Catalog persistent si besoin |
| Storage | S3 / Cloudflare R2 | Rasters caches |
| IPFS | web3.storage API | Pinning gratuit jusqu'a 1 TB |
| Smart contract | Solidity 0.8.24 + Foundry | Tests rapides |
| SDK JS | TypeScript 5 + viem | Verifier signatures |
| SDK Py | pydantic + httpx | Compatible asyncio |

### 5.2 Infrastructure deploiement

**Phase 1 : Self-hosted** (dev + pilote)
- Docker Compose sur VPS Hetzner (20 EUR/mois)
- Cloudflare en front (gratuit)
- PostgreSQL managed ou self-hosted

**Phase 2 : SaaS** (scale)
- Kubernetes sur AWS EKS ou GCP GKE
- RDS PostgreSQL multi-AZ
- S3 pour tile cache
- API Gateway + rate limiting
- CloudFront CDN

**Phase 3 : Decentralized**
- Oracle node réplicable
- Multiple operators (consortium)
- Chainlink-style reputation

### 5.3 Securite

- Signature EIP-712 obligatoire
- Oracle keys stockees dans HSM ou Cloud KMS
- Multi-sig pour ajouter/revoquer oracles
- Rate limiting API (100 req/min par client)
- Audit smart contract (Spearbit, Trail of Bits)
- Bug bounty Immunefi (50k USD)

### 5.4 Determinisme

- Pin all dependencies (poetry.lock, package-lock.json)
- Docker image avec digest (pas tag)
- Script hash inclus dans la preuve
- Test CI : 3 runs sur 8 indices = 24 hashes comparees

---

## 6. INTEGRATION API (pour Polymarket et autres)

### 6.1 Endpoint `/resolve`

```http
POST /v1/resolve
Authorization: Bearer sk_live_...
Content-Type: application/json

{
  "bet_config": { ... },     // ou "bet_config_url": "ipfs://..."
  "webhook_url": "https://polymarket.com/oracles/callback",
  "async": true
}
```

Response (sync) :
```json
{
  "job_id": "res_01HXYZ...",
  "status": "completed",
  "proof": { ... },          // format spec 3.4
  "signature": { ... }
}
```

### 6.2 Endpoint `/verify`

```http
POST /v1/verify
Content-Type: application/json

{
  "proof": { ... }           // proof JSON complete
}
```

Response :
```json
{
  "valid": true,
  "signer_authorized": true,
  "ipfs_accessible": true,
  "rasters_match": true,
  "script_matches": true,
  "reproduced_outcome": "YES",
  "original_outcome": "YES"
}
```

### 6.3 SDK JavaScript

```typescript
import { SpectralOracle } from '@spectral-oracle/client';

const oracle = new SpectralOracle({ apiKey: 'sk_...' });

const proof = await oracle.resolve({
  bet_config: { /* ... */ }
});

// On-chain
const tx = await oracle.submitToChain(proof, { chainId: 11155111 });
```

---

## 7. MODELE BUSINESS

### 7.1 Pricing tiers

| Tier | Prix | Limit | Cible |
|------|------|-------|-------|
| **Free** | 0 | 5 resolutions/mois, mock-only | Devs, OSS |
| **Starter** | 99 USD/mois | 50 resolutions/mois | Small markets, chercheurs |
| **Pro** | 999 USD/mois | 500 resolutions/mois, SLA | Kalshi, Augur |
| **Enterprise** | Custom | Illimite, dedicated, audit | Polymarket, assureurs |
| **On-demand** | 5-50 USD / resolution | Pay as you go | Tests, pilotes |

### 7.2 Revenus complementaires

- **Consulting integration** : 10-50k USD par client
- **Custom bet design** : 2-5k USD par bet
- **White-label** : 10k USD setup + 3k USD/mois
- **Audit indépendant** : 500 USD / audit

### 7.3 Cibles ARR

| Annee | Clients | ARR | Note |
|-------|---------|-----|------|
| Y1 | 3 pilotes | 100k USD | Polymarket PoC + 2 small markets |
| Y2 | 10 clients | 1M USD | Expansion + carbon verif |
| Y3 | 25 clients | 5M USD | Multi-chain + enterprise |

---

## 8. TODO — ROADMAP PRIORISEE

### Sprint 1 (Semaine 1-2) — Extraction

- [ ] Creer repo GitHub `geoedge/spectral-oracle` (MIT)
- [ ] Extraire `packages/core/` depuis `para-oracle/backend/app/services/spectral_pipeline.py`
- [ ] Migrer 28 tests pytest (conserver 100% passing)
- [ ] Ajouter `BetConfig` dataclass + YAML loader
- [ ] Ajouter JSON schema `bet-config.schema.yaml`
- [ ] Documentation `README.md` niveau OSS

### Sprint 2 (Semaine 3-4) — CLI + API

- [ ] Package `packages/cli/` avec commandes resolve/verify/init
- [ ] Package `packages/api/` FastAPI autonome
- [ ] Docker image publie sur Docker Hub (`spectraloracle/api:v1.0`)
- [ ] Docker compose pour dev local

### Sprint 3 (Semaine 5-6) — Pipeline reel

- [ ] Implementer `spectral_oracle.sentinelhub.ProcessAPIClient`
- [ ] Brancher `_real_compute()` sur Sentinel Hub Process API
- [ ] Cache composites (S3 ou local) pour eviter recomputes
- [ ] Tests end-to-end avec credentials Sentinel Hub

### Sprint 4 (Semaine 7-8) — IPFS + signature

- [ ] Integration web3.storage pour pin IPFS
- [ ] EIP-712 signer en Python (eth_account)
- [ ] Format de preuve v1.0 finalise + schema JSON
- [ ] Endpoint `/verify` avec re-run partiel

### Sprint 5 (Semaine 9-10) — Smart contract

- [ ] `contracts/SpectralOracle.sol` avec tests Foundry
- [ ] Deploy Sepolia + Etherscan verification
- [ ] Deploy Base testnet + Polygon Amoy
- [ ] Script de publication `submitResolution()`

### Sprint 6 (Semaine 11-12) — SDKs

- [ ] `@spectral-oracle/client` publie npm
- [ ] `spectral-oracle-client` publie PyPI
- [ ] Documentation integration Polymarket
- [ ] 3 exemples integration (React, Node, Python)

### Sprint 7 (Semaine 13-14) — Catalog + sales ready

- [ ] Catalog de 31 bets pre-seedes
- [ ] Regions GeoJSON officielles (IBGE, Census, Eurostat)
- [ ] Templates par categorie (deforestation, wildfire, flood, ...)
- [ ] Landing page + pricing page + docs.spectral-oracle.io
- [ ] Deck commercial pour Polymarket (10 slides)

### Sprint 8 (Semaine 15-16) — Pilote Polymarket

- [ ] Identifier 3 marches Polymarket environnementaux actifs
- [ ] Proposer oracle resolution pour ces 3 marches
- [ ] Pitch call avec Polymarket team
- [ ] Signer LOI (Letter of Intent)
- [ ] Contrat pilote 3-6 mois, 50-200k USD

---

## 9. METRIQUES DE SUCCES

| Metrique | Cible 6 mois | Cible 12 mois |
|----------|--------------|---------------|
| GitHub stars | 500 | 5 000 |
| npm downloads / mois | 1 000 | 20 000 |
| Resolutions on-chain | 50 | 1 000 |
| Pilotes signes | 1 | 5 |
| ARR | 50k USD | 500k USD |
| Tests coverage | 85% | 90% |
| Uptime API | 99% | 99.9% |
| Documentation NPS | 7 | 9 |

---

## 10. RISQUES & MITIGATION

| Risque | Impact | Probabilite | Mitigation |
|--------|--------|-------------|------------|
| Sentinel Hub changement pricing | Moyen | Moyenne | Fallback sur Copernicus STAC (gratuit) |
| Polymarket refuse | Haut | Haute | Backup : Kalshi, Augur, DAOs |
| Determinisme casse par OS | Haut | Faible | Docker pinned + CI multi-OS |
| Exploit smart contract | Critique | Faible | Audit + bug bounty |
| Concurrence (API3, UMA) | Moyen | Haute | Specialisation geospatial |
| Regulation oracles | Moyen | Faible | Consultation juridique CFTC |
