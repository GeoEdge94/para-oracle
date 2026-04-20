import { useEffect, useMemo, useRef, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import * as THREE from "three";
import type { Bet } from "@/lib/api";

const CAT_COLORS: Record<string, string> = {
  deforestation: "#10b981",
  wildfire: "#f59e0b",
  flood: "#3b82f6",
  mining: "#a855f7",
  drought: "#ef4444",
  glacier: "#06b6d4",
  urbanization: "#f97316",
  water_quality: "#0ea5e9",
};

type Props = {
  bets: Bet[];
  onSelect?: (bet: Bet) => void;
  width: number;
  height: number;
};

export function GlobeView({ bets, onSelect, width, height }: Props) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [material] = useState(() => {
    const m = new THREE.MeshPhongMaterial({ color: 0xffffff });
    m.bumpScale = 8;
    const loader = new THREE.TextureLoader();
    loader.load("/globe/earth-blue-marble.jpg", (tex) => {
      m.map = tex;
      m.needsUpdate = true;
    });
    loader.load("/globe/earth-topology.png", (tex) => {
      m.bumpMap = tex;
      m.needsUpdate = true;
    });
    return m;
  });

  const regions = useMemo(
    () =>
      bets
        .filter((b) => b.region_geojson)
        .map((b) => ({
          bet: b,
          geometry: b.region_geojson!,
          color: CAT_COLORS[b.category] || "#8b5cf6",
        })),
    [bets]
  );

  // Outlines: flatten polygon rings into [lat, lng][] paths (three-globe expects lat first)
  const paths = useMemo(() => {
    const out: { coords: [number, number][]; color: string; bet: Bet }[] = [];
    for (const r of regions) {
      const polys: GeoJSON.Position[][][] =
        r.geometry.type === "MultiPolygon" ? r.geometry.coordinates : [r.geometry.coordinates];
      for (const poly of polys) {
        for (const ring of poly) {
          out.push({
            coords: ring.map(([lng, lat]) => [lat, lng] as [number, number]),
            color: r.color,
            bet: r.bet,
          });
        }
      }
    }
    return out;
  }, [regions]);

  const points = useMemo(
    () =>
      regions.map((r) => {
        const [lng, lat] = centroid(r.geometry);
        return { lat, lng, color: r.color, bet: r.bet };
      }),
    [regions]
  );

  useEffect(() => {
    const g = globeRef.current;
    if (!g) return;
    g.pointOfView({ lat: 15, lng: 10, altitude: 2.2 }, 0);
    const controls = g.controls() as unknown as { autoRotate: boolean; autoRotateSpeed: number };
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.35;
    const scene = g.scene();
    scene.add(new THREE.AmbientLight(0xffffff, 1.0));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(1, 1, 1);
    scene.add(dir);
  }, [material]);

  return (
    <Globe
      ref={globeRef}
      width={width}
      height={height}
      globeMaterial={material}
      backgroundImageUrl="/globe/night-sky.png"
      showAtmosphere={true}
      atmosphereColor="#3b82f6"
      atmosphereAltitude={0.15}
      pathsData={paths}
      pathPoints="coords"
      pathPointLat={(p) => (p as [number, number])[0]}
      pathPointLng={(p) => (p as [number, number])[1]}
      pathColor={(d) => [
        hexToRgba((d as { color: string }).color, 0.95),
        hexToRgba((d as { color: string }).color, 0.4),
      ]}
      pathStroke={1.5}
      pathDashLength={0.04}
      pathDashGap={0.02}
      pathDashAnimateTime={6000}
      pathTransitionDuration={0}
      onPathClick={(d) => {
        if (onSelect) onSelect((d as { bet: Bet }).bet);
      }}
      pathLabel={(d) => {
        const b = (d as { bet: Bet }).bet;
        return `<div style="background:#0a0f1a;padding:6px 10px;border:1px solid #334155;border-radius:6px;font-family:sans-serif;font-size:12px;color:#e2e8f0;">
          <div style="font-weight:600">${escapeHtml(b.region_name)}</div>
          <div style="font-size:10px;color:#94a3b8;margin-top:2px">${escapeHtml(b.category)} · ${escapeHtml(b.index_type)}</div>
        </div>`;
      }}
      pointsData={points}
      pointLat="lat"
      pointLng="lng"
      pointColor="color"
      pointAltitude={0.01}
      pointRadius={0.35}
      onPointClick={(d) => {
        if (onSelect) onSelect((d as { bet: Bet }).bet);
      }}
    />
  );
}

function centroid(geom: GeoJSON.Polygon | GeoJSON.MultiPolygon): [number, number] {
  const ring = geom.type === "MultiPolygon" ? geom.coordinates[0][0] : geom.coordinates[0];
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const [x, y] of ring) {
    sx += x;
    sy += y;
    n++;
  }
  return [sx / n, sy / n];
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
