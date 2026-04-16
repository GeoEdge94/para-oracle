-- ══════════════════════════════════════════════════════════════════════════
-- Nouvelles couches de preuves + attribution proof_layers a tous les bets
-- ══════════════════════════════════════════════════════════════════════════

-- Nouvelles couches NASA GIBS (date-aware) pour glaciers, eau, urbain
INSERT INTO layers (slug, name, description, type, url, display_order, visible_default) VALUES
  ('nasa-modis-snow', 'MODIS Snow Cover (NDSI)',
   'Couverture neige/glace MODIS quotidienne 500m. NDSI natif, ideal pour suivi glaciers.',
   'xyz',
   'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDSI_Snow_Cover/default/{date}/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png',
   8, FALSE),

  ('nasa-landsat-watermask', 'Landsat Water (GSFC)',
   'Masque eau Landsat GSFC pour detection inondations/assechement.',
   'xyz',
   'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Water_Mask/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png',
   9, FALSE),

  ('nasa-viirs-night', 'VIIRS Night Lights',
   'Lumieres de nuit VIIRS (Black Marble). Indicateur d''activite urbaine/industrielle.',
   'xyz',
   'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png',
   14, FALSE),

  ('nasa-modis-chlorophyll', 'MODIS Chlorophyll-a',
   'Concentration chlorophylle MODIS Aqua L3. Qualite eau oceans/cotes.',
   'xyz',
   'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Aqua_L3_Chlorophyll_A_Monthly/default/{date}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png',
   15, FALSE),

  ('nasa-modis-sst', 'MODIS Sea Surface Temp',
   'Temperature surface mer MODIS L3 mensuelle.',
   'xyz',
   'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Aqua_L3_SST_MidIR_Monthly_9km/default/{date}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png',
   16, FALSE),

  ('nasa-smap-soil-moisture', 'SMAP Soil Moisture',
   'Humidite des sols SMAP 9km. Detection secheresses agricoles.',
   'xyz',
   'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/SMAP_L3_Active_Passive_Soil_Moisture/default/{date}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png',
   17, FALSE),

  ('nasa-modis-aerosol', 'MODIS Aerosol Optical Depth',
   'Epaisseur optique aerosols MODIS. Detection poussiere/fumee des incendies.',
   'xyz',
   'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Aerosol/default/{date}/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png',
   18, FALSE)
ON CONFLICT (slug) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════════
-- Assigner proof_layers a tous les bets selon leur categorie
-- ══════════════════════════════════════════════════════════════════════════

-- GLACIERS (3 bets) : MODIS Snow + VIIRS TrueColor pour visualisation
UPDATE bets SET proof_layers = ARRAY['nasa-modis-snow', 'nasa-viirs-truecolor']
WHERE slug IN ('cordillera-blanca-glacier-2026', 'aletsch-glacier-2026', 'franz-josef-glacier-2026');

-- DROUGHT (lacs qui retrecissent, secheresse) : water mask + SMAP + VIIRS
UPDATE bets SET proof_layers = ARRAY['nasa-landsat-watermask', 'nasa-smap-soil-moisture', 'nasa-viirs-truecolor']
WHERE slug IN ('aral-sea-2026', 'lake-chad-2026', 'great-salt-lake-2026');

-- FLOOD (tous les bets d'inondation)
UPDATE bets SET proof_layers = ARRAY['nasa-landsat-watermask', 'nasa-viirs-truecolor', 'nasa-modis-truecolor']
WHERE slug IN ('tapajos-flood-2026', 'louisiana-wetland-loss-2026', 'assam-flood-2026', 'ahr-valley-flood-2026');

-- URBANIZATION (Istanbul) : night lights + true color
UPDATE bets SET proof_layers = ARRAY['nasa-viirs-night', 'nasa-viirs-truecolor']
WHERE slug = 'istanbul-sprawl-2026';

-- WATER QUALITY (GBR sediment) : chlorophyll + SST + true color
UPDATE bets SET proof_layers = ARRAY['nasa-modis-chlorophyll', 'nasa-modis-sst', 'nasa-viirs-truecolor']
WHERE slug = 'gbr-sediment-2027';

-- ══════════════════════════════════════════════════════════════════════════
-- Enrichir aussi les bets qui ont deja des couches (ajouter satellite date-aware)
-- ══════════════════════════════════════════════════════════════════════════

-- Ajouter viirs-truecolor a tous les bets deforestation pour visualisation temporelle
UPDATE bets SET proof_layers = array_append(proof_layers, 'nasa-viirs-truecolor')
WHERE category = 'deforestation'
  AND NOT ('nasa-viirs-truecolor' = ANY(proof_layers));

-- Ajouter aerosol aux wildfires pour voir fumee
UPDATE bets SET proof_layers = array_append(proof_layers, 'nasa-modis-aerosol')
WHERE category = 'wildfire'
  AND NOT ('nasa-modis-aerosol' = ANY(proof_layers));

-- Ajouter viirs-truecolor aux mines pour visualisation
UPDATE bets SET proof_layers = array_append(proof_layers, 'nasa-viirs-truecolor')
WHERE category = 'mining'
  AND NOT ('nasa-viirs-truecolor' = ANY(proof_layers));
