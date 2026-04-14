-- ══════════════════════════════════════════════════════════════════════════
-- ParaOracle — Schema principal
-- ══════════════════════════════════════════════════════════════════════════

-- ─── Users (mock auth) ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users_mock (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email        VARCHAR(255) UNIQUE NOT NULL,
    pseudo       VARCHAR(100),
    token        VARCHAR(255),                -- dummy token, stocke pour demo
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Layers (config wrappee QGIS / GeoJSON) ────────────────────────────────
-- Types : wms | wfs | xyz | geojson | tilejson
CREATE TABLE IF NOT EXISTS layers (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug         VARCHAR(100) UNIQUE NOT NULL,  -- ex: "para-border", "ndvi-t0"
    name         VARCHAR(255) NOT NULL,
    description  TEXT,
    type         VARCHAR(20) NOT NULL,
    url          TEXT,                           -- URL WMS/XYZ ou chemin local
    local_path   TEXT,                           -- chemin fichier si local
    style        JSONB,                          -- style MapLibre
    display_order INTEGER DEFAULT 0,
    visible_default BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Bets (questions de marche) ────────────────────────────────────────────
-- Statut : OPEN | CLOSED | RESOLVED_YES | RESOLVED_NO | ERROR
CREATE TABLE IF NOT EXISTS bets (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug             VARCHAR(150) UNIQUE NOT NULL,  -- ex: "para-deforestation-2025-s1"
    question         TEXT NOT NULL,
    description      TEXT,
    category         VARCHAR(50) NOT NULL,           -- deforestation, wildfire, flood, etc.
    region_name      VARCHAR(100) NOT NULL,          -- "Para, Brazil"
    region_geom      GEOMETRY(MultiPolygon, 4326) NOT NULL,
    period_start     DATE NOT NULL,
    period_end       DATE NOT NULL,
    threshold_value  NUMERIC NOT NULL,              -- 4200
    threshold_unit   VARCHAR(20) NOT NULL,          -- "km2"
    metric           VARCHAR(50) NOT NULL,          -- "deforestation_area_ndvi"
    ndvi_drop_threshold NUMERIC NOT NULL DEFAULT 0.3,
    status           VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    result_bool      BOOLEAN,                       -- true=YES, false=NO, null=unresolved
    resolved_value   NUMERIC,                       -- surface calculee (km2)
    resolved_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bets_status ON bets(status);
CREATE INDEX idx_bets_region_geom ON bets USING GIST(region_geom);
CREATE INDEX idx_bets_period ON bets(period_start, period_end);

-- ─── Analyses (runs du pipeline NDVI) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS analyses (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bet_id                 UUID NOT NULL REFERENCES bets(id) ON DELETE CASCADE,
    executed_at            TIMESTAMPTZ DEFAULT NOW(),
    status                 VARCHAR(20) NOT NULL,     -- PENDING | RUNNING | SUCCESS | FAILED
    params                 JSONB NOT NULL,            -- snapshot des params utilises

    -- Donnees Sentinel-2 utilisees
    sentinel_products_t0   TEXT[],                    -- IDs produits T0
    sentinel_products_t1   TEXT[],                    -- IDs produits T1
    stac_uris              TEXT[],                    -- URIs STAC

    -- Resultats
    surface_deforestee_km2 NUMERIC,
    pixels_deforested      BIGINT,
    cloud_coverage_mean    NUMERIC,

    -- Preuves (hashes)
    script_hash            VARCHAR(128),              -- sha256 du script/git commit
    ndvi_t0_hash           VARCHAR(128),
    ndvi_t1_hash           VARCHAR(128),
    delta_hash             VARCHAR(128),
    mask_hash              VARCHAR(128),
    ipfs_cid               VARCHAR(100),              -- CID fictif si demo

    -- Logs
    error_message          TEXT,
    duration_seconds       NUMERIC
);

CREATE INDEX idx_analyses_bet_id ON analyses(bet_id);
CREATE INDEX idx_analyses_executed_at ON analyses(executed_at DESC);

-- ─── Raster snapshots (optionnel — refs fichiers) ──────────────────────────
CREATE TABLE IF NOT EXISTS raster_snapshots (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id    UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
    kind           VARCHAR(30) NOT NULL,    -- ndvi_t0 | ndvi_t1 | delta | mask
    file_path      TEXT NOT NULL,
    file_hash      VARCHAR(128) NOT NULL,
    bbox_geom      GEOMETRY(Polygon, 4326),
    nodata_value   NUMERIC,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_raster_snapshots_analysis ON raster_snapshots(analysis_id);
