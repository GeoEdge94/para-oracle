-- ══════════════════════════════════════════════════════════════════════════
-- M1/M2 Web3 — pipeline_kind sur bets + colonnes IPFS/on-chain sur analyses
-- ══════════════════════════════════════════════════════════════════════════

-- M1 : discriminant de pipeline. Les paris existants (NDVI/NBR/...) conservent
-- la valeur par defaut 'spectral'. Les nouveaux paris meteo utilisent 'weather'.
ALTER TABLE bets
  ADD COLUMN IF NOT EXISTS pipeline_kind VARCHAR(20) NOT NULL DEFAULT 'spectral';

-- M2 : colonnes Web3 sur analyses. Trois CIDs (data, script, schema) + proof
-- TLSNotary + fingerprint canonique. Les colonnes on-chain (chain_tx_hash,
-- bond_amount_usdc, dispute_window_end, dispute_status) sont posees des M2
-- mais ne sont remplies qu'a partir de M3.
ALTER TABLE analyses
  ADD COLUMN IF NOT EXISTS data_cid VARCHAR(100),
  ADD COLUMN IF NOT EXISTS script_cid VARCHAR(100),
  ADD COLUMN IF NOT EXISTS schema_cid VARCHAR(100),
  ADD COLUMN IF NOT EXISTS tls_proof_cid VARCHAR(100),
  ADD COLUMN IF NOT EXISTS fingerprint_sha256 VARCHAR(80),
  ADD COLUMN IF NOT EXISTS chain_tx_hash VARCHAR(80),
  ADD COLUMN IF NOT EXISTS bond_amount_usdc NUMERIC(18,6),
  ADD COLUMN IF NOT EXISTS dispute_window_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispute_status VARCHAR(20) DEFAULT 'NONE';

CREATE INDEX IF NOT EXISTS idx_analyses_fingerprint ON analyses(fingerprint_sha256);
CREATE INDEX IF NOT EXISTS idx_analyses_chain_tx ON analyses(chain_tx_hash);

-- ─── Seed — Pari meteo MVP (Paris, precipitations, testnet Polygon Amoy) ──
-- Variable : total_precipitation (ERA5-Land), agregation max sur la periode
-- Seuil    : 30 mm (direction "increase" -> gte en pipeline weather)
-- BBox     : Grand Paris (approx 2.2°E-2.5°E / 48.8°N-48.95°N)
INSERT INTO bets (
    slug, question, description, category, region_name, region_geom,
    period_start, period_end, threshold_value, threshold_unit, metric,
    ndvi_drop_threshold, status,
    index_type, change_direction, change_threshold, ground_truth_source, proof_layers,
    pipeline_kind
) VALUES (
    'precip-amoy-testnet-01',
    'Les precipitations quotidiennes max a Paris depasseront-elles 30 mm en janvier 2025 ?',
    'Pari meteo reference pour le pipeline Web3. Source: ERA5-Land (Copernicus Climate Data Store). Resolution: max quotidien sur la bbox Grand Paris.',
    'weather',
    'Paris, France',
    ST_Multi(ST_GeomFromText(
      'POLYGON((2.20 48.80, 2.50 48.80, 2.50 48.95, 2.20 48.95, 2.20 48.80))',
      4326
    )),
    '2025-01-01', '2025-01-31',
    30, 'mm', 'precipitation_max_daily_era5',
    0.0, 'OPEN',
    'total_precipitation', 'increase', 0.0, 'ERA5-Land', ARRAY[]::TEXT[],
    'weather'
)
ON CONFLICT (slug) DO NOTHING;
