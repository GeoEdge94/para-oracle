import type maplibregl from "maplibre-gl";
import type { CategorisedLayer } from "./layerCategories";
import { resolveTileUrl } from "./layerCategories";

/**
 * Reconciliate MapLibre layers with application state.
 * Idempotent — safe to call every render.
 *
 * Conventions:
 *   - MapLibre source id = `src-${slug}`
 *   - MapLibre layer id  = slug
 *   - Basemap layers are mutually exclusive (radio): only one visible at a time
 */
export function syncLayers(map: maplibregl.Map, layers: CategorisedLayer[]) {
  if (!map.isStyleLoaded()) {
    map.once("styledata", () => syncLayers(map, layers));
    return;
  }

  // Order layers by display_order so addLayer produces correct z-stack
  const ordered = [...layers].sort((a, b) => a.display_order - b.display_order);

  for (const l of ordered) {
    const sourceId = `src-${l.slug}`;
    const layerId = l.slug;

    // Remove legacy layer if type mismatch (rare)
    if (map.getLayer(layerId)) {
      // Update visibility & opacity on existing layer
      map.setLayoutProperty(layerId, "visibility", l.visible ? "visible" : "none");
      const opacityProp = paintOpacityProp(map, layerId);
      if (opacityProp) map.setPaintProperty(layerId, opacityProp, l.opacity);
      continue;
    }

    // Add source + layer on first sync
    if (l.type === "xyz" && l.url) {
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, {
          type: "raster",
          tiles: [resolveTileUrl(l.url)],
          tileSize: 256,
          attribution: attributionFor(l.slug),
        });
      }
      map.addLayer({
        id: layerId,
        type: "raster",
        source: sourceId,
        layout: { visibility: l.visible ? "visible" : "none" },
        paint: { "raster-opacity": l.opacity },
      });
    } else if (l.type === "geojson" && l.url) {
      // geojson layers are added externally via addRegionGeoJSON; skip here
      continue;
    }
  }
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
