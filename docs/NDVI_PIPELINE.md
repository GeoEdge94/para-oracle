# Pipeline NDVI — Specification

## Objectif

Calculer de maniere **deterministe et rejouable** la surface deforestee dans le Para entre T0 et T1 a partir de Sentinel-2 L2A, et comparer au seuil 4 200 km² pour resoudre le pari en YES/NO.

## Entrees

```python
@dataclass
class PipelineConfig:
    bet_slug: str                      # "para-deforestation-2025-s1"
    period_start: date                 # 2025-01-01
    period_end: date                   # 2025-06-30
    region_geom_wkt: str               # MultiPolygon Para en WKT WGS84
    ndvi_drop_threshold: float = 0.3   # |ΔNDVI| declenchant pixel = deforeste
    threshold_km2: float = 4200.0      # seuil de decision
    max_cloud_cover: float = 20.0      # % max nuages par scene
    composite_window_days: int = 15    # fenetre composite T0 et T1
    revisit_delay_days: int = 2        # T+48h apres fin periode
```

## Etapes

### 1. Fenetres temporelles

- **T0** : [period_start, period_start + 15j] — composite debut periode
- **T1** : [period_end + 1j, period_end + 3j] centre sur T+48h — composite fin periode

### 2. Recherche produits Sentinel-2 L2A via STAC

```http
POST https://catalogue.dataspace.copernicus.eu/stac/search
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "collections": ["SENTINEL-2"],
  "bbox": [-59.0, -9.5, -46.0, 2.5],
  "datetime": "2025-01-01T00:00:00Z/2025-01-15T23:59:59Z",
  "filter": {
    "op": "and",
    "args": [
      {"op": "=", "args": [{"property": "processingLevel"}, "S2MSI2A"]},
      {"op": "<=", "args": [{"property": "eo:cloud_cover"}, 20]}
    ]
  },
  "limit": 100
}
```

OAuth2 obtenu via `POST https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token`
(grant_type=client_credentials).

### 3. Composite NDVI

Pour chaque fenetre (T0, T1) :

1. Ouvrir les bandes B4 (RED 665 nm, 10 m) et B8 (NIR 842 nm, 10 m) de chaque scene via rioxarray
2. Masquer les nuages (SCL bande 11 classes 3, 8, 9, 10) — Scene Classification Layer
3. Calculer NDVI pixel-par-pixel :
   ```
   NDVI = (B8 - B4) / (B8 + B4)
   ```
   Les valeurs tombent dans [-1, 1]. Vegetation dense → ~0.7-0.9. Sol nu → ~0.1-0.2.
4. Mediane temporelle sur la fenetre pour reduire le bruit (composite best-pixel)
5. Clip au polygone Para (ST_ClipByBox2D)

### 4. Delta NDVI

```
ΔNDVI(pixel) = NDVI_T1(pixel) - NDVI_T0(pixel)
```

Necessite reprojection/alignement prealable (`ndvi_t1.rio.reproject_match(ndvi_t0)`).

### 5. Masque binaire deforestation

```
mask(pixel) = 1 si ΔNDVI < -0.3
              0 sinon
```

Convention : une chute de NDVI superieure a 0.3 indique une perte de vegetation significative.

### 6. Agregation surface

```
pixel_area_m² = 10 * 10 = 100  (resolution Sentinel-2 L2A bandes 10 m)
pixels_deforested = sum(mask == 1)
surface_km² = pixels_deforested * 100 / 1_000_000
```

### 7. Decision

```
outcome_yes = surface_km² > 4200
```

### 8. Preuves

Pour chaque run, generer :

| Proof | Comment |
|---|---|
| `script_hash` | SHA-256 du fichier `ndvi_pipeline.py` + version |
| `ndvi_t0_hash` | SHA-256 du GeoTIFF NDVI T0 |
| `ndvi_t1_hash` | SHA-256 du GeoTIFF NDVI T1 |
| `delta_hash` | SHA-256 du raster delta |
| `mask_hash` | SHA-256 du masque binaire |
| `sentinel_products_t0/t1` | Liste des IDs produits utilises |
| `stac_uris` | URIs canoniques STAC |
| `ipfs_cid` | CID IPFS (ou mock au format `bafybei...`) |

## Points d'attention

| Point | Impact | Mitigation |
|---|---|---|
| Couverture nuageuse > 20% sur Para | Trou dans le composite | Elargir fenetre T0/T1, ou fallback Landsat 8/9 |
| Ombre SCL insuffisante | Faux positifs NDVI bas | Utiliser NBR ou dNBR complementaire pour feux |
| Reprojection T1 → T0 | Leger decalage pixel | `reproject_match` en nearest-neighbor (moins de deformation) |
| CRS local Para (UTM 22S) vs WGS84 | Calcul surface | Convertir en projection equivalent-surface avant sum |
| Changement saisonnier (pas deforestation) | Faux positifs | Seuil 0.3 relativement permissif mais robuste pour 6 mois |

## Implementation en mode reel

Pseudo-code avec rasterio/rioxarray :

```python
import rioxarray as rxr
import xarray as xr
import numpy as np
from shapely import wkt as shp_wkt

def compute_ndvi_composite(products: list[SentinelProduct]) -> xr.DataArray:
    ndvis = []
    for p in products:
        b4 = rxr.open_rasterio(p.asset_b04_url, masked=True).squeeze()
        b8 = rxr.open_rasterio(p.asset_b08_url, masked=True).squeeze()
        ndvi = (b8 - b4) / (b8 + b4)
        ndvis.append(ndvi)
    # Median composite — robust to clouds/shadows
    stacked = xr.concat(ndvis, dim="time")
    return stacked.median(dim="time")

def run():
    ndvi_t0 = compute_ndvi_composite(products_t0)
    ndvi_t1 = compute_ndvi_composite(products_t1).rio.reproject_match(ndvi_t0)

    delta = ndvi_t1 - ndvi_t0
    mask = (delta < -0.3).astype("uint8")

    para_geom = shp_wkt.loads(config.region_geom_wkt)
    mask_clipped = mask.rio.clip([para_geom], drop=True)

    # Projection equi-surface pour agregation precise
    mask_proj = mask_clipped.rio.reproject("EPSG:5880")  # SIRGAS 2000 / Brazil Polyconic
    pixel_area = abs(mask_proj.rio.resolution()[0] * mask_proj.rio.resolution()[1])
    pixels = int((mask_proj == 1).sum())
    surface_km2 = pixels * pixel_area / 1_000_000

    return surface_km2
```

## Tests de reproductibilite

```bash
# Run 1
curl -X POST http://localhost:8000/oracle/resolve/para-deforestation-2025-s1 > run1.json

# Run 2 (identique attendu)
curl -X POST http://localhost:8000/oracle/resolve/para-deforestation-2025-s1 > run2.json

diff run1.json run2.json
# Les hashes script/ndvi_t0/ndvi_t1/delta/mask DOIVENT etre identiques
```
