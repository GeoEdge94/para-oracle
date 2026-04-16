import type maplibregl from "maplibre-gl";
import type { CategorisedLayer } from "./layerCategories";
import { resolveTileUrl, isDateAware } from "./layerCategories";

/**
 * Reconciliate MapLibre layers with application state.
 * Idempotent — safe to call every render.
 *
 * Conventions:
 *   - MapLibre source id = `src-${slug}`
 *   - MapLibre layer id  = slug
 *   - Basemap layers are mutually exclusive (radio): only one visible at a time
 *
 * @param selectedDate optional ISO date (YYYY-MM-DD) applied to `{date}`-aware tile URLs
 */
export function syncLayers(map: maplibregl.Map, layers: CategorisedLayer[], selectedDate?: string) {
  if (!map.isStyleLoaded()) {
    map.once("styledata", () => syncLayers(map, layers, selectedDate));
    return;
  }

  const ordered = [...layers].sort((a, b) => a.display_order - b.display_order);

  // Hide boot basemap once an app-managed basemap is visible
  const hasVisibleBasemap = ordered.some((l) => l.category === "basemap" && l.visible);
  if (map.getLayer("__boot")) {
    map.setLayoutProperty("__boot", "visibility", hasVisibleBasemap ? "none" : "visible");
  }

  for (const l of ordered) {
    const sourceId = `src-${l.slug}`;
    const layerId = l.slug;

    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, "visibility", l.visible ? "visible" : "none");
      const opacityProp = paintOpacityProp(map, layerId);
      if (opacityProp) map.setPaintProperty(layerId, opacityProp, l.opacity);

      // Refresh tiles URL if a date-aware layer needs a new date
      if (l.type === "xyz" && l.url && isDateAware(l.url)) {
        const src = map.getSource(sourceId) as maplibregl.RasterTileSource | undefined;
        if (src && typeof src.setTiles === "function") {
          src.setTiles([resolveTileUrl(l.url, selectedDate)]);
        }
      }
      continue;
    }

    if (l.type === "xyz" && l.url) {
      try {
        if (!map.getSource(sourceId)) {
          map.addSource(sourceId, {
            type: "raster",
            tiles: [resolveTileUrl(l.url, selectedDate)],
            tileSize: 256,
            attribution: attributionFor(l.slug),
          });
        }
        // Insert raster layers BELOW the Pará vector fill/border (if present),
        // so the region polygon stays visually on top of every overlay.
        const beforeId = firstExistingLayer(map, ["para-fill", "para-border", "para-line"]);
        map.addLayer(
          {
            id: layerId,
            type: "raster",
            source: sourceId,
            layout: { visibility: l.visible ? "visible" : "none" },
            paint: { "raster-opacity": l.opacity },
          },
          beforeId
        );
      } catch (e) {
        console.warn(`[syncLayers] skipped ${l.slug}:`, e);
      }
    } else if (l.type === "geojson" && l.url) {
      continue;
    }
  }
}

function firstExistingLayer(map: maplibregl.Map, candidates: string[]): string | undefined {
  for (const id of candidates) {
    if (map.getLayer(id)) return id;
  }
  return undefined;
}

function paintOpacityProp(map: maplibregl.Map, id: string): string | null {
  const type = map.getLayer(id)?.type;
  if (type === "raster") return "raster-opacity";
  if (type === "fill") return "fill-opacity";
  if (type === "line") return "line-opacity";
  if (type === "circle") return "circle-opacity";
  if (type === "symbol") return "icon-opacity";
  return null;
}

function attributionFor(slug: string): string {
  if (slug.startsWith("nasa-")) return "NASA EOSDIS GIBS";
  if (slug === "basemap-osm") return "© OpenStreetMap";
  if (slug === "basemap-satellite") return "ESRI World Imagery";
  if (slug === "basemap-carto-dark") return "© CARTO";
  return "";
}

/** Enforce single-basemap invariant before state is pushed to syncLayers. */
export function ensureBasemapRadio(layers: CategorisedLayer[], newlyToggledSlug: string | null): CategorisedLayer[] {
  if (!newlyToggledSlug) return layers;
  const toggled = layers.find((l) => l.slug === newlyToggledSlug);
  if (!toggled || toggled.category !== "basemap") return layers;
  if (!toggled.visible) return layers;
  return layers.map((l) =>
    l.category === "basemap" && l.slug !== newlyToggledSlug ? { ...l, visible: false } : l
  );
}
