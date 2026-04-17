# ParaOracle V1 — Plan d'architecture complet

> Document de reference definitif pour l'implementation.
> Chaque section est executable. Pas de "a faire plus tard".
> Date : 17 avril 2026

---

## 1. VISION

ParaOracle est un **marche de prediction environnemental** resolu par des **preuves satellite**.

Un utilisateur :
1. Voit 30+ paris sur une carte mondiale (deforestation, feux, inondations, glaciers, mines, secheresse, urbanisation, qualite de l'eau)
2. Explore chaque pari avec des couches satellite datees + cadastres de verite terrain superposes
3. Place des mises YES/NO avec un solde simule de 10 000 EUR (ou connecte son wallet pour du on-chain)
4. Declenche l'oracle qui calcule automatiquement le resultat via indices spectraux
5. Voit le verdict avec preuves SHA-256, CID IPFS, et comparaison visuelle satellite vs cadastre

**Ce qui distingue ParaOracle** : le resultat n'est pas une opinion — c'est un **calcul deterministe** sur des images satellite publiques, verifiable par n'importe qui.

---

## 2. SOURCES DE VERITE — REGISTRE COMPLET

Chaque pari est resolu en comparant l'oracle (indices spectraux Sentinel-2) avec des **cadastres officiels** superposes visuellement.

### 2.1 Sources de verite par categorie

#### DEFORESTATION
| Source | Institution | URL WMS/XYZ | Couverture | Frequence |
|--------|-----------|-------------|-----------|-----------|
| PRODES cumule | INPE (Bresil) | `https://terrabrasilis.dpi.inpe.br/geoserver/ows?service=WMS&layers=prodes-legal-amz:accumulated_deforestation_2007&...` | Amazonie legale | Annuel |
| PRODES annuel | INPE | `layers=prodes-legal-amz:yearly_deforestation` | Amazonie legale | Annuel |
| DETER alertes | INPE | `layers=deter-amz:deter_amz` | Amazonie legale | Quasi-temps reel |
| Hansen tree loss | UMD/Google/NASA | `https://tiles.globalforestwatch.org/umd_tree_cover_loss/latest/dynamic/{z}/{x}/{y}.png` | Global 30m | Annuel |
| MapBiomas LULC | MapBiomas | `https://plataforma.brasil.mapbiomas.org/geoserver/wms?layers=mapbiomas-brasil:col9_coverage_2023` | Bresil 30m | Annuel |
| GLAD alerts | UMD | `https://tiles.globalforestwatch.org/gfw_integrated_alerts/latest/default/{z}/{x}/{y}.png` | Global | Hebdo |

#### FEUX / ZONES BRULEES
| Source | Institution | URL | Couverture | Frequence |
|--------|-----------|-----|-----------|-----------|
| VIIRS FIRMS | NASA | `https://firms.modaps.eosdis.nasa.gov/mapserver/wms/fires/?layers=fires_viirs_snpp_24` | Global | 24h |
| MCD64A1 | NASA MODIS | `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Thermal_Anomalies_Day/default/{date}/...` | Global 500m | Quotidien |
| INPE Queimadas | INPE | `http://queimadas.dgi.inpe.br/queimadas/geoserver/wms?layers=bdqueimadas:focos` | Bresil | Horaire |

#### INONDATION / HYDROLOGIE
| Source | Institution | URL | Couverture | Frequence |
|--------|-----------|-----|-----------|-----------|
| JRC Global Surface Water | JRC/EC | `https://storage.googleapis.com/global-surface-water/tiles2021/occurrence/{z}/{x}/{y}.png` | Global 30m | Annuel |
| Copernicus EMS | EC | `https://emergency.copernicus.eu/mapping/ems/...` | Ponctuel | Evenementiel |
| MODIS Flood Map | NASA | `https://floodmap.modaps.eosdis.nasa.gov/...` | Global 250m | 3 jours |

#### MINES / SOL NU
| Source | Institution | URL | Couverture | Frequence |
|--------|-----------|-----|-----------|-----------|
| MapBiomas Mining | MapBiomas | WMS via geoserver MapBiomas | Bresil | Annuel |
| Global Mining Footprint | Maus et al. | GeoJSON dataset | Global | Snapshot |

#### GLACIERS / NEIGE
| Source | Institution | URL | Couverture | Frequence |
|--------|-----------|-----|-----------|-----------|
| GLIMS | NSIDC | Shapefiles telechargeables | Global | Irregulier |
| MODIS Snow Cover | NASA | `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Snow_Cover/default/{date}/...` | Global 500m | Quotidien |

#### URBANISATION
| Source | Institution | URL | Couverture | Frequence |
|--------|-----------|-----|-----------|-----------|
| GHSL Built-up | JRC/EC | `https://ghsl.jrc.ec.europa.eu/geoserver/ows?layers=jrc_ghsl_built_c_mssglc_2018` | Global 10m | ~5 ans |
| ESA WorldCover | ESA | `https://services.terrascope.be/wmts/v2?layer=WORLDCOVER_2021_MAP` | Global 10m | Annuel |

#### QUALITE DE L'EAU
| Source | Institution | URL | Couverture | Frequence |
|--------|-----------|-----|-----------|-----------|
| Copernicus Marine | EC | API produits ocean color | Global | Quotidien |
| NASA Ocean Color | NASA | `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Chlorophyll_A/default/{date}/...` | Global | 8 jours |

### 2.2 Indices spectraux Sentinel-2

| Indice | Formule | Bandes | Detection | Seuil type |
|--------|---------|--------|-----------|------------|
| NDVI | (B8-B4)/(B8+B4) | NIR+RED 10m | Vegetation | delta < -0.3 |
| EVI | 2.5*(B8-B4)/(B8+6*B4-7.5*B2+1) | NIR+RED+BLUE 10m | Vegetation dense | delta < -0.2 |
| NBR | (B8-B12)/(B8+B12) | NIR+SWIR2 20m | Zones brulees | dNBR > 0.27 |
| NDWI | (B3-B8)/(B3+B8) | GREEN+NIR 10m | Eau/inondation | > 0.3 |
| MNDWI | (B3-B11)/(B3+B11) | GREEN+SWIR 20m | Eau (urbain) | > 0.3 |
| NDBI | (B11-B8)/(B11+B8) | SWIR+NIR 20m | Bati | delta > 0.15 |
| BSI | ((B11+B4)-(B8+B2))/((B11+B4)+(B8+B2)) | 4 bandes 20m | Sol nu/mines | delta > 0.1 |
| NDSI | (B3-B11)/(B3+B11) | GREEN+SWIR 20m | Neige/glace | < 0.4 = fonte |

---

## 3. CATALOGUE DE PARIS — 31 PARIS

### 3.1 Bets existants (9 seeded)

| # | Slug | Categorie | Region | Indice | Seuil | Verite terrain | Status |
|---|------|-----------|--------|--------|-------|----------------|--------|
| 1 | para-deforestation-2025-s1 | deforestation | Para, Brazil | NDVI | 4200 km2 | PRODES + DETER | OPEN |
| 2 | rondonia-deforestation-2025-s1 | deforestation | Rondonia, Brazil | NDVI | 3000 km2 | PRODES + DETER | OPEN |
| 3 | mato-grosso-fires-2025-s1 | wildfire | Mato Grosso, Brazil | NBR | 1500 km2 | FIRMS + Queimadas | RESOLVED_NO |
| 4 | br163-deforestation-fires-2025 | deforestation | BR-163, Brazil | NDVI+NBR | 1200 km2 | PRODES + FIRMS | OPEN |
| 5 | para-fires-primary-2025 | wildfire | Para, Brazil | NBR+NDVI | 50% | FIRMS + PRODES | OPEN |
| 6 | tapajos-flood-2026 | flood | Tapajos, Brazil | NDWI | +30% | JRC Water | OPEN |
| 7 | tapajos-mining-2025 | mining | Tapajos EPA, Brazil | BSI | 15 km2 | MapBiomas Mining | OPEN |
| 8 | mt-soja-drought-2026 | drought | Mato Grosso, Brazil | NDVI anomaly | 40% | - | OPEN |
| 9 | se-para-fires-deforestation-2025 | deforestation | SE Para, Brazil | NDVI+NBR | 300 km2 | PRODES + FIRMS | OPEN |

### 3.2 Bets a seeder (22 additionnels, deja en DB)

| # | Slug | Categorie | Region | Indice |
|---|------|-----------|--------|--------|
| 10 | california-wildfire-2026 | wildfire | Southern California | NBR |
| 11 | canada-boreal-fires-2026 | wildfire | NWT/Alberta, Canada | NBR |
| 12 | greece-wildfire-2026 | wildfire | Evros/Attica, Greece | NBR |
| 13 | australia-bushfire-2026 | wildfire | Kosciuszko, Australia | NBR |
| 14 | great-salt-lake-2026 | drought | Utah, USA | NDWI |
| 15 | aral-sea-2026 | drought | South Aral Sea, Uzbekistan | MNDWI |
| 16 | lake-chad-2026 | drought | Lake Chad, Chad/Nigeria | NDWI |
| 17 | assam-flood-2026 | flood | Kaziranga, Assam | NDWI |
| 18 | ahr-valley-flood-2026 | flood | Ahr Valley, Germany | NDWI |
| 19 | istanbul-sprawl-2026 | urbanization | Istanbul, Turkey | NDBI |
| 20 | louisiana-wetland-loss-2026 | water_quality | Louisiana Coast, USA | NDWI+NDVI |
| 21 | mpumalanga-mining-2026 | mining | Mpumalanga, South Africa | BSI |
| 22 | cordillera-blanca-glacier-2026 | glacier | Cordillera Blanca, Peru | NDSI |
| 23 | franz-josef-glacier-2026 | glacier | Franz Josef, NZ | NDSI |
| 24 | aletsch-glacier-2026 | glacier | Aletsch, Switzerland | NDSI |
| 25 | gbr-sediment-2027 | water_quality | Great Barrier Reef, AUS | Turbidity |
| 26 | borneo-palm-oil-2026 | deforestation | Kalimantan, Indonesia | NDVI |
| 27 | chaco-deforestation-2026 | deforestation | Gran Chaco, Paraguay | NDVI |
| 28 | caqueta-deforestation-2026 | deforestation | Caqueta, Colombia | NDVI |
| 29 | madagascar-masoala-2026 | deforestation | Masoala-Makira, Madagascar | NDVI |
| 30 | congo-mai-ndombe-2026 | deforestation | Mai-Ndombe, DRC | NDVI |
| 31 | myanmar-logging-2026 | deforestation | Chin Hills, Myanmar | NDVI |

### 3.3 Chaque bet a besoin de

1. **Polygone region** (MultiPolygon 4326) — coordonnees officielles
2. **question** FR + **question_en** EN
3. **index_type** — quel indice spectral utiliser (NDVI, NBR, NDWI, BSI, NDSI, NDBI)
4. **change_direction** — decrease (perte) / increase (gain) / threshold (absolu)
5. **change_threshold** — seuil de changement par pixel
6. **threshold_value + threshold_unit** — seuil d'aggregation (km2, ha, %)
7. **ground_truth_source** — quelle couche de verite utiliser (PRODES, FIRMS, JRC_WATER, etc.)
8. **proof_layers** — slugs des couches a activer dans la vue analyse

---

## 4. ARCHITECTURE ORACLE MULTI-INDICE

### 4.1 Pipeline generalise (remplace le NDVI-only actuel)

```python
class SpectralPipeline:
    """Pipeline generalise pour tout indice spectral Sentinel-2."""

    FORMULAS = {
        "NDVI":  lambda B4, B8: (B8 - B4) / (B8 + B4),
        "EVI":   lambda B2, B4, B8: 2.5 * (B8 - B4) / (B8 + 6*B4 - 7.5*B2 + 1),
        "NBR":   lambda B8, B12: (B8 - B12) / (B8 + B12),
        "NDWI":  lambda B3, B8: (B3 - B8) / (B3 + B8),
        "MNDWI": lambda B3, B11: (B3 - B11) / (B3 + B11),
        "NDBI":  lambda B8, B11: (B11 - B8) / (B11 + B8),
        "BSI":   lambda B2, B4, B8, B11: ((B11+B4) - (B8+B2)) / ((B11+B4) + (B8+B2)),
        "NDSI":  lambda B3, B11: (B3 - B11) / (B3 + B11),
    }

    BANDS_NEEDED = {
        "NDVI":  ["B04", "B08"],
        "EVI":   ["B02", "B04", "B08"],
        "NBR":   ["B08", "B12"],
        "NDWI":  ["B03", "B08"],
        "MNDWI": ["B03", "B11"],
        "NDBI":  ["B08", "B11"],
        "BSI":   ["B02", "B04", "B08", "B11"],
        "NDSI":  ["B03", "B11"],
    }

    def run(self, config: PipelineConfig) -> PipelineResult:
        bands = self.BANDS_NEEDED[config.index_type]
        formula = self.FORMULAS[config.index_type]

        # 1. Search Sentinel-2 L2A products
        products_t0 = copernicus.search(bbox, t0_window, bands)
        products_t1 = copernicus.search(bbox, t1_window, bands)

        # 2. Download + composite (median temporel)
        composite_t0 = self.composite(products_t0, bands)
        composite_t1 = self.composite(products_t1, bands)

        # 3. Apply spectral formula
        index_t0 = formula(*[composite_t0[b] for b in bands])
        index_t1 = formula(*[composite_t1[b] for b in bands])

        # 4. Delta + mask
        delta = index_t1 - index_t0
        if config.change_direction == "decrease":
            mask = delta < -config.change_threshold
        elif config.change_direction == "increase":
            mask = delta > config.change_threshold
        else:
            mask = abs(index_t1) > config.change_threshold

        # 5. Clip + aggregate
        mask_clipped = clip_to_polygon(mask, config.region_wkt)
        surface = count_pixels(mask_clipped) * pixel_area_m2 / 1e6

        # 6. Decision
        outcome = surface > config.threshold_km2

        # 7. Proofs
        hashes = hash_all_rasters(index_t0, index_t1, delta, mask)
        ipfs_cid = pin_to_ipfs(hashes)

        return PipelineResult(outcome, surface, hashes, ipfs_cid)
```

### 4.2 Mode mock deterministe (inchange)

Le mock reste base sur `Random(bet_slug)` pour la reproductibilite.

### 4.3 Mode reel via Sentinel Hub Process API

```
POST https://services.sentinel-hub.com/api/v1/process
Authorization: Bearer {token}
{
  "input": {
    "bounds": { "bbox": [...], "properties": {"crs": "http://www.opengis.net/def/crs/EPSG/0/3857"} },
    "data": [{ "type": "sentinel-2-l2a", "dataFilter": {"timeRange": {"from": "...", "to": "..."}}}]
  },
  "evalscript": "//VERSION=3\nfunction setup(){return{input:['B04','B08'],output:{bands:1}}}\nfunction evaluatePixel(s){return[(s.B08-s.B04)/(s.B08+s.B04)]}",
  "output": { "width": 512, "height": 512, "responses": [{"format": {"type": "image/tiff"}}] }
}
```

Les evalscripts sont parametriques selon l'index_type du bet.

---

## 5. ARCHITECTURE ON-CHAIN

### 5.1 Smart Contract (Solidity)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ParaOracle {
    struct Bet {
        bytes32 slugHash;
        uint256 thresholdKm2;
        uint256 periodStart;
        uint256 periodEnd;
        bool resolved;
        bool outcomeYes;
        uint256 resolvedSurfaceKm2;
        bytes32 evidenceHash;  // keccak256 of all 5 SHA-256 hashes
        string ipfsCid;
    }

    struct Position {
        address user;
        bool isYes;
        uint256 amount;
        uint256 odds;  // basis points (1850 = 1.85x)
        bool settled;
    }

    mapping(bytes32 => Bet) public bets;
    mapping(bytes32 => Position[]) public positions;
    mapping(bytes32 => uint256) public yesPool;
    mapping(bytes32 => uint256) public noPool;

    address public oracle;  // backend wallet address

    event BetCreated(bytes32 indexed slugHash, uint256 threshold);
    event PositionPlaced(bytes32 indexed slugHash, address user, bool isYes, uint256 amount);
    event BetResolved(bytes32 indexed slugHash, bool outcomeYes, uint256 surfaceKm2, bytes32 evidenceHash);
    event Payout(bytes32 indexed slugHash, address user, uint256 amount);

    function placeBet(bytes32 slugHash, bool isYes) external payable { ... }
    function resolve(bytes32 slugHash, bool outcomeYes, uint256 surfaceKm2, bytes32 evidenceHash, string calldata ipfsCid) external onlyOracle { ... }
    function claimPayout(bytes32 slugHash) external { ... }
}
```

### 5.2 Integration wallet (frontend)

```
npm install wagmi viem @rainbow-me/rainbowkit
```

**Chaine cible** : Sepolia testnet (chain ID 11155111)

**Flux** :
1. Bouton "Connect wallet" dans la topbar (RainbowKit modal)
2. Si connecte : affiche adresse tronquee + balance ETH
3. Sur page bet : bouton "Place on-chain" a cote du simulateur
4. Signe la transaction via MetaMask/WalletConnect
5. Confirmation on-chain → user_bet persiste en DB avec tx_hash
6. Resolution oracle : backend signe EIP-712 + appelle resolve()
7. Utilisateur claim son payout via claimPayout()

### 5.3 EIP-712 Typed Data (signature oracle)

```json
{
  "types": {
    "Resolution": [
      {"name": "slugHash", "type": "bytes32"},
      {"name": "outcomeYes", "type": "bool"},
      {"name": "surfaceKm2", "type": "uint256"},
      {"name": "evidenceHash", "type": "bytes32"},
      {"name": "ipfsCid", "type": "string"},
      {"name": "timestamp", "type": "uint256"}
    ]
  },
  "domain": {
    "name": "ParaOracle",
    "version": "1",
    "chainId": 11155111,
    "verifyingContract": "0x..."
  }
}
```

---

## 6. SIMULATEUR (10 000 EUR)

### 6.1 Modele de donnees

```sql
ALTER TABLE users_mock ADD COLUMN balance NUMERIC(12,2) DEFAULT 10000.00;
ALTER TABLE users_mock ADD COLUMN total_won NUMERIC(12,2) DEFAULT 0.00;
ALTER TABLE users_mock ADD COLUMN total_lost NUMERIC(12,2) DEFAULT 0.00;
```

### 6.2 Endpoints

| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/wallet/balance` | Solde actuel + stats (won/lost) |
| POST | `/wallet/place-bet` | Placer un pari (deduit du solde) |
| POST | `/wallet/reset` | Reset a 10 000 EUR |

### 6.3 Logique placement

```python
@router.post("/place-bet")
def place_bet(slug: str, position: str, amount: float, db, user):
    if amount > user.balance:
        raise HTTPException(400, "Solde insuffisant")
    if amount < 1:
        raise HTTPException(400, "Mise minimum 1 EUR")

    bet = db.query(Bet).filter(Bet.slug == slug).first()
    if bet.status != "OPEN":
        raise HTTPException(400, "Bet is not open")

    # Calcul de la cote (simplifie — ratio pool YES/NO)
    stats = get_market_stats(slug, db)
    if position == "YES":
        odds = (stats.total_volume + amount) / (stats.yes_volume + amount)
    else:
        odds = (stats.total_volume + amount) / (stats.no_volume + amount)
    odds = max(odds, 1.01)  # plancher

    user.balance -= amount
    user_bet = UserBet(user_id=user.id, bet_id=bet.id, position=position,
                       amount=amount, odds=round(odds, 3))
    db.add(user_bet)
    db.commit()
    return {"balance": user.balance, "odds": odds, "potential_payout": amount * odds}
```

### 6.4 Settlement

Deja implemente dans `oracle.py` :
```sql
UPDATE user_bets SET status = CASE WHEN position = :winning THEN 'WON' ELSE 'LOST' END
```

Ajouter : crediter le solde des gagnants.

```python
# Apres settlement
for ub in db.query(UserBet).filter(UserBet.bet_id == bet.id, UserBet.status == "WON"):
    user = db.query(UserMock).get(ub.user_id)
    user.balance += float(ub.potential_payout)
    user.total_won += float(ub.potential_payout)

for ub in db.query(UserBet).filter(UserBet.bet_id == bet.id, UserBet.status == "LOST"):
    user = db.query(UserMock).get(ub.user_id)
    user.total_lost += float(ub.amount)
```

---

## 7. ARCHITECTURE DONNEES GEOSPATIALES

### 7.1 Tile cache proxy (existant, a etendre)

```
/data/tile-cache/
├── {slug}/                     ← couches statiques (PRODES, Hansen, etc.)
│   └── {z}/{x}/{y}.png
├── {slug}/{date}/              ← couches datees (NASA GIBS)
│   └── {z}/{x}/{y}.{png,jpg}
└── pipeline/{bet_slug}/        ← resultats pipeline (composites NDVI, delta, mask)
    └── {z}/{x}/{y}.png
```

### 7.2 Warmup par bet

Chaque bet doit pre-charger ses couches de verite terrain pour sa zone.

```python
WARMUP_CONFIG = {
    "deforestation": ["prodes-accumulated", "deter-amz", "hansen-tree-loss"],
    "wildfire":      ["viirs-firms"],
    "flood":         ["jrc-global-water"],
    "mining":        ["mapbiomas-mining"],
    "glacier":       ["modis-snow-cover"],
    "urbanization":  ["ghsl-built-up"],
    "drought":       [],  # pas de couche specifique, juste NDVI anomaly
    "water_quality": ["nasa-ocean-color"],
}
```

### 7.3 Couches par bet (proof_layers)

Chaque bet declare ses `proof_layers` — les slugs de couches qui constituent la preuve visuelle.

```json
{
  "para-deforestation-2025-s1": {
    "proof_layers": ["prodes-accumulated", "deter-amz", "delta-ndvi", "mask-deforestation", "nasa-viirs-truecolor"]
  },
  "california-wildfire-2026": {
    "proof_layers": ["viirs-firms", "nbr-delta", "nbr-mask", "nasa-modis-truecolor"]
  },
  "assam-flood-2026": {
    "proof_layers": ["jrc-global-water", "ndwi-delta", "ndwi-mask", "nasa-viirs-truecolor"]
  }
}
```

Le frontend active automatiquement ces couches quand l'utilisateur ouvre l'analyse.

---

## 8. FEATURES FRONTEND

### 8.1 Map page (/)

**Existant** :
- Carte mondiale avec regions colorees par categorie
- BetTicker scrollant
- CategoryFilter
- BetBottomSheet carousel
- CrisisStats

**A ajouter** :
- **Wallet balance** dans la topbar (10 000.00 EUR ou balance ETH si connecte)
- **Bouton Connect Wallet** (RainbowKit)
- **Heatmap densite** des paris (zones avec beaucoup de paris = plus intenses)
- **Filtres actifs** : par status (OPEN, RESOLVED), par date, par volume

### 8.2 Analysis page (/analysis/:slug)

**Existant** :
- Carte avec layers, DateSelector, LayerPanel, Legend
- BetSheet bottom dock avec MarketStats, BetTimeline, VerdictPanel
- OnboardingOverlay

**A ajouter** :
- **Formulaire de placement** (montant + position YES/NO) dans le bottom sheet
- **Bouton "Place on-chain"** si wallet connecte
- **Historique des resolutions** (si le bet a ete resolu plusieurs fois pendant les tests)
- **Comparaison split-screen** T0 vs T1 (swipe horizontal)
- **Animation fly-to** sur les zones de deforestation detectees

### 8.3 Wallet page (/wallet) — NOUVELLE

- **Solde** : 10 000.00 EUR (simule) ou balance ETH (on-chain)
- **Toggle Simulateur / On-chain**
- **Historique** : tous les placements, gains, pertes
- **PnL graphique** : courbe de performance
- **Reset button** : remet a 10 000 EUR

### 8.4 Leaderboard page (/leaderboard) — NOUVELLE

- Classement des utilisateurs par PnL
- Avatar + pseudo + total mise + total gagne + ROI %
- Top 3 mis en avant

---

## 9. USER STORIES

### US-01 : Decouvrir les paris
> En tant qu'utilisateur, je veux voir tous les paris actifs sur une carte mondiale, filtrer par categorie (feux, deforestation, etc.), et comprendre rapidement la question de chaque pari.

**Acceptance** :
- 30+ paris affiches sur la carte avec polygones colores
- Toggle categorie filtre en temps reel
- Ticker horizontal montre les paris actifs
- Bottom sheet carousel pour naviguer entre les paris
- Question affichee dans la langue choisie (FR/EN)

### US-02 : Explorer un pari en detail
> En tant qu'utilisateur, je veux voir l'imagerie satellite datee d'un pari, superposer les couches de verite terrain, et comprendre ce que l'oracle va mesurer.

**Acceptance** :
- Page analysis avec carte satellite ESRI
- DateSelector T0/T1/custom
- LayerPanel avec couches proof_layers activees par defaut
- Legend contextuelle (NDVI, NBR, NDWI selon l'indice du bet)
- Zones detectees affichees en overlay colore

### US-03 : Placer un pari
> En tant qu'utilisateur, je veux miser YES ou NO sur un pari avec mon solde simule de 10k EUR, voir la cote dynamique, et comprendre mon payout potentiel.

**Acceptance** :
- Formulaire dans le bottom sheet : montant + position (YES/NO)
- Cote calculee dynamiquement (ratio pools)
- Payout potentiel affiche avant confirmation
- Solde deduit immediatement
- Toast de confirmation

### US-04 : Connecter son wallet
> En tant qu'utilisateur crypto, je veux connecter mon wallet MetaMask/WalletConnect pour placer des mises on-chain sur Sepolia.

**Acceptance** :
- Bouton Connect Wallet dans la topbar
- Modal RainbowKit avec choix du wallet
- Adresse tronquee affichee apres connexion
- Balance ETH visible
- Toggle Simulateur / On-chain dans la page wallet

### US-05 : Declencher l'oracle
> En tant qu'utilisateur, je veux declencher la resolution d'un pari et voir le resultat avec preuves.

**Acceptance** :
- Bouton "Trigger oracle" sur la page analysis
- Loading state pendant le calcul
- Resultat YES/NO affiche en grand
- Surface mesuree vs seuil
- 6 hashes copiables
- VerdictPanel avec repartition gagnants/perdants
- Couches proof_layers activees automatiquement

### US-06 : Verifier les preuves
> En tant qu'auditeur, je veux pouvoir verifier independamment le resultat d'un pari.

**Acceptance** :
- Hashes SHA-256 des 5 rasters affichees et copiables
- CID IPFS affiche
- IDs produits Sentinel-2 + STAC URIs
- Couches satellite datees superposables
- Cadastres officiels (PRODES, FIRMS, JRC) superposables pour comparaison visuelle
- Pipeline reproductible (3x → memes hashes)

### US-07 : Suivre ses performances
> En tant qu'utilisateur, je veux voir mon historique de paris, mes gains/pertes, et mon classement.

**Acceptance** :
- Page wallet avec solde + historique
- PnL en temps reel
- Page leaderboard avec classement

---

## 10. PLAN D'EXECUTION

### Phase 1 — Oracle multi-indice + data complete (2-3 jours)

| # | Tache | Fichiers | Effort |
|---|-------|----------|--------|
| 1.1 | Refactorer NDVIPipeline en SpectralPipeline | `services/spectral_pipeline.py` | 2h |
| 1.2 | Ajouter formules NBR, NDWI, BSI, NDSI, NDBI | `services/spectral_pipeline.py` | 1h |
| 1.3 | Adapter oracle.py pour appeler SpectralPipeline | `routers/oracle.py` | 30min |
| 1.4 | Seeder les 22 bets manquants avec polygones officiels | `db/init/03-seed.sql` | 3h |
| 1.5 | Ajouter proof_layers a chaque bet | `db/init/03-seed.sql` | 1h |
| 1.6 | Ajouter couches de verite manquantes (JRC Water, GHSL, MODIS Snow, Ocean Color) | `db/init/03-seed.sql` + `tiles.py` warmup | 2h |
| 1.7 | Warmup par categorie de bet | `routers/tiles.py` | 1h |
| 1.8 | Tests reproductibilite pour chaque indice | `tests/test_spectral.py` | 2h |

### Phase 2 — Simulateur + wallet (1-2 jours)

| # | Tache | Fichiers | Effort |
|---|-------|----------|--------|
| 2.1 | Ajouter balance/total_won/total_lost a users_mock | `db/init/02-schema.sql`, `models/user.py` | 30min |
| 2.2 | Router /wallet (balance, place-bet, reset) | `routers/wallet.py` | 2h |
| 2.3 | Calcul de cote dynamique | `services/odds.py` | 1h |
| 2.4 | Crediter gagnants apres settlement | `routers/oracle.py` | 30min |
| 2.5 | Formulaire placement dans bottom sheet Analysis | `pages/Analysis.tsx` | 2h |
| 2.6 | Wallet balance dans topbar | `components/WalletBadge.tsx` | 1h |
| 2.7 | Page /wallet (historique, PnL, reset) | `pages/Wallet.tsx` | 3h |
| 2.8 | Page /leaderboard | `pages/Leaderboard.tsx` | 2h |

### Phase 3 — Connect Wallet + on-chain (2-3 jours)

| # | Tache | Fichiers | Effort |
|---|-------|----------|--------|
| 3.1 | Smart contract ParaOracle.sol | `contracts/ParaOracle.sol` | 3h |
| 3.2 | Deploy script Sepolia | `scripts/deploy.js` | 1h |
| 3.3 | Installer wagmi + RainbowKit | `package.json` | 30min |
| 3.4 | WalletProvider + ConnectButton | `components/WalletConnect.tsx` | 2h |
| 3.5 | Hooks useContract (placeBet, claimPayout) | `hooks/useParaOracle.ts` | 2h |
| 3.6 | Toggle Simulateur / On-chain | `pages/Wallet.tsx` | 1h |
| 3.7 | Backend EIP-712 signer pour resolve on-chain | `services/chain_signer.py` | 2h |
| 3.8 | Tests hardhat (deploy, place, resolve, claim) | `test/ParaOracle.test.js` | 3h |

### Phase 4 — Frontend polish (1-2 jours)

| # | Tache | Fichiers | Effort |
|---|-------|----------|--------|
| 4.1 | Split-screen T0 vs T1 (swipe compare) | `components/SplitCompare.tsx` | 3h |
| 4.2 | Fly-to animation vers zones detectees | `pages/Analysis.tsx` | 1h |
| 4.3 | Heatmap densite des paris sur la carte | `pages/Map.tsx` | 2h |
| 4.4 | Toast notifications (placement, resolution) | `components/Toast.tsx` | 1h |
| 4.5 | PWA manifest + service worker (offline tile cache) | `public/manifest.json`, `sw.js` | 2h |
| 4.6 | Responsive final (iPhone SE → iPad Pro) | `styles.css` | 2h |

---

## 11. METRIQUES DE SUCCES

| Metrique | Cible |
|----------|-------|
| Paris affiches sur la carte | 31 |
| Categories couvertes | 8 (deforestation, wildfire, flood, mining, drought, glacier, urbanization, water_quality) |
| Indices spectraux supportes | 8 (NDVI, EVI, NBR, NDWI, MNDWI, NDBI, BSI, NDSI) |
| Sources de verite integrees | 12+ (PRODES, DETER, Hansen, FIRMS, JRC Water, GHSL, MODIS Snow, etc.) |
| Couches cartographiques | 25+ |
| Tuiles pre-cachees | 1000+ |
| Tests reproductibilite | 3x par indice = hashes identiques |
| i18n | FR + EN complet |
| Devises | EUR + USD |
| Wallet | Simulateur 10k + MetaMask/WalletConnect Sepolia |
| Smart contract | Deploy Sepolia + tests Hardhat |
| Endpoints API | 22+ |
| Temps de chargement carte | < 2s (tiles cachees) |
| PWA | Installable, fonctionne hors-ligne (tiles cachees) |

---

## 12. DIAGRAMME FINAL

```
                         ┌──────────────────────┐
                         │     UTILISATEUR       │
                         │  (mobile / desktop)   │
                         └──────────┬─────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
              Simulateur       MetaMask        WalletConnect
              (10k EUR)       (Sepolia)        (Sepolia)
                    │               │               │
                    └───────────────┼───────────────┘
                                    │
                         ┌──────────▼─────────────┐
                         │   FRONTEND (React)      │
                         │                         │
                         │  MapLibre GL + Layers    │
                         │  i18n FR/EN + EUR/USD    │
                         │  wagmi + RainbowKit      │
                         │  LayerPanel QGIS-style   │
                         │  DateSelector T0/T1      │
                         │  SimulatorForm           │
                         │  WalletPage + Leaderboard│
                         └──────────┬─────────────┘
                                    │ REST API
                         ┌──────────▼─────────────┐
                         │   BACKEND (FastAPI)      │
                         │                         │
                         │  SpectralPipeline        │
                         │  (NDVI/NBR/NDWI/BSI/    │
                         │   NDSI/NDBI/EVI)        │
                         │                         │
                         │  OddsEngine              │
                         │  ChainSigner (EIP-712)   │
                         │  TileProxy + Warmup      │
                         │  WalletRouter            │
                         └──┬──────────┬──────────┘
                            │          │
                    ┌───────▼───┐  ┌───▼───────────────────┐
                    │ PostgreSQL │  │   SOURCES EXTERNES     │
                    │ + PostGIS  │  │                        │
                    │            │  │  Sentinel Hub Process   │
                    │ 8 tables   │  │  TerraBrasilis WMS     │
                    │ 31 bets    │  │  NASA GIBS WMTS        │
                    │ 25+ layers │  │  GFW CloudFront        │
                    │            │  │  JRC Water / GHSL       │
                    └────────────┘  └───────────┬───────────┘
                                                │
                                    ┌───────────▼───────────┐
                                    │   BLOCKCHAIN           │
                                    │   (Sepolia Testnet)    │
                                    │                        │
                                    │   ParaOracle.sol       │
                                    │   - placeBet()         │
                                    │   - resolve()          │
                                    │   - claimPayout()      │
                                    │   - evidenceHash       │
                                    └────────────────────────┘
```
