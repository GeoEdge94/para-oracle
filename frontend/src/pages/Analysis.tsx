import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { API, type Bet, type OracleResult, type UserBet, type BetMarketStats, type UserBetSummary, type DeforestationZone } from "@/lib/api";
import { LayerPanel } from "@/components/LayerPanel";
import { Legend } from "@/components/Legend";
import { StatusBadge } from "@/components/StatusBadge";
import { DateSelector, type DatePreset } from "@/components/DateSelector";
import { categorise, isDateAware, type CategorisedLayer } from "@/lib/layerCategories";
import { syncLayers, ensureBasemapRadio, geojsonBounds, installRegionMask } from "@/lib/mapLayers";
import { ChevronLeft, ChevronDown, ChevronUp, Play, Copy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { LocaleToggle } from "@/components/LocaleToggle";
import { StreakBadge } from "@/components/StreakBadge";
import { ResolutionScene } from "@/components/ResolutionScene";
import { useMissions, isBoosted } from "@/lib/engage";
import { BoostedBadge } from "@/components/BoostedBadge";
import { MarketMeta } from "@/components/MarketMeta";
import { PriceHistoryChart } from "@/components/PriceHistoryChart";
import { DepthChart } from "@/components/DepthChart";
import { useI18n } from "@/lib/i18n";
import { OnboardingOverlay } from "@/components/OnboardingOverlay";
import { MarketStats } from "@/components/MarketStats";
import { PlaceBetForm } from "@/components/PlaceBetForm";
import { BetTimeline } from "@/components/BetTimeline";
import { EvidenceDetail } from "@/components/EvidenceDetail";
import { Web3Evidence } from "@/components/Web3Evidence";
import { VerdictPanel } from "@/components/VerdictPanel";
import { MapPin } from "lucide-react";

export function Analysis() {
  const { slug = "" } = useParams();
  const { t, betQ } = useI18n();
  const { bump: bumpMission } = useMissions();
  const navigate = useNavigate();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [bet, setBet] = useState<Bet | null>(null);
  const [layers, setLayers] = useState<CategorisedLayer[]>([]);
  const [result, setResult] = useState<OracleResult | null>(null);
  const [resolving, setResolving] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [_preset, setPreset] = useState<DatePreset>("T1");
  const [sheetCollapsed, setSheetCollapsed] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem("para_onboarding_done"),
  );
  const [placements, setPlacements] = useState<UserBet[]>([]);
  const [marketStats, setMarketStats] = useState<BetMarketStats | null>(null);
  const [myBets, setMyBets] = useState<UserBetSummary | null>(null);
  const [zones, setZones] = useState<DeforestationZone[]>([]);
  const [showDetail, setShowDetail] = useState(false);
  const [showResolution, setShowResolution] = useState(false);
  const [userPosition, setUserPosition] = useState<"YES" | "NO" | null>(null);

  useEffect(() => {
    bumpMission("analyze");
    API.getBet(slug).then((r) => {
      setBet(r.data);
      if (!selectedDate) setSelectedDate(r.data.period_end);
    });
    API.listLayers().then((r) => {
      // On analysis page, turn NDVI layers on by default
      const cats = categorise(r.data).map((l) => {
        if (l.slug === "delta-ndvi") return { ...l, visible: true, opacity: 0.75 };
        if (l.slug === "nasa-viirs-truecolor") return { ...l, visible: true };
        return l;
      });
      // Ensure only one basemap visible
      const withBase = cats.map((l) =>
        l.slug === "basemap-satellite" ? { ...l, visible: true } :
        l.slug === "basemap-osm" ? { ...l, visible: false } : l
      );
      setLayers(withBase);
    });
    API.listUserBets(slug).then((r) => setPlacements(r.data)).catch(() => {});
    API.marketStats(slug).then((r) => setMarketStats(r.data)).catch(() => {});
    API.myBets(slug).then((r) => setMyBets(r.data)).catch(() => {});
    API.listZones(slug).then((r) => setZones(r.data)).catch(() => {});
    // Hydrate the evidence panel from the most recent analysis so bets that are
    // already resolved show their Web3 trace without re-clicking "Resoudre".
    API.listAnalyses(slug).then((r) => {
      const list = (r.data as unknown as Array<Record<string, unknown>>) || [];
      const a = list.find((x) => x.status === "SUCCESS") || list[0];
      if (!a) return;
      const params = (a.params as Record<string, unknown>) || {};
      const evidence = {
        pipeline_kind: (params.pipeline_kind as "weather" | "spectral") || "spectral",
        schema_version: "v1",
        fingerprint_sha256: (a.fingerprint_sha256 as string) || "",
        ipfs_cid: (a.ipfs_cid as string) || "",
        data_cid: (a.data_cid as string) || "",
        script_cid: (a.script_cid as string) || "",
        schema_cid: (a.schema_cid as string) || "",
        tls_proof_cid: (a.tls_proof_cid as string) || "",
        gateway_base: "https://gateway.pinata.cloud/ipfs/",
        period: { start: "", end: "" },
        analysis_id: String(a.id || ""),
        chain_tx_hash: (a.chain_tx_hash as string) || "",
        bond_amount_usdc: a.bond_amount_usdc != null ? Number(a.bond_amount_usdc) : undefined,
        dispute_window_end: (a.dispute_window_end as string) || "",
        dispute_status: (a.dispute_status as string) || "",
        script_hash: (a.script_hash as string) || undefined,
        ndvi_t0_hash: (a.ndvi_t0_hash as string) || undefined,
        ndvi_t1_hash: (a.ndvi_t1_hash as string) || undefined,
        delta_hash: (a.delta_hash as string) || undefined,
        mask_hash: (a.mask_hash as string) || undefined,
        sentinel_products_t0: (a.sentinel_products_t0 as string[]) || [],
        sentinel_products_t1: (a.sentinel_products_t1 as string[]) || [],
      };
      setResult({
        bet_id: slug,
        resolved_outcome: "YES",
        surface_deforestee_km2: Number(a.surface_deforestee_km2 || 0),
        threshold_km2: 0,
        resolution_timestamp: (a.executed_at as string) || new Date().toISOString(),
        evidence: evidence as OracleResult["evidence"],
      });
    }).catch(() => {});
  }, [slug]);

  useEffect(() => {
    if (!mapContainer.current || !bet || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          "__boot": {
            type: "raster",
            tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
            tileSize: 256,
          },
        },
        layers: [{ id: "__boot", type: "raster", source: "__boot" }],
      },
      center: [-52.0, -5.0],
      zoom: 6,
      maxZoom: 14,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

    map.on("load", () => {
      if (bet.region_geojson) {
        const bounds = geojsonBounds(bet.region_geojson);
        const pad = 1.5;
        map.setMinZoom(4);

        map.flyTo({ center: [-52, -4], zoom: 3, duration: 0 });

        setTimeout(() => {
          map.fitBounds(
            [[bounds[0], bounds[1]], [bounds[2], bounds[3]]],
            { padding: { top: 60, bottom: 280, left: 20, right: 20 }, duration: 2000, curve: 1.2 },
          );
          setTimeout(() => {
            map.setMaxBounds([
              [bounds[0] - pad, bounds[1] - pad],
              [bounds[2] + pad, bounds[3] + pad],
            ]);
          }, 2200);
        }, 300);

        installRegionMask(map, bet.region_geojson);

        map.addSource("para", { type: "geojson", data: { type: "Feature", properties: {}, geometry: bet.region_geojson } });
        map.addLayer({ id: "para-line", type: "line", source: "para", paint: { "line-color": "#10b981", "line-width": 2 } });
      }
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [bet]);

  useEffect(() => {
    if (mapRef.current && layers.length) {
      const bounds = bet?.region_geojson ? geojsonBounds(bet.region_geojson) : undefined;
      syncLayers(mapRef.current, layers, selectedDate || undefined, bounds);
    }
  }, [layers, selectedDate]);

  async function resolve() {
    setResolving(true);
    setShowResolution(true);
    try {
      // Determine user's position from myBets before resolving
      if (myBets && myBets.positions.length > 0) {
        const pending = myBets.positions.find((p) => p.status === "PENDING");
        setUserPosition(pending ? pending.position : null);
      } else {
        setUserPosition(null);
      }
      const { data } = await API.resolveBet(slug);
      setResult(data);
      const r = await API.getBet(slug);
      setBet(r.data);

      // Refetch zones detectees apres resolution
      const z = await API.listZones(slug);
      setZones(z.data);

      // Activer automatiquement les proof_layers du bet sur la carte
      const proofSlugs = r.data.proof_layers || [];
      const map = mapRef.current;
      setLayers((prev) => {
        const next = prev.map((l) => {
          if (proofSlugs.includes(l.slug)) {
            const opacity = l.category === "verified" ? 0.65 : l.category === "ndvi" ? 0.75 : 1;
            return { ...l, visible: true, opacity };
          }
          return l;
        });
        if (map) {
          for (const l of next) {
            if (proofSlugs.includes(l.slug) && map.getLayer(l.slug)) {
              map.setLayoutProperty(l.slug, "visibility", "visible");
              const type = map.getLayer(l.slug)?.type;
              const prop = type === "raster" ? "raster-opacity" : type === "fill" ? "fill-opacity" : null;
              if (prop) map.setPaintProperty(l.slug, prop, l.opacity);
            }
          }
        }
        return next;
      });

      // Afficher les zones detectees sur la carte
      setShowDetail(true);

      // Deplier le bottom sheet pour montrer le verdict
      setSheetCollapsed(false);
    } finally {
      setResolving(false);
    }
  }

  const onToggle = useCallback((slug: string) => {
    const map = mapRef.current;
    setLayers((prev) => {
      const flipped = prev.map((l) => (l.slug === slug ? { ...l, visible: !l.visible } : l));
      const next = ensureBasemapRadio(flipped, slug);
      if (map) {
        for (const l of next) {
          if (map.getLayer(l.slug)) {
            map.setLayoutProperty(l.slug, "visibility", l.visible ? "visible" : "none");
          }
        }
      }
      return next;
    });
  }, []);
  const onOpacity = useCallback((slug: string, opacity: number) => {
    const map = mapRef.current;
    if (map?.getLayer(slug)) {
      const type = map.getLayer(slug)?.type;
      const prop = type === "raster" ? "raster-opacity" : type === "fill" ? "fill-opacity" : null;
      if (prop) map.setPaintProperty(slug, prop, opacity);
    }
    setLayers((prev) => prev.map((l) => (l.slug === slug ? { ...l, opacity } : l)));
  }, []);
  const onReorder = useCallback((slug: string, direction: "up" | "down") => {
    setLayers((prev) => {
      const sorted = [...prev].sort((a, b) => a.display_order - b.display_order);
      const idx = sorted.findIndex((l) => l.slug === slug);
      if (idx === -1) return prev;
      const swap = direction === "up" ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= sorted.length) return prev;
      const a = sorted[idx];
      const b = sorted[swap];
      return prev.map((l) => {
        if (l.slug === a.slug) return { ...l, display_order: b.display_order };
        if (l.slug === b.slug) return { ...l, display_order: a.display_order };
        return l;
      });
    });
  }, []);

  const SOURCE_COLORS: Record<string, string> = { PRODES: "#fbbf24", DETER: "#fb923c", NDVI: "#10b981" };

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !zones.length) return;

    const ZONE_LAYERS = [
      "deforestation-zones-glow",
      "deforestation-zones-fill",
      "deforestation-zones-line",
      "deforestation-zones-labels",
    ];
    const colorExpr: maplibregl.ExpressionSpecification = [
      "match", ["get", "source"],
      "PRODES", "#fbbf24",
      "DETER", "#fb923c",
      "#10b981",
    ];

    if (showDetail) {
      const fc: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: zones.map((z) => ({
          type: "Feature" as const,
          properties: { source: z.source, name: z.zone_name, surface: Number(z.surface_km2), confidence: Number(z.confidence) },
          geometry: z.geojson,
        })),
      };

      if (!map.getSource("deforestation-zones")) {
        map.addSource("deforestation-zones", { type: "geojson", data: fc });

        map.addLayer({
          id: "deforestation-zones-glow", type: "line", source: "deforestation-zones",
          paint: { "line-color": colorExpr, "line-width": 8, "line-opacity": 0.15, "line-blur": 6 },
        }, "para-line");

        map.addLayer({
          id: "deforestation-zones-fill", type: "fill", source: "deforestation-zones",
          paint: {
            "fill-color": colorExpr,
            "fill-opacity": ["interpolate", ["linear"], ["get", "confidence"], 0.7, 0.08, 1, 0.25],
          },
        }, "para-line");

        map.addLayer({
          id: "deforestation-zones-line", type: "line", source: "deforestation-zones",
          paint: { "line-color": colorExpr, "line-width": 2.5, "line-opacity": 0.9 },
        }, "para-line");

        map.addLayer({
          id: "deforestation-zones-labels", type: "circle", source: "deforestation-zones",
          paint: {
            "circle-radius": 4,
            "circle-color": colorExpr,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#0f172a",
          },
        });
      } else {
        (map.getSource("deforestation-zones") as maplibregl.GeoJSONSource).setData(fc);
        for (const id of ZONE_LAYERS) {
          if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "visible");
        }
      }
    } else {
      for (const id of ZONE_LAYERS) {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", "none");
      }
    }
  }, [showDetail, zones]);

  // Pick the legend to show based on which NDVI layer is active & top-most
  const activeLegend = useMemo((): "ndvi" | "delta" | "mask" | null => {
    const visible = layers.filter((l) => l.visible && l.category === "ndvi");
    if (!visible.length) return null;
    const top = visible.sort((a, b) => b.display_order - a.display_order)[0];
    if (top.slug.startsWith("mask")) return "mask";
    if (top.slug.startsWith("delta")) return "delta";
    return "ndvi";
  }, [layers]);

  // How many visible layers react to the date selector
  const dateAffectedCount = useMemo(
    () => layers.filter((l) => l.visible && isDateAware(l.url)).length,
    [layers]
  );

  const onDateChange = useCallback((iso: string, preset: DatePreset) => {
    setSelectedDate(iso);
    setPreset(preset);
  }, []);

  if (!bet) return <div style={{ padding: 20 }}>{t("common.loading")}</div>;

  const resolved = bet.status.startsWith("RESOLVED");

  return (
    <div className="market-page-roboto" style={{ position: "relative", height: "100dvh", fontFamily: "'Roboto', system-ui, -apple-system, sans-serif" }}>
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 30,
        padding: "10px 14px", background: "rgba(15, 23, 42, 0.9)", backdropFilter: "blur(10px)",
        display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--border-muted)",
      }}>
        <button
          onClick={() => navigate("/")}
          className="topbar-icon-btn"
          aria-label={t("common.back")}
          style={{ width: 32, height: 32 }}
        >
          <ChevronLeft size={18} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: 0.8 }}>{t("analysis.title")}</div>
          <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--fg-strong)" }}>
            {bet.region_name}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <StreakBadge />
          <span className="topbar-sep" />
          <LocaleToggle />
          <span className="topbar-sep" />
          <StatusBadge />
        </div>
      </div>

      <div ref={mapContainer} style={{ position: "absolute", inset: 0 }} />

      {bet && selectedDate && (
        <DateSelector
          periodStart={bet.period_start}
          periodEnd={bet.period_end}
          selectedDate={selectedDate}
          onChange={onDateChange}
          affectedLayers={dateAffectedCount}
        />
      )}

      {activeLegend && (
        <div style={{ position: "fixed", left: 12, bottom: sheetCollapsed ? 60 : "52%", zIndex: 20, transition: "bottom 0.25s ease" }}>
          <Legend category={activeLegend} />
        </div>
      )}

      {layers.length > 0 && (
        <LayerPanel
          layers={layers}
          onToggle={onToggle}
          onOpacity={onOpacity}
          onReorder={onReorder}
        />
      )}

      <div className="bottom-dock">
        <div className={`bottom-sheet ${sheetCollapsed ? "bottom-sheet--collapsed" : ""}`}>
          <button className="bottom-sheet-handle" onClick={() => setSheetCollapsed((c) => !c)}>
            <span className="bottom-sheet-grabber" />
            <span style={{ fontSize: 10, color: "#64748b" }}>
              {sheetCollapsed ? t("analysis.show_details") : t("common.reduce")}
            </span>
            {sheetCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          <AnimatePresence initial={false}>
          {!sheetCollapsed && (
            <motion.div
              key="sheet-body"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <div className="serif" style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.35, color: "var(--fg-strong)", flex: 1 }}>
                    {betQ(bet)}
                  </div>
                  {isBoosted(bet.period_end, bet.status) && (
                    <BoostedBadge periodEnd={bet.period_end} status={bet.status} variant="pill" />
                  )}
                </div>
                <div className="mono" style={{ fontSize: 10, color: "var(--fg-faint)", marginTop: 6, letterSpacing: 0.3 }}>
                  {t("analysis.threshold_label", { value: bet.threshold_value, unit: bet.threshold_unit, drop: bet.ndvi_drop_threshold })}
                </div>
              </div>

              {/* Price history chart with multi-timeframe */}
              <PriceHistoryChart bet={bet} height={160} />

              {/* Orderbook-style depth chart */}
              <div style={{ marginTop: 14 }}>
                <DepthChart stats={marketStats} />
              </div>

              {/* Editorial meta block (criteria + sources) */}
              <MarketMeta bet={bet} />

              {resolved ? (
                <div style={{ padding: 14, background: bet.result_bool ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)", borderRadius: 10, marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase" }}>{t("analysis.result")}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: bet.result_bool ? "#34d399" : "#f87171" }}>
                    {bet.result_bool ? "YES" : "NO"}
                  </div>
                  <div style={{ fontSize: 13, color: "#cbd5e1", marginTop: 4 }}>
                    {t("analysis.surface")} : <strong>{Number(bet.resolved_value).toFixed(2)} km²</strong>
                  </div>
                </div>
              ) : (
                <motion.button
                  className="btn btn-primary"
                  onClick={resolve}
                  disabled={resolving}
                  whileTap={{ scale: 0.97 }}
                  whileHover={{ y: -1 }}
                  transition={{ type: "spring", stiffness: 420, damping: 28 }}
                  style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 }}
                >
                  <Play size={16} /> {resolving ? t("analysis.resolving") : t("analysis.resolve_btn")}
                </motion.button>
              )}

              <PlaceBetForm slug={slug} betStatus={bet.status} stats={marketStats} onPlaced={() => {
                API.marketStats(slug).then(r => setMarketStats(r.data)).catch(() => {});
                API.myBets(slug).then(r => setMyBets(r.data)).catch(() => {});
              }} />
              <MarketStats stats={marketStats} myBets={myBets} />
              <BetTimeline placements={placements} periodStart={bet.period_start} periodEnd={bet.period_end} />
              {result && <EvidencePanel r={result} />}

              {zones.length > 0 && (
                <button
                  onClick={() => {
                    const next = !showDetail;
                    setShowDetail(next);
                    const map = mapRef.current;
                    if (!map) return;
                    const evidenceSlugs = ["prodes-accumulated", "deter-amz", "delta-ndvi", "mask-deforestation"];
                    setLayers((prev) => {
                      const updated = prev.map((l) =>
                        evidenceSlugs.includes(l.slug)
                          ? { ...l, visible: next, opacity: next ? (l.category === "verified" ? 0.65 : 0.75) : l.opacity }
                          : l,
                      );
                      for (const l of updated) {
                        if (evidenceSlugs.includes(l.slug) && map.getLayer(l.slug)) {
                          map.setLayoutProperty(l.slug, "visibility", l.visible ? "visible" : "none");
                          const prop = map.getLayer(l.slug)?.type === "raster" ? "raster-opacity" : null;
                          if (prop) map.setPaintProperty(l.slug, prop, l.opacity);
                        }
                      }
                      return updated;
                    });
                  }}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    padding: "10px 0", marginBottom: 8, background: showDetail ? "rgba(251,191,36,0.12)" : "#0f172a",
                    border: `1px solid ${showDetail ? "#fbbf2444" : "#334155"}`, borderRadius: 10,
                    color: showDetail ? "#fbbf24" : "#94a3b8", fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  <MapPin size={14} />
                  {showDetail ? t("analysis.hide_zones") : t("analysis.show_zones", { n: zones.length })}
                </button>
              )}

              {showDetail && <EvidenceDetail zones={zones} />}
              {showDetail && <VerdictPanel bet={bet} zones={zones} placements={placements} />}
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </div>

      {showOnboarding && (
        <OnboardingOverlay onDismiss={() => {
          setShowOnboarding(false);
          localStorage.setItem("para_onboarding_done", "1");
        }} />
      )}

      <AnimatePresence>
        {showResolution && bet && (
          <ResolutionScene
            bet={bet}
            result={result}
            userPosition={userPosition}
            loading={resolving}
            onClose={() => setShowResolution(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function EvidencePanel({ r }: { r: OracleResult }) {
  const { t } = useI18n();
  function copy(v: string) { navigator.clipboard.writeText(v); }
  const rows: [string, string | undefined][] = [
    ["IPFS CID", r.evidence.ipfs_cid],
    ["Script", r.evidence.script_hash],
    ["NDVI T0", r.evidence.ndvi_t0_hash],
    ["NDVI T1", r.evidence.ndvi_t1_hash],
    ["Delta", r.evidence.delta_hash],
    ["Mask", r.evidence.mask_hash],
  ];
  const sentinelCount =
    (r.evidence.sentinel_products_t0?.length || 0) +
    (r.evidence.sentinel_products_t1?.length || 0);
  return (
    <div>
      <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", marginBottom: 6 }}>{t("analysis.evidence_title")}</div>
      {sentinelCount > 0 && (
        <div style={{ fontSize: 11, color: "#cbd5e1", marginBottom: 8 }}>
          {t("analysis.sentinel_scenes", { n: sentinelCount })}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
            <span style={{ color: "#94a3b8", width: 60 }}>{k}</span>
            <code style={{ color: "#cbd5e1", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {v || "—"}
            </code>
            {v && <button onClick={() => copy(v!)} style={{ background: "none", border: "none", color: "#94a3b8" }}><Copy size={12} /></button>}
          </div>
        ))}
      </div>
      <Web3Evidence evidence={r.evidence} />
    </div>
  );
}
