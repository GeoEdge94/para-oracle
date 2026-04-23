import { motion } from "framer-motion";
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
      <div style={{ fontSize: 10, color: "var(--fg-subtle)", textTransform: "uppercase", marginBottom: 6, letterSpacing: 0.5 }}>
        {t("market.title")}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 6 }}>
        <span style={{ color: "var(--fg-subtle)" }}>{t("market.bets_count", { n: stats.total_bets })}</span>
        <span className="num" style={{ color: "var(--fg)", fontWeight: 600 }}>
          {formatAmount(Number(stats.total_volume))}
        </span>
      </div>

      <div style={{ display: "flex", gap: 2, height: 6, borderRadius: 3, overflow: "hidden", marginBottom: 4, background: "var(--surface-2)" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${yesPct}%` }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{ background: "var(--accent)", borderRadius: "3px 0 0 3px" }}
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${noPct}%` }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
          style={{ background: "var(--danger)", borderRadius: "0 3px 3px 0" }}
        />
      </div>

      <div className="num" style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--fg-faint)" }}>
        <span>YES {yesPct}% · {stats.avg_odds_yes ? t("market.odds", { v: stats.avg_odds_yes }) : ""}</span>
        <span>NO {noPct.toFixed(0)}% · {stats.avg_odds_no ? t("market.odds", { v: stats.avg_odds_no }) : ""}</span>
      </div>

      {myBets && myBets.positions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          style={{ marginTop: 8, padding: 10, background: "var(--surface-1)", borderRadius: 8, border: "1px solid var(--border-muted)" }}
        >
          <div style={{ fontSize: 10, color: "var(--fg-subtle)", textTransform: "uppercase", marginBottom: 4, letterSpacing: 0.5 }}>
            {t("market.your_position")}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
            <span style={{ color: "var(--fg)" }}>
              {t("market.staked", { amount: formatAmount(Number(myBets.total_staked)) })}
            </span>
            <span className="num" style={{ color: "var(--accent)", fontWeight: 600 }}>
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
        </motion.div>
      )}
    </div>
  );
}
