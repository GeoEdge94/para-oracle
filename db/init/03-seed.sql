-- ══════════════════════════════════════════════════════════════════════════
-- Seed initial — Para polygon (simplifie pour demo) + pari + user mock
-- ══════════════════════════════════════════════════════════════════════════

-- User mock demo
INSERT INTO users_mock (email, pseudo, token) VALUES
  ('demo@para-oracle.app', 'demo', 'mock-token-demo-1234')
ON CONFLICT (email) DO NOTHING;

-- ─── Layers de base ───────────────────────────────────────────────────────
INSERT INTO layers (slug, name, description, type, url, display_order, visible_default) VALUES
  ('basemap-osm', 'OSM Base', 'OpenStreetMap raster tiles', 'xyz',
   'https://tile.openstreetmap.org/{z}/{x}/{y}.png', 0, TRUE),
  ('basemap-satellite', 'Satellite (ESRI)', 'ESRI World Imagery', 'xyz',
   'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', 1, FALSE),
  ('para-border', 'Frontiere Para', 'Limite officielle etat Para', 'geojson',
   '/data/para/para-border.geojson', 2, TRUE),
  ('ndvi-t0', 'NDVI T0 (janvier 2025)', 'Composite NDVI debut periode', 'xyz',
   '/tiles/ndvi-t0/{z}/{x}/{y}.png', 10, FALSE),
  ('ndvi-t1', 'NDVI T1 (juin 2025)', 'Composite NDVI fin periode', 'xyz',
   '/tiles/ndvi-t1/{z}/{x}/{y}.png', 11, FALSE),
  ('delta-ndvi', 'Delta NDVI', 'Heatmap de changement NDVI T0 → T1', 'xyz',
   '/tiles/delta/{z}/{x}/{y}.png', 12, FALSE),
  ('mask-deforestation', 'Masque deforestation', 'Pixels avec Δ NDVI < -0.3', 'xyz',
   '/tiles/mask/{z}/{x}/{y}.png', 13, FALSE)
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
