import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useNavigate } from "react-router-dom";
import { API, type Bet } from "@/lib/api";
import { BetSheet } from "@/components/BetSheet";
import { BetCarousel } from "@/components/BetCarousel";
import { BetTicker } from "@/components/BetTicker";
import { StatusBadge } from "@/components/StatusBadge";
import { geojsonBounds, buildInvertedMask } from "@/lib/mapLayers";
import { LogOut, Plus, X } from "lucide-react";

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
  const betsRef = useRef<Bet[]>([]);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          "carto-dark": {
            type: "raster",
            tiles: ["https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png"],
            tileSize: 256,
            attribution: "CARTO",
          },
          "esri-satellite": {
            type: "raster",
            tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
            tileSize: 256,
          },
        },
        layers: [
          { id: "carto-dark", type: "raster", source: "carto-dark" },
          { id: "esri-satellite", type: "raster", source: "esri-satellite" },
        ],
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

      const world: GeoJSON.Position[] = [[-180,-90],[180,-90],[180,90],[-180,90],[-180,-90]];
      const visibleBets = allBets.filter((b) => b.region_geojson && !SUB_ZONES.has(b.slug));
      const holes: GeoJSON.Position[][] = visibleBets.map((b) => {
        const g = b.region_geojson!;
        return g.type === "MultiPolygon" ? g.coordinates[0][0] : g.coordinates[0];
      });

      map.addSource("sat-mask", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "Polygon", coordinates: [world, ...holes] },
        },
      });
      map.addLayer({
        id: "sat-mask-fill",
        type: "fill",
        source: "sat-mask",
        paint: { "fill-color": "#0f172a", "fill-opacity": 0.92 },
      });

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
          paint: { "fill-color": color, "fill-opacity": 0.15 },
        });

        map.addLayer({
          id: `glow-${bet.slug}`,
          type: "line",
          source: srcId,
          paint: { "line-color": color, "line-width": 6, "line-opacity": 0.2, "line-blur": 4 },
        });

        map.addLayer({
          id: `border-${bet.slug}`,
          type: "line",
          source: srcId,
          paint: { "line-color": color, "line-width": 1.5, "line-opacity": 0.8 },
        });
      }

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
    return () => { map.remove(); mapRef.current = null; };
  }, []);

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
        borderBottom: "1px solid #1e293b",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 800, fontSize: 15 }}>
            Para<span style={{ color: "#10b981" }}>Oracle</span>
          </div>
          <StatusBadge />
        </div>
        <button className="btn btn-ghost" onClick={logout} style={{ padding: "5px 9px", fontSize: 12 }}>
          <LogOut size={14} style={{ verticalAlign: "middle" }} />
        </button>
      </div>

      <BetTicker bets={bets} />

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
        <>
          <button
            className="fab"
            style={{ bottom: 100, left: 16, width: 38, height: 38, background: "#334155" }}
            onClick={() => setShowCarousel(false)}
          >
            <X size={16} />
          </button>
          <BetCarousel bets={bets} onSelect={(b) => { setShowCarousel(false); selectBet(b); }} />
        </>
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
