# ParaOracle Backend — Agent Guide

Tu es un agent Claude Code specialise sur le backend ParaOracle.
Ce fichier te donne tout le contexte pour intervenir sans hesiter.

## Stack

- **Python 3.12** + FastAPI 0.115 + Uvicorn (reload dev)
- **SQLAlchemy 2.0** (ORM) + GeoAlchemy2 (PostGIS) + Pydantic v2 (schemas)
- **PostgreSQL 16 + PostGIS 3.4** (container `para-db`, port interne 5432, host 5434)
- **Rasterio / rioxarray / xarray** pour le traitement NDVI (stub pour l'instant)
- **httpx** pour les appels HTTP (Copernicus STAC, upstream tiles)
- Docker container `para-backend` avec volume `./backend:/app` (hot reload)

## Structure

```
backend/
  app/
    main.py              ← FastAPI app, CORS, 6 routers
    core/
      config.py          ← Settings (pydantic-settings, env vars)
      database.py        ← engine + SessionLocal + get_db dependency
    models/
      __init__.py        ← re-exports: Bet, Analysis, Layer, UserMock, RasterSnapshot
      bet.py             ← Bet (MultiPolygon 4326, threshold, status OPEN→RESOLVED_YES/NO)
      analysis.py        ← Analysis (5 hashes, surface, IPFS CID)
      layer.py           ← Layer (slug, type xyz/wms/geojson, url, display_order)
      user.py            ← UserMock (email, token)
    schemas/
      auth.py            ← LoginRequest (EmailStr), LoginResponse
      bet.py             ← BetBase, BetRead, BetSummary (Decimal fields)
      layer.py           ← LayerRead
      analysis.py        ← AnalysisRead, OracleResult (evidence dict)
    routers/
      auth.py            ← POST /login, GET /me
      bets.py            ← GET /bets, GET /bets/{slug} (avec region GeoJSON)
      layers.py          ← GET /layers, GET /{slug}, GET /{slug}/style
      oracle.py          ← GET /status, POST /resolve/{bet_slug}
      analyses.py        ← GET /analyses, GET /{analysis_id}
      tiles.py           ← GET /{slug}/{z}/{x}/{y}.{png,jpg}, POST /warmup
    services/
      copernicus_client.py  ← CopernicusClient (STAC search, OAuth2, mock fallback)
      ndvi_pipeline.py      ← NDVIPipeline (deterministe, PipelineConfig dataclass)
  Dockerfile
  requirements.txt
```

## Conventions

- **Commits** : `<type>(bet-<id>): <description courte>` (ex: `feat(bet-lancement-02): real NDVI pipeline`)
- **Push apres chaque task** (pas en batch)
- **Types** : feat, fix, refactor, test, chore, docs, data
- **Branch format** : `<type>/<bet-id>-<short-description>`

## Base de donnees

5 tables dans `paraoracle` (extensions: postgis, pgcrypto, uuid-ossp) :

- `users_mock` — auth demo
- `bets` — paris, colonne `region_geom` GEOMETRY(MultiPolygon, 4326), index GIST
- `layers` — 16 couches carto (basemaps, NASA, NDVI pipeline, cadastres INPE, vecteurs)
- `analyses` — resultats pipeline (5 hashes SHA-256, surface km2, CID IPFS)
- `raster_snapshots` — fichiers rasters indexes par analysis_id

Seed dans `db/init/03-seed.sql`. La BDD est initialisee automatiquement par Docker.

## Endpoints critiques

| Priorite | Endpoint | Notes |
|----------|----------|-------|
| P0 | `POST /oracle/resolve/{slug}` | Pipeline principal. Doit rester deterministe. |
| P0 | `GET /tiles/{slug}/{z}/{x}/{y}.png` | Proxy + cache disque. Ne JAMAIS casser le cache path. |
| P1 | `GET /bets/{slug}` | Retourne GeoJSON via `__geo_interface__`. |
| P1 | `GET /layers` | Le frontend en depend pour toutes les couches. |
| P2 | `POST /tiles/warmup` | Pre-chauffe PRODES+DETER z4-8 sur bbox Para. |

## Variables d'environnement

Definies dans `.env` (gitignore) et lues par `core/config.py` :

- `DATABASE_URL` — SQLAlchemy connection string
- `COPERNICUS_CLIENT_ID/SECRET` — CDSE OAuth2 (vides = mock)
- `SENTINEL_HUB_CLIENT_ID/SECRET` — Sentinel Hub (sh-*)
- `USE_MOCK_SENTINEL` — true/false
- `CORS_ORIGINS` — CSV d'origines (parse par `cors_origins_list` property)
- `DATA_DIR` — `/data` dans le container, `./data` sur l'hote

## Tile cache

- **Root** : `/data/tile-cache/{slug}/{z}/{x}/{y}.png`
- **Date-aware** : `/data/tile-cache/{slug}/{date}/{z}/{x}/{y}.{ext}`
- `tile_to_bbox(z, x, y)` convertit ZXY → EPSG:3857 pour les WMS
- Basemaps (OSM, ESRI, Carto) ne sont PAS proxies
- Headers : `Cache-Control: public, max-age=86400`

## Pipeline NDVI (ndvi_pipeline.py)

**PipelineConfig** : bet_slug, dates, region_geom_wkt, thresholds.

**Flux** : search_s2_l2a → compute composites → delta → mask → surface → YES/NO.

**Mock mode** : `random.Random(bet_slug)` seed, 4 fichiers .tif, hashes deterministes.

**Real mode** : stub `_real_compute()` — A IMPLEMENTER avec rioxarray.

## Regles pour l'agent

1. Ne JAMAIS modifier les hashes/CID d'une analyse existante
2. Le pipeline DOIT rester deterministe (memes inputs → memes outputs)
3. Toujours utiliser `text()` avec bind params pour le SQL brut (SQLAlchemy 2.0)
4. Les schemas Pydantic utilisent `from_attributes = True` (ORM mode)
5. CORS_ORIGINS est un string CSV, pas une list — utiliser `settings.cors_origins_list`
6. Le port PostgreSQL externe est 5434 (pas 5432)
7. Tester avec `docker compose exec -T frontend npx tsc --noEmit` apres toute modif schema
8. `email-validator` est requis pour les schemas avec EmailStr
