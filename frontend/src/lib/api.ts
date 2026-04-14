import axios from "axios";

const baseURL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("para_token");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export type BetSummary = {
  id: string;
  slug: string;
  question: string;
  category: string;
  status: string;
  period_start: string;
  period_end: string;
  threshold_value: number;
  threshold_unit: string;
  result_bool: boolean | null;
  resolved_value: number | null;
};

export type Bet = BetSummary & {
  description: string;
  region_name: string;
  region_geojson: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
  ndvi_drop_threshold: number;
  resolved_at: string | null;
};

export type Layer = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  type: "wms" | "wfs" | "xyz" | "geojson" | "tilejson";
  url: string | null;
  local_path: string | null;
  style: Record<string, unknown> | null;
  display_order: number;
  visible_default: boolean;
};

export type OracleResult = {
  bet_id: string;
  resolved_outcome: "YES" | "NO";
  surface_deforestee_km2: number;
  threshold_km2: number;
  resolution_timestamp: string;
  evidence: {
    script_hash: string;
    ndvi_t0_hash: string;
    ndvi_t1_hash: string;
    delta_hash: string;
    mask_hash: string;
    sentinel_products_t0: string[];
    sentinel_products_t1: string[];
    stac_uris: string[];
    ipfs_cid: string;
    period: { start: string; end: string };
    analysis_id: string;
  };
};

export const API = {
  login: (email: string, password: string) =>
    api.post<{ token: string; email: string; pseudo: string }>("/auth/login", { email, password }),
  listBets: () => api.get<BetSummary[]>("/bets"),
  getBet: (slug: string) => api.get<Bet>(`/bets/${slug}`),
  listLayers: () => api.get<Layer[]>("/layers"),
  resolveBet: (slug: string) => api.post<OracleResult>(`/oracle/resolve/${slug}`),
  listAnalyses: (slug: string) => api.get(`/analyses?bet_slug=${slug}`),
};
