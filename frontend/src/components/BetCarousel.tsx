import type { Bet } from "@/lib/api";
import { TrendingUp, Flame, Droplets, Mountain, Thermometer, Snowflake, Building, Fish, ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";

type Props = {
  bets: Bet[];
  onSelect: (bet: Bet) => void;
};

const CAT_CONFIG: Record<string, { color: string; icon: typeof TrendingUp; i18nKey: string }> = {
  deforestation: { color: "#10b981", icon: TrendingUp, i18nKey: "categories.deforestation" },
  wildfire: { color: "#f59e0b", icon: Flame, i18nKey: "categories.wildfire" },
  flood: { color: "#3b82f6", icon: Droplets, i18nKey: "categories.flood" },
  mining: { color: "#a855f7", icon: Mountain, i18nKey: "categories.mining" },
  drought: { color: "#ef4444", icon: Thermometer, i18nKey: "categories.drought" },
  glacier: { color: "#06b6d4", icon: Snowflake, i18nKey: "categories.deforestation" },
  urbanization: { color: "#f97316", icon: Building, i18nKey: "categories.urban" },
  water_quality: { color: "#0ea5e9", icon: Fish, i18nKey: "categories.water_quality" },
};

function yesPct(bet: Bet): number | null {
  if (bet.status === "RESOLVED_YES") return 100;
  if (bet.status === "RESOLVED_NO") return 0;
  return null;
}

export function BetCarousel({ bets, onSelect }: Props) {
  const { t, locale } = useI18n();
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
                  {Number(b.resolved_value).toLocaleString(locale === "fr" ? "fr-FR" : "en-US", { maximumFractionDigits: 0 })} km²
                </span>
              </div>
            ) : (
              <div className="bcc-open">
                <span className="bcc-live-dot" />
                <span>{t("categories.in_progress")}</span>
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
