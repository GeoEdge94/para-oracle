import type { Layer } from "@/lib/api";

export type LayerCategory = "basemap" | "satellite" | "verified" | "ndvi" | "vector" | "fire";

export type CategorisedLayer = Layer & {
  category: LayerCategory;
  opacity: number;
  visible: boolean;
};

function inferCategory(slug: string): LayerCategory {
  if (slug.startsWith("basemap-")) return "basemap";
  if (
    slug.startsWith("prodes") ||
    slug.startsWith("deter") ||
    slug.startsWith("gfw-") ||
    slug.startsWith("hansen-") ||
    slug.startsWith("mapbiomas-")
  ) return "verified";
  if (slug.startsWith("nasa-") && slug.includes("firms")) return "fire";
  if (slug.startsWith("nasa-") || slug.includes("truecolor")) return "satellite";
  if (slug.includes("ndvi") || slug.startsWith("delta") || slug.startsWith("mask")) return "ndvi";
  return "vector";
}

export const CATEGORY_ICONS: Record<LayerCategory, { icon: string; order: number }> = {
  basemap:   { icon: "🗺️", order: 0 },
  satellite: { icon: "🛰️", order: 1 },
  verified:  { icon: "📜", order: 2 },
  ndvi:      { icon: "🌿", order: 3 },
  fire:      { icon: "🔥", order: 4 },
  vector:    { icon: "📐", order: 5 },
};

export const CATEGORY_I18N_KEYS: Record<LayerCategory, string> = {
  basemap: "layers.basemap",
  satellite: "layers.satellite",
  verified: "layers.verified",
  ndvi: "layers.ndvi",
  fire: "layers.fire",
  vector: "layers.vector",
};

/** Default opacity when a verified-deforestation overlay becomes visible. */
export const VERIFIED_DEFAULT_OPACITY = 0.65;

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

/**
 * Build the tile URL that MapLibre will request.
 *
 * - **Basemap layers** → use the external URL directly (CDN, no proxy)
 * - **All other layers** → route through backend tile cache proxy at
 *   `{API_BASE}/tiles/{slug}/{z}/{x}/{y}.ext`
 *   The proxy fetches upstream once, caches to disk, and serves forever.
 * - **Date-aware layers** → append `?date=YYYY-MM-DD` to the proxy URL
 */
export function buildTileUrl(layer: CategorisedLayer, dateIso?: string): string {
  const url = layer.url ?? "";

  // Basemaps → direct external load, no proxy
  if (layer.category === "basemap") {
    return url.includes("{date}") ? url.replace("{date}", dateIso || defaultDate()) : url;
  }

  // Determine file extension (.jpg for GIBS true-color, .png for everything else)
  const ext = url.includes(".jpg") ? "jpg" : "png";
  let proxyUrl = `${API_BASE}/tiles/${layer.slug}/{z}/{x}/{y}.${ext}`;

  // Append date for NASA GIBS date-aware layers
  if (url.includes("{date}")) {
    const date = dateIso || defaultDate();
    proxyUrl += `?date=${date}`;
  }

  return proxyUrl;
}

/** @deprecated — use buildTileUrl() for new code */
export function resolveTileUrl(url: string, dateIso?: string): string {
  if (!url.includes("{date}")) return url;
  return url.replace("{date}", dateIso || defaultDate());
}

function defaultDate(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** True if the layer's upstream URL is date-dependent. */
export function isDateAware(url: string | null): boolean {
  return !!url && url.includes("{date}");
}

export function categorise(layers: Layer[]): CategorisedLayer[] {
  return layers
    .map((l) => {
      const category = inferCategory(l.slug);
      return {
        ...l,
        category,
        opacity: category === "verified" ? VERIFIED_DEFAULT_OPACITY : 1,
        visible: l.visible_default,
      };
    })
    .sort((a, b) => a.display_order - b.display_order);
}
