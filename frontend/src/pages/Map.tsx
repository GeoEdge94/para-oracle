import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useNavigate } from "react-router-dom";
import { API, type Bet } from "@/lib/api";
import { BetSheet } from "@/components/BetSheet";
import { BetCarousel } from "@/components/BetCarousel";
import { StatusBadge } from "@/components/StatusBadge";
import { geojsonBounds } from "@/lib/mapLayers";
import { LogOut } from "lucide-react";

const BRAZIL_CENTER: [number, number] = [-55, -10];

const CAT_COLORS: Record<string, string> = {
  deforestation: "#10b981",
  wildfire: "#f59e0b",
  flood: "#3b82f6",
};

export function MapPage() {
  const navigate = useNavigate();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [selectedBet, setSelectedBet] = useState<Bet | null>(null);

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
      center: BRAZIL_CENTER,
      zoom: 4,
      maxZoom: 14,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false, showZoom: false }), "top-right");

    map.on("load", async () => {
      const res = await API.listBets();
      const allBets = res.data;
      setBets(allBets);

      for (const bet of allBets) {
        if (!bet.region_geojson) continue;
        const color = CAT_COLORS[bet.category] || "#8b5cf6";
        const srcId = `region-${bet.slug}`;

        map.addSource(srcId, {
          type: "geojson",
          data: { type: "Feature", properties: { slug: bet.slug }, geometry: bet.region_geojson },
        });

        map.addLayer({
          id: `fill-${bet.slug}`,
          type: "fill",
          source: srcId,
          paint: { "fill-color": color, "fill-opacity": 0.12 },
        });

        map.addLayer({
          id: `border-${bet.slug}`,
          type: "line",
          source: srcId,
          paint: { "line-color": color, "line-width": 2, "line-dasharray": [4, 2] },
        });

        map.on("click", `fill-${bet.slug}`, () => {
          setSelectedBet(bet);
        });

        map.on("mouseenter", `fill-${bet.slug}`, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", `fill-${bet.slug}`, () => { map.getCanvas().style.cursor = ""; });
      }
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
        padding: "10px 14px", background: "rgba(15,23,42,0.9)", backdropFilter: "blur(10px)",
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

      <div ref={mapContainer} style={{ position: "absolute", inset: 0 }} />

      {!selectedBet && <BetCarousel bets={bets} onSelect={selectBet} />}

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
