-- ══════════════════════════════════════════════════════════════════════════
-- Global bets seed — 22 bets across 6 continents
-- ══════════════════════════════════════════════════════════════════════════

-- ═══ SOUTH AMERICA ═══

INSERT INTO bets (slug, question, description, category, region_name, region_geom,
  period_start, period_end, threshold_value, threshold_unit, metric,
  ndvi_drop_threshold, status, index_type, change_direction, change_threshold, ground_truth_source, proof_layers
) VALUES
('chaco-deforestation-2026',
 'La deforestation dans le Gran Chaco paraguayen depassera-t-elle 15 000 ha en 2026 ?',
 'Conversion foret seche en paturages bovins. Deuxieme plus grande foret d''Amerique du Sud.',
 'deforestation', 'Gran Chaco, Paraguay',
 ST_Multi(ST_GeomFromText('POLYGON((-60.5 -23.5,-59.5 -23.5,-59.0 -22.5,-59.0 -21.5,-59.5 -20.5,-60.5 -20.5,-61.0 -21.5,-61.0 -22.5,-60.5 -23.5))',4326)),
 '2026-01-01','2026-12-31',15000,'ha','deforestation_chaco_ndvi',0.3,'OPEN',
 'NDVI','decrease',0.3,'HANSEN',ARRAY['hansen-tree-loss']
),
('cordillera-blanca-glacier-2026',
 'Le glacier de la Cordillera Blanca reculera-t-il de plus de 100m entre mars 2026 et mars 2027 ?',
 'Plus grande concentration de glaciers tropicaux au monde. Source Riviere Santa.',
 'glacier', 'Cordillera Blanca, Peru',
 ST_Multi(ST_GeomFromText('POLYGON((-77.9 -9.5,-77.5 -9.5,-77.2 -9.2,-77.2 -8.8,-77.5 -8.6,-77.9 -8.6,-78.1 -8.8,-78.1 -9.2,-77.9 -9.5))',4326)),
 '2026-03-01','2027-03-01',100,'meters','glacier_retreat_ndsi',0.4,'OPEN',
 'BSI','increase',0.2,'GLIMS',ARRAY[]::TEXT[]
),
('caqueta-deforestation-2026',
 'La deforestation dans le Caqueta colombien depassera-t-elle 8 000 ha en 2026 ?',
 'Arc de deforestation post-accords FARC. Elevage bovin et accaparement de terres.',
 'deforestation', 'Caqueta, Colombia',
 ST_Multi(ST_GeomFromText('POLYGON((-76.2 1.0,-75.5 1.0,-74.8 1.5,-74.8 2.2,-75.5 2.5,-76.2 2.2,-76.5 1.5,-76.2 1.0))',4326)),
 '2026-01-01','2026-12-31',8000,'ha','deforestation_caqueta_ndvi',0.3,'OPEN',
 'NDVI','decrease',0.3,'HANSEN',ARRAY['hansen-tree-loss']
)
ON CONFLICT (slug) DO NOTHING;

-- ═══ NORTH AMERICA ═══

INSERT INTO bets (slug, question, description, category, region_name, region_geom,
  period_start, period_end, threshold_value, threshold_unit, metric,
  ndvi_drop_threshold, status, index_type, change_direction, change_threshold, ground_truth_source, proof_layers
) VALUES
('california-wildfire-2026',
 'Les incendies en Californie du Sud bruler ont-ils plus de 10 000 ha entre juin et novembre 2026 ?',
 'Corridor Santa Ana winds. Palisades Fire 2025 reference. Zone LA/Ventura.',
 'wildfire', 'Southern California, USA',
 ST_Multi(ST_GeomFromText('POLYGON((-119.2 33.8,-118.2 33.8,-117.8 34.2,-117.8 34.8,-118.5 35.0,-119.2 34.8,-119.5 34.2,-119.2 33.8))',4326)),
 '2026-06-01','2026-11-30',10000,'ha','wildfire_california_nbr',0.27,'OPEN',
 'NBR','decrease',0.27,'FIRMS',ARRAY['nasa-viirs-firms']
),
('great-salt-lake-2026',
 'La surface du Great Salt Lake tombera-t-elle sous 2 400 km² entre mai et octobre 2026 ?',
 'Perte de 2/3 de la surface depuis 1987. Poussiere toxique arsenic sur lakebed expose.',
 'drought', 'Great Salt Lake, Utah, USA',
 ST_Multi(ST_GeomFromText('POLYGON((-113.2 40.6,-112.5 40.6,-112.0 41.0,-112.0 41.7,-112.5 42.0,-113.2 41.7,-113.5 41.0,-113.2 40.6))',4326)),
 '2026-05-01','2026-10-31',2400,'km2','lake_shrinkage_ndwi',0.3,'OPEN',
 'NDWI','decrease',0.0,'JRC_GSW',ARRAY[]::TEXT[]
),
('canada-boreal-fires-2026',
 'Les feux dans la foret boreale du NWT/Alberta depasseront-ils 50 000 ha en 2026 ?',
 'Record 2023: 18.5M ha. Plus grand reservoir de carbone terrestre.',
 'wildfire', 'NWT/Alberta, Canada',
 ST_Multi(ST_GeomFromText('POLYGON((-117.0 61.0,-114.0 61.0,-112.0 62.0,-112.0 63.5,-114.0 64.0,-117.0 63.5,-118.0 62.0,-117.0 61.0))',4326)),
 '2026-05-01','2026-09-30',50000,'ha','boreal_fire_nbr',0.27,'OPEN',
 'NBR','decrease',0.27,'FIRMS',ARRAY['nasa-viirs-firms']
),
('louisiana-wetland-loss-2026',
 'La perte de zones humides cotieres en Louisiane depassera-t-elle 5 km² en 2026 ?',
 'Delta du Mississippi. 75 km²/an de perte. Barataria Bay.',
 'flood', 'Mississippi Delta, Louisiana, USA',
 ST_Multi(ST_GeomFromText('POLYGON((-90.5 28.8,-89.5 28.8,-89.0 29.2,-89.0 29.8,-89.5 30.0,-90.5 29.8,-91.0 29.2,-90.5 28.8))',4326)),
 '2026-01-01','2026-12-31',5,'km2','wetland_loss_ndwi',0.3,'OPEN',
 'NDWI','increase',0.3,'JRC_GSW',ARRAY[]::TEXT[]
)
ON CONFLICT (slug) DO NOTHING;

-- ═══ AFRICA ═══

INSERT INTO bets (slug, question, description, category, region_name, region_geom,
  period_start, period_end, threshold_value, threshold_unit, metric,
  ndvi_drop_threshold, status, index_type, change_direction, change_threshold, ground_truth_source, proof_layers
) VALUES
('congo-mai-ndombe-2026',
 'La deforestation dans le Mai-Ndombe (RDC) fera-t-elle chuter le NDVI moyen sous 0.60 au S2 2026 ?',
 'Front de deforestation agriculture sur brulis + charbon de bois. Projet REDD+ defaillant.',
 'deforestation', 'Mai-Ndombe, DRC',
 ST_Multi(ST_GeomFromText('POLYGON((17.5 -3.5,18.5 -3.5,19.5 -2.5,19.5 -1.5,18.5 -1.0,17.5 -1.5,17.0 -2.5,17.5 -3.5))',4326)),
 '2026-07-01','2026-12-31',60,'percent','deforestation_congo_ndvi',0.3,'OPEN',
 'NDVI','decrease',0.3,'HANSEN',ARRAY['hansen-tree-loss']
),
('madagascar-masoala-2026',
 'La deforestation dans le corridor Masoala-Makira depassera-t-elle 5 000 ha au S1 2026 ?',
 'Tavy (agriculture sur brulis) + exploitation illegale bois de rose.',
 'deforestation', 'Masoala-Makira, Madagascar',
 ST_Multi(ST_GeomFromText('POLYGON((49.4 -16.0,50.0 -16.0,50.4 -15.5,50.4 -14.8,50.0 -14.5,49.4 -14.8,49.2 -15.5,49.4 -16.0))',4326)),
 '2026-01-01','2026-06-30',5000,'ha','deforestation_masoala_ndvi',0.3,'OPEN',
 'NDVI','decrease',0.3,'HANSEN',ARRAY['hansen-tree-loss']
),
('lake-chad-2026',
 'La surface d''eau du Lac Tchad tombera-t-elle sous 1 400 km² entre mai et juillet 2026 ?',
 'Reduction de 90% depuis 1960. Catastrophe humanitaire 30M personnes.',
 'drought', 'Lake Chad, Chad/Nigeria',
 ST_Multi(ST_GeomFromText('POLYGON((13.0 12.5,14.5 12.5,15.5 13.2,15.5 14.5,14.5 15.0,13.0 14.5,12.5 13.2,13.0 12.5))',4326)),
 '2026-05-01','2026-07-31',1400,'km2','lake_shrinkage_ndwi',0.3,'OPEN',
 'NDWI','decrease',0.0,'JRC_GSW',ARRAY[]::TEXT[]
),
('mpumalanga-mining-2026',
 'L''expansion miniere a Mpumalanga depassera-t-elle 3 km² de nouveau sol nu en 2026 ?',
 'Plus dense concentration de mines charbon en Afrique. Drainage acide.',
 'mining', 'Mpumalanga, South Africa',
 ST_Multi(ST_GeomFromText('POLYGON((28.8 -26.2,29.3 -26.2,29.8 -25.8,29.8 -25.3,29.3 -25.0,28.8 -25.3,28.5 -25.8,28.8 -26.2))',4326)),
 '2026-01-01','2026-12-31',3,'km2','mining_expansion_bsi',0.25,'OPEN',
 'BSI','increase',0.25,'DETER',ARRAY['hansen-tree-loss']
)
ON CONFLICT (slug) DO NOTHING;

-- ═══ EUROPE ═══

INSERT INTO bets (slug, question, description, category, region_name, region_geom,
  period_start, period_end, threshold_value, threshold_unit, metric,
  ndvi_drop_threshold, status, index_type, change_direction, change_threshold, ground_truth_source, proof_layers
) VALUES
('greece-wildfire-2026',
 'Les incendies en Grece (Evros/Attique) depasseront-ils 10 000 ha entre juin et septembre 2026 ?',
 'Megafire Evros 2023 = plus grand incendie histoire UE (96 000 ha).',
 'wildfire', 'Evros/Attica, Greece',
 ST_Multi(ST_GeomFromText('POLYGON((25.5 40.5,26.5 40.5,27.0 41.0,27.0 41.8,26.5 42.0,25.5 41.8,25.0 41.0,25.5 40.5))',4326)),
 '2026-06-01','2026-09-30',10000,'ha','wildfire_greece_nbr',0.27,'OPEN',
 'NBR','decrease',0.27,'FIRMS',ARRAY['nasa-viirs-firms']
),
('aletsch-glacier-2026',
 'La surface de roche exposee du glacier d''Aletsch augmentera-t-elle de 0.5 km² en 2026 ?',
 'Plus grand glacier des Alpes. Perte 10% volume en 2 ans (2022-2024).',
 'glacier', 'Aletsch Glacier, Switzerland',
 ST_Multi(ST_GeomFromText('POLYGON((7.9 46.3,8.1 46.3,8.2 46.4,8.2 46.55,8.1 46.6,7.9 46.6,7.8 46.55,7.8 46.4,7.9 46.3))',4326)),
 '2026-01-01','2026-12-31',0.5,'km2','glacier_retreat_bsi',0.15,'OPEN',
 'BSI','increase',0.15,'GLIMS',ARRAY[]::TEXT[]
),
('ahr-valley-flood-2026',
 'Une inondation dans la vallee de l''Ahr inondera-t-elle plus de 15 km² entre avril et octobre 2026 ?',
 'Inondation 2021: 180 morts, 30 Mrd EUR degats. Vallee etroite vulnerable.',
 'flood', 'Ahr Valley, Germany',
 ST_Multi(ST_GeomFromText('POLYGON((6.7 50.2,7.2 50.2,7.5 50.4,7.5 50.7,7.2 50.8,6.7 50.7,6.5 50.4,6.7 50.2))',4326)),
 '2026-04-01','2026-10-31',15,'km2','flood_ahr_ndwi',0.2,'OPEN',
 'NDWI','increase',0.2,'JRC_GSW',ARRAY[]::TEXT[]
),
('istanbul-sprawl-2026',
 'L''expansion urbaine d''Istanbul augmentera-t-elle de 5 km² de surface batie en 2026 ?',
 '16M habitants. Projet Kanal Istanbul. Conversion agricole/foret en bati.',
 'urbanization', 'Istanbul, Turkey',
 ST_Multi(ST_GeomFromText('POLYGON((28.5 40.7,29.2 40.7,29.6 41.0,29.6 41.4,29.2 41.5,28.5 41.4,28.2 41.0,28.5 40.7))',4326)),
 '2026-01-01','2026-12-31',5,'km2','urban_sprawl_ndbi',0.1,'OPEN',
 'NDBI','increase',0.1,'GHSL',ARRAY[]::TEXT[]
)
ON CONFLICT (slug) DO NOTHING;

-- ═══ ASIA ═══

INSERT INTO bets (slug, question, description, category, region_name, region_geom,
  period_start, period_end, threshold_value, threshold_unit, metric,
  ndvi_drop_threshold, status, index_type, change_direction, change_threshold, ground_truth_source, proof_layers
) VALUES
('borneo-palm-oil-2026',
 'Le NDVI moyen autour de Tanjung Puting (Kalimantan) tombera-t-il sous 0.65 au S2 2026 ?',
 'Conversion foret tourbeuse en palmeraies. 420 000 ha/an perdus en Indonesie.',
 'deforestation', 'Central Kalimantan, Indonesia',
 ST_Multi(ST_GeomFromText('POLYGON((111.0 -3.2,112.0 -3.2,112.5 -2.8,112.5 -2.2,112.0 -1.8,111.0 -2.2,110.7 -2.8,111.0 -3.2))',4326)),
 '2026-07-01','2026-12-31',65,'percent','deforestation_borneo_ndvi',0.3,'OPEN',
 'NDVI','decrease',0.3,'HANSEN',ARRAY['hansen-tree-loss']
),
('assam-flood-2026',
 'L''inondation monsoon a Kaziranga (Assam) inondera-t-elle plus de 500 km² en 2026 ?',
 'Brahmaputra. 2M deplaces/an. 75% de Kaziranga NP submerge.',
 'flood', 'Kaziranga, Assam, India',
 ST_Multi(ST_GeomFromText('POLYGON((92.5 26.0,93.5 26.0,94.2 26.5,94.2 27.2,93.5 27.5,92.5 27.2,92.0 26.5,92.5 26.0))',4326)),
 '2026-06-15','2026-08-31',500,'km2','flood_assam_ndwi',0.3,'OPEN',
 'NDWI','increase',0.3,'JRC_GSW',ARRAY[]::TEXT[]
),
('aral-sea-2026',
 'La surface d''eau de la mer d''Aral Sud depassera-t-elle 2 500 km² entre avril et septembre 2026 ?',
 'De 68 000 km² a moins de 3 000. Desert Aralkum, tempetes de poussiere toxique.',
 'drought', 'South Aral Sea, Uzbekistan',
 ST_Multi(ST_GeomFromText('POLYGON((57.5 44.0,59.0 44.0,60.0 44.8,60.0 46.0,59.0 46.5,57.5 46.0,57.0 44.8,57.5 44.0))',4326)),
 '2026-04-01','2026-09-30',2500,'km2','lake_recovery_ndwi',0.2,'OPEN',
 'NDWI','increase',0.2,'JRC_GSW',ARRAY[]::TEXT[]
),
('myanmar-logging-2026',
 'Le deboisement illegal dans les Chin Hills augmentera-t-il de 5% les pixels NDVI<0.50 en 2026 ?',
 'Acceleration post-coup 2021. Teck pour export Chine. Effondrement enforcement.',
 'deforestation', 'Chin Hills, Myanmar',
 ST_Multi(ST_GeomFromText('POLYGON((93.2 21.2,94.5 21.2,95.0 21.8,95.0 22.8,94.5 23.2,93.2 22.8,92.8 21.8,93.2 21.2))',4326)),
 '2026-01-01','2026-12-31',5,'percent','deforestation_myanmar_ndvi',0.3,'OPEN',
 'NDVI','decrease',0.3,'HANSEN',ARRAY['hansen-tree-loss']
)
ON CONFLICT (slug) DO NOTHING;

-- ═══ OCEANIA ═══

INSERT INTO bets (slug, question, description, category, region_name, region_geom,
  period_start, period_end, threshold_value, threshold_unit, metric,
  ndvi_drop_threshold, status, index_type, change_direction, change_threshold, ground_truth_source, proof_layers
) VALUES
('australia-bushfire-2026',
 'Un feu creera-t-il une zone de severite haute (>10 000 ha) pres de Kosciuszko au S2 2026 ?',
 'Black Summer 2019-2020: 12M ha. Cycles La Nina/El Nino.',
 'wildfire', 'Kosciuszko NP, Australia',
 ST_Multi(ST_GeomFromText('POLYGON((147.5 -37.0,148.5 -37.0,149.2 -36.5,149.2 -35.8,148.5 -35.5,147.5 -35.8,147.0 -36.5,147.5 -37.0))',4326)),
 '2026-10-01','2027-03-31',10000,'ha','bushfire_nbr',0.44,'OPEN',
 'NBR','decrease',0.44,'FIRMS',ARRAY['nasa-viirs-firms']
),
('gbr-sediment-2027',
 'Le panache sedimentaire du Burdekin atteindra-t-il 50 km dans le lagon GBR au S1 2027 ?',
 'Plus grande source de sediments dans la GBR. Stress corallien, blanchissement.',
 'water_quality', 'Burdekin/GBR, Queensland, Australia',
 ST_Multi(ST_GeomFromText('POLYGON((146.5 -20.2,147.5 -20.2,148.0 -19.8,148.0 -19.0,147.5 -18.5,146.5 -19.0,146.2 -19.8,146.5 -20.2))',4326)),
 '2027-01-01','2027-04-30',50,'km','sediment_plume_red',0.05,'OPEN',
 'NDWI','decrease',0.0,'JRC_GSW',ARRAY[]::TEXT[]
),
('franz-josef-glacier-2026',
 'Le glacier Franz Josef reculera-t-il de plus de 100m entre mars 2026 et mars 2027 ?',
 'Recul 1.5 km depuis 2008. Mass balance fortement negative.',
 'glacier', 'Franz Josef, New Zealand',
 ST_Multi(ST_GeomFromText('POLYGON((169.8 -43.7,170.2 -43.7,170.5 -43.5,170.5 -43.2,170.2 -43.0,169.8 -43.2,169.6 -43.5,169.8 -43.7))',4326)),
 '2026-03-01','2027-03-01',100,'meters','glacier_retreat_bsi',0.2,'OPEN',
 'BSI','increase',0.2,'GLIMS',ARRAY[]::TEXT[]
)
ON CONFLICT (slug) DO NOTHING;

-- ═══ USER BETS MOCK (2 par bet global) ═══

INSERT INTO user_bets (user_id, bet_id, position, amount, odds, status, placed_at)
SELECT u.id, b.id, pos, amt, od, 'PENDING', ts
FROM (VALUES
  ('demo@para-oracle.app','chaco-deforestation-2026','YES',220.00,1.85,'2026-02-10 10:00:00+00'::timestamptz),
  ('alice@para-oracle.app','chaco-deforestation-2026','NO',180.00,2.15,'2026-03-15 14:00:00+00'),
  ('bob@para-oracle.app','cordillera-blanca-glacier-2026','YES',150.00,1.70,'2026-04-01 09:00:00+00'),
  ('carla@para-oracle.app','cordillera-blanca-glacier-2026','NO',200.00,2.30,'2026-05-10 15:00:00+00'),
  ('demo@para-oracle.app','caqueta-deforestation-2026','YES',300.00,1.80,'2026-02-20 11:00:00+00'),
  ('alice@para-oracle.app','caqueta-deforestation-2026','NO',250.00,2.20,'2026-04-05 13:00:00+00'),
  ('bob@para-oracle.app','california-wildfire-2026','YES',400.00,1.75,'2026-06-15 10:00:00+00'),
  ('carla@para-oracle.app','california-wildfire-2026','NO',200.00,2.40,'2026-07-01 16:00:00+00'),
  ('demo@para-oracle.app','great-salt-lake-2026','YES',180.00,1.90,'2026-05-10 09:00:00+00'),
  ('alice@para-oracle.app','great-salt-lake-2026','NO',250.00,2.10,'2026-06-01 14:00:00+00'),
  ('bob@para-oracle.app','canada-boreal-fires-2026','YES',350.00,1.65,'2026-05-20 11:00:00+00'),
  ('carla@para-oracle.app','canada-boreal-fires-2026','NO',200.00,2.50,'2026-06-10 15:00:00+00'),
  ('demo@para-oracle.app','louisiana-wetland-loss-2026','YES',150.00,1.95,'2026-03-01 10:00:00+00'),
  ('alice@para-oracle.app','louisiana-wetland-loss-2026','NO',180.00,2.05,'2026-04-15 14:00:00+00'),
  ('bob@para-oracle.app','congo-mai-ndombe-2026','YES',280.00,1.80,'2026-07-15 09:00:00+00'),
  ('carla@para-oracle.app','congo-mai-ndombe-2026','NO',200.00,2.25,'2026-08-01 15:00:00+00'),
  ('demo@para-oracle.app','madagascar-masoala-2026','YES',200.00,1.85,'2026-02-01 10:00:00+00'),
  ('alice@para-oracle.app','madagascar-masoala-2026','NO',150.00,2.20,'2026-03-10 14:00:00+00'),
  ('bob@para-oracle.app','lake-chad-2026','YES',300.00,1.70,'2026-05-01 11:00:00+00'),
  ('carla@para-oracle.app','lake-chad-2026','NO',250.00,2.35,'2026-06-01 16:00:00+00'),
  ('demo@para-oracle.app','mpumalanga-mining-2026','YES',180.00,1.90,'2026-03-15 09:00:00+00'),
  ('alice@para-oracle.app','mpumalanga-mining-2026','NO',220.00,2.10,'2026-05-01 13:00:00+00'),
  ('bob@para-oracle.app','greece-wildfire-2026','YES',350.00,1.75,'2026-06-20 10:00:00+00'),
  ('carla@para-oracle.app','greece-wildfire-2026','NO',180.00,2.30,'2026-07-10 15:00:00+00'),
  ('demo@para-oracle.app','aletsch-glacier-2026','YES',200.00,1.65,'2026-04-01 10:00:00+00'),
  ('alice@para-oracle.app','aletsch-glacier-2026','NO',150.00,2.45,'2026-05-15 14:00:00+00'),
  ('bob@para-oracle.app','ahr-valley-flood-2026','NO',280.00,1.60,'2026-04-10 11:00:00+00'),
  ('carla@para-oracle.app','ahr-valley-flood-2026','YES',200.00,2.50,'2026-05-01 16:00:00+00'),
  ('demo@para-oracle.app','istanbul-sprawl-2026','YES',250.00,1.55,'2026-02-15 09:00:00+00'),
  ('alice@para-oracle.app','istanbul-sprawl-2026','NO',180.00,2.60,'2026-03-20 13:00:00+00'),
  ('bob@para-oracle.app','borneo-palm-oil-2026','YES',300.00,1.80,'2026-07-10 10:00:00+00'),
  ('carla@para-oracle.app','borneo-palm-oil-2026','NO',220.00,2.20,'2026-08-15 15:00:00+00'),
  ('demo@para-oracle.app','assam-flood-2026','YES',200.00,1.70,'2026-06-20 09:00:00+00'),
  ('alice@para-oracle.app','assam-flood-2026','NO',180.00,2.35,'2026-07-05 14:00:00+00'),
  ('bob@para-oracle.app','aral-sea-2026','NO',250.00,1.60,'2026-04-15 11:00:00+00'),
  ('carla@para-oracle.app','aral-sea-2026','YES',200.00,2.50,'2026-05-20 16:00:00+00'),
  ('demo@para-oracle.app','myanmar-logging-2026','YES',180.00,1.85,'2026-03-01 10:00:00+00'),
  ('alice@para-oracle.app','myanmar-logging-2026','NO',220.00,2.15,'2026-04-15 14:00:00+00'),
  ('bob@para-oracle.app','australia-bushfire-2026','YES',400.00,1.75,'2026-10-15 10:00:00+00'),
  ('carla@para-oracle.app','australia-bushfire-2026','NO',200.00,2.30,'2026-11-01 15:00:00+00'),
  ('demo@para-oracle.app','gbr-sediment-2027','YES',150.00,1.90,'2027-01-10 09:00:00+00'),
  ('alice@para-oracle.app','gbr-sediment-2027','NO',200.00,2.10,'2027-02-01 14:00:00+00'),
  ('bob@para-oracle.app','franz-josef-glacier-2026','YES',250.00,1.65,'2026-04-01 11:00:00+00'),
  ('carla@para-oracle.app','franz-josef-glacier-2026','NO',180.00,2.40,'2026-05-15 16:00:00+00')
) AS v(email, slug, pos, amt, od, ts)
JOIN users_mock u ON u.email = v.email
JOIN bets b ON b.slug = v.slug;
