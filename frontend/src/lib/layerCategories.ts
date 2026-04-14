import type { Layer } from "@/lib/api";

export type LayerCategory = "basemap" | "satellite" | "ndvi" | "vector" | "fire";

export type CategorisedLayer = Layer & {
  category: LayerCategory;
  opacity: number;
  visible: boolean;
};

function inferCategory(slug: string): LayerCategory {
  if (slug.startsWith("basemap-")) return "basemap";
  if (slug.startsWith("nasa-") && slug.includes("firms")) return "fire";
  if (slug.startsWith("nasa-") || slug.includes("truecolor")) return "satellite";
  if (slug.includes("ndvi") || slug.startsWith("delta") || slug.startsWith("mask")) return "ndvi";
  return "vector";
}

export const CATEGORY_META: Record<LayerCategory, { label: string; icon: string; order: number }> = {
  basemap:   { label: "Fonds de carte", icon: "🗺️", order: 0 },
  satellite: { label: "Imagerie satellite", icon: "🛰️", order: 1 },
  ndvi:      { label: "NDVI / Déforestation", icon: "🌿", order: 2 },
  fire:      { label: "Feux actifs", icon: "🔥", order: 3 },
  vector:    { label: "Vecteurs", icon: "📐", order: 4 },
};

/**
 * Resolve `{date}` placeholder for NASA GIBS tiles.
 * Defaults to J-1 (today's tile often not published before ~18:00 UTC).
 * Accepts ISO date string (YYYY-MM-DD) to target a specific day.
 */
export function resolveTileUrl(url: string, dateIso?: string): string {
  if (!url.includes("{date}")) return url;
  if (dateIso) return url.replace("{date}", dateIso);
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return url.replace("{date}", d.toISOString().slice(0, 10));
}

/** True if the layer URL contains a `{date}` placeholder. */
export function isDateAware(url: string | null): boolean {
  return !!url && url.includes("{date}");
}

export function categorise(layers: Layer[]): CategorisedLayer[] {
  return layers
    .map((l) => ({
      ...l,
      category: inferCategory(l.slug),
      opacity: 1,
      visible: l.visible_default,
    }))
    .sort((a, b) => a.display_order - b.display_order);
}
