# Plan d'implémentation — Pipeline Web3 Oracle (MVP Polygon Amoy)

## Contexte

La codebase `para-oracle` implémente aujourd'hui un oracle environnemental avec un pipeline déterministe `SpectralPipeline` (8 indices Sentinel-2, hashes SHA-256, mock IPFS CID) exposé via `POST /oracle/resolve/{bet_slug}`. Le socle FastAPI / PostgreSQL+PostGIS / React est solide pour les étapes 1-4 de [pipelineWeb3.md](pipelineWeb3.md) — mais **aucune brique Web3 réelle n'existe** : pas de client CDS météo, pas de normalisation canonique JSON, pas d'IPFS réel, pas de TLSNotary, pas de contrat Solidity, pas de bot de challenge.

Le besoin : ajouter un pipeline Web3 bout-en-bout compatible avec Polymarket et les assureurs paramétriques, où chaque résolution est auditable on-chain via trois CIDs IPFS (data, script, TLS proof) + un fingerprint SHA-256 ancré on-chain avec caution USDC et fenêtre de dispute de 48h.

**Scope MVP confirmé** : Polygon Amoy testnet, TLSNotary PSE (avec stub de fallback), Pinata free tier, une seule variable météo (`total_precipitation` ERA5-Land via CDS). Les deux pipelines (Sentinel-2 existant + nouveau Weather) coexistent. Stack : Solidity + Foundry pour le contrat, bot Python avec web3.py.

**Non inclus dans ce MVP** : UMA V3 (contract stocke l'état `DISPUTED` mais résolution admin manuelle), dispute UX frontend, Alembic, multi-variables météo (EFAS/GloFAS/soil-water en v2), mainnet, observabilité prod, multisig oracle.

---

## Architecture transverse

- **Quatre toggles env indépendants**, calqués sur `USE_MOCK_SENTINEL` : `USE_MOCK_CDS`, `USE_MOCK_IPFS`, `USE_MOCK_TLSNOTARY`, `USE_MOCK_CHAIN`. Chacun par défaut à `true`. Le endpoint resolve reste fonctionnel à chaque commit.
- **Interface commune** : `BasePipelineResult` (dataclass dans `backend/app/services/pipeline_base.py`) avec `outcome_yes`, `observed_value`, `threshold_value`, `data_normalized: dict`, `blobs: list[BlobRef]`, `params: dict`. `SpectralPipeline` (legacy, adapté) et `WeatherPipeline` (nouveau) émettent tous deux ce type.
- **Orchestrateur Web3** : un nouveau module `backend/app/services/web3_publisher.py::publish_resolution(result, bet)` appelé par le router oracle après le pipeline. Il chaîne : pin blobs → inject CIDs dans `data_normalized` → canonicalize → hash → TLSNotary → pin data.json + script + schema + proof → submit on-chain.
- **Déterminisme préservé** : `random.Random(f"{bet_slug}:{variable}")` pour WeatherPipeline mock, `Random(bet_slug)` pour SpectralPipeline existant. Fingerprint JSON canonique reproductible bit-à-bit.

### Stratégie de normalisation : JSON direct vs manifest de blobs

Deux formes de données, deux stratégies :

| Pipeline | Taille data | Stratégie |
|---|---|---|
| `WeatherPipeline` (ERA5-Land précipitation) | ~10-100 Ko de valeurs numériques | Sérialiser les valeurs directement dans `data.json` (array `values[]` arrondis 6 décimales). Fingerprint = SHA-256 du JSON canonique. |
| `SpectralPipeline` (rasters Sentinel-2) | 4 fichiers `.tif` de ~1-20 Mo chacun | Pin chaque `.tif` comme blob IPFS → récupérer le CID → construire un `data.json` manifest qui liste `{kind, cid, sha256, bbox}` pour chaque raster + les stats agrégées. Fingerprint = SHA-256 du manifest canonique. |

Dans les deux cas, `data.json` a la même structure top-level (`schema_version, pipeline_kind, bet_slug, period, fingerprint_inputs, result`). Seul le contenu de `fingerprint_inputs` diffère : valeurs brutes pour Weather, liste de blob refs pour Spectral.

---

## Adapter SpectralPipeline pour le pipeline Web3 (non-breaking)

L'existant [spectral_pipeline.py](backend/app/services/spectral_pipeline.py) produit déjà 5 hashes SHA-256 sur les rasters — 70% du travail est fait. Il manque :

1. **Exposer les blobs** — `PipelineResult.blobs: list[BlobRef]` où `BlobRef = {kind: "ndvi_t0"|"ndvi_t1"|"delta"|"mask", path: Path, sha256: str, bbox: list[float]}`. Les rasters sont déjà écrits par `_mock_compute()` ([ligne 190-200](backend/app/services/spectral_pipeline.py#L190-L200)) ; il suffit de les exporter dans la dataclass.
2. **Construire `data_normalized`** — nouvelle méthode `_build_manifest(blobs, stats)` retourne un dict :
   ```python
   {
     "schema_version": "v1",
     "pipeline_kind": "spectral",
     "bet_slug": cfg.bet_slug,
     "index_type": cfg.index_type,
     "period": {"start": ..., "end": ...},
     "region_bbox": [...],
     "fingerprint_inputs": {
       "rasters": [{"kind": "ndvi_t0", "cid": "<filled by publisher>", "sha256": "..."}, ...],
       "bands": ["B04", "B08"],
       "script_version": SCRIPT_VERSION
     },
     "result": {"outcome_yes": bool, "surface_km2": float, "pixels": int, "cloud_mean": float}
   }
   ```
   Les `cid` sont à `null` à la sortie du pipeline ; `web3_publisher` les remplit après avoir pinné chaque blob.
3. **`resolution_script.py` adapté spectral** — le script standalone doit :
   - Détecter `pipeline_kind == "spectral"` dans `data.json`
   - Pour chaque entrée `fingerprint_inputs.rasters[]`, re-fetch depuis IPFS gateway via `cid`
   - Recomputer SHA-256 du blob, asserter `== sha256` du manifest
   - Recomputer les stats (`surface_km2`) via `rioxarray` à partir des rasters téléchargés
   - Comparer au `result.surface_km2` et au seuil du bet → `outcome_yes`

   Pour rester stdlib-only sur Weather, le script conditionne l'import `rioxarray` au cas `pipeline_kind == "spectral"` (avec message d'erreur clair si manquant).
4. **Convertir les hashes legacy en nouvelle forme** — les colonnes `ndvi_t0_hash`, `ndvi_t1_hash`, `delta_hash`, `mask_hash` existantes ([analysis.py:31-34](backend/app/models/analysis.py#L31-L34)) restent remplies **en plus** des nouvelles colonnes (`data_cid`, `script_cid`, `schema_cid`, `tls_proof_cid`, `fingerprint_sha256`). Double write pendant la transition pour ne rien casser côté frontend existant. `ipfs_cid` devient alias de `data_cid`.
5. **`PipelineConfig` inchangée** — aucune modif des champs existants. L'adaptation est pure extension.

**Résultat** : un pari spectral (ex: `bet-lancement-02` déforestation) passe par exactement le même chemin Web3 qu'un pari météo — mêmes 3 CIDs, même fingerprint SHA-256, même submit on-chain, même challenge bot. Le bot télécharge automatiquement les rasters via leurs blob CIDs pour revalider.

**Toggle de compatibilité** : `USE_WEB3_PUBLISHING=false` (défaut `true`) désactive complètement le chaînage Web3 — `SpectralPipeline` fonctionne exactement comme avant M1 pour tous les paris existants.

---

## Milestone 1 — WeatherPipeline + normalisation + adaptation SpectralPipeline (Semaine 1)

Objectif : `POST /oracle/resolve/{bet_slug}` fonctionne E2E en full mock **pour les deux types de paris** (weather + spectral) avec un `fingerprint_sha256` reproductible.

**Créer**
- `backend/app/services/pipeline_base.py` — `BasePipelineResult` + `BlobRef` dataclass + helper `build_manifest(...)`.
- `backend/app/services/cds_client.py` — wrapper sur `cdsapi.Client().retrieve("reanalysis-era5-land", {...})`. Branche mock déterministe seed `Random(bet_slug)`.
- `backend/app/services/weather_pipeline.py` — `WeatherPipeline(config).run() -> BasePipelineResult`. Config : `variable: Literal["total_precipitation"]`, `aggregation: Literal["max","mean","sum"]`. `blobs = []` (pas de fichiers binaires), `data_normalized` contient les valeurs numériques directement.
- `backend/app/services/canonical.py` — `canonicalize(data: dict) -> bytes` (`json.dumps(data, sort_keys=True, separators=(",",":"), default=_round6)`), `fingerprint_sha256(data) -> "sha256:<hex>"`.
- `backend/app/services/schema_v1.py` + `data/schemas/schema_v1.json` (figé, versionné) — schéma générique qui supporte les deux formes `fingerprint_inputs`.

**Modifier**
- [backend/app/services/spectral_pipeline.py](backend/app/services/spectral_pipeline.py) — **adaptation non-breaking** :
  - `PipelineResult` étend/implémente `BasePipelineResult` (ajout `data_normalized: dict`, `blobs: list[BlobRef]`, `outcome_yes`, `observed_value`, `threshold_value`)
  - Nouvelle méthode `_build_manifest()` construit le dict décrit dans la section "Adapter SpectralPipeline"
  - Les champs legacy (`ndvi_t0_hash`, `delta_hash`, etc.) restent remplis
- [backend/app/models/bet.py](backend/app/models/bet.py) — ajouter `pipeline_kind: String(20) default 'spectral'` (values: `spectral | weather`).
- [backend/app/routers/oracle.py](backend/app/routers/oracle.py#L42) — brancher sur `bet.pipeline_kind` pour choisir le pipeline. Ajouter `fingerprint_sha256` dans `OracleResult.evidence`. Conservation backward-compat : les paris existants avec `pipeline_kind='spectral'` passent toujours.
- [backend/requirements.txt](backend/requirements.txt) — `+cdsapi==0.7.4`.
- `db/init/04-web3.sql` (nouveau) — `ALTER TABLE bets ADD COLUMN pipeline_kind VARCHAR(20) NOT NULL DEFAULT 'spectral';` + seed `precip-amoy-testnet-01`.

**Env vars** : `CDS_API_URL`, `CDS_API_KEY`, `USE_MOCK_CDS=true`, `USE_WEB3_PUBLISHING=true`.

---

## Milestone 2 — IPFS pinning + resolution_script standalone (Semaine 2)

Objectif : trois CIDs atterrissent dans la ligne `analyses` ; le `resolution_script.py` publié est runnable standalone et reproduit le même `outcome_yes`.

**Créer**
- `backend/app/services/ipfs_client.py` — `IPFSClient.pin_bytes(name, content)` et `.pin_json(name, obj)`. Backends `mock` (reprend `_mock_ipfs_cid` de [spectral_pipeline.py:242](backend/app/services/spectral_pipeline.py#L242)) et `pinata` (POST `https://api.pinata.cloud/pinning/pinFileToIPFS`).
- `scripts/resolution_script.py` (racine repo, **zéro import** `app.*`) — signature `python resolution_script.py data.json --threshold 30 --direction gte`. Recompute fingerprint, assert égalité, applique seuil, printe `{outcome_yes, observed_value, fingerprint_sha256}`. Stdlib only.
- `scripts/tests/test_resolution_script.py` — subprocess + canned `data.json`.
- `backend/app/services/web3_publisher.py` — orchestrateur.

**Modifier**
- [backend/app/models/analysis.py](backend/app/models/analysis.py) + `backend/app/schemas/analysis.py` — ajouter colonnes (voir SQL ci-dessous).
- [backend/app/routers/oracle.py](backend/app/routers/oracle.py) — appeler `web3_publisher.publish_resolution(...)` après le pipeline.
- `db/init/04-web3.sql` — étendre :
  ```sql
  ALTER TABLE analyses
    ADD COLUMN data_cid VARCHAR(100),
    ADD COLUMN script_cid VARCHAR(100),
    ADD COLUMN schema_cid VARCHAR(100),
    ADD COLUMN tls_proof_cid VARCHAR(100),
    ADD COLUMN fingerprint_sha256 VARCHAR(80),
    ADD COLUMN chain_tx_hash VARCHAR(80),
    ADD COLUMN bond_amount_usdc NUMERIC(18,6),
    ADD COLUMN dispute_window_end TIMESTAMPTZ,
    ADD COLUMN dispute_status VARCHAR(20) DEFAULT 'NONE';
  ```

**Env vars** : `USE_MOCK_IPFS=true`, `PINATA_JWT`, `IPFS_GATEWAY_URL=https://gateway.pinata.cloud/ipfs/`, `SCHEMA_V1_CID` (cache).

---

## Milestone 3 — Smart contract Solidity + chain client (Semaines 2-3, parallèle M2)

Objectif : `submitResolution(...)` sur Polygon Amoy, dispute window 48h, bond USDC.

**Créer**
- `contracts/foundry.toml` — layout Foundry standard.
- `contracts/src/ParaOracle.sol` — state machine `PENDING → FINALIZED` (timer 48h) ou `PENDING → DISPUTED` (fonds gelés, admin résout). `mapping(bytes32 => Resolution)` keyé sur `keccak256(betSlugHash, periodEnd)`. Events `ResolutionSubmitted`, `ResolutionDisputed`, `ResolutionFinalized`. USDC via `IERC20.transferFrom`.
- `contracts/src/interfaces/IParaOracle.sol`.
- `contracts/test/ParaOracle.t.sol` — happy path, double-submit, dispute avant window, finalize après window, bond refund/slash.
- `contracts/script/Deploy.s.sol` — forge script (env : `USDC_ADDR`, `BOND_AMOUNT`, `DISPUTE_WINDOW_SECONDS`).
- `backend/app/services/chain_client.py` — `ChainClient.submit_resolution(bundle, outcome, observed, threshold, period_end) -> tx_hash`. Mock : fake tx hash déterministe depuis fingerprint.

**Modifier**
- `backend/app/services/web3_publisher.py` — après pin, call `chain_client.submit_resolution(...)` → persist `chain_tx_hash`, `bond_amount_usdc`, `dispute_window_end = now + 48h`, `dispute_status = 'PENDING'`.
- [backend/app/routers/oracle.py](backend/app/routers/oracle.py) — inclure `chain_tx_hash` + CIDs dans `OracleResult.evidence`.
- [backend/requirements.txt](backend/requirements.txt) — `+web3==7.5.0`, `+eth-account==0.13.0`.

**Env vars** : `USE_MOCK_CHAIN=true`, `CHAIN_RPC_URL=https://rpc-amoy.polygon.technology`, `CHAIN_ID=80002`, `ORACLE_PRIVATE_KEY`, `PARA_ORACLE_ADDRESS`, `USDC_ADDRESS`, `BOND_AMOUNT_USDC=500`, `DISPUTE_WINDOW_SECONDS=172800`.

---

## Milestone 4 — Challenge bot + TLSNotary stub (Semaines 3-4)

Objectif : process indépendant qui rejoue la résolution depuis les events on-chain et disputerait sur divergence. TLSNotary livré comme stub structurellement correct avec piste PoC PSE en parallèle.

**Créer**
- `bot/challenger.py` (racine repo, **pas** sous `backend/`) — subscribe aux events `ResolutionSubmitted` via web3.py, fetch `dataCID` + `scriptCID` via gateway IPFS, run `python resolution_script.py data.json`, compare au résultat on-chain. Sur divergence : `ParaOracle.dispute(...)` avec bond.
- `bot/requirements.txt` — `web3`, `httpx`, `eth-account`. **Pas** de FastAPI/SQLAlchemy (bot doit être reproductible par un tiers).
- `bot/Dockerfile` + service optionnel dans `docker-compose.yml` (profile `bot`).
- `backend/app/services/tlsnotary_client.py` — `TLSNotaryClient.notarize(url, params) -> bytes`. Mock : JSON envelope `{version, server, request_hash, notary: "stub", signature: "stub"}`. Real : `NotImplementedError("PSE notary — voir docs/tlsnotary.md")`.
- `docs/tlsnotary.md` — plan de repli si PSE glisse : MVP ship avec stub + label bet `beta-no-tls-proof`, spike séparé post-MVP.

**Modifier**
- `backend/app/services/web3_publisher.py` — entre canonicalize et pin, appeler `tlsnotary_client.notarize(...)` sur la requête CDS ; pin la proof ; inclure `tls_proof_cid` dans `data.json` + payload on-chain.
- [frontend/](frontend/) (minimal) — bet detail view affiche `chain_tx_hash` (link polygonscan), 3 CIDs (links Pinata gateway), countdown `dispute_window_end`. **Pas** de bouton Dispute en MVP.

**Env vars** : `USE_MOCK_TLSNOTARY=true`, `TLSNOTARY_NOTARY_URL`, `CHALLENGER_PRIVATE_KEY`, `CHALLENGER_POLL_SECONDS=30`.

---

## Fichiers critiques à modifier

- [backend/app/routers/oracle.py](backend/app/routers/oracle.py) — point d'entrée, appelle `web3_publisher`
- [backend/app/services/spectral_pipeline.py](backend/app/services/spectral_pipeline.py) — refactor vers `BasePipelineResult` (non-breaking)
- [backend/app/models/analysis.py](backend/app/models/analysis.py) + [backend/app/models/bet.py](backend/app/models/bet.py) — nouvelles colonnes
- [backend/app/core/config.py](backend/app/core/config.py) — env vars Web3
- [backend/requirements.txt](backend/requirements.txt) — `cdsapi`, `web3`, `eth-account`
- [db/init/04-web3.sql](db/init/) — nouvelle migration SQL
- [docker-compose.yml](docker-compose.yml) — service `bot` optionnel (profile)

## Fichiers/modules à créer

- `backend/app/services/` : `pipeline_base.py`, `cds_client.py`, `weather_pipeline.py`, `canonical.py`, `schema_v1.py`, `ipfs_client.py`, `web3_publisher.py`, `chain_client.py`, `tlsnotary_client.py`
- `scripts/resolution_script.py` + tests (stdlib only, zéro dépendance backend)
- `contracts/` : layout Foundry complet (`foundry.toml`, `src/`, `test/`, `script/`)
- `bot/` : `challenger.py`, `requirements.txt`, `Dockerfile`
- `data/schemas/schema_v1.json` (versionné, figé)
- `docs/tlsnotary.md`

## Patterns existants à réutiliser

- Pattern déterministe `random.Random(bet_slug)` ([spectral_pipeline.py:182](backend/app/services/spectral_pipeline.py#L182))
- Pattern mock CID `_mock_ipfs_cid` ([spectral_pipeline.py:242](backend/app/services/spectral_pipeline.py#L242))
- Pattern fallback credentials `use_mock = use_mock or not (id and secret)` ([copernicus_client.py:46](backend/app/services/copernicus_client.py#L46))
- Schema `OracleResult.evidence` dict extensible ([oracle.py:128-153](backend/app/routers/oracle.py#L128-L153))
- Pydantic v2 + `from_attributes=True`, `settings` via pydantic-settings

---

## Vérification E2E

**Après M1** :
```bash
docker compose up db backend
# Pari weather (nouveau)
curl -X POST localhost:8000/oracle/resolve/precip-amoy-testnet-01
# Pari spectral existant (doit continuer à fonctionner + produire fingerprint_sha256)
curl -X POST localhost:8000/oracle/resolve/bet-lancement-02
```
Relancer sur DB fraîche deux fois ; `evidence.fingerprint_sha256` doit être byte-identique sur les deux types de paris. Vérifier que les anciens champs (`ndvi_t0_hash`, etc.) sont toujours remplis pour le spectral (double write).

**Après M2** :
Flip `USE_MOCK_IPFS=false`, resolve, télécharger `https://gateway.pinata.cloud/ipfs/<data_cid>`, puis :
```bash
python scripts/resolution_script.py data.json --threshold 30 --direction gte
```
Le `outcome_yes` doit matcher la ligne DB.

**Après M3** :
```bash
cd contracts && forge test
forge script Deploy --broadcast --rpc-url amoy
```
Faucet Amoy + test-USDC faucet pour l'oracle wallet. Resolve, inspecter tx sur `amoy.polygonscan.com`. Vérifier events `ResolutionSubmitted`, state `PENDING`, `dispute_window_end = now + 48h`.

**Après M4** :
```bash
docker compose --profile bot up bot
```
Resolve un bet → log bot "outcome matches, no dispute". Puis submit manuellement une résolution avec `outcome` inversé via `cast` → bot doit appeler `ParaOracle.dispute(...)` et un event `ResolutionDisputed` doit apparaître on-chain.

## Risques & fallbacks

- **TLSNotary** (risque le plus élevé) : mitigé par toggle + stub shape-compatible. Si PSE glisse, MVP ship avec `USE_MOCK_TLSNOTARY=true` et label `beta-no-tls-proof`.
- **CDS API queue time** (ERA5-Land requests peuvent attendre plusieurs minutes) : accepter waits synchrones ≤2min ou fallback mock en démo. Pattern async en v2.
- **Pinata free tier** (1 GB, 500 pins/mois) : suffisant MVP. Cache disque pour pinner `schema_v1.json` et `resolution_script.py` une seule fois.
- **Déterminisme WeatherPipeline real mode** : ERA5-Land values peuvent être révisées. Pinner la requête exacte (incl. `expver`) dans le payload TLS-notarisé ; fingerprint couvre les bytes reçus, pas la requête.
- **Collisions mock CID vs réels** : le prefix mock est non-canonique (`bafybei` + hex tronqué), facile à distinguer en audit DB.

---

## Suivi d'implémentation

Chaque étape implémentée est documentée dans `docs/web3/` :

- `docs/web3/m1-<task>.md` — M1 WeatherPipeline + normalisation + adaptation SpectralPipeline
- `docs/web3/m2-<task>.md` — M2 IPFS + resolution_script standalone
- `docs/web3/m3-<task>.md` — M3 Smart contract Solidity + chain client
- `docs/web3/m4-<task>.md` — M4 Challenge bot + TLSNotary stub

Chaque fichier contient : fichiers créés/modifiés, choix techniques pris, commandes de test, résultats observés.
