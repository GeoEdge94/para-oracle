import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Zap, TrendingUp, Satellite } from "lucide-react";
import { api, type Bet } from "@/lib/api";
import { GlobeView, type GlobeViewHandle } from "@/components/GlobeView";
import { ConstellationArcs } from "@/components/ConstellationArcs";
import { isBoosted, formatCountdown } from "@/lib/engage";
import { useVisibleInterval } from "@/lib/usePageVisibility";

type BetLite = Bet;

function centroidOf(geom: GeoJSON.Polygon | GeoJSON.MultiPolygon | null): [number, number] | null {
  if (!geom) return null;
  try {
    const ring = geom.type === "MultiPolygon" ? geom.coordinates[0][0] : geom.coordinates[0];
    let sx = 0, sy = 0, n = 0;
    for (const [x, y] of ring) { sx += x; sy += y; n++; }
    return [sy / n, sx / n]; // [lat, lng]
  } catch { return null; }
}

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
  const globeRef = useRef<GlobeViewHandle | null>(null);

  // Live-tracked screen position of the current bet point on the globe (null = behind globe)
  const [pointPos, setPointPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    api.get<BetLite[]>("/bets").then((r) => {
      setBets(r.data);
      setOpenBets(r.data.filter((b) => b.status === "OPEN"));
    }).catch(() => {});
  }, []);

  // Cycle every intervalMs (paused when tab hidden)
  useVisibleInterval(() => {
    if (openBets.length === 0) return;
    setIndex((i) => (i + 1) % openBets.length);
  }, intervalMs, openBets.length > 0);

  // Fetch stats for current bet + rotate camera to face the bet so it's visible on the front
  useEffect(() => {
    const current = openBets[index];
    if (!current) return;
    setStats(null);
    api.get<MarketStats>(`/user-bets/by-bet/${current.slug}/stats`)
      .then((r) => setStats(r.data))
      .catch(() => {});
    const c = centroidOf(current.region_geojson);
    if (c) {
      const [lat, lng] = c;
      // Gentle camera move to place the bet near-center, kept slightly off so it doesn't hide behind the popup
      globeRef.current?.pointOfView(lat + 5, lng - 20, 2.2, 1600);
    }
  }, [openBets, index]);

  const current = openBets[index];
  const catColor = current ? CAT_COLORS[current.category] ?? "#a855f7" : "#34d399";

  // Track screen position of the current bet so popup + thread follow rotation.
  // Poll at ~6 Hz (not rAF) to keep React re-renders out of framer-motion's animation budget.
  // useVisibleInterval pauses polling entirely when the tab is hidden.
  const pollPosRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (!current) { pollPosRef.current = () => {}; return; }
    const c = centroidOf(current.region_geojson);
    if (!c) { setPointPos(null); pollPosRef.current = () => {}; return; }
    const [lat, lng] = c;
    const poll = () => {
      const p = globeRef.current?.getScreenCoords(lat, lng, 0.01);
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return;
      setPointPos((prev) => {
        if (prev && Math.abs(p.x - prev.x) < 0.5 && Math.abs(p.y - prev.y) < 0.5) return prev;
        return { x: p.x, y: p.y };
      });
    };
    pollPosRef.current = poll;
    poll();
  }, [current, size]);

  useVisibleInterval(() => { pollPosRef.current(); }, 160, !!current);

  // Popup anchored slightly outward from the bet point (toward sphere edge)
  const R = size / 2;
  const popupDelta = pointPos
    ? (() => {
        const dx = pointPos.x - R;
        const dy = pointPos.y - R;
        const d = Math.max(8, Math.sqrt(dx * dx + dy * dy));
        const ux = dx / d;
        const uy = dy / d;
        const pushOut = Math.max(R * 0.35, 110); // how far the popup sits past the point
        return {
          // Thread origin (on globe surface point, relative to container center)
          cx: pointPos.x - R,
          cy: pointPos.y - R,
          // Popup center, pushed outward along the same radial direction
          px: pointPos.x - R + ux * pushOut,
          py: pointPos.y - R + uy * pushOut,
        };
      })()
    : null;

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
      {/* The globe — photo-realistic Earth (react-globe.gl w/ blue-marble texture) */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "auto" }}>
        <GlobeView ref={globeRef} bets={bets} width={size} height={size} transparent />
      </div>

      {/* Constellation arcs overlay — subtle network feel between points */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <ConstellationArcs size={size} opacity={0.45} count={14} seed={11} />
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

      {/* Thread line + popup card — anchored to the current bet's live screen position */}
      {current && popupDelta && (
          <div
            key={current.slug}
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
            {popupDelta && (<>
            {/* Thread: thin dashed line from the bet's globe point out to the popup */}
            <svg
              style={{
                position: "absolute",
                left: Math.min(popupDelta.cx, popupDelta.px) - 6,
                top: Math.min(popupDelta.cy, popupDelta.py) - 6,
                width: Math.abs(popupDelta.px - popupDelta.cx) + 12,
                height: Math.abs(popupDelta.py - popupDelta.cy) + 12,
                pointerEvents: "none",
                overflow: "visible",
              }}
            >
              <line
                x1={popupDelta.cx - Math.min(popupDelta.cx, popupDelta.px) + 6}
                y1={popupDelta.cy - Math.min(popupDelta.cy, popupDelta.py) + 6}
                x2={popupDelta.px - Math.min(popupDelta.cx, popupDelta.px) + 6}
                y2={popupDelta.py - Math.min(popupDelta.cy, popupDelta.py) + 6}
                stroke={catColor}
                strokeWidth={1}
                strokeDasharray="3 3"
                opacity={0.8}
              />
              <circle
                cx={popupDelta.cx - Math.min(popupDelta.cx, popupDelta.px) + 6}
                cy={popupDelta.cy - Math.min(popupDelta.cy, popupDelta.py) + 6}
                r={4}
                fill={catColor}
                opacity={0.9}
              >
                <animate attributeName="r" from="2" to="9" dur="1.4s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.9" to="0" dur="1.4s" repeatCount="indefinite" />
              </circle>
              <circle
                cx={popupDelta.cx - Math.min(popupDelta.cx, popupDelta.px) + 6}
                cy={popupDelta.cy - Math.min(popupDelta.cy, popupDelta.py) + 6}
                r={2.4}
                fill="#fff"
                stroke={catColor}
                strokeWidth={1}
              />
            </svg>

            {/* Popup card */}
            <div
              style={{
                position: "absolute",
                left: popupDelta.px,
                top: popupDelta.py,
                transform: "translate(-50%, -50%)",
                pointerEvents: "auto",
              }}
            >
              <div
                style={{
                  width: 260,
                  padding: "14px 16px",
                  borderRadius: "var(--radius-md)",
                  background: "rgb(6, 10, 20)",
                  border: `1px solid ${catColor}66`,
                  boxShadow: `0 16px 56px rgba(0,0,0,0.75), 0 0 34px ${catColor}40, inset 0 1px 0 rgba(255,255,255,0.05)`,
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
              </div>
            </div>
            </>)}
          </div>
        )}

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
