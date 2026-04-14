import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useNavigate } from "react-router-dom";
import { API, type Bet, type Layer } from "@/lib/api";
import { BetSheet } from "@/components/BetSheet";
import { FAB } from "@/components/FAB";
import { Satellite, LogOut } from "lucide-react";

const PARA_CENTER: [number, number] = [-52.5, -4.0];

export function MapPage() {
  const navigate = useNavigate();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [bet, setBet] = useState<Bet | null>(null);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [showSheet, setShowSheet] = useState(true);

  // Init map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap",
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      center: PARA_CENTER,
      zoom: 5,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", async () => {
      // Fetch bet + layers
      const [betRes, layersRes] = await Promise.all([
        API.getBet("para-deforestation-2025-s1"),
        API.listLayers(),
      ]);
      setBet(betRes.data);
      setLayers(layersRes.data);

      // Add Para polygon
      if (betRes.data.region_geojson) {
        map.addSource("para-region", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: betRes.data.region_geojson,
          },
        });
        map.addLayer({
          id: "para-fill",
          type: "fill",
          source: "para-region",
          paint: { "fill-color": "#10b981", "fill-opacity": 0.15 },
        });
        map.addLayer({
          id: "para-border",
          type: "line",
          source: "para-region",
          paint: { "line-color": "#10b981", "line-width": 2, "line-dasharray": [3, 2] },
        });

        // Click zone → open sheet
        map.on("click", "para-fill", () => setShowSheet(true));
      }
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  function logout() {
    localStorage.removeItem("para_token");
    navigate("/login");
  }

  return (
    <div style={{ position: "relative", height: "100dvh" }}>
      {/* Header */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 30,
        padding: "12px 16px", background: "rgba(15,23,42,0.85)", backdropFilter: "blur(8px)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        borderBottom: "1px solid #1e293b",
      }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>
          Para<span style={{ color: "#10b981" }}>Oracle</span>
        </div>
        <button className="btn btn-ghost" onClick={logout} style={{ padding: "6px 10px", fontSize: 12 }}>
          <LogOut size={14} style={{ verticalAlign: "middle" }} />
        </button>
      </div>

      <div ref={mapContainer} style={{ position: "absolute", inset: 0 }} />

      <FAB icon={<Satellite size={20} />} onClick={() => setShowSheet(true)} />

      {showSheet && bet && (
        <BetSheet bet={bet} onClose={() => setShowSheet(false)} onOpen={() => navigate(`/analysis/${bet.slug}`)} />
      )}
    </div>
  );
}
