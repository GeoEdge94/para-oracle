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
  index_type: string;
  change_direction: string;
  change_threshold: number;
  ground_truth_source: string;
  proof_layers: string[];
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

export type UserBet = {
  id: string;
  user_id: string;
  bet_id: string;
  position: "YES" | "NO";
  amount: number;
  odds: number;
  potential_payout: number;
  status: "PENDING" | "WON" | "LOST";
  placed_at: string;
  settled_at: string | null;
  user_pseudo: string | null;
};

export type BetMarketStats = {
  total_volume: number;
  total_bets: number;
  yes_volume: number;
  no_volume: number;
  yes_count: number;
  no_count: number;
  yes_pct: number;
  avg_odds_yes: number | null;
  avg_odds_no: number | null;
};

export type UserBetSummary = {
  total_staked: number;
  potential_payout: number;
  positions: UserBet[];
};

export type DeforestationZone = {
  id: string;
  analysis_id: string | null;
  bet_id: string;
  zone_name: string;
  source: "PRODES" | "DETER" | "NDVI";
  surface_km2: number;
  confidence: number;
  detected_at: string;
  geojson: GeoJSON.Polygon;
};

export const API = {
  login: (email: string, password: string) =>
    api.post<{ token: string; email: string; pseudo: string }>("/auth/login", { email, password }),
  listBets: () => api.get<Bet[]>("/bets"),
  getBet: (slug: string) => api.get<Bet>(`/bets/${slug}`),
  listLayers: () => api.get<Layer[]>("/layers"),
  resolveBet: (slug: string) => api.post<OracleResult>(`/oracle/resolve/${slug}`),
  listAnalyses: (slug: string) => api.get(`/analyses?bet_slug=${slug}`),
  listUserBets: (slug: string) => api.get<UserBet[]>(`/user-bets/by-bet/${slug}`),
  marketStats: (slug: string) => api.get<BetMarketStats>(`/user-bets/by-bet/${slug}/stats`),
  myBets: (slug: string) => {
    const token = localStorage.getItem("para_token") || "";
    return api.get<UserBetSummary>(`/user-bets/my/${slug}?token=${token}`);
  },
  listZones: (slug: string) => api.get<DeforestationZone[]>(`/zones/by-bet/${slug}`),
};
