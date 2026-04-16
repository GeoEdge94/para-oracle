-- ══════════════════════════════════════════════════════════════════════════
-- Seed initial — Para polygon (simplifie pour demo) + pari + user mock
-- ══════════════════════════════════════════════════════════════════════════

-- User mock demo
INSERT INTO users_mock (email, pseudo, token) VALUES
  ('demo@para-oracle.app', 'demo', 'mock-token-demo-1234')
ON CONFLICT (email) DO NOTHING;

-- ─── Layers de base ───────────────────────────────────────────────────────
INSERT INTO layers (slug, name, description, type, url, display_order, visible_default) VALUES
  -- Basemaps (radio exclusif)
  ('basemap-osm', 'OSM Base', 'OpenStreetMap raster tiles', 'xyz',
   'https://tile.openstreetmap.org/{z}/{x}/{y}.png', 0, FALSE),
  ('basemap-satellite', 'Satellite (ESRI)', 'ESRI World Imagery', 'xyz',
   'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', 1, TRUE),
  ('basemap-carto-dark', 'Carto Dark', 'Fond sombre minimal', 'xyz',
   'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', 2, FALSE),

  -- Imagerie satellite publique (NASA GIBS — {date} resolu cote client, fmt YYYY-MM-DD)
  ('nasa-modis-truecolor', 'MODIS True Color (NASA, aujourd''hui)', 'Imagerie quotidienne MODIS 250m', 'xyz',
   'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/{date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg', 4, FALSE),
  ('nasa-viirs-truecolor', 'VIIRS True Color (NASA, aujourd''hui)', 'Imagerie quotidienne VIIRS 250m', 'xyz',
   'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/{date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg', 5, FALSE),
  ('nasa-modis-ndvi', 'MODIS NDVI 16-day (NASA)', 'NDVI global 500m, revisite 16 jours', 'xyz',
   'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_L3_NDVI_16Day/default/{date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png', 6, FALSE),
  ('nasa-viirs-firms', 'VIIRS FIRMS (feux actifs 24h)', 'Detections de feux VIIRS derniere 24h', 'xyz',
   'https://firms.modaps.eosdis.nasa.gov/mapserver/wms/fires/?service=WMS&request=GetMap&layers=fires_viirs_snpp_24&styles=&format=image/png&transparent=true&version=1.1.1&width=256&height=256&srs=EPSG:3857&bbox={bbox-epsg-3857}', 7, FALSE),

  -- Cadastres de deforestation verifies (sources officielles — activees par defaut)
  ('prodes-accumulated', 'PRODES cumule (INPE)',
   'Polygones de deforestation cumulee Amazonie legale depuis 2007 — source officielle INPE/PRODES',
   'xyz',
   'https://terrabrasilis.dpi.inpe.br/geoserver/ows?service=WMS&version=1.3.0&request=GetMap&layers=prodes-legal-amz:accumulated_deforestation_2007&styles=&format=image/png&transparent=true&crs=EPSG:3857&width=256&height=256&bbox={bbox-epsg-3857}',
   30, TRUE),
  ('prodes-yearly', 'PRODES annuel (INPE)',
   'Deforestation annuelle officielle Amazonie legale — polygones valides par an',
   'xyz',
   'https://terrabrasilis.dpi.inpe.br/geoserver/ows?service=WMS&version=1.3.0&request=GetMap&layers=prodes-legal-amz:yearly_deforestation&styles=&format=image/png&transparent=true&crs=EPSG:3857&width=256&height=256&bbox={bbox-epsg-3857}',
   31, FALSE),
  ('deter-amz', 'DETER alertes (INPE)',
   'Alertes deforestation/degradation/mines quasi-temps reel, 2016–present',
   'xyz',
   'https://terrabrasilis.dpi.inpe.br/geoserver/ows?service=WMS&version=1.3.0&request=GetMap&layers=deter-amz:deter_amz&styles=&format=image/png&transparent=true&crs=EPSG:3857&width=256&height=256&bbox={bbox-epsg-3857}',
   32, TRUE),
  ('hansen-tree-loss', 'Hansen perte couverture arboree',
   'Perte de couvert forestier 2000–present, 30m (Hansen/UMD/Google/NASA via GFW)',
   'xyz',
   'https://tiles.globalforestwatch.org/umd_tree_cover_loss/latest/dynamic/{z}/{x}/{y}.png',
   34, FALSE),

  -- Produits NDVI calcules par le pipeline (reserves, tiles generees cote backend)
  ('ndvi-t0', 'NDVI T0 (janvier 2025)', 'Composite NDVI debut periode', 'xyz',
   '/tiles/ndvi-t0/{z}/{x}/{y}.png', 10, FALSE),
  ('ndvi-t1', 'NDVI T1 (juin 2025)', 'Composite NDVI fin periode', 'xyz',
   '/tiles/ndvi-t1/{z}/{x}/{y}.png', 11, FALSE),
  ('delta-ndvi', 'Delta NDVI', 'Heatmap de changement NDVI T0 → T1', 'xyz',
   '/tiles/delta/{z}/{x}/{y}.png', 12, FALSE),
  ('mask-deforestation', 'Masque deforestation', 'Pixels avec Δ NDVI < -0.3', 'xyz',
   '/tiles/mask/{z}/{x}/{y}.png', 13, FALSE),

  -- Couche vectorielle haut niveau
  ('para-border', 'Frontiere Para', 'Limite officielle etat Para', 'geojson',
   '/data/para/para-border.geojson', 20, TRUE)
ON CONFLICT (slug) DO NOTHING;

-- ─── Pari demo — Para 2025 S1 ─────────────────────────────────────────────
-- Polygone Para officiel (IBGE, simplifie a ~80 points)
INSERT INTO bets (
    slug, question, description, category, region_name, region_geom,
    period_start, period_end, threshold_value, threshold_unit, metric,
    ndvi_drop_threshold, status
) VALUES (
    'para-deforestation-2025-s1',
    'La deforestation dans l''etat du Para depassera-t-elle 4 200 km² entre janvier et juin 2025 ?',
    'Resolution automatique base sur NDVI Sentinel-2. Seuil delta NDVI < -0.3 pour un pixel marque comme deforeste. Agregation sur toute la periode a 10m de resolution.',
    'deforestation',
    'Para, Brazil',
    ST_Multi(ST_GeomFromText(
      'POLYGON((-48.1946 -4.911, -47.6152 -4.56, -46.6765 -3.0941, -46.6696 -2.7346, -46.2833 -2.1544, -46.3152 -1.7416, -46.1613 -1.6228, -46.0634 -1.1062, -46.2076 -0.8856, -46.4691 -1.0253, -46.4958 -0.8722, -46.6364 -0.9691, -46.6293 -0.8008, -46.9426 -0.8593, -47.092 -0.6741, -47.1605 -0.7623, -47.4744 -0.5923, -47.4816 -0.7391, -47.5898 -0.5761, -47.6315 -0.7063, -47.9171 -0.5664, -48.4096 -0.9058, -48.4288 -0.2272, -49.3826 -0.1915, -49.397 0.0622, -49.6996 0.1505, -49.4886 0.3342, -50.1678 0.3403, -50.0364 0.5342, -50.2261 0.6962, -50.6448 0.2087, -51.2081 -0.117, -51.6835 -0.7955, -51.7004 -1.0632, -52.111 -1.215, -52.4201 -1.0527, -52.5352 -0.5741, -52.9327 -0.1423, -53.1753 0.3817, -53.1057 0.6795, -53.4115 0.9293, -53.4337 1.2345, -54.3777 1.7637, -54.7448 1.7758, -54.9543 2.5837, -55.3854 2.4185, -55.9347 2.5335, -56.139 2.2658, -55.9669 2.0885, -55.999 1.8314, -57.3044 1.9975, -57.5772 1.6904, -57.9902 1.6585, -58.0043 1.5031, -58.3172 1.5685, -58.5088 1.463, -58.4963 1.268, -58.8955 1.2277, -58.8695 -0.3475, -58.4289 -1.0286, -58.1561 -1.2328, -58.0333 -1.098, -57.9597 -1.3969, -57.0825 -1.7824, -56.6791 -2.2126, -56.0987 -2.0269, -56.3892 -2.2785, -58.4818 -6.7814, -57.6417 -8.2199, -57.5929 -8.7565, -57.2038 -8.9208, -56.7543 -9.4064, -50.2248 -9.8412, -50.0378 -9.2894, -49.221 -8.2038, -49.1607 -7.7914, -49.378 -7.4964, -49.2095 -6.9254, -48.3757 -6.345, -48.4361 -6.2014, -48.1382 -5.6027, -48.7552 -5.3492, -48.1946 -4.911))',
      4326
    )),
    '2025-01-01',
    '2025-06-30',
    4200,
    'km2',
    'deforestation_area_ndvi',
    0.3,
    'OPEN'
) ON CONFLICT (slug) DO NOTHING;
