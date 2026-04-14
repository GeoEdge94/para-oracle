# Architecture — ParaOracle

## Principes

1. **Deterministe** — memes entrees → meme sortie. Rejouable localement et verifiable on-chain.
2. **Sans intervention humaine** — la resolution finale ne passe par aucune action manuelle.
3. **Mobile-first** — UX pensee pour smartphone avant desktop.
4. **Standards ouverts** — STAC, OGC WMS/WFS, GeoJSON, OAuth2, JWT, GeoTIFF.
5. **Conteneurise** — docker-compose orchestrant 4 services (5 avec QGIS Server optionnel).

## Schema de communication

```
User (mobile Chrome/Safari)
   │
   │  HTTPS
   ▼
┌────────────────────────┐
│  Frontend  React + Vite│  localhost:3000
│  MapLibre GL JS        │  → /login, /, /analysis/:slug
│  localStorage (token)  │
└───────────┬────────────┘
            │
            │  REST JSON  (Authorization: Bearer <token>)
            ▼
┌─────────────────────────────────────────────┐
│  Backend  FastAPI                           │  localhost:8000
│                                             │
│  /auth/login      mock → users_mock          │
│  /bets[/slug]     GET → bets + region_geojson│
│  /layers          GET → configuration carto │
│  /analyses        GET → historique runs     │
│  /oracle/resolve  POST → pipeline + update   │
│                                             │
│  ┌──────────────┐   ┌──────────────────┐   │
│  │ Copernicus   │   │ NDVIPipeline     │   │
│  │ STAC client  │   │ rasterio/rioxarray│  │
│  │ + OAuth2     │   │ B4/B8 → NDVI → Δ  │  │
│  └──────┬───────┘   └────────┬─────────┘   │
└─────────┼─────────────────────┼─────────────┘
          │                     │
          ▼                     ▼
   Copernicus CDSE        PostgreSQL 16 + PostGIS 3.4
   STAC + OData           (bets, analyses, layers, users,
   Sentinel-2 L2A          raster_snapshots)
                              localhost:5432

Optionnel :
   QGIS Server 3.34 (WMS/WFS) → localhost:8080
```

## Pourquoi ces choix

| Choix | Alternative | Justification |
|---|---|---|
| FastAPI (Python) | Express/Nest (Node) | Ecosysteme geo mature (rasterio, rioxarray, geopandas, pystac-client). Pydantic types forts. |
| PostgreSQL + PostGIS | MongoDB | Polygones natifs, requetes spatiales (`ST_Contains`, `ST_Intersects`), index GIST. |
| MapLibre GL JS | Leaflet | WebGL fluide sur mobile, styles vector tiles, gestes tactiles natifs. |
| React + Vite + TS | Next.js | Pas besoin de SSR pour une app interne. Vite = build rapide. |
| STAC (Copernicus) | OData | Standard OGC, pagination, filtres CQL. Meilleur ecosysteme (pystac-client). |
| Docker Compose | K8s | Demo locale, simple a lancer. K8s viendra en prod. |

## Volumes Docker

| Volume | Contenu |
|---|---|
| `para_db_data` | Donnees Postgres (persistant) |
| `./data` monte sur `/data` | Polygone Para, scenes mockees, rasters NDVI generes |
| `./backend` monte sur `/app` | Hot reload code backend |
| `./frontend` monte sur `/app` (moins node_modules) | Hot reload code frontend |

## Reseau

Tous les services sont sur le reseau `para-net` (bridge). Le frontend communique avec le backend via `http://backend:8000` en interne, `http://localhost:8000` depuis le host.

## Securite (demo)

- JWT HS256 avec secret en env (a changer en prod)
- CORS restrictif a `http://localhost:3000`
- Users mockes (pas de password reel stocke)
- Firestore non utilise — on reste sur Postgres

En production :
- Auth Firebase/Clerk avec OAuth
- Rotation JWT + refresh tokens
- Rate limiting (slowapi ou reverse proxy)
- TLS (Caddy / nginx / Cloudflare)
