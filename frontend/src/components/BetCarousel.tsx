import type { Bet } from "@/lib/api";
import { TrendingUp, Flame, Droplets, ChevronRight } from "lucide-react";

type Props = {
  bets: Bet[];
  onSelect: (bet: Bet) => void;
};

const CAT_CONFIG: Record<string, { color: string; icon: typeof TrendingUp; label: string }> = {
  deforestation: { color: "#10b981", icon: TrendingUp, label: "Deforestation" },
  wildfire: { color: "#f59e0b", icon: Flame, label: "Feux" },
  flood: { color: "#3b82f6", icon: Droplets, label: "Inondation" },
};

function yesPct(bet: Bet): number | null {
  if (bet.status === "RESOLVED_YES") return 100;
  if (bet.status === "RESOLVED_NO") return 0;
  return null;
}

export function BetCarousel({ bets, onSelect }: Props) {
  if (!bets.length) return null;

  return (
    <div className="bet-carousel">
      {bets.map((b) => {
        const cat = CAT_CONFIG[b.category] || CAT_CONFIG.deforestation;
        const Icon = cat.icon;
        const resolved = b.status.startsWith("RESOLVED");
        const pct = yesPct(b);

        return (
          <button key={b.slug} className="bet-carousel-card" onClick={() => onSelect(b)}>
            <div className="bcc-header">
              <div className="bcc-icon" style={{ background: `${cat.color}18`, color: cat.color }}>
                <Icon size={14} />
              </div>
              <ChevronRight size={12} className="bcc-arrow" />
            </div>

            <div className="bcc-region">{b.region_name}</div>

            <div className="bcc-question">
              {b.threshold_value.toLocaleString()} {b.threshold_unit} · S1 2025
            </div>

            {resolved ? (
              <div className="bcc-result">
                <span className={`bcc-outcome ${b.result_bool ? "bcc-yes" : "bcc-no"}`}>
                  {b.result_bool ? "YES" : "NO"}
                </span>
                <span className="bcc-surface">
                  {Number(b.resolved_value).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} km²
                </span>
              </div>
            ) : (
              <div className="bcc-open">
                <span className="bcc-live-dot" />
                <span>En cours</span>
              </div>
            )}

            {pct !== null && (
              <div className="bcc-bar">
                <div className="bcc-bar-fill" style={{ width: `${pct}%`, background: pct > 50 ? "#10b981" : "#f87171" }} />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
