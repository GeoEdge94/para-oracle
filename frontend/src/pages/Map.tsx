import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useNavigate } from "react-router-dom";
import { API, type Bet } from "@/lib/api";
import { BetSheet } from "@/components/BetSheet";
import { FAB } from "@/components/FAB";
import { LayerPanel } from "@/components/LayerPanel";
import { StatusBadge } from "@/components/StatusBadge";
import { categorise, type CategorisedLayer } from "@/lib/layerCategories";
import { syncLayers, ensureBasemapRadio } from "@/lib/mapLayers";
import { Satellite, LogOut } from "lucide-react";

const PARA_CENTER: [number, number] = [-52.5, -4.0];

export function MapPage() {
  const navigate = useNavigate();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [bet, setBet] = useState<Bet | null>(null);
  const [layers, setLayers] = useState<CategorisedLayer[]>([]);
  const [showSheet, setShowSheet] = useState(true);

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
      center: PARA_CENTER,
      zoom: 6,
      maxZoom: 14,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

    map.on("load", async () => {
      const [betRes, layersRes] = await Promise.all([
        API.getBet("para-deforestation-2025-s1"),
        API.listLayers(),
      ]);
      setBet(betRes.data);
      setLayers(categorise(layersRes.data));

      if (betRes.data.region_geojson) {
        map.addSource("para-region", {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: betRes.data.region_geojson },
        });
        map.addLayer({
          id: "para-fill",
          type: "fill",
          source: "para-region",
          paint: { "fill-color": "#10b981", "fill-opacity": 0.1 },
        });
        map.addLayer({
          id: "para-border",
          type: "line",
          source: "para-region",
          paint: { "line-color": "#10b981", "line-width": 2, "line-dasharray": [3, 2] },
        });
        map.on("click", "para-fill", () => setShowSheet(true));
      }
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Reconciliate MapLibre state whenever `layers` change
  useEffect(() => {
    if (mapRef.current && layers.length) syncLayers(mapRef.current, layers);
  }, [layers]);

  const onToggle = useCallback((slug: string) => {
    setLayers((prev) => {
      const flipped = prev.map((l) => (l.slug === slug ? { ...l, visible: !l.visible } : l));
      return ensureBasemapRadio(flipped, slug);
    });
  }, []);
  const onOpacity = useCallback((slug: string, opacity: number) => {
    setLayers((prev) => prev.map((l) => (l.slug === slug ? { ...l, opacity } : l)));
  }, []);
  const onReorder = useCallback((slug: string, direction: "up" | "down") => {
    setLayers((prev) => {
      const sorted = [...prev].sort((a, b) => a.display_order - b.display_order);
      const idx = sorted.findIndex((l) => l.slug === slug);
      if (idx === -1) return prev;
      const swap = direction === "up" ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= sorted.length) return prev;
      // swap display_order values
      const a = sorted[idx];
      const b = sorted[swap];
      return prev.map((l) => {
        if (l.slug === a.slug) return { ...l, display_order: b.display_order };
        if (l.slug === b.slug) return { ...l, display_order: a.display_order };
        return l;
      });
    });
  }, []);

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

      {layers.length > 0 && (
        <LayerPanel
          layers={layers}
          onToggle={onToggle}
          onOpacity={onOpacity}
          onReorder={onReorder}
        />
      )}

      <FAB icon={<Satellite size={20} />} onClick={() => setShowSheet(true)} />

      {showSheet && bet && (
        <BetSheet
          bet={bet}
          onClose={() => setShowSheet(false)}
          onOpen={() => navigate(`/analysis/${bet.slug}`)}
        />
      )}
    </div>
  );
}
