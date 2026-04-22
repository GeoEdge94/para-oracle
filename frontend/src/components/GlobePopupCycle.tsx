import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Zap, TrendingUp, Satellite } from "lucide-react";
import { api } from "@/lib/api";
import { ConstellationArcs } from "@/components/ConstellationArcs";
import { GlobeHero } from "@/components/GlobeHero";
import { isBoosted, formatCountdown } from "@/lib/engage";

type BetLite = {
  slug: string;
  region_name: string;
  category: string;
  status: string;
  period_end: string;
  index_type: string;
  threshold_value: number;
  threshold_unit: string;
  region_geojson: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
};

type MarketStats = { yes_pct: number; total_volume: number; total_bets: number };

const CAT_COLORS: Record<string, string> = {
  deforestation: "#34d399",
  wildfire: "#f59e0b",
  flood: "#60a5fa",
  mining: "#a855f7",
  drought: "#f87171",
  glacier: "#67e8f9",
  urbanization: "#fb923c",
  water_quality: "#38bdf8",
};

/** Six compass positions around the globe (angles in degrees from top, clockwise). */
const POSITIONS = [
  { angle: -45, label: "top-right" },
  { angle: 35,  label: "right-down" },
  { angle: 120, label: "bottom-right" },
  { angle: 210, label: "bottom-left" },
  { angle: 300, label: "left-up" },
  { angle: -15, label: "top-near" },
];

function centroidOf(geom: GeoJSON.Polygon | GeoJSON.MultiPolygon | null): [number, number] | null {
  if (!geom) return null;
  try {
    const ring = geom.type === "MultiPolygon" ? geom.coordinates[0][0] : geom.coordinates[0];
    let sx = 0, sy = 0, n = 0;
    for (const [x, y] of ring) { sx += x; sy += y; n++; }
    return [sy / n, sx / n]; // [lat, lng]
  } catch { return null; }
}

type Props = {
  size: number;
  intervalMs?: number;
};

/**
 * 3D rotating globe + cycling live popups.
 *
 * Fetches public /bets, picks OPEN markets, rotates through them every
 * `intervalMs` showing a floating card at a compass angle around the
 * globe. A thin "thread" line visually links each popup back to the
 * globe edge so it feels like the info is emerging from the planet.
 *
 * No fake data: popup shows the real region name + threshold + live YES%
 * fetched per-market from /user-bets/by-bet/{slug}/stats.
 */
export function GlobePopupCycle({ size, intervalMs = 9000 }: Props) {
  const [bets, setBets] = useState<BetLite[]>([]);
  const [openBets, setOpenBets] = useState<BetLite[]>([]);
  const [index, setIndex] = useState(0);
  const [stats, setStats] = useState<MarketStats | null>(null);

  useEffect(() => {
    api.get<BetLite[]>("/bets").then((r) => {
      setBets(r.data);
      setOpenBets(r.data.filter((b) => b.status === "OPEN"));
    }).catch(() => {});
  }, []);

  // Cycle every intervalMs
  useEffect(() => {
    if (openBets.length === 0) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % openBets.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [openBets.length, intervalMs]);

  // Fetch stats for current bet
  useEffect(() => {
    const current = openBets[index];
    if (!current) return;
    setStats(null);
    api.get<MarketStats>(`/user-bets/by-bet/${current.slug}/stats`)
      .then((r) => setStats(r.data))
      .catch(() => {});
  }, [openBets, index]);

  // Build markers for cobe (all bets, small glow)
  const markers = bets
    .map((b) => {
      const c = centroidOf(b.region_geojson);
      if (!c) return null;
      return { location: c as [number, number], size: 0.04 };
    })
    .filter(Boolean) as { location: [number, number]; size: number }[];

  const current = openBets[index];
  const pos = POSITIONS[index % POSITIONS.length];
  const R = size / 2;
  const popupDistance = R * 0.92; // a hair inside so the thread touches edge
  const angleRad = ((pos.angle - 90) * Math.PI) / 180;
  const cx = Math.cos(angleRad) * popupDistance;
  const cy = Math.sin(angleRad) * popupDistance;

  // Popup offset further from globe so it reads well
  const popupOffset = 70;
  const px = Math.cos(angleRad) * (popupDistance + popupOffset);
  const py = Math.sin(angleRad) * (popupDistance + popupOffset);

  const catColor = current ? CAT_COLORS[current.category] ?? "#a855f7" : "#34d399";

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* The globe */}
      <GlobeHero size={size} variant="pro" markers={markers} opacity={0.95} />

      {/* Constellation arcs overlay (subtle network feel) */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <ConstellationArcs size={size} opacity={0.55} count={14} seed={11} />
      </div>

      {/* Live badge top-left of globe */}
      <div style={{
        position: "absolute",
        top: 8,
        left: 8,
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        background: "rgba(5, 8, 15, 0.72)",
        border: "1px solid var(--hairline-strong)",
        backdropFilter: "blur(8px)",
        zIndex: 3,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: 3,
          background: "var(--success)",
          animation: "tt-pulse 1.8s ease-in-out infinite",
        }} />
        <span className="mono" style={{ fontSize: 9, color: "var(--fg-muted)", letterSpacing: 1.4 }}>
          {openBets.length} LIVE MARKETS
        </span>
      </div>

      {/* Thread line + popup card (cycles with AnimatePresence) */}
      <AnimatePresence mode="wait">
        {current && (
          <motion.div
            key={current.slug}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: "absolute",
              pointerEvents: "none",
              zIndex: 4,
              left: "50%",
              top: "50%",
              width: 0,
              height: 0,
            }}
          >
            {/* Thread: thin dashed line from globe edge to popup */}
            <svg
              style={{
                position: "absolute",
                left: Math.min(cx, px) - 4,
                top: Math.min(cy, py) - 4,
                width: Math.abs(px - cx) + 8,
                height: Math.abs(py - cy) + 8,
                pointerEvents: "none",
                overflow: "visible",
              }}
            >
              <motion.line
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.35 }}
                x1={cx - Math.min(cx, px) + 4}
                y1={cy - Math.min(cy, py) + 4}
                x2={px - Math.min(cx, px) + 4}
                y2={py - Math.min(cy, py) + 4}
                stroke={catColor}
                strokeWidth={1}
                strokeDasharray="3 3"
                opacity={0.7}
              />
              <circle
                cx={cx - Math.min(cx, px) + 4}
                cy={cy - Math.min(cy, py) + 4}
                r={4}
                fill={catColor}
                opacity={0.9}
              >
                <animate attributeName="r" from="2" to="7" dur="1.4s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.9" to="0" dur="1.4s" repeatCount="indefinite" />
              </circle>
              <circle
                cx={cx - Math.min(cx, px) + 4}
                cy={cy - Math.min(cy, py) + 4}
                r={2}
                fill={catColor}
              />
            </svg>

            {/* Popup card */}
            <div
              style={{
                position: "absolute",
                left: px,
                top: py,
                transform: "translate(-50%, -50%)",
                pointerEvents: "auto",
              }}
            >
              <motion.div
                initial={{ y: 6, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -4, opacity: 0 }}
                transition={{ delay: 0.25, duration: 0.35 }}
                style={{
                  width: 260,
                  padding: "14px 16px",
                  borderRadius: "var(--radius-md)",
                  background: "rgba(10, 15, 26, 0.96)",
                  backdropFilter: "blur(12px) saturate(140%)",
                  border: `1px solid ${catColor}55`,
                  boxShadow: `0 14px 50px rgba(0,0,0,0.6), 0 0 28px ${catColor}33, inset 0 1px 0 rgba(255,255,255,0.04)`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span
                    className="mono"
                    style={{
                      fontSize: 8,
                      letterSpacing: 1.4,
                      textTransform: "uppercase",
                      fontWeight: 700,
                      padding: "3px 7px",
                      borderRadius: 4,
                      background: `${catColor}22`,
                      color: catColor,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span style={{ width: 5, height: 5, borderRadius: 3, background: catColor, boxShadow: `0 0 6px ${catColor}` }} />
                    {current.category.replace(/_/g, " ")}
                  </span>
                  {isBoosted(current.period_end, current.status) && (
                    <span
                      className="mono"
                      style={{
                        fontSize: 8,
                        letterSpacing: 1,
                        color: "#fbbf24",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 3,
                        fontWeight: 700,
                      }}
                    >
                      <Zap size={8} /> J-1
                    </span>
                  )}
                </div>

                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--fg-strong)",
                    lineHeight: 1.3,
                    marginBottom: 6,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {current.region_name}
                </div>

                <div className="mono" style={{ fontSize: 9, color: "var(--fg-muted)", letterSpacing: 0.3, marginBottom: 8 }}>
                  <Satellite size={9} style={{ marginRight: 4, verticalAlign: "middle" }} />
                  {current.index_type} · Seuil {current.threshold_value} {current.threshold_unit}
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    paddingTop: 6,
                    borderTop: "1px solid var(--hairline)",
                  }}
                >
                  <div>
                    <div className="mono" style={{ fontSize: 7, color: "var(--fg-faint)", letterSpacing: 1.2, textTransform: "uppercase" }}>Implied YES</div>
                    <div className="display num" style={{ fontSize: 18, color: catColor, letterSpacing: -0.3 }}>
                      {stats ? `${Math.round(stats.yes_pct)}%` : "…"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="mono" style={{ fontSize: 7, color: "var(--fg-faint)", letterSpacing: 1.2, textTransform: "uppercase" }}>
                      {isBoosted(current.period_end, current.status) ? "Closes" : "Volume"}
                    </div>
                    <div className="mono num" style={{ fontSize: 13, color: "var(--fg-strong)", fontWeight: 700 }}>
                      {isBoosted(current.period_end, current.status)
                        ? formatCountdown(current.period_end)
                        : stats
                          ? `${Math.round(stats.total_volume)} €`
                          : "…"}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Counter bottom */}
      <div style={{
        position: "absolute",
        bottom: -6,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        gap: 4,
        zIndex: 3,
      }}>
        {openBets.slice(0, Math.min(8, openBets.length)).map((_, i) => (
          <span
            key={i}
            style={{
              width: 18,
              height: 2,
              borderRadius: 1,
              background: i === (index % Math.min(8, openBets.length)) ? catColor : "var(--hairline-strong)",
              transition: "background 220ms var(--ease)",
            }}
          />
        ))}
      </div>

      <div style={{
        position: "absolute",
        bottom: -32,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: 5,
        fontSize: 9,
        color: "var(--fg-faint)",
        letterSpacing: 1.3,
        textTransform: "uppercase",
        fontFamily: "var(--font-mono)",
      }}>
        <TrendingUp size={10} />
        <span>Live feed · Sentinel-2 oracle</span>
      </div>
    </div>
  );
}
