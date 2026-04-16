import type { BetMarketStats, UserBetSummary } from "@/lib/api";

type Props = {
  stats: BetMarketStats | null;
  myBets: UserBetSummary | null;
};

export function MarketStats({ stats, myBets }: Props) {
  if (!stats) return null;

  const yesPct = stats.yes_pct;
  const noPct = 100 - yesPct;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", marginBottom: 6 }}>
        Marche
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
        <span style={{ color: "#94a3b8" }}>{stats.total_bets} paris</span>
        <span style={{ color: "#e2e8f0", fontWeight: 600 }}>
          {Number(stats.total_volume).toLocaleString("fr-FR")} EUR
        </span>
      </div>

      <div style={{ display: "flex", gap: 2, height: 6, borderRadius: 3, overflow: "hidden", marginBottom: 4 }}>
        <div style={{ width: `${yesPct}%`, background: "#10b981", borderRadius: "3px 0 0 3px" }} />
        <div style={{ width: `${noPct}%`, background: "#f87171", borderRadius: "0 3px 3px 0" }} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#64748b" }}>
        <span>YES {yesPct}% · {stats.avg_odds_yes ? `cote ${stats.avg_odds_yes}` : ""}</span>
        <span>NO {noPct.toFixed(0)}% · {stats.avg_odds_no ? `cote ${stats.avg_odds_no}` : ""}</span>
      </div>

      {myBets && myBets.positions.length > 0 && (
        <div style={{ marginTop: 8, padding: 8, background: "#0f172a", borderRadius: 8 }}>
          <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", marginBottom: 4 }}>
            Votre position
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
            <span style={{ color: "#e2e8f0" }}>
              {Number(myBets.total_staked).toLocaleString("fr-FR")} EUR mise
            </span>
            <span style={{ color: "#10b981", fontWeight: 600 }}>
              → {Number(myBets.potential_payout).toLocaleString("fr-FR")} EUR
            </span>
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
            {myBets.positions.map((p) => (
              <span key={p.id} className={`badge ${p.status === "WON" ? "badge-yes" : p.status === "LOST" ? "badge-no" : "badge-open"}`}>
                {p.position} · {Number(p.amount)} EUR
                {p.status !== "PENDING" && ` · ${p.status}`}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
