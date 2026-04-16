import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useNavigate } from "react-router-dom";
import { API, type Bet } from "@/lib/api";
import { BetSheet } from "@/components/BetSheet";
import { BetBottomSheet } from "@/components/BetBottomSheet";
import { BetTicker } from "@/components/BetTicker";
import { CrisisStats } from "@/components/CrisisStats";
import { CategoryFilter } from "@/components/CategoryFilter";
import { geojsonBounds } from "@/lib/mapLayers";
import { LogOut, Plus } from "lucide-react";
import { LocaleToggle } from "@/components/LocaleToggle";

const WORLD_CENTER: [number, number] = [10, 15];

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

export function MapPage() {
  const navigate = useNavigate();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [selectedBet, setSelectedBet] = useState<Bet | null>(null);
  const [overlapMenu, setOverlapMenu] = useState<{ x: number; y: number; bets: Bet[] } | null>(null);
  const [showCarousel, setShowCarousel] = useState(false);
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const betsRef = useRef<Bet[]>([]);
  const dashAnimRef = useRef<number | null>(null);
  const pulseAnimRef = useRef<number | null>(null);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          "__boot": {
            type: "raster",
            tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
            tileSize: 256,
            attribution: "ESRI World Imagery",
          },
        },
        layers: [{ id: "__boot", type: "raster", source: "__boot" }],
      },
      center: WORLD_CENTER,
      zoom: 2,
      maxZoom: 14,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false, showZoom: false }), "top-right");

    map.on("load", async () => {
      const res = await API.listBets();
      const allBets = res.data;
      setBets(allBets);
      betsRef.current = allBets;

      const SUB_ZONES = new Set([
        "br163-deforestation-fires-2025",
        "para-fires-primary-2025",
        "tapajos-flood-2026",
        "tapajos-mining-2025",
        "se-para-fires-deforestation-2025",
        "mt-soja-drought-2026",
      ]);

      const visibleBets = allBets.filter((b) => b.region_geojson && !SUB_ZONES.has(b.slug));

      const fillIds: string[] = [];
      for (const bet of visibleBets) {
        const color = CAT_COLORS[bet.category] || "#8b5cf6";
        const srcId = `region-${bet.slug}`;
        const fillId = `fill-${bet.slug}`;
        fillIds.push(fillId);

        map.addSource(srcId, {
          type: "geojson",
          data: { type: "Feature", properties: { slug: bet.slug }, geometry: bet.region_geojson! },
        });

        map.addLayer({
          id: fillId,
          type: "fill",
          source: srcId,
          paint: { "fill-color": color, "fill-opacity": 0.12 },
        });

        map.addLayer({
          id: `glow-${bet.slug}`,
          type: "line",
          source: srcId,
          paint: { "line-color": color, "line-width": 8, "line-opacity": 0.2, "line-blur": 5 },
        });

        map.addLayer({
          id: `border-${bet.slug}`,
          type: "line",
          source: srcId,
          paint: { "line-color": color, "line-width": 2, "line-dasharray": [2, 2] },
        });

        const centroid = computeCentroid(bet.region_geojson!);
        const centroidSrc = `center-${bet.slug}`;
        map.addSource(centroidSrc, {
          type: "geojson",
          data: { type: "Feature", properties: { slug: bet.slug, color }, geometry: { type: "Point", coordinates: centroid } },
        });

        map.addLayer({
          id: `pulse-${bet.slug}`,
          type: "circle",
          source: centroidSrc,
          paint: {
            "circle-radius": 4,
            "circle-color": color,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#0a0f1a",
            "circle-stroke-opacity": 0.9,
          },
        });
      }

      // Ant march animation on borders (shifting dasharray)
      let dashOffset = 0;
      const animateDash = () => {
        dashOffset = (dashOffset + 0.1) % 4;
        for (const bet of visibleBets) {
          const lid = `border-${bet.slug}`;
          if (map.getLayer(lid)) {
            map.setPaintProperty(lid, "line-dasharray", [2, 2, dashOffset]);
          }
        }
        dashAnimRef.current = requestAnimationFrame(animateDash);
      };
      dashAnimRef.current = requestAnimationFrame(animateDash);

      // Pulse animation on centroids
      let pulseT = 0;
      const animatePulse = () => {
        pulseT += 0.05;
        const r = 4 + Math.sin(pulseT) * 2;
        for (const bet of visibleBets) {
          const lid = `pulse-${bet.slug}`;
          if (map.getLayer(lid)) {
            map.setPaintProperty(lid, "circle-radius", r);
          }
        }
        pulseAnimRef.current = requestAnimationFrame(animatePulse);
      };
      pulseAnimRef.current = requestAnimationFrame(animatePulse);

      map.on("click", (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: fillIds.filter((id) => map.getLayer(id)) });
        if (!features.length) { setOverlapMenu(null); return; }

        const slugs = [...new Set(features.map((f) => f.properties?.slug).filter(Boolean))];
        const matched = slugs.map((s) => betsRef.current.find((b) => b.slug === s)).filter(Boolean) as Bet[];

        if (matched.length === 1) {
          setOverlapMenu(null);
          setSelectedBet(matched[0]);
          const b = geojsonBounds(matched[0].region_geojson!);
          map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: { top: 60, bottom: 300, left: 20, right: 20 }, duration: 1200 });
        } else if (matched.length > 1) {
          setSelectedBet(null);
          setOverlapMenu({ x: e.point.x, y: e.point.y, bets: matched });
        }
      });

      map.on("mousemove", (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: fillIds.filter((id) => map.getLayer(id)) });
        map.getCanvas().style.cursor = features.length ? "pointer" : "";
      });
    });

    mapRef.current = map;
    return () => {
      if (dashAnimRef.current) cancelAnimationFrame(dashAnimRef.current);
      if (pulseAnimRef.current) cancelAnimationFrame(pulseAnimRef.current);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !bets.length) return;
    for (const bet of bets) {
      const show = filterCat === null || bet.category === filterCat;
      for (const layerId of [`fill-${bet.slug}`, `border-${bet.slug}`, `glow-${bet.slug}`, `pulse-${bet.slug}`]) {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, "visibility", show ? "visible" : "none");
        }
      }
    }
  }, [filterCat, bets]);

  function selectBet(bet: Bet) {
    setSelectedBet(bet);
    if (mapRef.current && bet.region_geojson) {
      const b = geojsonBounds(bet.region_geojson);
      mapRef.current.fitBounds([[b[0], b[1]], [b[2], b[3]]], {
        padding: { top: 60, bottom: 300, left: 20, right: 20 },
        duration: 1200,
      });
    }
  }

  function logout() {
    localStorage.removeItem("para_token");
    navigate("/login");
  }

  return (
    <div style={{ position: "relative", height: "100dvh" }}>
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 30,
        padding: "8px 14px", background: "#0a0f1a",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: "1px solid #1e293b", gap: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: "-0.5px" }}>
            Para<span style={{ color: "#10b981" }}>Oracle</span>
          </div>
          <span style={{ fontSize: 8, color: "#64748b", letterSpacing: "1px", fontFamily: "monospace" }}>/ GLOBAL</span>
        </div>
        <div style={{ flex: 1, display: "flex", justifyContent: "center", overflow: "hidden" }}>
          <CrisisStats bets={bets} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <LocaleToggle />
          <button onClick={logout} style={{ padding: "4px 8px", fontSize: 10, background: "transparent", border: "1px solid #1e293b", color: "#94a3b8", borderRadius: 4, cursor: "pointer" }}>
            <LogOut size={12} style={{ verticalAlign: "middle" }} />
          </button>
        </div>
      </div>

      <BetTicker bets={bets} />
      <CategoryFilter bets={bets} active={filterCat} onSelect={setFilterCat} />

      <div ref={mapContainer} style={{ position: "absolute", inset: 0 }} onClick={() => { setOverlapMenu(null); setShowCarousel(false); }} />

      {overlapMenu && (
        <div className="overlap-menu" style={{ left: overlapMenu.x, top: overlapMenu.y }}>
          <div style={{ fontSize: 10, color: "#64748b", padding: "6px 10px 4px", textTransform: "uppercase" }}>
            {overlapMenu.bets.length} paris sur cette zone
          </div>
          {overlapMenu.bets.map((b) => {
            const color = CAT_COLORS[b.category] || "#8b5cf6";
            return (
              <button
                key={b.slug}
                className="overlap-menu-item"
                onClick={() => { setOverlapMenu(null); selectBet(b); }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {b.region_name}
                </span>
                <span style={{ fontSize: 9, color: "#64748b" }}>{b.index_type}</span>
              </button>
            );
          })}
        </div>
      )}

      {!selectedBet && !showCarousel && (
        <button
          className="fab"
          style={{ bottom: 24, left: 16 }}
          onClick={() => setShowCarousel(true)}
        >
          <Plus size={22} />
        </button>
      )}

      {showCarousel && !selectedBet && (
        <BetBottomSheet
          bets={filterCat ? bets.filter((b) => b.category === filterCat) : bets}
          onSelect={(b) => { setShowCarousel(false); selectBet(b); }}
          onClose={() => setShowCarousel(false)}
        />
      )}

      {selectedBet && (
        <BetSheet
          bet={selectedBet}
          onClose={() => setSelectedBet(null)}
          onOpen={() => navigate(`/analysis/${selectedBet.slug}`)}
        />
      )}
    </div>
  );
}

function computeCentroid(geom: GeoJSON.Polygon | GeoJSON.MultiPolygon): [number, number] {
  const ring = geom.type === "MultiPolygon" ? geom.coordinates[0][0] : geom.coordinates[0];
  let sx = 0, sy = 0, n = 0;
  for (const [x, y] of ring) { sx += x; sy += y; n++; }
  return [sx / n, sy / n];
}
