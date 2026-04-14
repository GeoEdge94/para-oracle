# ParaOracle — Deforestation Prediction Market Oracle

Web app mobile-first servant d'interface pour un **oracle determinist de marche de prediction** base sur Sentinel-2 et couches QGIS.

**Question du marche demo :**
> La deforestation dans l'etat du Para (Amazonie) depassera-t-elle 4 200 km² entre janvier et juin 2025 ?

Resolution automatique : composites NDVI T0/T1 → delta NDVI → masque binaire (Δ < -0.3) → surface agregee → seuil 4200 km² → YES/NO.

---

## Architecture (vue d'ensemble)

```
┌──────────────────────────────────────────────────────────┐
│                    FRONTEND (React + TS)                 │
│         MapLibre GL JS · Mobile-first PWA                │
│    Login mock · Carte pari · Vue analyse NDVI detaillee  │
│                    localhost:3000                        │
└────────────────────────┬─────────────────────────────────┘
                         │ REST (axios)
┌────────────────────────▼─────────────────────────────────┐
│                  BACKEND (FastAPI Python)                │
│   /auth · /bets · /layers · /oracle · /analyses          │
│                    localhost:8000                        │
│                                                          │
│   ┌──────────────────┐   ┌──────────────────────┐        │
│   │ CopernicusClient │   │   NDVIPipeline       │        │
│   │  STAC / OData    │   │  rioxarray/rasterio  │        │
│   │  Sentinel Hub    │   │  B4/B8 → NDVI → Δ    │        │
│   └──────────────────┘   └──────────────────────┘        │
└───────────────┬───────────────────────────┬──────────────┘
                │                           │
    ┌───────────▼────────────┐   ┌──────────▼────────────┐
    │  PostgreSQL + PostGIS  │   │   QGIS Server (WMS)   │
    │  bets · analyses       │   │   Layers Para + routes│
    │  layers · users        │   │   localhost:8080      │
    │  localhost:5432        │   │                       │
    └────────────────────────┘   └───────────────────────┘
                │
                ▼
        ┌────────────────┐
        │  data/rasters  │  NDVI_T0, NDVI_T1, delta, mask
        │  (volume)      │  Hashes + CIDs IPFS (fake)
        └────────────────┘
```

---

## Stack

| Couche | Choix | Justification |
|---|---|---|
| Frontend | React 18 + Vite + TypeScript + MapLibre GL JS | Mobile-first, PWA ready, MapLibre gratuit et natif WebGL |
| Backend | FastAPI (Python 3.12) + uvicorn | Typage Pydantic, ecosysteme geo (rasterio/rioxarray) |
| BDD | PostgreSQL 16 + PostGIS 3.4 | Stockage geometrie Para + analyses + indexation spatiale |
| QGIS | QGIS Server (WMS/WFS) — optionnel | Export GeoJSON suffisant pour demo |
| Orchestration | Docker Compose | 4 services : frontend, backend, db, qgis-server |
| Oracle | Python pipeline deterministe | Rejouable avec memes entrees → meme resultat |

---

## Demarrage local

```bash
cp .env.example .env
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000/docs |
| PostgreSQL | localhost:5432 |
| QGIS Server | http://localhost:8080 |

---

## Structure du repo

```
para-oracle/
├── docker-compose.yml
├── .env.example
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py                FastAPI app + CORS + routers
│       ├── core/
│       │   ├── config.py           Settings env
│       │   └── database.py         SQLAlchemy session
│       ├── models/                 SQLAlchemy ORM (bet, analysis, layer, user)
│       ├── schemas/                Pydantic schemas
│       ├── routers/                REST endpoints
│       │   ├── auth.py             Login mock
│       │   ├── bets.py             GET/POST bets
│       │   ├── layers.py           GET /layers → QGIS
│       │   └── oracle.py           POST /oracle/resolve/{bet_id}
│       └── services/
│           ├── copernicus_client.py  STAC/OData client (mockable)
│           └── ndvi_pipeline.py      Pipeline deterministe NDVI
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx
│       ├── App.tsx                 Routes
│       ├── pages/
│       │   ├── Login.tsx
│       │   ├── Map.tsx             Carte principale avec pari
│       │   └── Analysis.tsx        Vue detaillee NDVI
│       ├── components/
│       │   ├── MapView.tsx         MapLibre + layers
│       │   ├── BetSheet.tsx        Bottom sheet mobile
│       │   ├── LayerControls.tsx   Toggle NDVI/delta/mask
│       │   ├── DateSlider.tsx      T0 → T1
│       │   └── FAB.tsx             Floating action button
│       ├── lib/
│       │   ├── api.ts              Client axios
│       │   └── auth.ts             Token localStorage
│       └── types/index.ts
├── db/init/
│   ├── 01-extensions.sql           CREATE EXTENSION postgis
│   ├── 02-schema.sql               Tables bets/analyses/layers/users
│   └── 03-seed.sql                 Para polygon + pari demo + user mock
├── data/
│   ├── para/                       Polygone Para (GeoJSON/shapefile)
│   ├── sentinel/                   Scenes S2 mockees
│   └── rasters/                    NDVI_T0/T1/delta/mask pre-calcules
└── docs/
    ├── ARCHITECTURE.md
    ├── NDVI_PIPELINE.md
    ├── ADLC_BETS.md                Plan ADLC avec bet cards
    └── ORACLE_SPEC.md              Format JSON → smart contract
```

---

## Reproductibilite et preuves

Chaque execution du pipeline produit :

```json
{
  "bet_id": "bet-para-deforestation-2025-s1",
  "resolved_outcome": "YES",
  "surface_deforestee_km2": 4867.3,
  "threshold_km2": 4200,
  "resolution_timestamp": "2025-07-02T14:30:00Z",
  "evidence": {
    "script_hash": "sha256:a1b2c3...",
    "ndvi_t0_hash": "sha256:d4e5f6...",
    "ndvi_t1_hash": "sha256:g7h8i9...",
    "delta_hash": "sha256:j0k1l2...",
    "mask_hash": "sha256:m3n4o5...",
    "sentinel_products": ["S2A_MSIL2A_20250105T...", "S2B_MSIL2A_20250628T..."],
    "ipfs_cid": "bafybeig...",
    "period": { "start": "2025-01-01", "end": "2025-06-30" }
  }
}
```

Format pret pour consommation on-chain via smart contract (voir `docs/ORACLE_SPEC.md`).
