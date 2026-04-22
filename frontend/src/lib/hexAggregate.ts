import { latLngToCell, gridDisk, cellToLatLng } from "h3-js";
import type { Bet } from "@/lib/api";

/**
 * Aggregate bets into H3 hexagonal cells + ScatterplotLayer nodes data.
 * Produces a density map (hex) and glow nodes (exact centroids) suitable
 * for deck.gl layers over the MapLibre satellite basemap.
 */

export type HexDatum = {
  hex: string;
  count: number;
  category: string;
};

export type NodeDatum = {
  slug: string;
  position: [number, number]; // [lng, lat]
  regionName: string;
  category: string;
  status: string;
  indexType: string;
  threshold: number;
  thresholdUnit: string;
};

function centroidOf(geom: GeoJSON.Polygon | GeoJSON.MultiPolygon | null): [number, number] | null {
  if (!geom) return null;
  try {
    const ring = geom.type === "MultiPolygon" ? geom.coordinates[0][0] : geom.coordinates[0];
    let sx = 0, sy = 0, n = 0;
    for (const [x, y] of ring) { sx += x; sy += y; n++; }
    return [sx / n, sy / n]; // [lng, lat]
  } catch { return null; }
}

/**
 * Build glow nodes at exact market centroids.
 */
export function buildNodes(bets: Bet[]): NodeDatum[] {
  const out: NodeDatum[] = [];
  for (const b of bets) {
    const c = centroidOf(b.region_geojson);
    if (!c) continue;
    out.push({
      slug: b.slug,
      position: c,
      regionName: b.region_name,
      category: b.category,
      status: b.status,
      indexType: b.index_type,
      threshold: Number(b.threshold_value),
      thresholdUnit: b.threshold_unit,
    });
  }
  return out;
}

/**
 * Build an H3 hex grid around each market centroid with a given resolution
 * and neighborhood radius. Aggregates count of overlapping markets per cell.
 * Resolution 3 = big continent-scale hexes, perfect for the Orion-style
 * "city aura" look.
 */
export function buildHexDensity(
  bets: Bet[],
  opts?: { resolution?: number; radius?: number }
): HexDatum[] {
  const resolution = opts?.resolution ?? 3;
  const radius = opts?.radius ?? 6;

  const counter = new Map<string, { count: number; categories: Record<string, number> }>();

  for (const b of bets) {
    const c = centroidOf(b.region_geojson);
    if (!c) continue;
    const [lng, lat] = c;
    const centerCell = latLngToCell(lat, lng, resolution);
    const cells = gridDisk(centerCell, radius);
    for (let i = 0; i < cells.length; i++) {
      const weight = Math.max(0.25, 1 - i / cells.length); // centre = 1, edges = 0.25
      const existing = counter.get(cells[i]) ?? { count: 0, categories: {} };
      existing.count += weight;
      existing.categories[b.category] = (existing.categories[b.category] ?? 0) + weight;
      counter.set(cells[i], existing);
    }
  }

  const out: HexDatum[] = [];
  for (const [hex, { count, categories }] of counter.entries()) {
    const dominant = Object.entries(categories).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "deforestation";
    out.push({ hex, count, category: dominant });
  }
  return out;
}

/** For cell → [lat, lng] conversion if ever needed by labels */
export function hexCentroid(h: string): [number, number] {
  return cellToLatLng(h); // [lat, lng]
}

/** Category → [r, g, b, a] for deck.gl (0-255) */
export const CATEGORY_RGB: Record<string, [number, number, number]> = {
  deforestation: [16, 185, 129],
  wildfire:      [245, 158, 11],
  flood:         [59, 130, 246],
  mining:        [168, 85, 247],
  drought:       [239, 68, 68],
  glacier:       [6, 182, 212],
  urbanization:  [249, 115, 22],
  water_quality: [14, 165, 233],
};

/** Build a color [r, g, b, a] for a hex given its category + count. */
export function hexColor(d: HexDatum, maxCount: number): [number, number, number, number] {
  const [r, g, b] = CATEGORY_RGB[d.category] ?? [99, 102, 241];
  // Intensity clamped to 30-180 alpha
  const alpha = Math.round(30 + Math.min(1, d.count / Math.max(1, maxCount)) * 150);
  return [r, g, b, alpha];
}
