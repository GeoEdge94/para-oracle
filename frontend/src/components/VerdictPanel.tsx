import type { Bet, DeforestationZone, UserBet } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Props = {
  bet: Bet;
  zones: DeforestationZone[];
  placements: UserBet[];
};

export function VerdictPanel({ bet, zones, placements }: Props) {
  const { t, locale, formatAmount } = useI18n();
  if (!zones.length || !bet.status.startsWith("RESOLVED")) return null;

  const totalSurface = zones.reduce((s, z) => s + Number(z.surface_km2), 0);
  const threshold = Number(bet.threshold_value);
  const exceeded = totalSurface > threshold;
  const delta = totalSurface - threshold;

  const bySource: Record<string, { count: number; surface: number }> = {};
  for (const z of zones) {
    const s = bySource[z.source] || { count: 0, surface: 0 };
    s.count++;
    s.surface += Number(z.surface_km2);
    bySource[z.source] = s;
  }
  const sourceOrder = ["PRODES", "DETER", "NDVI"];
  const sourceColors: Record<string, string> = { PRODES: "#fbbf24", DETER: "#fb923c", NDVI: "#10b981" };
  const sourceLabels: Record<string, string> = { PRODES: "PRODES (INPE)", DETER: "DETER (INPE)", NDVI: "Pipeline NDVI" };

  const winners = placements.filter((p) => p.status === "WON");
  const losers = placements.filter((p) => p.status === "LOST");
  const totalPool = placements.reduce((s, p) => s + Number(p.amount), 0);
  const totalPayouts = winners.reduce((s, p) => s + Number(p.potential_payout), 0);
  const lostPool = losers.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", marginBottom: 8 }}>
        {t("verdict.title")}
      </div>

      <div style={{ padding: 14, background: "rgba(15,23,42,0.8)", border: "1px solid #334155", borderRadius: 10, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: exceeded ? "#10b981" : "#f87171" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>
            {exceeded ? t("verdict.above") : t("verdict.below")}
          </span>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          <div style={{ flex: 1, padding: 8, background: "#0f172a", borderRadius: 8, textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "#64748b", textTransform: "uppercase" }}>{t("verdict.detected")}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#e2e8f0" }}>{totalSurface.toLocaleString(locale === "fr" ? "fr-FR" : "en-US", { maximumFractionDigits: 1 })} km²</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", color: "#64748b", fontSize: 14 }}>vs</div>
          <div style={{ flex: 1, padding: 8, background: "#0f172a", borderRadius: 8, textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "#64748b", textTransform: "uppercase" }}>{t("betsheet.threshold")}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#94a3b8" }}>{threshold.toLocaleString(locale === "fr" ? "fr-FR" : "en-US")} km²</div>
          </div>
        </div>

        <div style={{
          padding: 8, borderRadius: 8, textAlign: "center", fontSize: 12, fontWeight: 700,
          background: exceeded ? "rgba(16,185,129,0.12)" : "rgba(248,113,113,0.12)",
          color: exceeded ? "#34d399" : "#f87171",
          border: `1px solid ${exceeded ? "#10b98133" : "#f8717133"}`,
        }}>
          {exceeded ? "+" : ""}{delta.toLocaleString(locale === "fr" ? "fr-FR" : "en-US", { maximumFractionDigits: 1 })} km² {t(exceeded ? "verdict.above_short" : "verdict.below_short")} {t("verdict.of_threshold")} → {bet.result_bool ? "YES" : "NO"}
        </div>
      </div>

      <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", marginBottom: 6 }}>
        {t("verdict.geo_sources")}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
        {sourceOrder.filter((s) => bySource[s]).map((s) => {
          const d = bySource[s];
          const pct = (d.surface / totalSurface) * 100;
          return (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: sourceColors[s], flexShrink: 0 }} />
              <span style={{ color: "#94a3b8", width: 90, flexShrink: 0 }}>{sourceLabels[s]}</span>
              <div style={{ flex: 1, height: 4, background: "#1e293b", borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: sourceColors[s], borderRadius: 2 }} />
              </div>
              <span style={{ color: "#e2e8f0", fontWeight: 600, minWidth: 65, textAlign: "right" }}>
                {d.surface.toLocaleString(locale === "fr" ? "fr-FR" : "en-US", { maximumFractionDigits: 1 })} km²
              </span>
              <span style={{ color: "#64748b", minWidth: 20, textAlign: "right" }}>{d.count}</span>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", marginBottom: 6 }}>
        {t("verdict.payout_split")}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <div style={{ flex: 1, padding: 8, background: "rgba(16,185,129,0.08)", borderRadius: 8, border: "1px solid #10b98122" }}>
          <div style={{ fontSize: 9, color: "#64748b", textTransform: "uppercase" }}>{t("verdict.pool_winners")}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#34d399" }}>
            {formatAmount(totalPayouts)}
          </div>
          <div style={{ fontSize: 10, color: "#64748b" }}>{t("verdict.winners", { n: winners.length })}</div>
        </div>
        <div style={{ flex: 1, padding: 8, background: "rgba(248,113,113,0.08)", borderRadius: 8, border: "1px solid #f8717122" }}>
          <div style={{ fontSize: 9, color: "#64748b", textTransform: "uppercase" }}>{t("verdict.pool_losers")}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#f87171" }}>
            {formatAmount(lostPool)}
          </div>
          <div style={{ fontSize: 10, color: "#64748b" }}>{t("verdict.losers", { n: losers.length })}</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {[...winners, ...losers].sort((a, b) => Number(b.potential_payout) - Number(a.potential_payout)).map((p) => {
          const won = p.status === "WON";
          return (
            <div key={p.id} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "5px 8px",
              background: won ? "rgba(16,185,129,0.05)" : "rgba(248,113,113,0.05)",
              borderRadius: 6, fontSize: 11,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: won ? "#10b981" : "#f87171", flexShrink: 0 }} />
              <span style={{ color: "#94a3b8", flex: 1 }}>{p.user_pseudo}</span>
              <span style={{ color: won ? "#34d399" : "#94a3b8", fontWeight: 600 }}>{p.position}</span>
              <span style={{ color: "#64748b" }}>{formatAmount(Number(p.amount))}</span>
              <span style={{ color: won ? "#10b981" : "#f87171", fontWeight: 700 }}>
                {won ? `+${formatAmount(Number(p.potential_payout) - Number(p.amount))}` : `-${formatAmount(Number(p.amount))}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
