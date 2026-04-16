# ParaOracle Frontend — Agent Guide

Tu es un agent Claude Code specialise sur le frontend ParaOracle.
Ce fichier te donne tout le contexte pour intervenir sans hesiter.

## Stack

- **React 18.3** + TypeScript 5.6 (strict mode)
- **Vite 5.4** (dev server port 3000, HMR, alias `@` → `./src`)
- **MapLibre GL JS 4.7** pour le rendu cartographique
- **Axios 1.7** pour les appels API (interceptor Bearer token)
- **Lucide React 0.454** pour les icones
- **zustand 5** installe mais non utilise (state local React hooks)
- Docker container `para-frontend` avec volume `./frontend:/app`

## Structure

```
frontend/src/
  main.tsx                 ← BrowserRouter, ProtectedRoute (localStorage para_token)
  styles.css               ← Dark theme, tous les composants, media query mobile
  vite-env.d.ts            ← VITE_API_BASE_URL, VITE_QGIS_WMS_URL
  pages/
    Login.tsx              ← Form mock login, pre-rempli demo@para-oracle.app
    Map.tsx                ← Carte principale, boot ESRI satellite, LayerPanel, BetSheet
    Analysis.tsx           ← Carte NDVI, DateSelector, resolve oracle, EvidencePanel
  components/
    BetSheet.tsx           ← Bottom sheet pari (status badge, seuil, surface, CTA analyse)
    DateSelector.tsx       ← Chips T0/T1/Today + date picker custom
    FAB.tsx                ← Floating action button
    LayerPanel.tsx         ← Panneau QGIS-style (groupes, toggles, opacite, reorder)
    Legend.tsx             ← Mini legende NDVI/delta/mask (gradient + swatch)
    StatusBadge.tsx        ← Badge LIVE/mock depuis GET /oracle/status
  lib/
    api.ts                 ← Axios instance + types (Bet, Layer, OracleResult) + API object
    layerCategories.ts     ← CategorisedLayer, buildTileUrl, categorise, CATEGORY_META
    mapLayers.ts           ← syncLayers (reconciliation MapLibre), ensureBasemapRadio
```

## Routes

| Route | Page | Auth | Description |
|-------|------|------|-------------|
| `/login` | Login | non | Form email/password mock |
| `/` | MapPage | oui | Carte satellite + panneau couches + BetSheet |
| `/analysis/:slug` | Analysis | oui | Carte NDVI + timeline + oracle + preuves |

Auth = `localStorage.getItem("para_token")` verifie par `ProtectedRoute`.

## MapLibre — Architecture couches

### Boot basemap
La carte s'initialise avec `__boot` = ESRI World Imagery comme source initiale. Quand `syncLayers` detecte qu'un basemap app-managed est visible, `__boot` est masque.

### syncLayers(map, layers, selectedDate?)
Fonction centrale. Appellee a chaque changement de `layers` ou `selectedDate`.

1. Cache `__boot` si un basemap applicatif est visible
2. Itere `layers` trie par `display_order` ASC
3. Si la couche MapLibre existe : update visibility + opacity + tiles URL (si date-aware)
4. Si elle n'existe pas : `addSource` + `addLayer` avec `beforeId = para-fill/para-border`
5. `raster-fade-duration: 0` pour rendu instantane

### Z-stack (bas → haut)
```
__boot (ESRI satellite, masque)
basemap-satellite (ou OSM, Carto — radio exclusif)
  NASA satellite (MODIS/VIIRS true color)
    NASA NDVI 16-day
      Pipeline NDVI (ndvi-t0, ndvi-t1, delta, mask)
        Cadastres verifies (PRODES jaune 65%, DETER 65%)
          Hansen / GFW
            para-fill (vert 10% opacity)
              para-border (pointilles verts)
```

### Tile URLs
- **Basemaps** : URL externe directe (CDN, pas de proxy)
- **Tout le reste** : `{API_BASE}/tiles/{slug}/{z}/{x}/{y}.{ext}` via backend proxy
- **Date-aware** : `?date=YYYY-MM-DD` ajoute pour les couches NASA GIBS

Gere par `buildTileUrl(layer, dateIso?)` dans `layerCategories.ts`.

## Categories de couches

| Category | Slug prefix | Icon | Default opacity |
|----------|-------------|------|-----------------|
| `basemap` | `basemap-*` | 🗺️ | 1.0 |
| `satellite` | `nasa-*` (sauf firms) | 🛰️ | 1.0 |
| `verified` | `prodes*`, `deter*`, `hansen*`, `gfw-*` | 📜 | 0.65 |
| `ndvi` | `*ndvi*`, `delta*`, `mask*` | 🌿 | 1.0 |
| `fire` | `nasa-*firms*` | 🔥 | 1.0 |
| `vector` | tout le reste | 📐 | 1.0 |

## API calls (lib/api.ts)

```typescript
API.login(email, password)         // POST /auth/login
API.listBets()                     // GET /bets
API.getBet(slug)                   // GET /bets/{slug}
API.listLayers()                   // GET /layers
API.resolveBet(slug)               // POST /oracle/resolve/{slug}
API.listAnalyses(slug)             // GET /analyses?bet_slug={slug}
// /oracle/status appele directement par StatusBadge via api.get()
```

Token injecte automatiquement par interceptor Axios (`Authorization: Bearer`).

## Env vars

| Variable | Default | Usage |
|----------|---------|-------|
| `VITE_API_BASE_URL` | `http://localhost:8000` | Base URL du backend |
| `VITE_QGIS_WMS_URL` | `http://localhost:8080/wms` | WMS QGIS (non utilise) |

Definies dans `.env` a la racine du projet. Rechargement = restart container frontend.

## Regles pour l'agent

1. **TypeScript strict** — zero `any`, zero `@ts-ignore`. Verifier avec `npx tsc --noEmit`.
2. **Pas de state global** — tout en hooks locaux (useState, useCallback, useMemo, useRef).
3. **MapLibre** — ne JAMAIS creer une 2eme instance de map. Utiliser `mapRef.current`.
4. **syncLayers est idempotent** — safe to call on every render. Ne pas ajouter manuellement des layers MapLibre en dehors de syncLayers (sauf para-fill/border dans map.on('load')).
5. **Basemaps = radio exclusif** — utiliser `ensureBasemapRadio()` apres tout toggle.
6. **Proxy tiles** — les couches non-basemap passent par `/tiles/...` du backend. Construire l'URL via `buildTileUrl(layer, dateIso)`, JAMAIS hardcoder l'URL upstream.
7. **Mobile-first** — tester le responsive avec media query `max-width: 600px`. Le panneau couches descend sous le date selector sur mobile.
8. **Dark theme** — palette `#0f172a` (bg), `#1e293b` (cards), `#334155` (borders), `#10b981` (accent vert), `#94a3b8` (texte secondaire).
9. **Pas de commentaires** sauf quand le WHY est non-evident.
10. **Commits** : `<type>(bet-<id>): <description>` — push apres chaque task.
