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
import { GlobeView } from "@/components/GlobeView";
import { geojsonBounds } from "@/lib/mapLayers";
import { LogOut, Plus, Trophy, Menu, X, Globe } from "lucide-react";
import { motion } from "framer-motion";
import { LocaleToggle } from "@/components/LocaleToggle";
import { WalletBadge } from "@/components/WalletBadge";
import { StreakBadge } from "@/components/StreakBadge";
import { DeckOverlay } from "@/components/DeckOverlay";
import { useMissions, isBoosted } from "@/lib/engage";
import { usePulseOnNewBet } from "@/lib/usePulseOnNewBet";
import { usePageVisibility } from "@/lib/usePageVisibility";
import { useI18n } from "@/lib/i18n";

const WORLD_CENTER: [number, number] = [10, 15];

const SUB_ZONES = new Set([
  "br163-deforestation-fires-2025",
  "para-fires-primary-2025",
  "tapajos-flood-2026",
  "tapajos-mining-2025",
  "se-para-fires-deforestation-2025",
  "mt-soja-drought-2026",
]);

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
  const { t } = useI18n();
  const navigate = useNavigate();
  const { bump: bumpMission } = useMissions();
  const pageVisible = usePageVisibility();
  const pageVisibleRef = useRef(pageVisible);
  useEffect(() => { pageVisibleRef.current = pageVisible; }, [pageVisible]);
  const seenRef = useRef<Set<string>>(new Set());
  const [deckMap, setDeckMap] = useState<maplibregl.Map | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [selectedBet, setSelectedBet] = useState<Bet | null>(null);
  const [overlapMenu, setOverlapMenu] = useState<{ x: number; y: number; bets: Bet[] } | null>(null);
  const [showCarousel, setShowCarousel] = useState(false);
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"map" | "globe">("map");
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
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
      setDeckMap(map);
      const res = await API.listBets();
      const allBets = res.data;
      setBets(allBets);
      betsRef.current = allBets;

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

      // Ant-march borders: cycle through a small fixed set of dash patterns
      // (avoid creating unique arrays per frame — fills MapLibre's LineAtlas
      // texture and causes layers to vanish after a minute).
      const DASH_PATTERNS: [number, number][] = [
        [2, 2],
        [2.5, 1.5],
        [3, 1],
        [2.5, 1.5],
      ];
      let dashIdx = 0;
      let lastDashTick = performance.now();
      const animateDash = (now: number) => {
        if (pageVisibleRef.current && now - lastDashTick >= 180) {
          lastDashTick = now;
          dashIdx = (dashIdx + 1) % DASH_PATTERNS.length;
          const pattern = DASH_PATTERNS[dashIdx];
          for (const bet of visibleBets) {
            const lid = `border-${bet.slug}`;
            if (map.getLayer(lid)) {
              map.setPaintProperty(lid, "line-dasharray", pattern);
            }
          }
        }
        dashAnimRef.current = requestAnimationFrame(animateDash);
      };
      dashAnimRef.current = requestAnimationFrame(animateDash);

      // Pulse animation on centroids
      let pulseT = 0;
      const animatePulse = () => {
        if (pageVisibleRef.current) {
          pulseT += 0.05;
          const r = 4 + Math.sin(pulseT) * 2;
          for (const bet of visibleBets) {
            const lid = `pulse-${bet.slug}`;
            if (map.getLayer(lid)) {
              map.setPaintProperty(lid, "circle-radius", r);
            }
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
      const show =
        filterCat === null ? true :
        filterCat === "__boosted__" ? isBoosted(bet.period_end, bet.status) :
        bet.category === filterCat;
      for (const layerId of [`fill-${bet.slug}`, `border-${bet.slug}`, `glow-${bet.slug}`, `pulse-${bet.slug}`]) {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, "visibility", show ? "visible" : "none");
        }
      }
    }
  }, [filterCat, bets]);

  // Poll /user-bets for new placements; pulse pin + discreet toast
  const pulsingSlugs = usePulseOnNewBet(bets);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const bet of bets) {
      const lid = `pulse-${bet.slug}`;
      if (!map.getLayer(lid)) continue;
      if (pulsingSlugs.has(bet.slug)) {
        map.setPaintProperty(lid, "circle-stroke-width", 6);
        map.setPaintProperty(lid, "circle-radius", 10);
        map.setPaintProperty(lid, "circle-stroke-opacity", 0.9);
      } else {
        map.setPaintProperty(lid, "circle-stroke-width", 2);
        map.setPaintProperty(lid, "circle-stroke-opacity", 0.9);
      }
    }
  }, [pulsingSlugs, bets]);

  function selectBet(bet: Bet) {
    if (!seenRef.current.has(bet.slug)) {
      seenRef.current.add(bet.slug);
      bumpMission("check");
    }
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
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: "-0.5px" }}>
            Para<span style={{ color: "#10b981" }}>Oracle</span>
          </div>
          <span style={{ fontSize: 8, color: "#64748b", letterSpacing: "1px", fontFamily: "monospace" }}>{t("map.nav_global")}</span>
        </div>
        <div className="topbar-center">
          <CrisisStats bets={bets} />
        </div>
        <div className="topbar-actions">
          <StreakBadge />
          <WalletBadge onClick={() => navigate("/wallet")} />
          <button className="topbar-icon-btn" data-variant="gold" onClick={() => navigate("/leaderboard")} title={t("map.leaderboard")} aria-label={t("map.leaderboard")}>
            <Trophy size={14} />
          </button>
          <span className="topbar-sep" />
          <LocaleToggle />
          <span className="topbar-sep" />
          <button className="topbar-icon-btn" data-variant="danger" onClick={logout} title={t("map.logout")} aria-label={t("map.logout")}>
            <LogOut size={14} />
          </button>
        </div>
        <button className="topbar-hamburger" onClick={() => setMenuOpen(true)} aria-label={t("map.menu")}>
          <Menu size={18} />
        </button>
      </div>

      {menuOpen && (
        <>
          <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} />
          <aside className="sidebar-drawer" role="dialog" aria-label={t("map.menu")}>
            <div className="sidebar-head">
              <span style={{ fontWeight: 700, fontSize: 13 }}>{t("map.menu")}</span>
              <button onClick={() => setMenuOpen(false)} className="sidebar-close" aria-label={t("common.close")}>
                <X size={16} />
              </button>
            </div>
            <div className="sidebar-section">
              <div className="sidebar-label">{t("map.crisis")}</div>
              <CrisisStats bets={bets} />
            </div>
            <div className="sidebar-section sidebar-actions">
              <WalletBadge onClick={() => { setMenuOpen(false); navigate("/wallet"); }} />
              <button onClick={() => { setMenuOpen(false); navigate("/leaderboard"); }} className="sidebar-btn" style={{ color: "#fbbf24" }}>
                <Trophy size={14} /> <span>{t("map.leaderboard")}</span>
              </button>
              <div className="sidebar-btn" style={{ justifyContent: "space-between" }}>
                <span style={{ color: "#94a3b8", fontSize: 11 }}>{t("map.language")}</span>
                <LocaleToggle />
              </div>
              <button onClick={() => { setMenuOpen(false); logout(); }} className="sidebar-btn" style={{ color: "#94a3b8" }}>
                <LogOut size={14} /> <span>{t("map.logout")}</span>
              </button>
            </div>
          </aside>
        </>
      )}

      <BetTicker bets={bets} />
      <CategoryFilter bets={bets} active={filterCat} onSelect={setFilterCat} />

      <div
        ref={mapContainer}
        style={{ position: "absolute", inset: 0, display: viewMode === "map" ? "block" : "none" }}
        onClick={() => { setOverlapMenu(null); setShowCarousel(false); }}
      />

      {/* deck.gl hex density + glow nodes overlay (over ESRI satellite) */}
      {viewMode === "map" && (
        <DeckOverlay
          map={deckMap}
          bets={bets}
          onNodeClick={(slug) => navigate(`/market/${slug}`)}
        />
      )}

      {viewMode === "globe" && (
        <div style={{ position: "absolute", inset: 0, background: "#000", zIndex: 1 }}>
          <GlobeView
            bets={bets.filter((b) => !SUB_ZONES.has(b.slug))}
            width={size.w}
            height={size.h}
            onSelect={(b) => navigate(`/analysis/${b.slug}`)}
          />
        </div>
      )}

      {overlapMenu && (
        <motion.div
          className="overlap-menu"
          style={{ left: overlapMenu.x, top: overlapMenu.y }}
          initial={{ opacity: 0, y: -4, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          <div style={{ fontSize: 10, color: "var(--fg-faint)", padding: "6px 10px 4px", textTransform: "uppercase", letterSpacing: 0.5 }}>
            {t("map.bets_on_zone", { n: overlapMenu.bets.length })}
          </div>
          {overlapMenu.bets.map((b, idx) => {
            const color = CAT_COLORS[b.category] || "#8b5cf6";
            return (
              <motion.button
                key={b.slug}
                className="overlap-menu-item"
                onClick={() => { setOverlapMenu(null); selectBet(b); }}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.04 + idx * 0.035, duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ x: 2 }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {b.region_name}
                </span>
                <span style={{ fontSize: 9, color: "var(--fg-faint)" }}>{b.index_type}</span>
              </motion.button>
            );
          })}
        </motion.div>
      )}

      {!selectedBet && !showCarousel && (
        <>
          <motion.button
            className={`fab fab-secondary${viewMode === "globe" ? " fab-active" : ""}`}
            style={{ bottom: 24, right: 16, left: "auto" }}
            onClick={() => setViewMode((v) => (v === "map" ? "globe" : "map"))}
            title={viewMode === "globe" ? "Vue carte" : "Vue globe 3D"}
            aria-label={viewMode === "globe" ? "Vue carte" : "Vue globe 3D"}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 22, delay: 0.1 }}
            whileTap={{ scale: 0.92 }}
            whileHover={{ scale: 1.05 }}
          >
            <Globe size={20} />
          </motion.button>
          <motion.button
            className="fab"
            style={{ bottom: 24, left: 16 }}
            onClick={() => setShowCarousel(true)}
            aria-label="Discover bets"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            whileTap={{ scale: 0.92 }}
            whileHover={{ scale: 1.05 }}
          >
            <Plus size={22} />
          </motion.button>
        </>
      )}

      {showCarousel && !selectedBet && (
        <BetBottomSheet
          bets={
            filterCat === null ? bets :
            filterCat === "__boosted__" ? bets.filter((b) => isBoosted(b.period_end, b.status)) :
            bets.filter((b) => b.category === filterCat)
          }
          onSelect={(b) => { setShowCarousel(false); selectBet(b); }}
          onClose={() => setShowCarousel(false)}
        />
      )}

      {selectedBet && (
        <BetSheet
          bet={selectedBet}
          onClose={() => setSelectedBet(null)}
          onOpen={() => navigate(`/market/${selectedBet.slug}`)}
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
