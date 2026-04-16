# ParaOracle — Fonctionnement complet de l'application

> Document d'audit et d'explication technique
> Version : 0.1.0 | Date : 16 avril 2026

---

## 1. Vue d'ensemble

ParaOracle est un **oracle deterministe pour marches de prediction sur la deforestation amazonienne**. L'application repond a des questions de type :

> *"La deforestation dans l'etat du Para depassera-t-elle 4 200 km² entre janvier et juin 2025 ?"*

La reponse (**YES** ou **NO**) est calculee automatiquement par un pipeline de traitement d'images satellite Sentinel-2, sans intervention humaine. Le resultat est accompagne de **preuves cryptographiques** (hashes SHA-256, CID IPFS) qui permettent a quiconque de verifier et rejouer le calcul.

---

## 2. Architecture globale

```
┌─────────────────────────────────────────────────────────┐
│                    UTILISATEUR                          │
│              (navigateur / mobile)                      │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP
┌──────────────────────▼──────────────────────────────────┐
│               FRONTEND (React + MapLibre)                │
│  - Carte satellite interactive                           │
│  - Panneau de couches QGIS-style                         │
│  - Selecteur de dates (T0 / T1 / custom)                 │
│  - Bottom sheet : pari, marche, preuves                  │
│  - Onboarding guide 5 etapes                             │
│  Port 3000                                               │
└──────────────────────┬──────────────────────────────────┘
                       │ API REST (axios + Bearer token)
┌──────────────────────▼──────────────────────────────────┐
│               BACKEND (FastAPI + Python 3.12)            │
│                                                          │
│  /auth       → Login mock (MVP)                          │
│  /bets       → CRUD paris + geometrie PostGIS            │
│  /layers     → Config 16 couches cartographiques         │
│  /oracle     → Resolution deterministe (pipeline NDVI)   │
│  /analyses   → Historique des resolutions + preuves      │
│  /tiles      → Proxy cache tuiles (PRODES, DETER, NASA)  │
│  /user-bets  → Placements utilisateurs + stats marche    │
│  /zones      → Zones de deforestation detectees           │
│  Port 8000                                               │
└──────┬───────────────┬──────────────────────────────────┘
       │               │
       │  SQL           │  HTTP (upstream tiles)
       │               │
┌──────▼───────┐  ┌────▼──────────────────────────────────┐
│  PostgreSQL  │  │        SOURCES EXTERNES                │
│  + PostGIS   │  │                                        │
│              │  │  Copernicus STAC → Sentinel-2 L2A      │
│  7 tables    │  │  TerraBrasilis   → PRODES, DETER       │
│  16 couches  │  │  NASA GIBS       → MODIS, VIIRS        │
│  3 paris     │  │  GFW CloudFront  → Hansen tree loss    │
│  Port 5434   │  │  ESRI            → World Imagery       │
└──────────────┘  └───────────────────────────────────────┘
```

---

## 3. Flux principal : resolution d'un pari

### Etape 1 — L'utilisateur ouvre l'application

1. **Login** : email + mot de passe mock → token stocke en `localStorage`
2. **Page Map** : carte satellite ESRI centree sur le Para (zoom 6)
3. Les couches **PRODES** (deforestation cumulee, jaune) et **DETER** (alertes, orange) s'affichent automatiquement par-dessus l'imagerie satellite
4. La **frontiere du Para** est tracee en pointilles verts
5. Le **BetSheet** en bas affiche la question du pari, le seuil, la periode

### Etape 2 — L'utilisateur navigue vers l'analyse

1. Clic sur **"Voir l'analyse NDVI"** → route `/analysis/para-deforestation-2025-s1`
2. La carte passe en mode analyse :
   - Basemap satellite par defaut
   - Couche **delta-NDVI** visible a 75% d'opacite
   - Couche **VIIRS true color** visible
3. Le **selecteur de dates** propose T0 (1er janvier 2025), T1 (30 juin 2025), ou aujourd'hui
4. Le **panneau de couches** permet d'activer/desactiver 16 couches avec opacite individuelle

### Etape 3 — Declenchement de l'oracle

L'utilisateur clique **"Declencher l'oracle"**. Voici ce qui se passe cote backend :

```
POST /oracle/resolve/para-deforestation-2025-s1
```

#### 3a. Recuperation du pari

```python
bet = db.query(Bet).filter(Bet.slug == "para-deforestation-2025-s1").first()
# → question, region_geom (MultiPolygon 80 sommets), dates, seuils
```

#### 3b. Extraction de la geometrie PostGIS

```sql
SELECT ST_AsText(region_geom) FROM bets WHERE id = :bet_id
-- → 'MULTIPOLYGON(((-48.1946 -4.911, -47.6152 -4.56, ...)))'
```

#### 3c. Configuration du pipeline

```python
PipelineConfig(
    bet_slug = "para-deforestation-2025-s1",
    period_start = 2025-01-01,
    period_end = 2025-06-30,
    region_geom_wkt = "MULTIPOLYGON(...)",
    ndvi_drop_threshold = 0.3,      # pixel deforeste si delta NDVI < -0.3
    threshold_km2 = 4200.0,         # surface totale pour YES
    max_cloud_cover = 20.0,         # rejeter scenes > 20% nuages
    composite_window_days = 15,     # fenetre temporelle du composite
    revisit_delay_days = 2          # attendre T+48h apres fin de periode
)
```

#### 3d. Recherche des images Sentinel-2

**Fenetre T0** : 1er → 16 janvier 2025
**Fenetre T1** : 25 juin → 9 juillet 2025 (centre sur period_end + 2 jours)

```python
copernicus_client.search_s2_l2a(
    bbox = [-59.0, -9.8, -46.0, 2.6],  # Para
    date_start = 2025-01-01,
    date_end = 2025-01-16,
    max_cloud_cover = 20.0
)
# → Liste de SentinelProduct (ID, tuile, nuages, URLs bandes B04/B08)
```

En mode mock : 2 produits fictifs par fenetre (tuiles 22LDH et 22MDT).

#### 3e. Calcul NDVI

Pour chaque fenetre temporelle :

```
NDVI = (B8_NIR - B4_RED) / (B8_NIR + B4_RED)
```

- Valeur -1 a +1
- Vegetation dense : NDVI > 0.6
- Sol nu / eau : NDVI < 0.2
- **Composite** : mediane temporelle sur toutes les scenes de la fenetre (elimine les nuages)

#### 3f. Calcul du delta

```
Delta_NDVI = NDVI_T1 - NDVI_T0
```

- Valeur negative = **perte de vegetation**
- Valeur positive = **croissance**

#### 3g. Masque binaire de deforestation

```
Masque = (Delta_NDVI < -0.3) → 1 (deforeste), sinon 0
```

Le seuil -0.3 est le standard scientifique pour distinguer deforestation reelle vs variation saisonniere naturelle.

#### 3h. Clip au polygone du Para

Le masque est decoupe au contour exact de l'etat du Para (80 sommets, projection SIRGAS 2000 / EPSG:5880 pour surface precise).

#### 3i. Aggregation de surface

```
surface_km2 = nombre_pixels_deforestes × 100 m² / 1 000 000
```

Chaque pixel Sentinel-2 = 10m × 10m = 100 m².

#### 3j. Decision

```
SI surface_km2 > 4200 → YES (deforestation depasse le seuil)
SINON → NO
```

En mode mock : ~5053 km² → **YES**

#### 3k. Generation des preuves

5 fichiers produits, chacun hashe en SHA-256 :

| Fichier | Hash | Contenu |
|---------|------|---------|
| `ndvi_t0.tif` | `sha256:d6eda4...` | Composite NDVI debut de periode |
| `ndvi_t1.tif` | `sha256:1c8b29...` | Composite NDVI fin de periode |
| `delta.tif` | `sha256:cc047d...` | Delta NDVI (T1 - T0) |
| `mask.tif` | `sha256:35c40d...` | Masque binaire deforestation |
| script source | `sha256:9d5398...` | Code du pipeline (version + source) |

Plus un **CID IPFS** (identifiant de contenu decentralise) pour publication publique future.

#### 3l. Persistance

1. **Analyse** sauvegardee dans `analyses` (hashes, surface, duree, produits Sentinel)
2. **Pari** mis a jour : `status = RESOLVED_YES`, `resolved_value = 5052.79`, `resolved_at = now()`
3. **Placements utilisateurs** regles automatiquement :

```sql
UPDATE user_bets
SET status = CASE
  WHEN position = 'YES' THEN 'WON'    -- ils avaient raison
  ELSE 'LOST'                          -- ils avaient tort
END,
settled_at = '2026-04-16T...'
WHERE bet_id = :id AND status = 'PENDING'
```

### Etape 4 — Affichage du resultat

Le frontend recoit l'`OracleResult` :

```json
{
  "bet_id": "para-deforestation-2025-s1",
  "resolved_outcome": "YES",
  "surface_deforestee_km2": 5052.79,
  "threshold_km2": 4200.0,
  "evidence": {
    "script_hash": "sha256:9d5398...",
    "ndvi_t0_hash": "sha256:d6eda4...",
    "ndvi_t1_hash": "sha256:1c8b29...",
    "delta_hash": "sha256:cc047d...",
    "mask_hash": "sha256:35c40d...",
    "ipfs_cid": "bafybei7d39c0c3867db...",
    "sentinel_products_t0": ["S2A_MSIL2A_..."],
    "sentinel_products_t1": ["S2A_MSIL2A_..."],
    "analysis_id": "uuid"
  }
}
```

L'utilisateur voit :
- **YES** en grand vert (ou NO en rouge)
- La surface exacte (5052.79 km²)
- Les 6 hashes copiables (pour verification independante)
- Le nombre de scenes Sentinel-2 utilisees
- Les zones de deforestation detectees sur la carte (si expandees)

---

## 4. Systeme de couches cartographiques

### 4.1 Les 16 couches

Stockees dans la table `layers` de PostgreSQL. Le frontend les charge via `GET /layers`.

| # | Slug | Source | Type | Visible |
|---|------|--------|------|---------|
| 1 | basemap-osm | OpenStreetMap | XYZ direct | non |
| 2 | basemap-satellite | ESRI World Imagery | XYZ direct | **oui** |
| 3 | basemap-carto-dark | CARTO | XYZ direct | non |
| 4 | nasa-modis-truecolor | NASA GIBS | XYZ proxy | non |
| 5 | nasa-viirs-truecolor | NASA GIBS | XYZ proxy | non |
| 6 | nasa-modis-ndvi | NASA GIBS | XYZ proxy | non |
| 7 | nasa-viirs-firms | NASA FIRMS | XYZ proxy | non |
| 8 | ndvi-t0 | Pipeline local | XYZ proxy | non |
| 9 | ndvi-t1 | Pipeline local | XYZ proxy | non |
| 10 | delta-ndvi | Pipeline local | XYZ proxy | non |
| 11 | mask-deforestation | Pipeline local | XYZ proxy | non |
| 12 | prodes-accumulated | INPE TerraBrasilis | WMS proxy | **oui** |
| 13 | prodes-yearly | INPE TerraBrasilis | WMS proxy | non |
| 14 | deter-amz | INPE TerraBrasilis | WMS proxy | **oui** |
| 15 | hansen-tree-loss | GFW / Hansen | XYZ proxy | non |
| 16 | para-border | Local GeoJSON | vecteur | **oui** |

### 4.2 Proxy de tuiles avec cache

Les couches 4 a 15 passent par le backend (`/tiles/{slug}/{z}/{x}/{y}.png`).

**Premier acces** : le backend fetch la tuile depuis la source externe, la sauvegarde dans `/data/tile-cache/{slug}/{z}/{x}/{y}.png`, puis la retourne.

**Acces suivants** : lecture directe depuis le disque. Zero latence reseau.

**Pre-chargement** : `POST /tiles/warmup` telecharge toutes les tuiles PRODES + DETER pour le Para (zoom 4-8, ~280 tuiles, 8 MB). Apres ca, l'application fonctionne **sans connexion** aux API INPE.

### 4.3 Z-stack (ordre d'empilement)

De bas en haut sur la carte :

```
1. Basemap satellite (ESRI)
2. Imagerie NASA (MODIS/VIIRS true color)
3. NASA NDVI 16-day
4. Pipeline NDVI (T0, T1, delta, masque)
5. Cadastres verifies (PRODES jaune 65%, DETER orange 65%)
6. Hansen/GFW
7. Zones de deforestation detectees (geojson dynamique)
8. Remplissage region Para (vert 10%)
9. Frontiere Para (pointilles verts)
```

Les cadastres INPE sont semi-transparents (65%) pour que l'imagerie satellite reste visible en-dessous — c'est la **superposition** des deux qui prouve visuellement le resultat.

---

## 5. Systeme de paris et marche

### 5.1 Structure d'un pari

| Champ | Exemple |
|-------|---------|
| `slug` | `para-deforestation-2025-s1` |
| `question` | La deforestation dans l'etat du Para depassera-t-elle 4 200 km²... |
| `region_geom` | MultiPolygon PostGIS (80 sommets, SRID 4326) |
| `period_start` | 2025-01-01 |
| `period_end` | 2025-06-30 |
| `threshold_value` | 4200 |
| `threshold_unit` | km2 |
| `ndvi_drop_threshold` | 0.3 |
| `status` | OPEN → RESOLVED_YES / RESOLVED_NO / ERROR |

### 5.2 Placements utilisateurs

Table `user_bets` :

| Champ | Type | Description |
|-------|------|-------------|
| `position` | YES / NO | Le pari de l'utilisateur |
| `amount` | Numeric | Montant mise (ex: 50.00) |
| `odds` | Numeric | Cote (ex: 1.850) |
| `potential_payout` | Generated | amount × odds (calcule automatiquement) |
| `status` | PENDING → WON / LOST | Regle par l'oracle |
| `settled_at` | Timestamp | Date de reglement |

### 5.3 Stats marche

`GET /user-bets/by-bet/{slug}/stats` retourne :

```json
{
  "total_volume": 850.00,
  "total_bets": 10,
  "yes_volume": 510.00,
  "no_volume": 340.00,
  "yes_count": 6,
  "no_count": 4,
  "yes_pct": 60.0,
  "avg_odds_yes": 1.85,
  "avg_odds_no": 2.10
}
```

### 5.4 Reglement automatique

Quand l'oracle resout un pari, **tous les placements PENDING sont regles en une seule requete SQL** :
- Position correcte → `WON`
- Position incorrecte → `LOST`

Pas d'intervention humaine, pas de delai.

---

## 6. Zones de deforestation

Table `deforestation_zones` : zones geographiques nommees ou la deforestation est detectee.

| Champ | Description |
|-------|-------------|
| `zone_name` | Ex: "Sao Felix do Xingu", "Altamira Nord" |
| `source` | PRODES, DETER, ou NDVI (pipeline) |
| `surface_km2` | Surface deforestee dans cette zone |
| `confidence` | 0.0 a 1.0 (niveau de confiance) |
| `detected_at` | Date de detection |
| `geojson` | Polygone GeoJSON de la zone |

Ces zones sont affichees sur la carte en overlay colore :
- **PRODES** (jaune) : deforestation confirmee par l'INPE
- **DETER** (orange) : alertes quasi temps reel
- **NDVI** (vert) : detectee par le pipeline ParaOracle

---

## 7. Garanties de determinisme

Le pipeline est concu pour que **toute execution avec les memes entrees produise exactement les memes sorties**.

| Garantie | Mecanisme |
|----------|-----------|
| Memes images satellite | Recherche STAC avec bbox + dates fixes |
| Meme calcul NDVI | Formule fixe (B8-B4)/(B8+B4), composite median |
| Meme masque | Seuil -0.3 fixe, pas d'arrondi intermediaire |
| Meme surface | Comptage pixels exact, resolution 10m fixe |
| Meme decision | Comparaison > 4200 km² deterministe |
| Mock reproductible | PRNG seed = `bet_slug` → meme sequence aleatoire |
| Preuve verifiable | SHA-256 de chaque fichier intermediaire |
| Code auditable | Hash du script source inclus dans les preuves |

**Test CI** : le workflow GitHub Actions execute le pipeline 3 fois et verifie que les 5 hashes sont identiques.

---

## 8. Base de donnees

### Schema (7 tables)

```sql
users_mock          -- 4 utilisateurs demo
layers              -- 16 couches cartographiques
bets                -- 3 paris (Para, Rondonia, Mato Grosso)
analyses            -- Resultats pipeline + preuves
raster_snapshots    -- Fichiers rasters indexes
user_bets           -- Placements utilisateurs (10+4+4 = 18 seed)
deforestation_zones -- Zones detectees (8+3+3 = 14 seed)
```

### Extensions PostGIS

- `postgis` : types GEOMETRY, fonctions spatiales (ST_AsText, ST_Multi, etc.)
- `pgcrypto` : generation UUID, hashing
- `uuid-ossp` : uuid_generate_v4()

### Donnees seed

- **3 paris** : Para (OPEN), Rondonia (OPEN), Mato Grosso (RESOLVED_NO)
- **4 utilisateurs** : demo, alice_forest, bob_verde, carla_geo
- **18 placements** : mix YES/NO, cotes variees, PENDING et settles
- **14 zones de deforestation** : noms reels, surfaces realistes, sources variees
- **16 couches** : URLs upstream reelles, display_order, visible_default

---

## 9. Infrastructure

### Docker Compose (3 services actifs)

| Service | Image | Port | Volume |
|---------|-------|------|--------|
| `db` | postgis/postgis:16-3.4 | 5434 | `db_data` (persist) + `db/init/` (scripts SQL) |
| `backend` | build `./backend` | 8000 | `./backend:/app` + `./data:/data` |
| `frontend` | build `./frontend` | 3000 | `./frontend:/app` |

### Tile cache

```
/data/tile-cache/
├── prodes-accumulated/     141 tuiles (zoom 4-8, Para)
├── deter-amz/              138 tuiles (zoom 4-8, Para)
├── hansen-tree-loss/       a la demande
├── nasa-modis-ndvi/        par date (YYYY-MM-DD/z/x/y.png)
└── nasa-modis-truecolor/   par date (YYYY-MM-DD/z/x/y.jpg)
```

Total apres warmup : **282 tuiles, 7.9 MB**.

### CI/CD (GitHub Actions)

5 jobs sur push/PR :
1. Lint backend (ruff + mypy)
2. Tests backend (pytest + PostGIS service)
3. **Reproductibilite** (3 runs pipeline mock → hashes identiques)
4. Lint + build frontend (tsc + vite)
5. Build images Docker

---

## 10. Securite et limites actuelles

| Aspect | Etat actuel | Production |
|--------|-------------|------------|
| Auth | Token mock string | JWT signe + OAuth2 |
| HTTPS | Non (HTTP dev) | TLS obligatoire |
| Secrets | `.env` gitignore | Vault / secrets manager |
| Rate limiting | Aucun | FastAPI middleware |
| Pipeline | Mock deterministe | Reel rioxarray + Sentinel Hub |
| IPFS | CID mock (`bafybei...`) | Pin reel Pinata/web3.storage |
| On-chain | Aucun | Solidity ParaOracle.sol Sepolia |
| Paiements | Montants fictifs | Integration wallet/fiat |

---

## 11. Comment verifier le resultat (audit)

Toute personne souhaitant verifier le resultat d'un pari peut :

1. **Consulter les preuves** : `GET /analyses/{analysis_id}` retourne les 5 hashes + produits Sentinel
2. **Telecharger les rasters** : les fichiers `.tif` sont dans `/data/rasters/{bet_slug}/`
3. **Recalculer le hash** : `sha256sum ndvi_t0.tif` doit correspondre au `ndvi_t0_hash`
4. **Rejouer le pipeline** : meme PipelineConfig → memes hashes (test CI le prouve)
5. **Verifier le script** : le `script_hash` hashe le code source du pipeline → toute modification est detectable
6. **Comparer aux sources officielles** : les couches PRODES et DETER (INPE) sont affichees directement sur la carte pour comparaison visuelle
7. **Verifier les images satellite** : les produits Sentinel-2 (IDs + STAC URIs) sont traces, telechargeables depuis Copernicus

La superposition **satellite + cadastre INPE + masque NDVI** sur la carte constitue la **preuve visuelle** que le resultat de l'oracle correspond a la realite observable.
