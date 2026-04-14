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
   'https://tile.openstreetmap.org/{z}/{x}/{y}.png', 0, TRUE),
  ('basemap-satellite', 'Satellite (ESRI)', 'ESRI World Imagery', 'xyz',
   'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', 1, FALSE),
  ('basemap-carto-dark', 'Carto Dark', 'Fond sombre minimal', 'xyz',
   'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', 2, FALSE),

  -- Imagerie satellite publique (NASA GIBS — {date} resolu cote client, fmt YYYY-MM-DD)
  ('nasa-modis-truecolor', 'MODIS True Color (NASA, aujourd''hui)', 'Imagerie quotidienne MODIS 250m', 'xyz',
   'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/{date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg', 4, FALSE),
  ('nasa-viirs-truecolor', 'VIIRS True Color (NASA, aujourd''hui)', 'Imagerie quotidienne VIIRS 250m', 'xyz',
   'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/{date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg', 5, FALSE),
  ('nasa-modis-ndvi', 'MODIS NDVI 16-day (NASA)', 'NDVI global 500m, revisite 16 jours', 'xyz',
   'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_16Day/default/{date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png', 6, FALSE),
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
-- Polygone Para simplifie (bounding box approximatif — remplacer par shapefile officiel)
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
      'POLYGON((-59.0 -9.5, -46.0 -9.5, -46.0 -1.0, -48.0 1.5, -55.0 2.5, -59.0 1.5, -59.0 -9.5))',
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
