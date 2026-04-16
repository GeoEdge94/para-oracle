import { useState } from "react";
import type { UserBet } from "@/lib/api";

type Props = {
  placements: UserBet[];
  periodStart: string;
  periodEnd: string;
};

export function BetTimeline({ placements, periodStart, periodEnd }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (!placements.length) return null;

  const start = new Date(periodStart).getTime();
  const end = new Date(periodEnd).getTime();
  const range = end - start;

  const months: string[] = [];
  const d = new Date(periodStart);
  while (d.getTime() <= end) {
    months.push(d.toLocaleDateString("fr-FR", { month: "short" }));
    d.setMonth(d.getMonth() + 1);
  }

  function dotSize(amount: number): number {
    if (amount >= 400) return 14;
    if (amount >= 200) return 10;
    return 7;
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", marginBottom: 8 }}>
        Activite du marche
      </div>

      <div style={{ position: "relative", padding: "14px 0 4px" }}>
        <div style={{ height: 2, background: "#334155", borderRadius: 1 }} />

        {placements.map((p) => {
          const t = new Date(p.placed_at).getTime();
          const pct = Math.max(0, Math.min(100, ((t - start) / range) * 100));
          const size = dotSize(Number(p.amount));
          const isYes = p.position === "YES";
          const color = p.status === "WON" ? "#10b981" : p.status === "LOST" ? "#f87171" : isYes ? "#34d399" : "#fb923c";

          return (
            <div
              key={p.id}
              onMouseEnter={() => setHoveredId(p.id)}
              onMouseLeave={() => setHoveredId(null)}
              onTouchStart={() => setHoveredId(p.id)}
              style={{
                position: "absolute",
                left: `${pct}%`,
                top: 14,
                transform: "translate(-50%, -50%)",
                width: size,
                height: size,
                borderRadius: "50%",
                background: color,
                border: `1.5px solid ${isYes ? "#065f46" : "#7f1d1d"}`,
                cursor: "pointer",
                transition: "transform 0.15s",
                zIndex: hoveredId === p.id ? 10 : 1,
              }}
            >
              {hoveredId === p.id && (
                <div style={{
                  position: "absolute",
                  bottom: "calc(100% + 6px)",
                  left: "50%",
                  transform: "translateX(-50%)",
                  background: "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: 6,
                  padding: "5px 8px",
                  fontSize: 10,
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                  zIndex: 20,
                  color: "#e2e8f0",
                }}>
                  <strong>{p.user_pseudo}</strong> · {p.position} · {Number(p.amount)} EUR
                  <br />
                  <span style={{ color: "#94a3b8" }}>
                    cote {Number(p.odds)} · {new Date(p.placed_at).toLocaleDateString("fr-FR")}
                    {p.status !== "PENDING" && (
                      <span style={{ color: p.status === "WON" ? "#10b981" : "#f87171", fontWeight: 600 }}>
                        {" "}· {p.status}
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#64748b", marginTop: 2 }}>
        {months.map((m, i) => <span key={i}>{m}</span>)}
      </div>
    </div>
  );
}
