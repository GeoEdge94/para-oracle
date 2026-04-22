import type { Bet } from "@/lib/api";
import { TrendingUp, Flame, Droplets, Mountain, Thermometer, Snowflake, Building, Fish, Zap } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { isBoosted } from "@/lib/engage";

type Props = {
  bets: Bet[];
  active: string | null;
  onSelect: (cat: string | null) => void;
};

const BOOST_FILTER = "__boosted__";

const CAT_META: Record<string, { color: string; icon: typeof TrendingUp; i18nKey: string }> = {
  deforestation: { color: "#10b981", icon: TrendingUp, i18nKey: "categories.deforestation" },
  wildfire: { color: "#f59e0b", icon: Flame, i18nKey: "categories.wildfire" },
  flood: { color: "#3b82f6", icon: Droplets, i18nKey: "categories.flood" },
  mining: { color: "#a855f7", icon: Mountain, i18nKey: "categories.mining" },
  drought: { color: "#ef4444", icon: Thermometer, i18nKey: "categories.drought" },
  glacier: { color: "#06b6d4", icon: Snowflake, i18nKey: "categories.deforestation" },
  urbanization: { color: "#f97316", icon: Building, i18nKey: "categories.urban" },
  water_quality: { color: "#0ea5e9", icon: Fish, i18nKey: "categories.water_quality" },
};

export function CategoryFilter({ bets, active, onSelect }: Props) {
  const { t } = useI18n();
  const counts: Record<string, number> = {};
  for (const b of bets) counts[b.category] = (counts[b.category] || 0) + 1;

  const boostedCount = bets.filter((b) => isBoosted(b.period_end, b.status)).length;
  const cats = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

  return (
    <div className="cat-filter-wrap">
      <div className="cat-filter">
        <button
          className={`cat-chip ${active === null ? "active" : ""}`}
          onClick={() => onSelect(null)}
        >
          <span className="cat-chip-dot" style={{ background: "var(--fg-subtle)" }} />
          <span>{t("categories.all")}</span>
          <span className="cat-chip-count">{bets.length}</span>
        </button>
        {boostedCount > 0 && (
          <button
            className={`cat-chip ${active === BOOST_FILTER ? "active" : ""}`}
            onClick={() => onSelect(active === BOOST_FILTER ? null : BOOST_FILTER)}
            style={active === BOOST_FILTER
              ? { borderColor: "#fbbf24", background: "rgba(251,191,36,0.14)", color: "#fbbf24" }
              : { borderColor: "rgba(251,191,36,0.35)", color: "#fbbf24" }}
          >
            <Zap size={10} />
            <span>J-1</span>
            <span className="cat-chip-count" style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24" }}>{boostedCount}</span>
          </button>
        )}
        {cats.map((c) => {
          const meta = CAT_META[c] || { color: "#8b5cf6", icon: TrendingUp, i18nKey: "" };
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
              <span>{meta.i18nKey ? t(meta.i18nKey) : c}</span>
              <span className="cat-chip-count">{counts[c]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
