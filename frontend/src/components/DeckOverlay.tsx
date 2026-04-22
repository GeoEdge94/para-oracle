import { useEffect, useMemo, useRef } from "react";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { H3HexagonLayer } from "@deck.gl/geo-layers";
import { ScatterplotLayer } from "@deck.gl/layers";
import type maplibregl from "maplibre-gl";
import type { Bet } from "@/lib/api";
import { buildHexDensity, buildNodes, hexColor, CATEGORY_RGB, type HexDatum, type NodeDatum } from "@/lib/hexAggregate";

type Props = {
  map: maplibregl.Map | null;
  bets: Bet[];
  visible?: boolean;
  onNodeClick?: (slug: string) => void;
};

/**
 * Adds a deck.gl overlay to an existing MapLibre map with:
 *  - H3HexagonLayer coloring density (Orion-style "city aura")
 *  - ScatterplotLayer additive glow nodes at exact market centroids
 *
 * The overlay is layered UNDER the map's own symbol/line layers so pins
 * and dashed region borders remain legible on top.
 */
export function DeckOverlay({ map, bets, visible = true, onNodeClick }: Props) {
  const overlayRef = useRef<MapboxOverlay | null>(null);

  const hexData: HexDatum[] = useMemo(() => buildHexDensity(bets, { resolution: 3, radius: 6 }), [bets]);
  const nodeData: NodeDatum[] = useMemo(() => buildNodes(bets), [bets]);
  const maxHexCount = useMemo(() => Math.max(1, ...hexData.map((d) => d.count)), [hexData]);

  // Create overlay once (deck.gl mutates layers via setProps)
  useEffect(() => {
    if (!map) return;
    const overlay = new MapboxOverlay({
      interleaved: true,
      layers: [],
    });
    // MapboxOverlay works on MapLibre via IControl interface
    map.addControl(overlay as unknown as maplibregl.IControl);
    overlayRef.current = overlay;
    return () => {
      try { map.removeControl(overlay as unknown as maplibregl.IControl); } catch {}
      overlayRef.current = null;
    };
  }, [map]);

  // Update layers whenever data / visibility changes
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    if (!visible || bets.length === 0) {
      overlay.setProps({ layers: [] });
      return;
    }

    const layers = [
      // Aura hex density — big continent-scale cells
      new H3HexagonLayer<HexDatum>({
        id: "paraoracle-hex-density",
        data: hexData,
        pickable: false,
        extruded: false,
        stroked: true,
        filled: true,
        getHexagon: (d) => d.hex,
        getFillColor: (d) => hexColor(d, maxHexCount),
        getLineColor: [255, 255, 255, 12],
        getLineWidth: 1,
        lineWidthMinPixels: 0.5,
        opacity: 0.9,
        parameters: { depthTest: false },
      }),

      // Glow ring 1 (wide soft) — additive cyan-emerald halo
      new ScatterplotLayer<NodeDatum>({
        id: "paraoracle-node-glow-wide",
        data: nodeData,
        pickable: false,
        stroked: false,
        filled: true,
        getPosition: (d) => d.position,
        getRadius: () => 60_000,
        radiusMinPixels: 18,
        radiusMaxPixels: 46,
        getFillColor: (d) => {
          const [r, g, b] = CATEGORY_RGB[d.category] ?? [16, 185, 129];
          return [r, g, b, 40];
        },
        parameters: { depthTest: false },
      }),

      // Glow ring 2 (narrow brighter)
      new ScatterplotLayer<NodeDatum>({
        id: "paraoracle-node-glow-core",
        data: nodeData,
        pickable: true,
        stroked: false,
        filled: true,
        getPosition: (d) => d.position,
        getRadius: () => 20_000,
        radiusMinPixels: 6,
        radiusMaxPixels: 14,
        getFillColor: (d) => {
          const [r, g, b] = CATEGORY_RGB[d.category] ?? [16, 185, 129];
          return [r, g, b, 255];
        },
        parameters: { depthTest: false },
        onClick: (info) => {
          const d = info.object as NodeDatum | undefined;
          if (d && onNodeClick) onNodeClick(d.slug);
        },
        updateTriggers: { onClick: [onNodeClick] },
      }),

      // White core center pixel
      new ScatterplotLayer<NodeDatum>({
        id: "paraoracle-node-center",
        data: nodeData,
        pickable: false,
        stroked: false,
        filled: true,
        getPosition: (d) => d.position,
        getRadius: () => 8_000,
        radiusMinPixels: 2,
        radiusMaxPixels: 4,
        getFillColor: () => [255, 255, 255, 230],
        parameters: { depthTest: false },
      }),
    ];

    overlay.setProps({ layers });
  }, [hexData, nodeData, maxHexCount, visible, bets.length, onNodeClick]);

  return null;
}
