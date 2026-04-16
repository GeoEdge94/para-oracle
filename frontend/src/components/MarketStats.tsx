import type { BetMarketStats, UserBetSummary } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Props = {
  stats: BetMarketStats | null;
  myBets: UserBetSummary | null;
};

export function MarketStats({ stats, myBets }: Props) {
  const { t, locale, formatAmount } = useI18n();
  if (!stats) return null;

  const yesPct = stats.yes_pct;
  const noPct = 100 - yesPct;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", marginBottom: 6 }}>
        {t("market.title")}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
        <span style={{ color: "#94a3b8" }}>{t("market.bets_count", { n: stats.total_bets })}</span>
        <span style={{ color: "#e2e8f0", fontWeight: 600 }}>
          {formatAmount(Number(stats.total_volume))}
        </span>
      </div>

      <div style={{ display: "flex", gap: 2, height: 6, borderRadius: 3, overflow: "hidden", marginBottom: 4 }}>
        <div style={{ width: `${yesPct}%`, background: "#10b981", borderRadius: "3px 0 0 3px" }} />
        <div style={{ width: `${noPct}%`, background: "#f87171", borderRadius: "0 3px 3px 0" }} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#64748b" }}>
        <span>YES {yesPct}% · {stats.avg_odds_yes ? t("market.odds", { v: stats.avg_odds_yes }) : ""}</span>
        <span>NO {noPct.toFixed(0)}% · {stats.avg_odds_no ? t("market.odds", { v: stats.avg_odds_no }) : ""}</span>
      </div>

      {myBets && myBets.positions.length > 0 && (
        <div style={{ marginTop: 8, padding: 8, background: "#0f172a", borderRadius: 8 }}>
          <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", marginBottom: 4 }}>
            {t("market.your_position")}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
            <span style={{ color: "#e2e8f0" }}>
              {t("market.staked", { amount: formatAmount(Number(myBets.total_staked)) })}
            </span>
            <span style={{ color: "#10b981", fontWeight: 600 }}>
              → {formatAmount(Number(myBets.potential_payout))}
            </span>
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
            {myBets.positions.map((p) => (
              <span key={p.id} className={`badge ${p.status === "WON" ? "badge-yes" : p.status === "LOST" ? "badge-no" : "badge-open"}`}>
                {p.position} · {formatAmount(Number(p.amount))}
                {p.status !== "PENDING" && ` · ${p.status}`}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
