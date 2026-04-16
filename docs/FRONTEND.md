# ParaOracle Frontend — Documentation technique

> **Framework** : React 18 + TypeScript + Vite 5
> **Carte** : MapLibre GL JS 4.7
> **URL** : `http://localhost:3000` (dev) | `http://192.168.1.93:3000` (LAN)

---

## Architecture

```
                     ProtectedRoute
                          │
          ┌───────────────┼──────────────┐
          │               │              │
       /login            /         /analysis/:slug
       Login.tsx      Map.tsx      Analysis.tsx
                         │              │
                    ┌────┴────┐    ┌────┴────┐
                    │         │    │         │
               LayerPanel  BetSheet  DateSelector  Legend
                    │                    │
               mapLayers.ts      layerCategories.ts
                    │                    │
               MapLibre GL          buildTileUrl()
                    │                    │
               syncLayers()      /tiles/{slug}/{z}/{x}/{y}
                                  (backend proxy)
```

## Pages

### Login (`/login`)

Formulaire mock. Pre-rempli avec `demo@para-oracle.app` / `demo1234`.

**Flux** : POST `/auth/login` → stocke `para_token` + `para_user` dans localStorage → redirect `/`.

### Map (`/`)

Carte plein ecran centree sur le Para (-52.5, -4.0) zoom 6.

**Etat** :
- `bet` : pari demo charge depuis `/bets/para-deforestation-2025-s1`
- `layers` : 16 couches depuis `/layers`, categorisees et triees
- `showSheet` : visibilite du bottom sheet

**Composants** :
- Header fixe : logo ParaOracle + StatusBadge (mock/live) + bouton logout
- Carte MapLibre : basemap ESRI satellite, polygone Para vert, couches PRODES/DETER
- LayerPanel : panneau droit, QGIS-style
- FAB : bouton satellite flottant (ouvre BetSheet)
- BetSheet : bottom sheet avec question, seuil, surface, CTA analyse

### Analysis (`/analysis/:slug`)

Carte d'analyse NDVI avec timeline et resolution oracle.

**Etat additionnel** :
- `selectedDate` : date ISO appliquee aux couches NASA GIBS
- `result` : OracleResult apres resolution
- `resolving` : flag de chargement

**Defaults specifiques** :
- Basemap satellite (pas OSM)
- delta-ndvi visible a 75% d'opacite
- VIIRS true color visible

**Composants additionnels** :
- DateSelector : chips T0/T1/Today + custom picker
- Legend : gradient NDVI/delta ou swatch masque (contextuel)
- EvidencePanel : 6 hashes SHA-256 + compteur scenes Sentinel + boutons copier
- Bouton "Declencher l'oracle" → POST `/oracle/resolve/{slug}`

---

## Composants

### LayerPanel

Panneau de couches inspire de QGIS. Pliable en icone.

| Fonctionnalite | Implementation |
|----------------|----------------|
| Groupes par categorie | `CATEGORY_META` (6 categories avec emoji + label) |
| Toggle visibilite | Icone Eye/EyeOff, callback `onToggle(slug)` |
| Slider opacite | Range input 0-100%, callback `onOpacity(slug, value)` |
| Reorder | Boutons fleches ↑↓, swap `display_order` |
| Basemap radio | `ensureBasemapRadio()` — un seul basemap visible |
| Compteur | `N/Total` par groupe |

**Mobile** (< 600px) : `top: 106px` (sous DateSelector), largeur `calc(100vw - 20px)`.

### DateSelector

Selecteur de dates pour couches temporelles (NASA GIBS).

| Chip | Valeur | Couleur active |
|------|--------|----------------|
| T0 | `bet.period_start` | Vert |
| T1 | `bet.period_end` | Vert |
| Aujourd'hui | J-1 UTC | Vert |
| Calendrier | Ouvre picker custom | Vert |

**Picker custom** : `<input type="date">` avec boutons `<` `>` (±1 jour). Min = period_start, max = J-1.

**Hint** : `"N couche(s) NASA affectee(s)"` si des couches date-aware sont visibles.

### BetSheet

Bottom sheet avec les infos du pari.

**Contenu** :
- Badge status colore (OPEN bleu, YES vert, NO rouge)
- Question du pari
- Grille : periode + seuil
- Surface deforestee (si resolu)
- CTA "Voir l'analyse NDVI"

### Legend

Mini legende positionnee en bas a gauche. Affichee uniquement si une couche NDVI est visible.

| Type | Rendu |
|------|-------|
| `ndvi` | Gradient rouge → jaune → vert (-1 a +1) |
| `delta` | Gradient rouge → vert (-0.5 a +0.5) |
| `mask` | Swatch rouge + "delta NDVI < -0.3" |

### StatusBadge

Pastille dans le header. Appelle `GET /oracle/status` au mount.

- **Mode live** : `Copernicus LIVE` (vert, icone satellite)
- **Mode mock** : `Mode demo` (ambre, icone alerte)

---

## Librairie (lib/)

### api.ts

Client HTTP avec token automatique.

```typescript
const api = axios.create({ baseURL: VITE_API_BASE_URL });
// Interceptor ajoute Authorization: Bearer {para_token}

const API = {
  login(email, password)       // POST /auth/login
  listBets()                   // GET /bets
  getBet(slug)                 // GET /bets/{slug}
  listLayers()                 // GET /layers
  resolveBet(slug)             // POST /oracle/resolve/{slug}
  listAnalyses(slug)           // GET /analyses?bet_slug={slug}
}
```

**Types exportes** : `BetSummary`, `Bet`, `Layer`, `OracleResult`

### layerCategories.ts

Categorisation et construction d'URLs de tuiles.

**Fonctions cles** :
- `categorise(layers)` : transforme `Layer[]` en `CategorisedLayer[]` avec category, opacity, visible
- `buildTileUrl(layer, dateIso?)` : construit l'URL finale
  - Basemaps → URL externe directe
  - Tout le reste → `{API_BASE}/tiles/{slug}/{z}/{x}/{y}.{ext}[?date=]`
- `isDateAware(url)` : detecte `{date}` dans l'URL
- `inferCategory(slug)` : infere la categorie depuis le prefix du slug

**Constantes** :
- `VERIFIED_DEFAULT_OPACITY = 0.65`
- `CATEGORY_META` : 6 categories avec label FR, emoji, ordre d'affichage

### mapLayers.ts

Reconciliation idempotente MapLibre ↔ etat React.

**`syncLayers(map, layers, selectedDate?)`** :
1. Masque `__boot` quand un basemap applicatif est visible
2. Pour chaque couche (tri display_order ASC) :
   - Existe deja → update visibility + opacity + tiles URL
   - N'existe pas → addSource + addLayer (beforeId = para-fill/border)
3. `raster-fade-duration: 0` pour affichage instantane
4. try/catch par couche — une erreur n'arrete pas les autres

**`ensureBasemapRadio(layers, slug)`** : desactive tous les basemaps sauf celui active.

---

## Styles (styles.css)

Theme sombre mobile-first.

**Palette** :
| Token | Couleur | Usage |
|-------|---------|-------|
| bg | `#0f172a` | Fond principal |
| card | `#1e293b` | Panels, sheets |
| border | `#334155` | Bordures |
| accent | `#10b981` | Boutons, liens, Para border |
| text | `#e2e8f0` | Texte principal |
| text-muted | `#94a3b8` | Texte secondaire |
| yes | `#34d399` | Resultat YES |
| no | `#f87171` | Resultat NO |
| mock | `#fbbf24` | Badge mode demo |

**Responsive** : `@media (max-width: 600px)` pour mobile — date selector full-width, layer panel sous la timeline.

---

## Build et deploiement

### Dev (Docker)
```bash
docker compose up frontend
# → http://localhost:3000 (HMR active)
# Volume: ./frontend:/app (sauf node_modules)
```

### Build production
```bash
cd frontend
npm run build     # tsc -b + vite build → dist/
npm run preview   # serve dist/ en local
```

### TypeScript check
```bash
npx tsc --noEmit  # ou dans le container:
docker compose exec frontend npx tsc --noEmit
```

### Variables d'environnement
Definies dans `.env` a la racine. Prefixe `VITE_` requis pour injection Vite.

```env
VITE_API_BASE_URL=http://192.168.1.93:8000
VITE_QGIS_WMS_URL=http://192.168.1.93:8080/wms
```

Changement = restart container frontend (pas de HMR sur les env vars).

---

## Dependances

| Package | Version | Role |
|---------|---------|------|
| react | 18.3.1 | UI rendering |
| react-dom | 18.3.1 | DOM binding |
| react-router-dom | 6.27.0 | Client routing (3 routes) |
| maplibre-gl | 4.7.1 | Rendu carte raster/vector |
| axios | 1.7.7 | HTTP client (API backend) |
| lucide-react | 0.454.0 | Icones (Eye, ChevronLeft, Play, Copy, etc.) |
| zustand | 5.0.1 | State management (installe, non utilise) |
| typescript | 5.6.3 | Type checking |
| vite | 5.4.10 | Build + dev server + HMR |

---

## Nouveaux composants (v0.2)

### Page Map (/) — Multi-bet
- **BetCarousel** : carousel horizontal style Polymarket avec icone categorie, region, seuil, resultat/statut
- Chaque bet affiche sa zone coloree sur la carte (vert deforestation, ambre wildfire, bleu flood)
- Click -> fly-to anime + BetSheet

### Page Analysis — Preuves et verdict
- **MarketStats** : volume total, barre YES/NO, cotes moyennes, position utilisateur
- **BetTimeline** : dots chronologiques sur barre horizontale (taille par montant, couleur par position)
- **EvidenceDetail** : timeline verticale des zones detectees (PRODES jaune, DETER orange, NDVI vert)
- **VerdictPanel** : surface detectee vs seuil, sources geospatiales, repartition gains (gagnants/perdants)
- **OnboardingOverlay** : tutorial 5 etapes au premier lancement (localStorage)

### Couches cartographiques
- Masque region (polygone inverse, opacity 88% hors zone)
- Zones deforestation (glow + fill + contour, couleur par source)
- Camera verrouillee dans la zone (maxBounds + minZoom)
- Animation fly-to au chargement (depart zoom 3, arrivee fitBounds 2s)
- Bounds sur sources raster (limite les requetes de tiles au bbox region)
- Toggle direct MapLibre (setLayoutProperty sans passer par React)

### Bottom sheet collapsible
- Handle avec label "Reduire" / "Afficher details"
- Collapsed : pastille centree compacte
- Expanded : scroll complet avec toutes les sections
