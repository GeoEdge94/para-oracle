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

-- ─── Users mock supplementaires ────────────────────────────────────────────
INSERT INTO users_mock (email, pseudo, token) VALUES
  ('alice@para-oracle.app', 'alice_forest', 'mock-token-alice-5678'),
  ('bob@para-oracle.app', 'bob_verde', 'mock-token-bob-9012'),
  ('carla@para-oracle.app', 'carla_geo', 'mock-token-carla-3456')
ON CONFLICT (email) DO NOTHING;

-- ─── Placements mock sur le pari Para S1 ───────────────────────────────────
INSERT INTO user_bets (user_id, bet_id, position, amount, odds, status, placed_at) VALUES
  ((SELECT id FROM users_mock WHERE email='demo@para-oracle.app'),
   (SELECT id FROM bets WHERE slug='para-deforestation-2025-s1'),
   'YES', 200.00, 1.850, 'PENDING', '2025-01-15 10:30:00+00'),
  ((SELECT id FROM users_mock WHERE email='demo@para-oracle.app'),
   (SELECT id FROM bets WHERE slug='para-deforestation-2025-s1'),
   'YES', 150.00, 1.720, 'PENDING', '2025-03-20 14:15:00+00'),
  ((SELECT id FROM users_mock WHERE email='alice@para-oracle.app'),
   (SELECT id FROM bets WHERE slug='para-deforestation-2025-s1'),
   'NO', 300.00, 2.100, 'PENDING', '2025-01-20 08:00:00+00'),
  ((SELECT id FROM users_mock WHERE email='alice@para-oracle.app'),
   (SELECT id FROM bets WHERE slug='para-deforestation-2025-s1'),
   'YES', 100.00, 1.650, 'PENDING', '2025-04-05 16:45:00+00'),
  ((SELECT id FROM users_mock WHERE email='alice@para-oracle.app'),
   (SELECT id FROM bets WHERE slug='para-deforestation-2025-s1'),
   'NO', 250.00, 2.250, 'PENDING', '2025-05-10 11:20:00+00'),
  ((SELECT id FROM users_mock WHERE email='bob@para-oracle.app'),
   (SELECT id FROM bets WHERE slug='para-deforestation-2025-s1'),
   'YES', 500.00, 1.900, 'PENDING', '2025-02-10 09:00:00+00'),
  ((SELECT id FROM users_mock WHERE email='bob@para-oracle.app'),
   (SELECT id FROM bets WHERE slug='para-deforestation-2025-s1'),
   'NO', 75.00, 2.400, 'PENDING', '2025-03-01 13:30:00+00'),
  ((SELECT id FROM users_mock WHERE email='bob@para-oracle.app'),
   (SELECT id FROM bets WHERE slug='para-deforestation-2025-s1'),
   'YES', 350.00, 1.780, 'PENDING', '2025-05-25 17:00:00+00'),
  ((SELECT id FROM users_mock WHERE email='carla@para-oracle.app'),
   (SELECT id FROM bets WHERE slug='para-deforestation-2025-s1'),
   'NO', 400.00, 2.150, 'PENDING', '2025-02-28 10:00:00+00'),
  ((SELECT id FROM users_mock WHERE email='carla@para-oracle.app'),
   (SELECT id FROM bets WHERE slug='para-deforestation-2025-s1'),
   'YES', 120.00, 1.600, 'PENDING', '2025-06-01 08:30:00+00');

-- ─── Zones de deforestation mock (preuves spatialisees — polygones irreguliers) ──
INSERT INTO deforestation_zones (bet_id, zone_name, source, surface_km2, confidence, detected_at, geojson) VALUES
  ((SELECT id FROM bets WHERE slug='para-deforestation-2025-s1'),
   'Sao Felix do Xingu', 'PRODES', 1250.3, 0.98, '2025-01-28',
   '{"type":"Polygon","coordinates":[[[-52.0,-6.8],[-51.7,-6.75],[-51.4,-6.82],[-51.25,-6.6],[-51.3,-6.35],[-51.55,-6.22],[-51.85,-6.28],[-52.05,-6.45],[-52.12,-6.6],[-52.0,-6.8]]]}'),
  ((SELECT id FROM bets WHERE slug='para-deforestation-2025-s1'),
   'Altamira Nord', 'PRODES', 820.5, 0.96, '2025-02-15',
   '{"type":"Polygon","coordinates":[[[-52.75,-3.38],[-52.5,-3.42],[-52.28,-3.3],[-52.18,-3.1],[-52.25,-2.92],[-52.48,-2.88],[-52.65,-2.95],[-52.78,-3.12],[-52.82,-3.28],[-52.75,-3.38]]]}'),
  ((SELECT id FROM bets WHERE slug='para-deforestation-2025-s1'),
   'Novo Progresso', 'DETER', 680.2, 0.89, '2025-03-10',
   '{"type":"Polygon","coordinates":[[[-55.55,-7.38],[-55.3,-7.42],[-55.08,-7.3],[-55.02,-7.12],[-55.1,-6.95],[-55.35,-6.88],[-55.52,-6.98],[-55.6,-7.15],[-55.58,-7.3],[-55.55,-7.38]]]}'),
  ((SELECT id FROM bets WHERE slug='para-deforestation-2025-s1'),
   'Itaituba Ouest', 'DETER', 420.8, 0.85, '2025-04-02',
   '{"type":"Polygon","coordinates":[[[-56.45,-4.98],[-56.22,-5.02],[-56.05,-4.88],[-55.95,-4.7],[-56.0,-4.52],[-56.18,-4.45],[-56.38,-4.55],[-56.5,-4.72],[-56.48,-4.88],[-56.45,-4.98]]]}'),
  ((SELECT id FROM bets WHERE slug='para-deforestation-2025-s1'),
   'Maraba Sud', 'NDVI', 550.0, 0.92, '2025-04-20',
   '{"type":"Polygon","coordinates":[[[-49.48,-5.78],[-49.22,-5.82],[-49.0,-5.68],[-48.92,-5.48],[-48.98,-5.32],[-49.18,-5.25],[-49.4,-5.35],[-49.52,-5.52],[-49.5,-5.68],[-49.48,-5.78]]]}'),
  ((SELECT id FROM bets WHERE slug='para-deforestation-2025-s1'),
   'Tucurui Est', 'NDVI', 310.6, 0.78, '2025-05-05',
   '{"type":"Polygon","coordinates":[[[-49.75,-4.18],[-49.55,-4.22],[-49.38,-4.1],[-49.32,-3.92],[-49.4,-3.75],[-49.58,-3.7],[-49.72,-3.8],[-49.8,-3.95],[-49.78,-4.1],[-49.75,-4.18]]]}'),
  ((SELECT id FROM bets WHERE slug='para-deforestation-2025-s1'),
   'Paragominas', 'PRODES', 180.4, 0.94, '2025-05-18',
   '{"type":"Polygon","coordinates":[[[-47.75,-3.48],[-47.55,-3.52],[-47.38,-3.4],[-47.3,-3.22],[-47.35,-3.05],[-47.52,-2.98],[-47.68,-3.08],[-47.78,-3.25],[-47.78,-3.38],[-47.75,-3.48]]]}'),
  ((SELECT id FROM bets WHERE slug='para-deforestation-2025-s1'),
   'Santarem Plateau', 'DETER', 840.0, 0.91, '2025-06-10',
   '{"type":"Polygon","coordinates":[[[-54.95,-2.98],[-54.68,-3.02],[-54.42,-2.88],[-54.32,-2.65],[-54.4,-2.42],[-54.62,-2.35],[-54.85,-2.45],[-55.0,-2.65],[-54.98,-2.82],[-54.95,-2.98]]]}');

-- ═══════════════════════════════════════════════════════════════════════════
-- BET 2 — Rondonia deforestation 2025 S1 (OPEN)
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO bets (
    slug, question, description, category, region_name, region_geom,
    period_start, period_end, threshold_value, threshold_unit, metric,
    ndvi_drop_threshold, status
) VALUES (
    'rondonia-deforestation-2025-s1',
    'La deforestation dans l''etat du Rondonia depassera-t-elle 3 000 km² entre janvier et juin 2025 ?',
    'Resolution automatique base sur NDVI Sentinel-2.',
    'deforestation',
    'Rondonia, Brazil',
    ST_Multi(ST_GeomFromText(
      'POLYGON((-62.4177 -13.1189, -62.1152 -13.1637, -61.8171 -13.5274, -61.009 -13.5064, -60.7093 -13.693, -60.3879 -13.4547, -59.7794 -12.3415, -60.0989 -11.8456, -59.9768 -11.1224, -61.5503 -10.9861, -61.477 -9.6299, -61.6283 -9.2571, -61.4692 -8.9201, -61.7133 -8.6879, -61.9902 -8.8727, -62.8666 -7.9759, -63.6212 -7.9765, -63.7912 -8.3332, -63.9441 -8.3312, -64.1418 -8.9451, -64.8078 -8.9856, -65.1429 -9.4468, -65.2704 -9.2636, -65.73 -9.5631, -66.4089 -9.4069, -66.8103 -9.818, -65.3569 -9.7202, -65.2888 -10.2199, -65.4297 -10.4809, -65.2509 -10.9845, -65.3635 -11.1473, -65.0289 -11.9976, -64.5128 -12.2229, -64.4062 -12.447, -63.0906 -12.636, -62.7944 -12.9952, -62.4177 -13.1189))',
      4326
    )),
    '2025-01-01', '2025-06-30', 3000, 'km2', 'deforestation_area_ndvi', 0.3, 'OPEN'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO user_bets (user_id, bet_id, position, amount, odds, status, placed_at) VALUES
  ((SELECT id FROM users_mock WHERE email='demo@para-oracle.app'),
   (SELECT id FROM bets WHERE slug='rondonia-deforestation-2025-s1'),
   'YES', 300.00, 1.95, 'PENDING', '2025-02-01 09:00:00+00'),
  ((SELECT id FROM users_mock WHERE email='alice@para-oracle.app'),
   (SELECT id FROM bets WHERE slug='rondonia-deforestation-2025-s1'),
   'NO', 200.00, 2.10, 'PENDING', '2025-03-15 14:00:00+00'),
  ((SELECT id FROM users_mock WHERE email='bob@para-oracle.app'),
   (SELECT id FROM bets WHERE slug='rondonia-deforestation-2025-s1'),
   'YES', 450.00, 1.80, 'PENDING', '2025-04-10 11:00:00+00'),
  ((SELECT id FROM users_mock WHERE email='carla@para-oracle.app'),
   (SELECT id FROM bets WHERE slug='rondonia-deforestation-2025-s1'),
   'NO', 150.00, 2.30, 'PENDING', '2025-05-20 16:00:00+00');

INSERT INTO deforestation_zones (bet_id, zone_name, source, surface_km2, confidence, detected_at, geojson) VALUES
  ((SELECT id FROM bets WHERE slug='rondonia-deforestation-2025-s1'),
   'Porto Velho Norte', 'PRODES', 620.0, 0.95, '2025-02-20',
   '{"type":"Polygon","coordinates":[[[-63.5,-8.5],[-63.2,-8.55],[-63.0,-8.4],[-62.95,-8.2],[-63.1,-8.05],[-63.35,-8.0],[-63.52,-8.15],[-63.55,-8.35],[-63.5,-8.5]]]}'),
  ((SELECT id FROM bets WHERE slug='rondonia-deforestation-2025-s1'),
   'Ji-Parana Sud', 'DETER', 480.5, 0.88, '2025-03-25',
   '{"type":"Polygon","coordinates":[[[-61.8,-11.2],[-61.55,-11.25],[-61.4,-11.1],[-61.38,-10.9],[-61.5,-10.78],[-61.72,-10.8],[-61.82,-10.95],[-61.85,-11.1],[-61.8,-11.2]]]}'),
  ((SELECT id FROM bets WHERE slug='rondonia-deforestation-2025-s1'),
   'Ariquemes Ouest', 'NDVI', 350.2, 0.82, '2025-05-10',
   '{"type":"Polygon","coordinates":[[[-63.8,-10.2],[-63.55,-10.25],[-63.4,-10.1],[-63.38,-9.9],[-63.5,-9.78],[-63.72,-9.82],[-63.82,-9.98],[-63.8,-10.2]]]}');

-- ═══════════════════════════════════════════════════════════════════════════
-- BET 3 — Mato Grosso fires 2025 S1 (RESOLVED_NO)
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO bets (
    slug, question, description, category, region_name, region_geom,
    period_start, period_end, threshold_value, threshold_unit, metric,
    ndvi_drop_threshold, status, result_bool, resolved_value, resolved_at
) VALUES (
    'mato-grosso-fires-2025-s1',
    'Les feux au Mato Grosso detruiront-ils plus de 1 500 km² de foret entre janvier et juin 2025 ?',
    'Resolution base sur detection de feux VIIRS/MODIS + analyse NDVI.',
    'wildfire',
    'Mato Grosso, Brazil',
    ST_Multi(ST_GeomFromText(
      'POLYGON((-56.2723 -9.4008, -56.7543 -9.4064, -57.2038 -8.9208, -57.5929 -8.7565, -57.6417 -8.2199, -58.1371 -7.3561, -58.3782 -7.8274, -58.2864 -8.0885, -58.4419 -8.7987, -61.5831 -8.7987, -61.4692 -8.9201, -61.6283 -9.2571, -61.477 -9.6299, -61.5503 -10.9861, -60.4601 -10.9899, -59.9768 -11.1224, -59.9172 -11.3384, -60.1109 -11.5825, -60.0989 -11.8456, -59.7794 -12.3415, -60.3879 -13.4547, -60.7093 -13.693, -60.3831 -13.9929, -60.4536 -14.3141, -60.245 -15.0975, -60.5757 -15.0975, -60.2395 -15.4746, -60.1741 -16.2669, -58.3222 -16.2664, -58.3989 -17.184, -57.4473 -17.8757, -57.119 -17.781, -56.7233 -17.3085, -56.0441 -17.1714, -55.1371 -17.6502, -54.5023 -17.4807, -54.3024 -17.6617, -54.0764 -17.6157, -53.6801 -17.2541, -53.7039 -17.6613, -53.9517 -17.9158, -53.0723 -18.034, -53.2173 -17.2968, -52.6294 -16.5178, -52.6812 -16.3017, -52.2543 -15.8937, -51.8803 -15.8243, -51.5341 -15.0652, -51.0871 -14.9213, -50.8739 -13.7345, -50.511 -12.8609, -50.6839 -12.6481, -50.7389 -11.5445, -50.6035 -10.6609, -50.2248 -9.8412, -56.2723 -9.4008))',
      4326
    )),
    '2025-01-01', '2025-06-30', 1500, 'km2', 'fire_area_ndvi', 0.3,
    'RESOLVED_NO', false, 980.4, '2025-07-01 12:00:00+00'
) ON CONFLICT (slug) DO NOTHING;

INSERT INTO user_bets (user_id, bet_id, position, amount, odds, status, placed_at, settled_at) VALUES
  ((SELECT id FROM users_mock WHERE email='demo@para-oracle.app'),
   (SELECT id FROM bets WHERE slug='mato-grosso-fires-2025-s1'),
   'NO', 250.00, 1.75, 'WON', '2025-01-20 10:00:00+00', '2025-07-01 12:00:00+00'),
  ((SELECT id FROM users_mock WHERE email='alice@para-oracle.app'),
   (SELECT id FROM bets WHERE slug='mato-grosso-fires-2025-s1'),
   'YES', 400.00, 2.20, 'LOST', '2025-02-15 13:00:00+00', '2025-07-01 12:00:00+00'),
  ((SELECT id FROM users_mock WHERE email='bob@para-oracle.app'),
   (SELECT id FROM bets WHERE slug='mato-grosso-fires-2025-s1'),
   'NO', 180.00, 1.65, 'WON', '2025-04-01 09:30:00+00', '2025-07-01 12:00:00+00'),
  ((SELECT id FROM users_mock WHERE email='carla@para-oracle.app'),
   (SELECT id FROM bets WHERE slug='mato-grosso-fires-2025-s1'),
   'YES', 320.00, 2.05, 'LOST', '2025-05-12 15:00:00+00', '2025-07-01 12:00:00+00');

INSERT INTO deforestation_zones (bet_id, zone_name, source, surface_km2, confidence, detected_at, geojson) VALUES
  ((SELECT id FROM bets WHERE slug='mato-grosso-fires-2025-s1'),
   'Sinop Region', 'DETER', 320.5, 0.91, '2025-03-15',
   '{"type":"Polygon","coordinates":[[[-55.8,-11.8],[-55.5,-11.85],[-55.3,-11.7],[-55.28,-11.5],[-55.4,-11.35],[-55.65,-11.38],[-55.78,-11.55],[-55.8,-11.8]]]}'),
  ((SELECT id FROM bets WHERE slug='mato-grosso-fires-2025-s1'),
   'Alta Floresta', 'NDVI', 280.3, 0.85, '2025-04-20',
   '{"type":"Polygon","coordinates":[[[-56.5,-10.2],[-56.25,-10.25],[-56.1,-10.1],[-56.08,-9.9],[-56.2,-9.78],[-56.42,-9.82],[-56.52,-9.98],[-56.5,-10.2]]]}'),
  ((SELECT id FROM bets WHERE slug='mato-grosso-fires-2025-s1'),
   'Colniza Ouest', 'PRODES', 379.6, 0.93, '2025-05-28',
   '{"type":"Polygon","coordinates":[[[-59.5,-9.8],[-59.25,-9.85],[-59.1,-9.7],[-59.05,-9.5],[-59.18,-9.35],[-59.4,-9.38],[-59.52,-9.55],[-59.5,-9.8]]]}');
