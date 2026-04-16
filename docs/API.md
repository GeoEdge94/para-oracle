# ParaOracle API — Reference technique

> **Base URL** : `http://localhost:8000` (dev) | `http://192.168.1.93:8000` (LAN)
> **Swagger UI** : `/docs` | **ReDoc** : `/redoc`
> **Version** : 0.1.0

---

## Authentification

Auth mock pour le MVP. Le token est un simple string stocke dans `users_mock.token`.

### POST /auth/login

Login mock. Accepte n'importe quel email/password. Cree ou retrouve l'utilisateur par email.

**Request**
```json
{ "email": "demo@para-oracle.app", "password": "demo1234" }
```

**Response 200**
```json
{ "token": "mock-token-demo-1234", "email": "demo@para-oracle.app", "pseudo": "demo" }
```

### GET /auth/me?token={token}

**Response 200** : `{ "email": "...", "pseudo": "..." }`
**Response 401** : token invalide

---

## Bets (Paris)

### GET /bets

Liste les paris. Filtre optionnel par status.

| Param | Type | Requis | Description |
|-------|------|--------|-------------|
| `status` | string (query) | non | `OPEN`, `CLOSED`, `RESOLVED_YES`, `RESOLVED_NO`, `ERROR` |

**Response 200** : `BetSummary[]`
```json
[{
  "id": "uuid",
  "slug": "para-deforestation-2025-s1",
  "question": "La deforestation dans l'etat du Para...",
  "category": "deforestation",
  "status": "OPEN",
  "period_start": "2025-01-01",
  "period_end": "2025-06-30",
  "threshold_value": 4200,
  "threshold_unit": "km2",
  "result_bool": null,
  "resolved_value": null
}]
```

### GET /bets/{slug}

Detail d'un pari avec geometrie GeoJSON de la region.

**Response 200** : `BetRead` + `region_geojson` (GeoJSON MultiPolygon)

**Response 404** : pari non trouve

---

## Layers (Couches cartographiques)

### GET /layers

Liste les 16 couches disponibles, ordonnees par `display_order`.

**Response 200** : `LayerRead[]`
```json
[{
  "id": "uuid",
  "slug": "prodes-accumulated",
  "name": "PRODES cumule (INPE)",
  "description": "Polygones de deforestation cumulee...",
  "type": "xyz",
  "url": "https://terrabrasilis.dpi.inpe.br/geoserver/ows?...",
  "local_path": null,
  "style": null,
  "display_order": 30,
  "visible_default": true
}]
```

**Types de couches** : `xyz`, `wms`, `wfs`, `geojson`, `tilejson`

### GET /layers/{slug}

Metadata d'une couche par slug.

### GET /layers/{slug}/style

Style MapLibre (JSONB). Retourne `{}` si null.

---

## Oracle (Resolution de paris)

### GET /oracle/status

Mode actuel + statut authentification Copernicus. Utilise par le frontend pour le badge LIVE/mock.

**Response 200**
```json
{
  "mode": "mock",
  "copernicus_authenticated": false,
  "copernicus_message": "missing COPERNICUS_CLIENT_ID / COPERNICUS_CLIENT_SECRET",
  "stac_url": "https://catalogue.dataspace.copernicus.eu/stac",
  "data_dir": "/data"
}
```

### POST /oracle/resolve/{bet_slug}

Declenche la resolution deterministe d'un pari via le pipeline NDVI Sentinel-2.

**Algorithme** :
1. Extraire bbox du polygone region
2. Rechercher produits Sentinel-2 L2A (T0 = debut periode, T1 = fin + 2j)
3. Calculer composites NDVI median temporel (B8 - B4) / (B8 + B4)
4. Delta NDVI = T1 - T0
5. Masque binaire : pixels ou delta < -0.3
6. Aggreger surface : pixels x 100 m^2 / 10^6 = km^2
7. Decision : surface > seuil → YES, sinon NO
8. Generer preuves SHA-256 + CID IPFS

**Response 200** : `OracleResult`
```json
{
  "bet_id": "para-deforestation-2025-s1",
  "resolved_outcome": "YES",
  "surface_deforestee_km2": 5052.79,
  "threshold_km2": 4200.0,
  "resolution_timestamp": "2026-04-14T01:26:53.242902Z",
  "evidence": {
    "script_hash": "sha256:9d5398...",
    "ndvi_t0_hash": "sha256:d6eda4...",
    "ndvi_t1_hash": "sha256:1c8b29...",
    "delta_hash": "sha256:cc047d...",
    "mask_hash": "sha256:35c40d...",
    "sentinel_products_t0": ["S2A_MSIL2A_..."],
    "sentinel_products_t1": ["S2A_MSIL2A_..."],
    "stac_uris": ["https://catalogue.dataspace.copernicus.eu/stac/..."],
    "ipfs_cid": "bafybei7d39c0c3867db...",
    "period": { "start": "2025-01-01", "end": "2025-06-30" },
    "analysis_id": "uuid"
  }
}
```

**Response 400** : pari deja resolu
**Response 404** : pari non trouve

---

## Analyses (Historique)

### GET /analyses?bet_slug={slug}

Derniers 50 runs, filtrables par bet_slug.

### GET /analyses/{analysis_id}

Detail d'une analyse avec preuves completes.

---

## Tiles (Cache proxy)

Proxy de tuiles cartographiques avec cache disque. Les basemaps (OSM, ESRI, Carto) ne sont PAS proxies — le frontend les charge directement.

### GET /tiles/{slug}/{z}/{x}/{y}.png

| Param | Type | Description |
|-------|------|-------------|
| `slug` | path | Slug de la couche (ex: `prodes-accumulated`) |
| `z`, `x`, `y` | path | Coordonnees tuile ZXY |
| `date` | query | Date ISO YYYY-MM-DD (requis pour couches NASA GIBS) |

**Comportement** :
1. Verifie cache disque `/data/tile-cache/{slug}/{z}/{x}/{y}.png`
2. Cache hit → retourne depuis le disque (< 1ms)
3. Cache miss → fetch upstream, sauvegarde, retourne

**Headers reponse** : `Cache-Control: public, max-age=86400`

**Exemples** :
```
GET /tiles/prodes-accumulated/5/10/12.png
GET /tiles/deter-amz/6/20/30.png
GET /tiles/nasa-modis-ndvi/5/10/12.png?date=2025-01-01
```

### GET /tiles/{slug}/{z}/{x}/{y}.jpg

Alias pour les tuiles JPEG (NASA GIBS true color).

### POST /tiles/warmup

Pre-remplit le cache pour PRODES + DETER sur la zone Para (zoom 4-8). Foreground, ~3-5 min.

**Response 200**
```json
{ "fetched": 277, "skipped_cached": 0, "errors": 3 }
```

---

## Modeles de donnees

### Base de donnees PostgreSQL 16 + PostGIS 3.4

**5 tables** :

| Table | Description | Colonnes cles |
|-------|-------------|---------------|
| `users_mock` | Utilisateurs demo | email (unique), token |
| `bets` | Paris de prediction | slug (unique), region_geom (MultiPolygon 4326), threshold_value, status |
| `layers` | Config couches carto | slug (unique), type (xyz/wms/geojson), url, display_order |
| `analyses` | Resultats pipeline | bet_id (FK), 5 hashes SHA-256, surface_km2, ipfs_cid |
| `raster_snapshots` | Fichiers rasters generes | analysis_id (FK), kind (ndvi_t0/t1/delta/mask), file_hash |

**Extensions** : `postgis`, `pgcrypto`, `uuid-ossp`
**Index GIST** : `bets.region_geom`, `raster_snapshots.bbox_geom`

### 16 couches en base

| Categorie | Couches | Visible par defaut |
|-----------|---------|-------------------|
| Basemaps | OSM, Satellite ESRI, Carto Dark | Satellite |
| Satellite NASA | MODIS True Color, VIIRS True Color, MODIS NDVI 16-day, VIIRS FIRMS | non |
| Pipeline NDVI | ndvi-t0, ndvi-t1, delta-ndvi, mask-deforestation | non |
| Cadastres verifies | PRODES cumule, PRODES annuel, DETER alertes, Hansen/GFW | PRODES + DETER |
| Vecteurs | Frontiere Para | oui |

---

## Services

### CopernicusClient

Client STAC pour Copernicus Data Space Ecosystem.

| Mode | Comportement |
|------|-------------|
| `USE_MOCK_SENTINEL=true` | Retourne 2 produits factices par recherche |
| `USE_MOCK_SENTINEL=false` + creds valides | OAuth2 client_credentials → STAC search → produits reels |
| Creds manquantes | Auto-fallback vers mock |

**OAuth endpoint** : `https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token`
**STAC endpoint** : `https://catalogue.dataspace.copernicus.eu/stac`

### NDVIPipeline

Pipeline deterministe : memes entrees → memes sorties, rejouable.

| Config | Valeur defaut |
|--------|---------------|
| `ndvi_drop_threshold` | 0.3 |
| `threshold_km2` | 4200.0 |
| `max_cloud_cover` | 20% |
| `composite_window_days` | 15 |
| `revisit_delay_days` | 2 |

**Preuves generees** : 5 hashes SHA-256 (script, ndvi_t0, ndvi_t1, delta, mask) + 1 CID IPFS mock.

---

## Configuration (.env)

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_DB` | `paraoracle` | Nom BDD |
| `POSTGRES_USER` | `paraoracle` | User BDD |
| `POSTGRES_PASSWORD` | `paraoracle_dev` | Password BDD |
| `COPERNICUS_CLIENT_ID` | _(vide)_ | OAuth2 CDSE |
| `COPERNICUS_CLIENT_SECRET` | _(vide)_ | OAuth2 CDSE |
| `SENTINEL_HUB_CLIENT_ID` | _(vide)_ | Sentinel Hub (sh-*) |
| `SENTINEL_HUB_CLIENT_SECRET` | _(vide)_ | Sentinel Hub secret |
| `USE_MOCK_SENTINEL` | `true` | Mock ou reel |
| `JWT_SECRET` | `change_me_in_prod` | Secret JWT |
| `CORS_ORIGINS` | `http://localhost:3000` | Origines autorisees (CSV) |
| `DATA_DIR` | `/data` | Dossier donnees/cache |

---

## Docker Compose

| Service | Image | Port | Healthcheck |
|---------|-------|------|-------------|
| `db` | `postgis/postgis:16-3.4` | `5434:5432` | `pg_isready` |
| `backend` | build `./backend` | `8000:8000` | `/health` |
| `frontend` | build `./frontend` | `3000:3000` | HTTP 200 |
| `qgis-server` | `camptocamp/qgis-server:3.34` | `8080:80` | profile `qgis` |
