import { useState, useRef, useEffect } from "react";
import type { Bet } from "@/lib/api";
import { TrendingUp, Flame, Droplets, Mountain, Thermometer, Snowflake, Building, Fish, ChevronRight, X } from "lucide-react";

type Props = {
  bets: Bet[];
  onSelect: (bet: Bet) => void;
  onClose: () => void;
};

const CAT_META: Record<string, { color: string; icon: typeof TrendingUp; label: string }> = {
  deforestation: { color: "#10b981", icon: TrendingUp, label: "Deforestation" },
  wildfire: { color: "#f59e0b", icon: Flame, label: "Wildfire" },
  flood: { color: "#3b82f6", icon: Droplets, label: "Flood" },
  mining: { color: "#a855f7", icon: Mountain, label: "Mining" },
  drought: { color: "#ef4444", icon: Thermometer, label: "Drought" },
  glacier: { color: "#06b6d4", icon: Snowflake, label: "Glacier" },
  urbanization: { color: "#f97316", icon: Building, label: "Urban" },
  water_quality: { color: "#0ea5e9", icon: Fish, label: "Water" },
};

function statusLabel(s: string) {
  if (s === "RESOLVED_YES") return { text: "YES", color: "#34d399", bg: "rgba(52,211,153,0.15)" };
  if (s === "RESOLVED_NO") return { text: "NO", color: "#f87171", bg: "rgba(248,113,113,0.15)" };
  return { text: "LIVE", color: "#10b981", bg: "rgba(16,185,129,0.12)" };
}

export function BetBottomSheet({ bets, onSelect, onClose }: Props) {
  const [idx, setIdx] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; time: number } | null>(null);

  const canPrev = idx > 0;
  const canNext = idx < bets.length - 1;

  useEffect(() => {
    if (trackRef.current) {
      trackRef.current.style.transform = `translateX(-${idx * 100}%)`;
    }
  }, [idx]);

  function handleTouchStart(e: React.TouchEvent) {
    touchStart.current = { x: e.touches[0].clientX, time: Date.now() };
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dt = Date.now() - touchStart.current.time;
    const velocity = Math.abs(dx) / dt;
    if (Math.abs(dx) > 50 || velocity > 0.5) {
      if (dx < 0 && canNext) setIdx(idx + 1);
      else if (dx > 0 && canPrev) setIdx(idx - 1);
    }
    touchStart.current = null;
  }

  if (!bets.length) return null;

  return (
    <div className="bbs-wrap">
      <div className="bbs-backdrop" onClick={onClose} />
      <div className="bbs-sheet">
        <div className="bbs-header">
          <div className="bbs-title">
            <span style={{ color: "#64748b", fontSize: 10, letterSpacing: 1 }}>MARKETS</span>
            <span className="bbs-count">{idx + 1} / {bets.length}</span>
          </div>
          <button className="bbs-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div
          className="bbs-viewport"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="bbs-track" ref={trackRef}>
            {bets.map((b) => {
              const meta = CAT_META[b.category] || { color: "#8b5cf6", icon: TrendingUp, label: b.category };
              const Icon = meta.icon;
              const st = statusLabel(b.status);
              const resolved = b.status.startsWith("RESOLVED");

              return (
                <div key={b.slug} className="bbs-slide">
                  <div className="bbs-card" onClick={() => onSelect(b)}>
                    <div className="bbs-card-top">
                      <div className="bbs-cat-badge" style={{ background: `${meta.color}18`, color: meta.color }}>
                        <Icon size={14} />
                        <span>{meta.label}</span>
                      </div>
                      <span className="bbs-status" style={{ background: st.bg, color: st.color }}>
                        {!resolved && <span className="bbs-live-dot" />}
                        {st.text}
                      </span>
                    </div>

                    <div className="bbs-region">{b.region_name}</div>

                    <div className="bbs-question">{b.question}</div>

                    <div className="bbs-metrics">
                      <div className="bbs-metric">
                        <div className="bbs-metric-label">Seuil</div>
                        <div className="bbs-metric-value">
                          {b.threshold_value} <span style={{ fontSize: 10, color: "#64748b" }}>{b.threshold_unit}</span>
                        </div>
                      </div>
                      <div className="bbs-metric">
                        <div className="bbs-metric-label">Indice</div>
                        <div className="bbs-metric-value" style={{ fontFamily: "monospace" }}>{b.index_type}</div>
                      </div>
                      <div className="bbs-metric">
                        <div className="bbs-metric-label">Source</div>
                        <div className="bbs-metric-value" style={{ fontSize: 11 }}>{b.ground_truth_source}</div>
                      </div>
                    </div>

                    {resolved && b.resolved_value !== null && (
                      <div className="bbs-result" style={{ background: st.bg }}>
                        <span style={{ fontSize: 9, color: "#94a3b8", textTransform: "uppercase" }}>Surface mesuree</span>
                        <span style={{ fontSize: 16, fontWeight: 700, color: st.color }}>
                          {Number(b.resolved_value).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} {b.threshold_unit}
                        </span>
                      </div>
                    )}

                    <button className="bbs-cta" style={{ borderColor: `${meta.color}55`, color: meta.color }}>
                      Voir sur la carte <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bbs-dots">
          {bets.map((_, i) => (
            <button
              key={i}
              className={`bbs-dot ${i === idx ? "active" : ""}`}
              onClick={() => setIdx(i)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
