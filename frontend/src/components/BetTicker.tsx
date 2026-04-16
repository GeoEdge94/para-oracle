import type { Bet } from "@/lib/api";

type Props = { bets: Bet[] };

const CAT_DOTS: Record<string, string> = {
  deforestation: "#10b981", wildfire: "#f59e0b", flood: "#3b82f6",
  mining: "#a855f7", drought: "#ef4444", glacier: "#06b6d4",
  urbanization: "#f97316", water_quality: "#0ea5e9",
};

export function BetTicker({ bets }: Props) {
  if (!bets.length) return null;

  const items = [...bets, ...bets];

  return (
    <div className="ticker-wrap">
      <div className="ticker-track">
        {items.map((b, i) => {
          const color = CAT_DOTS[b.category] || "#8b5cf6";
          const resolved = b.status.startsWith("RESOLVED");
          return (
            <span key={`${b.slug}-${i}`} className="ticker-item">
              <span className="ticker-dot" style={{ background: color }} />
              <span className="ticker-name">{b.region_name}</span>
              <span className="ticker-sep">·</span>
              {resolved ? (
                <span style={{ color: b.result_bool ? "#34d399" : "#f87171", fontWeight: 700 }}>
                  {b.result_bool ? "YES" : "NO"}
                </span>
              ) : (
                <span style={{ color: "#10b981" }}>LIVE</span>
              )}
              <span className="ticker-sep">·</span>
              <span className="ticker-val">{b.index_type}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
