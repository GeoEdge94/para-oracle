# Plan ADLC — Organisation en Bet Cards

**Convention** : chaque tache = bet card. On parie sur une hypothese, on mesure des criteres de succes, on cloture en WIN/LOSS.

## Mapping ADLC → livrables

| Phase | Focus | Livrables cles |
|---|---|---|
| **A - Analyse** | Comprendre probleme et contraintes | Specs oracle, perimetre pari, sources Sentinel-2, regles metier |
| **D - Design** | Concevoir architecture et flux | Schema BDD, API contract, maquettes mobile, docker-compose |
| **L - Lancement** | Implementer et deployer | Backend, frontend, pipeline NDVI, docker stack, premiere resolution |
| **C - Controle** | Tester, valider, monitorer | Tests reproductibilite, pipeline CI, monitoring, rapport precision |

---

## Phase A — Analyse

### BET-ANALYSE-01 — Definir regles exactes de resolution

- **Hypothese** : Si on fixe precisement `seuil=4200 km²`, `Δ NDVI < -0.3`, `pixel=10m`, alors deux personnes independantes obtiennent le meme YES/NO.
- **Livrables** :
  - `docs/NDVI_PIPELINE.md` — formule NDVI, seuil, fenetre temporelle
  - Definition convention delta (T1 - T0)
  - Choix mediane temporelle (pas moyenne) pour le composite
- **Risques** : Ambiguite sur fenetre composite, desaccord sur seuil de masque
- **Dependances** : Aucune
- **Succes** : Specs validees, 0 ambiguite sur regle de resolution
- **Statut** : DONE

### BET-ANALYSE-02 — Identifier sources de donnees autorisees

- **Hypothese** : Copernicus Data Space Ecosystem (CDSE) couvre 100% du Para sur 2025 avec revisite 3-5j.
- **Livrables** :
  - Liste endpoints STAC/OData testes
  - Cle OAuth2 client_credentials obtenue (ou plan pour l'obtenir)
  - Estimation volume scenes S2 L2A sur Para 6 mois
- **Risques** : Quotas CDSE, latence T+48h non respectee, scenes nuageuses
- **Dependances** : BET-ANALYSE-01
- **Succes** : 100+ scenes listees sur Para pour S1 2025, temps revisite < 5j
- **Statut** : TODO

### BET-ANALYSE-03 — Cartographier acteurs et contraintes legales

- **Hypothese** : Pas d'obstacle legal a resoudre un marche via donnees publiques Copernicus.
- **Livrables** :
  - Note sur licences Copernicus (Free Open Data)
  - Note sur juridiction prediction markets
  - Note sur redistribution (OK si citation source)
- **Risques** : Licence ODbL stricte sur certaines couches, citation obligatoire
- **Dependances** : Aucune
- **Succes** : Plan de licensing clair
- **Statut** : TODO

---

## Phase D — Design

### BET-DESIGN-01 — Schema BDD PostGIS

- **Hypothese** : 5 tables (bets, analyses, raster_snapshots, layers, users_mock) suffisent pour stocker une resolution complete + preuves.
- **Livrables** :
  - `db/init/02-schema.sql`
  - `db/init/03-seed.sql` avec polygone Para + pari demo
- **Risques** : Types geom incorrects, manque d'index GIST
- **Dependances** : BET-ANALYSE-01
- **Succes** : `docker compose up db` cree sans erreur, seed s'execute
- **Statut** : DONE

### BET-DESIGN-02 — Contract API REST

- **Hypothese** : 5 routers (auth, bets, layers, oracle, analyses) couvrent 100% des cas d'usage frontend.
- **Livrables** :
  - Squelettes FastAPI routers
  - Schemas Pydantic (BetRead, OracleResult, LayerRead, etc.)
  - OpenAPI auto-genere sur /docs
- **Risques** : Oubli endpoint de metadata (/analyses), CORS mal configure
- **Dependances** : BET-DESIGN-01
- **Succes** : Frontend peut consommer tous les endpoints sans hack
- **Statut** : DONE

### BET-DESIGN-03 — UX mobile-first (3 ecrans)

- **Hypothese** : Login + Map + Analysis suffisent a demontrer le flow utilisateur complet.
- **Livrables** :
  - Composants React : Login, MapPage, Analysis, BetSheet, FAB
  - Palette sombre (#0f172a + accents #10b981)
  - Bottom sheet 50vh fixe
- **Risques** : Gestes tactiles mal geres, FAB chevauche bottom sheet
- **Dependances** : BET-DESIGN-02
- **Succes** : Test sur iPhone SE (375px) sans scroll horizontal
- **Statut** : DONE

### BET-DESIGN-04 — Docker Compose

- **Hypothese** : 4 services (db, backend, frontend, qgis-server optionnel) en un seul `docker compose up`.
- **Livrables** :
  - `docker-compose.yml`
  - `backend/Dockerfile` avec GDAL
  - `frontend/Dockerfile` node:20-alpine
- **Risques** : GDAL version mismatch avec rasterio, hot reload qui ne marche pas
- **Dependances** : BET-DESIGN-01, BET-DESIGN-02, BET-DESIGN-03
- **Succes** : `docker compose up --build` → 3 services UP en < 2 min
- **Statut** : DONE

---

## Phase L — Lancement

### BET-LANCEMENT-01 — Pipeline NDVI en mode mock

- **Hypothese** : Une version mock produit des hashes deterministes → prouve que la structure est bonne.
- **Livrables** :
  - `ndvi_pipeline.py` avec `USE_MOCK_SENTINEL=true`
  - `POST /oracle/resolve/para-deforestation-2025-s1` retourne YES/NO
  - Hashes stables entre deux runs
- **Risques** : PRNG non seede, timestamps dans le hash
- **Dependances** : BET-DESIGN-02
- **Succes** : Deux runs consecutifs produisent memes hashes
- **Statut** : DONE

### BET-LANCEMENT-02 — Pipeline NDVI reel

- **Hypothese** : Avec credentials Copernicus, on peut telecharger, calculer NDVI et arriver au meme resultat YES/NO qu'avec des rasters de reference deposes en DVC.
- **Livrables** :
  - `ndvi_pipeline._real_compute()` implemente
  - Scripts rioxarray/rasterio
  - Download assets S3 Copernicus
  - Stockage GeoTIFF local
- **Risques** : Bands B4/B8 manquantes, CRS non aligne, memoire OOM sur full Para
- **Dependances** : BET-ANALYSE-02, BET-LANCEMENT-01
- **Succes** : Run reel produit surface > 4000 km² cohernte avec rapports INPE/MapBiomas
- **Statut** : TODO

### BET-LANCEMENT-03 — Upload IPFS + signature on-chain

- **Hypothese** : Pin des rasters vers Pinata + signature EIP-712 cote backend → smart contract stockera correctement la resolution.
- **Livrables** :
  - Service `IPFSService` wrappant Pinata API
  - Signature EIP-712 avec key de demo
  - Contrat Solidity deploye sur testnet (Sepolia ou Polygon Mumbai)
- **Risques** : Quota Pinata, cle privee en clair
- **Dependances** : BET-LANCEMENT-01
- **Succes** : Transaction on-chain verifiable avec evidenceRoot correct
- **Statut** : TODO

### BET-LANCEMENT-04 — UX detaillee "Analyse NDVI"

- **Hypothese** : Layer toggles + panneau preuves permettent a un utilisateur non-tech de comprendre la resolution.
- **Livrables** :
  - Page `Analysis.tsx` avec toggles NDVI T0/T1/Delta/Mask
  - Panneau preuves avec copy-to-clipboard pour les hashes
  - Bouton "Declencher oracle"
- **Risques** : Tuiles PNG non disponibles, layers mal ordonnes
- **Dependances** : BET-DESIGN-03, BET-LANCEMENT-01
- **Succes** : User peut activer/desactiver chaque couche et voir le resultat
- **Statut** : DONE

---

## Phase C — Controle

### BET-CONTROLE-01 — Reproductibilite (tests)

- **Hypothese** : Lancer le pipeline 3 fois sur les memes entrees produit exactement les memes hashes.
- **Livrables** :
  - Test pytest `test_reproducibility.py`
  - CI GitHub Actions qui lance 3 fois et compare
- **Risques** : Order dependency, floating point non-determinisme
- **Dependances** : BET-LANCEMENT-01
- **Succes** : 3 runs = 3 hashes identiques, CI green
- **Statut** : TODO

### BET-CONTROLE-02 — Validation ground-truth

- **Hypothese** : Le resultat NDVI converge vers les chiffres officiels PRODES/DETER a ±20%.
- **Livrables** :
  - Comparaison automatique avec INPE PRODES 2025
  - Rapport `accuracy_report.md`
  - Visualisation scatter plot NDVI vs PRODES
- **Risques** : PRODES pas encore publie pour S1 2025, methode differente (cumulative vs delta)
- **Dependances** : BET-LANCEMENT-02
- **Succes** : Ecart < 20% entre surface calculee et surface PRODES
- **Statut** : TODO

### BET-CONTROLE-03 — Monitoring production

- **Hypothese** : Sentry + Prometheus + Healthcheck permettent d'intervenir en < 1h sur un incident.
- **Livrables** :
  - Sentry SDK backend + frontend
  - Endpoint `/metrics` Prometheus
  - Alerts (erreur pipeline, DB down, Copernicus 503)
- **Risques** : Bruit alerting, dashboards mal configures
- **Dependances** : BET-LANCEMENT-02
- **Succes** : Alert declenchee < 5min apres panne simulee
- **Statut** : TODO

---

## Plan Notion (structure recommandee)

```
ParaOracle (hub)
├── [DOC] Cadrage fonctionnel
│   ├── Regle de resolution (BET-ANALYSE-01)
│   ├── Sources de donnees (BET-ANALYSE-02)
│   └── Contraintes legales (BET-ANALYSE-03)
├── [ARCHI] Architecture
│   ├── Schema BDD (BET-DESIGN-01)
│   ├── API Contract (BET-DESIGN-02)
│   ├── UX mobile-first (BET-DESIGN-03)
│   └── Docker stack (BET-DESIGN-04)
├── [IMPL] Implementation
│   ├── Pipeline mock (BET-LANCEMENT-01)
│   ├── Pipeline reel (BET-LANCEMENT-02)
│   ├── IPFS + on-chain (BET-LANCEMENT-03)
│   └── UX detaillee (BET-LANCEMENT-04)
├── [QA] Validation
│   ├── Reproductibilite (BET-CONTROLE-01)
│   ├── Ground-truth (BET-CONTROLE-02)
│   └── Monitoring (BET-CONTROLE-03)
├── Bets (database)
│   Columns : id | phase | title | hypothesis | status | owner | deliverables | risks
├── Tasks (database)
│   Liee a Bets par relation
│   Columns : id | bet_id | title | status | estimate | actual
└── Retrospectives (hebdo)
```

## Etat actuel du sprint

| Phase | DONE | TODO | Total |
|---|---|---|---|
| Analyse | 1 | 2 | 3 |
| Design | 4 | 0 | 4 |
| Lancement | 3 | 1 | 4 |
| Controle | 0 | 3 | 3 |
| **Total** | **8** | **6** | **14 bets** |

**Velocity attendue** : 2-3 bets/semaine → fin du sprint dans 2-3 semaines.
