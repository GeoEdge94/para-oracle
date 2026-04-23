import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { geoEqualEarth, geoPath, geoContains } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { Bet } from "@/lib/api";

type Props = {
  bets: Bet[];
  width?: number;
  height?: number;
};

type Node = {
  slug: string;
  regionName: string;
  category: string;
  status: string;
  x: number;
  y: number;
  threshold: number;
  thresholdUnit: string;
};

const CATEGORY_RGB: Record<string, string> = {
  deforestation: "#34d399",
  wildfire: "#f59e0b",
  flood: "#60a5fa",
  mining: "#a855f7",
  drought: "#f87171",
  glacier: "#67e8f9",
  urbanization: "#fb923c",
  water_quality: "#38bdf8",
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
 * Orion-style "punch card" world hex dot map.
 *
 * Generates a rectangular grid of dots on an Equal Earth projection,
 * keeps only the dots that fall inside land polygons (from UN
 * world-atlas 110m topology). Highlights our market locations with
 * bright glow dots + floating labels.
 *
 * No external MapLibre — pure SVG so it's crisp at any size and safe
 * to mount anywhere in the layout.
 */
export function WorldHexMap({ bets, width = 900, height = 500 }: Props) {
  const [landFC, setLandFC] = useState<FeatureCollection<Geometry> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const topo = (await import("world-atlas/countries-110m.json")).default as Topology;
        const fc = feature(topo, topo.objects.countries) as unknown as FeatureCollection<Geometry>;
        if (!cancelled) setLandFC(fc);
      } catch {}
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const projection = useMemo(() => {
    return geoEqualEarth().fitSize([width, height], { type: "Sphere" } as unknown as Feature<Geometry>);
  }, [width, height]);

  // Pre-compute all land dots (grid sampling + point-in-polygon test)
  const dots = useMemo(() => {
    if (!landFC) return [];
    const spacing = 11;
    const out: Array<{ x: number; y: number; intensity: number }> = [];
    // Build a single Feature to test contains (union of all countries)
    const testFeature: Feature<Geometry> = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "GeometryCollection",
        geometries: landFC.features.map((f) => f.geometry),
      } as unknown as Geometry,
    };
    for (let y = 0; y < height; y += spacing) {
      for (let x = 0; x < width; x += spacing) {
        const lngLat = projection.invert?.([x, y]);
        if (!lngLat) continue;
        if (Math.abs(lngLat[1]) > 85) continue;
        if (!geoContains(testFeature, lngLat)) continue;
        // Stagger rows for hex feel
        const offset = (Math.floor(y / spacing) % 2 === 0) ? 0 : spacing / 2;
        out.push({ x: x + offset, y, intensity: 0.22 + Math.random() * 0.08 });
      }
    }
    return out;
  }, [landFC, projection, width, height]);

  const nodes: Node[] = useMemo(() => {
    const out: Node[] = [];
    for (const b of bets) {
      const c = centroidOf(b.region_geojson);
      if (!c) continue;
      const p = projection(c);
      if (!p) continue;
      out.push({
        slug: b.slug,
        regionName: b.region_name,
        category: b.category,
        status: b.status,
        x: p[0],
        y: p[1],
        threshold: Number(b.threshold_value),
        thresholdUnit: b.threshold_unit,
      });
    }
    return out;
  }, [bets, projection]);

  const pathGen = useMemo(() => geoPath(projection), [projection]);

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block", background: "transparent" }}
    >
      <defs>
        <radialGradient id="node-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <filter id="blur-soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" />
        </filter>
      </defs>

      {/* Country outlines super subtle */}
      {landFC?.features.slice(0, 300).map((f, i) => (
        <path key={i} d={pathGen(f) || undefined} fill="transparent" stroke="rgba(255,255,255,0.02)" strokeWidth={0.5} />
      ))}

      {/* Land dots */}
      {dots.map((d, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={d.y}
          r={1.4}
          fill={`rgba(148, 163, 184, ${d.intensity})`}
        />
      ))}

      {/* Glow nodes + labels */}
      {nodes.map((n, i) => {
        const color = CATEGORY_RGB[n.category] ?? "#a855f7";
        // Label position offset (alternate above/below to avoid overlap)
        const labelAbove = (i % 2 === 0);
        const labelY = labelAbove ? n.y - 22 : n.y + 22;
        const delay = 0.2 + i * 0.04;
        return (
          <g key={n.slug}>
            {/* Outer halo */}
            <circle cx={n.x} cy={n.y} r={16} fill={color} opacity={0.08} filter="url(#blur-soft)" />
            <circle cx={n.x} cy={n.y} r={8} fill={color} opacity={0.18} />
            {/* Pulsing ring */}
            <circle cx={n.x} cy={n.y} r={4} fill="none" stroke={color} strokeWidth="1">
              <animate attributeName="r" from="3" to="10" dur="2.4s" begin={`${i * 0.3}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" from="0.7" to="0" dur="2.4s" begin={`${i * 0.3}s`} repeatCount="indefinite" />
            </circle>
            {/* Core */}
            <motion.circle
              initial={{ r: 0, opacity: 0 }}
              animate={{ r: 3, opacity: 1 }}
              transition={{ delay, duration: 0.35 }}
              cx={n.x}
              cy={n.y}
              fill={color}
            />
            <circle cx={n.x} cy={n.y} r={1.2} fill="#fff" />

            {/* Label — only show for first 6 biggest markets for legibility */}
            {i < 6 && (
              <motion.g
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: delay + 0.2, duration: 0.35 }}
              >
                <rect
                  x={n.x - 48}
                  y={labelY - 12}
                  width={96}
                  height={22}
                  rx={4}
                  fill="rgba(5, 8, 15, 0.88)"
                  stroke={color}
                  strokeOpacity={0.35}
                  strokeWidth={1}
                />
                <text
                  x={n.x}
                  y={labelY + 2}
                  textAnchor="middle"
                  fontFamily="Geist Mono, monospace"
                  fontSize={9}
                  fill="#fff"
                  fontWeight={600}
                >
                  {n.regionName.length > 16 ? n.regionName.slice(0, 14) + "…" : n.regionName}
                </text>
                <text
                  x={n.x}
                  y={labelY + 11}
                  textAnchor="middle"
                  fontFamily="Geist Mono, monospace"
                  fontSize={7}
                  fill={color}
                  opacity={0.8}
                >
                  {n.threshold} {n.thresholdUnit}
                </text>
              </motion.g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
