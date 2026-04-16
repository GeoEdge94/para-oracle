import type { Bet } from "@/lib/api";
import { TrendingUp, Flame, Droplets, Mountain, Thermometer, Snowflake, Building, Fish } from "lucide-react";

type Props = {
  bets: Bet[];
  active: string | null;
  onSelect: (cat: string | null) => void;
};

const CAT_META: Record<string, { color: string; icon: typeof TrendingUp; label: string }> = {
  deforestation: { color: "#10b981", icon: TrendingUp, label: "Deforestation" },
  wildfire: { color: "#f59e0b", icon: Flame, label: "Feux" },
  flood: { color: "#3b82f6", icon: Droplets, label: "Inondation" },
  mining: { color: "#a855f7", icon: Mountain, label: "Mines" },
  drought: { color: "#ef4444", icon: Thermometer, label: "Secheresse" },
  glacier: { color: "#06b6d4", icon: Snowflake, label: "Glacier" },
  urbanization: { color: "#f97316", icon: Building, label: "Urbanisation" },
  water_quality: { color: "#0ea5e9", icon: Fish, label: "Qualite eau" },
};

export function CategoryFilter({ bets, active, onSelect }: Props) {
  const counts: Record<string, number> = {};
  for (const b of bets) counts[b.category] = (counts[b.category] || 0) + 1;

  const cats = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

  return (
    <div className="cat-filter">
      <button
        className={`cat-chip ${active === null ? "active" : ""}`}
        onClick={() => onSelect(null)}
      >
        <span className="cat-chip-dot" style={{ background: "#94a3b8" }} />
        <span>Tous</span>
        <span className="cat-chip-count">{bets.length}</span>
      </button>
      {cats.map((c) => {
        const meta = CAT_META[c] || { color: "#8b5cf6", icon: TrendingUp, label: c };
        const Icon = meta.icon;
        const isActive = active === c;
        return (
          <button
            key={c}
            className={`cat-chip ${isActive ? "active" : ""}`}
            onClick={() => onSelect(isActive ? null : c)}
            style={isActive ? { borderColor: meta.color, background: `${meta.color}15` } : {}}
          >
            <Icon size={11} style={{ color: meta.color }} />
            <span>{meta.label}</span>
            <span className="cat-chip-count">{counts[c]}</span>
          </button>
        );
      })}
    </div>
  );
}
