# ParaOracle — Audit Technique Complet

## Vue d'ensemble

ParaOracle est un **oracle deterministe pour marche de prediction sur la deforestation** en Amazonie bresilienne. Il combine des donnees satellite Sentinel-2, des cadastres officiels (PRODES/DETER), et un pipeline NDVI automatise pour resoudre des paris YES/NO sur des seuils de surface deforestee.

**Stack** : React 18 + MapLibre GL + Vite | FastAPI + SQLAlchemy + PostGIS | Docker Compose

---

## Architecture

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐
│  Frontend    │───>│  Backend API │───>│  PostgreSQL   │
│  React/Vite  │    │  FastAPI     │    │  + PostGIS    │
│  Port 3000   │    │  Port 8000   │    │  Port 5434    │
└──────┬───────┘    └──────┬───────┘    └──────────────┘
       │                   │
       │  MapLibre GL      │  Tile Cache Proxy
       │  (carte)          │  /data/tile-cache/
       v                   v
┌──────────────┐    ┌──────────────┐
│ ESRI/NASA    │    │ Copernicus   │
│ Tile CDN     │    │ STAC (S2)    │
└──────────────┘    └──────────────┘
```

---

## Base de donnees (7 tables)

### users_mock
Auth demo. Email unique + token dummy.
- 4 users : demo, alice_forest, bob_verde, carla_geo

### bets
Paris de prediction. Chaque bet = question YES/NO + region geographique + seuil.
- `region_geom` MULTIPOLYGON 4326 (frontieres officielles IBGE)
- `status` : OPEN -> RESOLVED_YES / RESOLVED_NO / ERROR
- 3 bets actuels :
  - Para deforestation S1 2025 (OPEN, seuil 4200 km2)
  - Rondonia deforestation S1 2025 (OPEN, seuil 3000 km2)
  - Mato Grosso feux S1 2025 (RESOLVED_NO, resultat 980.4 km2 < seuil 1500 km2)

### layers
16 couches cartographiques :
- 3 basemaps (OSM, ESRI Satellite, Carto Dark)
- 3 imagerie NASA date-aware (MODIS/VIIRS true-color, MODIS NDVI 16-day)
- 1 feux actifs (VIIRS FIRMS)
- 4 cadastres verifies (PRODES cumule/annuel, DETER alertes, Hansen tree loss)
- 4 pipeline NDVI (T0, T1, delta, mask)
- 1 vecteur (frontiere Para)

### analyses
Executions du pipeline NDVI. Chaque resolution cree un enregistrement avec :
- 5 hashes SHA-256 (script, ndvi_t0, ndvi_t1, delta, mask)
- CID IPFS (preuve immutable)
- Produits Sentinel-2 utilises (IDs + URIs STAC)
- Surface calculee en km2, pixels deforestes, couverture nuageuse

### user_bets
Placements mock des utilisateurs :
- Position (YES/NO), montant (50-500 EUR), cote (1.60-2.40)
- `potential_payout` calcule automatiquement en DB (GENERATED ALWAYS AS amount * odds)
- Status PENDING -> WON/LOST (settle automatique a la resolution)
- 18 placements repartis sur 3 bets, 4 utilisateurs

### deforestation_zones
Zones de deforestation detectees (preuves spatialisees) :
- Source : PRODES (officiel INPE), DETER (alertes quasi-temps reel), NDVI (pipeline)
- Polygone GeoJSON irregulier (~10 points), surface km2, confiance 0-1
- 14 zones reparties sur 3 bets
- Dates de detection etalees jan-juin 2025

### raster_snapshots
References aux fichiers raster generes par le pipeline (ndvi_t0.tif, ndvi_t1.tif, delta.tif, mask.tif).

---

## API Backend (8 routers, 17 endpoints)

### Auth (`/auth`)
| Methode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/auth/login` | Login mock, accepte tout email/mdp, retourne token |
| GET | `/auth/me?token=` | Recupere user par token |

### Bets (`/bets`)
| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/bets` | Liste tous les bets avec geometrie GeoJSON |
| GET | `/bets/{slug}` | Detail d'un bet par slug |

La serialisation GeoJSON utilise `geoalchemy2.shape.to_shape()` puis `__geo_interface__` pour convertir la geometrie PostGIS en GeoJSON standard.

### Layers (`/layers`)
| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/layers` | Liste 16 couches, triees par display_order |
| GET | `/layers/{slug}` | Detail couche |
| GET | `/layers/{slug}/style` | Style MapLibre (JSONB) |

### Oracle (`/oracle`)
| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/oracle/status` | Mode mock/live + statut auth Copernicus |
| POST | `/oracle/resolve/{slug}` | Declenche pipeline NDVI, resout le bet |

Le POST `/oracle/resolve/{slug}` est le coeur du systeme :
1. Recupere le bet et sa geometrie WKT
2. Cree un PipelineConfig (dates, region, seuils)
3. Execute NDVIPipeline.run() (mock ou reel)
4. Persiste l'analyse avec 5 hashes + CID IPFS
5. Met a jour le bet (RESOLVED_YES/NO)
6. Settle les user_bets (WON/LOST)
7. Retourne OracleResult avec toutes les preuves

### Analyses (`/analyses`)
| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/analyses?bet_slug=` | Historique des resolutions |
| GET | `/analyses/{id}` | Detail analyse avec preuves |

### Tiles (`/tiles`)
| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/tiles/{slug}/{z}/{x}/{y}.png` | Proxy tile PNG + cache disque |
| GET | `/tiles/{slug}/{z}/{x}/{y}.jpg` | Proxy tile JPG (NASA GIBS) |
| POST | `/tiles/warmup` | Pre-cache PRODES/DETER z4-8 sur Para |

Systeme de cache :
- Path : `/data/tile-cache/{slug}/{date?}/{z}/{x}/{y}.{ext}`
- Cache hit : retour depuis disque avec `Cache-Control: max-age=86400`
- Cache miss : fetch upstream, sauvegarde, retour
- Basemaps (OSM, ESRI, Carto) ne sont PAS proxies (acces CDN direct)

### User Bets (`/user-bets`)
| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/user-bets/by-bet/{slug}` | Tous les placements sur un bet |
| GET | `/user-bets/by-bet/{slug}/stats` | Stats marche (volume, ratio YES/NO, cotes) |
| GET | `/user-bets/my/{slug}?token=` | Mes placements sur un bet |

### Zones (`/zones`)
| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/zones/by-bet/{slug}` | Zones deforestation detectees pour un bet |

---

## Pipeline NDVI (resolution deterministe)

### Flux de resolution
```
1. Recherche Sentinel-2 L2A via STAC (T0 + T1)
2. Calcul composites NDVI (bandes B04 rouge / B08 proche-IR)
3. Delta NDVI = T1 - T0
4. Masque binaire : pixels ou delta < -seuil (defaut -0.3)
5. Agregation surface km2 (comptage pixels * resolution)
6. Decision : surface > threshold_value -> YES / NO
7. Generation 5 hashes SHA-256 + CID IPFS
```

### Determinisme
Le pipeline est **deterministe** : memes entrees = memes sorties.
- `random.Random(bet_slug)` : seed fixe par slug
- Hashes SHA-256 du contenu des fichiers raster
- Tous les parametres snapshotes dans `analyses.params` (JSONB)

### Mode mock vs live
- **Mock** (`USE_MOCK_SENTINEL=true`, defaut) : Donnees synthetiques, 4 fichiers .tif stubs
- **Live** : Appel Copernicus STAC, download B04/B08, calcul reel (stub `_real_compute()` a implementer)

### PipelineConfig
```python
bet_slug: str
period_start: date      # debut periode
period_end: date        # fin periode
region_geom_wkt: str    # MultiPolygon WKT
ndvi_drop_threshold: float  # 0.3 par defaut
threshold_km2: float    # seuil du bet
max_cloud_cover: int    # 20%
composite_window_days: int  # 15 jours
```

---

## Frontend (3 pages, 12 composants)

### Routes
| Route | Page | Auth | Description |
|-------|------|------|-------------|
| `/login` | Login | Non | Formulaire mock pre-rempli |
| `/` | MapPage | Oui | Carte multi-bet + carousel |
| `/analysis/:slug` | Analysis | Oui | Analyse NDVI detaillee |

### Page Map (`/`)
- Charge tous les bets via `GET /bets` (avec geometries)
- Affiche N zones colorees sur la carte satellite ESRI :
  - Vert (#10b981) pour deforestation
  - Ambre (#f59e0b) pour wildfire
  - Bleu (#3b82f6) pour flood
- Carousel horizontal de cards style Polymarket en bas
- Click zone ou card -> fly-to anime + BetSheet (bottom sheet)
- BetSheet affiche : question, periode, seuil, stats marche, position user
- Bouton "Voir l'analyse NDVI" -> navigation vers `/analysis/:slug`

### Page Analysis (`/analysis/:slug`)
Generique — fonctionne avec n'importe quel slug de bet.

**Initialisation :**
- Animation fly-to sur la zone au chargement (depart zoom 3, arrivee fitBounds 2s)
- Camera verrouillee dans la zone (maxBounds + minZoom 4)
- Masque sombre hors zone (polygone inverse, opacity 88%)
- 16 couches activables dont delta-NDVI visible par defaut (75%)

**Controles :**
- LayerPanel (panneau QGIS-style) : toggle visibilite, slider opacite, reorder
- DateSelector : T0, T1, Aujourd'hui, date custom (affecte couches NASA date-aware)
- Legend dynamique : change selon la couche NDVI active (gradient ou swatch)

**Bottom sheet collapsible :**
- Resultat YES/NO + surface deforestee
- Stats marche (volume total, barre YES/NO, cotes moyennes)
- Position utilisateur (mise totale, payout potentiel, badges WON/LOST)
- Timeline des placements (dots chronologiques jan-juin)
- Preuves SHA-256 (6 hashes avec copie)
- Bouton "Voir les N zones detectees" :
  - Active les couches cadastre (PRODES, DETER) + delta NDVI + mask
  - Affiche les zones detectees sur la carte (glow + fill + contour par source)
  - EvidenceDetail : timeline verticale des zones (nom, source, surface, confiance)
  - VerdictPanel : surface detectee vs seuil, sources geospatiales, repartition des gains

### Composants
| Composant | Fichier | Role |
|-----------|---------|------|
| BetCarousel | `components/BetCarousel.tsx` | Cards style Polymarket (page /) |
| BetSheet | `components/BetSheet.tsx` | Bottom sheet detail bet + stats marche |
| BetTimeline | `components/BetTimeline.tsx` | Timeline horizontale des placements |
| DateSelector | `components/DateSelector.tsx` | Selecteur T0/T1/custom pour NASA |
| EvidenceDetail | `components/EvidenceDetail.tsx` | Timeline verticale zones detectees |
| LayerPanel | `components/LayerPanel.tsx` | Panneau couches (toggle/opacity/reorder) |
| Legend | `components/Legend.tsx` | Mini-legende NDVI/delta/mask |
| MarketStats | `components/MarketStats.tsx` | Volume, ratio YES/NO, position user |
| OnboardingOverlay | `components/OnboardingOverlay.tsx` | Tutorial 5 etapes (premier lancement) |
| StatusBadge | `components/StatusBadge.tsx` | Badge LIVE/MOCK |
| VerdictPanel | `components/VerdictPanel.tsx` | Verdict oracle + sources + gains |
| FAB | `components/FAB.tsx` | Floating action button |

### Bibliotheques frontend
| Lib | Version | Usage |
|-----|---------|-------|
| react | 18.3 | UI framework |
| maplibre-gl | 4.7 | Rendu cartographique WebGL |
| axios | 1.7 | Client HTTP (interceptor Bearer) |
| react-router-dom | 6.27 | Routing SPA |
| zustand | 5.0 | State management (installe, non utilise) |
| lucide-react | 0.454 | Icones |

---

## Couches cartographiques (z-stack bas vers haut)

```
__boot (ESRI satellite, masque par basemap applicatif)
  basemap-satellite / basemap-osm / basemap-carto-dark (radio exclusif)
    nasa-modis-truecolor (date-aware, proxy backend)
    nasa-viirs-truecolor (date-aware, proxy backend)
    nasa-modis-ndvi (date-aware, proxy backend)
    nasa-viirs-firms (feux actifs, WMS bbox)
      ndvi-t0 (pipeline, proxy backend)
      ndvi-t1 (pipeline, proxy backend)
      delta-ndvi (pipeline, proxy backend)
      mask-deforestation (pipeline, proxy backend)
        prodes-accumulated (WMS INPE, 65% opacity)
        prodes-yearly (WMS INPE)
        deter-amz (WMS INPE, 65% opacity)
        hansen-tree-loss (GFW tiles)
          para-outside-fill (masque sombre hors region, 88% opacity)
            deforestation-zones-glow (halo lumineux)
            deforestation-zones-fill (remplissage par source)
            deforestation-zones-line (contour par source)
            deforestation-zones-labels (points centraux)
              para-fill (region, 10% vert)
              para-border / para-line (pointilles verts)
```

### Optimisations couches
- `bounds` sur les sources raster : limite les requetes de tiles au bbox de la region
- `raster-fade-duration: 0` : rendu instantane
- Toggle direct MapLibre sans passer par React (setLayoutProperty immediat)

---

## Docker Compose (4 services)

| Service | Image | Port externe | Role |
|---------|-------|-------------|------|
| para-db | postgis/postgis:16-3.4 | 5434 | PostgreSQL + PostGIS, healthcheck |
| para-backend | ./backend (Dockerfile) | 8000 | FastAPI, uvicorn --reload, hot reload |
| para-frontend | ./frontend (Dockerfile) | 3000 | Vite dev server, --host 0.0.0.0 |
| para-qgis | camptocamp/qgis-server:3.34 | 8080 | QGIS Server (profil optionnel) |

**Reseau** : `para-net` (bridge, tous les services)
**Volume persistant** : `para_db_data` (donnees PostgreSQL)
**Init automatique** : `db/init/01-extensions.sql`, `02-schema.sql`, `03-seed.sql` executes au premier demarrage

### Variables d'environnement
| Variable | Default | Service |
|----------|---------|---------|
| DATABASE_URL | postgresql+psycopg2://paraoracle:paraoracle_dev@db:5432/paraoracle | backend |
| COPERNICUS_CLIENT_ID | (vide) | backend |
| COPERNICUS_CLIENT_SECRET | (vide) | backend |
| USE_MOCK_SENTINEL | true | backend |
| CORS_ORIGINS | http://localhost:3000 | backend |
| DATA_DIR | /data | backend |
| VITE_API_BASE_URL | http://192.168.1.93:8000 | frontend |

---

## Flux utilisateur complet

### 1. Authentification
```
/login -> POST /auth/login -> token en localStorage -> redirect /
```

### 2. Selection d'un bet (page /)
```
GET /bets -> 3 bets avec geometries
-> MapLibre : N zones colorees + carousel cards
-> Click zone/card -> fly-to + BetSheet
-> GET /user-bets/by-bet/{slug}/stats (stats marche)
-> GET /user-bets/my/{slug} (position user)
```

### 3. Analyse detaillee (/analysis/:slug)
```
GET /bets/{slug} -> bet + region_geojson
GET /layers -> 16 couches
GET /user-bets/by-bet/{slug} -> placements
GET /user-bets/by-bet/{slug}/stats -> stats
GET /user-bets/my/{slug} -> mes positions
GET /zones/by-bet/{slug} -> zones detectees
-> MapLibre : masque region + couches NDVI + zones
```

### 4. Resolution oracle
```
POST /oracle/resolve/{slug}
  -> NDVIPipeline.run()
    -> Copernicus STAC search (mock/reel)
    -> Calcul NDVI T0/T1 -> delta -> mask -> surface km2
    -> 5 hashes SHA-256 + CID IPFS
  -> INSERT analyses
  -> UPDATE bets (RESOLVED_YES/NO)
  -> UPDATE user_bets (WON/LOST)
  -> RETURN OracleResult
```

### 5. Visualisation preuves
```
Bouton "Voir les zones" :
  -> Active couches PRODES + DETER + delta + mask
  -> Affiche zones GeoJSON sur carte (glow + fill + contour)
  -> EvidenceDetail (timeline zones)
  -> VerdictPanel (surface vs seuil + repartition gains)
```

---

## Securite et limites (etat actuel)

### Mock / Demo
- Auth sans verification reelle (tout email/mdp accepte)
- Tokens en clair dans localStorage
- Pas de HTTPS (HTTP uniquement)
- Donnees de placement fictives
- Pipeline mock par defaut (pas d'appels Copernicus reels)
- `_real_compute()` non implemente (stub NotImplementedError)

### Determinisme du pipeline
- Reproductible : `random.Random(bet_slug)` seed fixe
- Hashes deterministes mais sur donnees synthetiques
- Parametres snapshotes dans analyses.params (JSONB)

### A implementer pour production
- Auth JWT signee avec refresh tokens
- HTTPS obligatoire (TLS)
- Pipeline reel Sentinel-2 L2A (rioxarray/rasterio)
- Smart contract Solidity pour settlement on-chain
- Rate limiting sur les endpoints
- Validation des montants de paris
- Mecanisme de depot/retrait (wallet)
- Tests unitaires et d'integration
- CI/CD pipeline
- Monitoring (logs structures, metriques)
