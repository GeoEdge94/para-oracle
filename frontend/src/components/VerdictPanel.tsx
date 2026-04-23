import * as Tabs from "@radix-ui/react-tabs";
import { motion, AnimatePresence } from "framer-motion";
import type { Bet, DeforestationZone, UserBet } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Props = {
  bet: Bet;
  zones: DeforestationZone[];
  placements: UserBet[];
};

const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] as const },
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
  const totalPayouts = winners.reduce((s, p) => s + Number(p.potential_payout), 0);
  const lostPool = losers.reduce((s, p) => s + Number(p.amount), 0);

  const nfmt = (v: number, digits = 1) =>
    v.toLocaleString(locale === "fr" ? "fr-FR" : "en-US", { maximumFractionDigits: digits });

  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ fontSize: 10, color: "var(--fg-subtle)", textTransform: "uppercase", marginBottom: 8, letterSpacing: 0.5 }}>
        {t("verdict.title")}
      </div>

      <Tabs.Root defaultValue="result">
        <Tabs.List className="vtabs-list" aria-label={t("verdict.title")}>
          <Tabs.Trigger value="result" className="vtabs-trigger">{t("verdict.tab_result")}</Tabs.Trigger>
          <Tabs.Trigger value="sources" className="vtabs-trigger">{t("verdict.tab_sources")}</Tabs.Trigger>
          <Tabs.Trigger value="payouts" className="vtabs-trigger">{t("verdict.tab_payouts")}</Tabs.Trigger>
        </Tabs.List>

        <AnimatePresence mode="wait">
          <Tabs.Content value="result" asChild>
            <motion.div key="result" {...fadeUp}>
              <div style={{ padding: 14, background: "rgba(15,23,42,0.8)", border: "1px solid var(--border)", borderRadius: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: exceeded ? "var(--accent)" : "var(--danger)" }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--fg)" }}>
                    {exceeded ? t("verdict.above") : t("verdict.below")}
                  </span>
                </div>

                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  <div style={{ flex: 1, padding: 10, background: "var(--surface-1)", borderRadius: 8, textAlign: "center" }}>
                    <div style={{ fontSize: 9, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: 0.6 }}>{t("verdict.detected")}</div>
                    <div className="num" style={{ fontSize: 18, fontWeight: 800, color: "var(--fg)" }}>{nfmt(totalSurface)} km²</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", color: "var(--fg-faint)", fontSize: 12 }}>vs</div>
                  <div style={{ flex: 1, padding: 10, background: "var(--surface-1)", borderRadius: 8, textAlign: "center" }}>
                    <div style={{ fontSize: 9, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: 0.6 }}>{t("betsheet.threshold")}</div>
                    <div className="num" style={{ fontSize: 18, fontWeight: 800, color: "var(--fg-muted)" }}>{nfmt(threshold, 0)} km²</div>
                  </div>
                </div>

                <div style={{
                  padding: 10, borderRadius: 8, textAlign: "center", fontSize: 12, fontWeight: 700,
                  background: exceeded ? "var(--accent-soft)" : "var(--danger-soft)",
                  color: exceeded ? "var(--success)" : "var(--danger)",
                  border: `1px solid ${exceeded ? "rgba(16,185,129,0.2)" : "rgba(248,113,113,0.2)"}`,
                }}>
                  <span className="num">{exceeded ? "+" : ""}{nfmt(delta)}</span> km² {t(exceeded ? "verdict.above_short" : "verdict.below_short")} {t("verdict.of_threshold")} → {bet.result_bool ? "YES" : "NO"}
                </div>
              </div>
            </motion.div>
          </Tabs.Content>

          <Tabs.Content value="sources" asChild>
            <motion.div key="sources" {...fadeUp}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sourceOrder.filter((s) => bySource[s]).map((s) => {
                  const d = bySource[s];
                  const pct = (d.surface / totalSurface) * 100;
                  return (
                    <div key={s} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: sourceColors[s], flexShrink: 0 }} />
                      <span style={{ color: "var(--fg-muted)", width: 90, flexShrink: 0 }}>{sourceLabels[s]}</span>
                      <div style={{ flex: 1, height: 5, background: "var(--surface-2)", borderRadius: 3, overflow: "hidden" }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                          style={{ height: "100%", background: sourceColors[s], borderRadius: 3 }}
                        />
                      </div>
                      <span className="num" style={{ color: "var(--fg)", fontWeight: 600, minWidth: 70, textAlign: "right" }}>
                        {nfmt(d.surface)} km²
                      </span>
                      <span className="num" style={{ color: "var(--fg-faint)", minWidth: 22, textAlign: "right" }}>{d.count}</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </Tabs.Content>

          <Tabs.Content value="payouts" asChild>
            <motion.div key="payouts" {...fadeUp}>
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                <div style={{ flex: 1, padding: 10, background: "var(--accent-soft)", borderRadius: 8, border: "1px solid rgba(16,185,129,0.2)" }}>
                  <div style={{ fontSize: 9, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: 0.6 }}>{t("verdict.pool_winners")}</div>
                  <div className="num" style={{ fontSize: 15, fontWeight: 800, color: "var(--success)" }}>
                    {formatAmount(totalPayouts)}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--fg-faint)" }}>{t("verdict.winners", { n: winners.length })}</div>
                </div>
                <div style={{ flex: 1, padding: 10, background: "var(--danger-soft)", borderRadius: 8, border: "1px solid rgba(248,113,113,0.2)" }}>
                  <div style={{ fontSize: 9, color: "var(--fg-faint)", textTransform: "uppercase", letterSpacing: 0.6 }}>{t("verdict.pool_losers")}</div>
                  <div className="num" style={{ fontSize: 15, fontWeight: 800, color: "var(--danger)" }}>
                    {formatAmount(lostPool)}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--fg-faint)" }}>{t("verdict.losers", { n: losers.length })}</div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {[...winners, ...losers].sort((a, b) => Number(b.potential_payout) - Number(a.potential_payout)).map((p, i) => {
                  const won = p.status === "WON";
                  return (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03, duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                      style={{
                        display: "flex", alignItems: "center", gap: 6, padding: "6px 8px",
                        background: won ? "rgba(16,185,129,0.05)" : "rgba(248,113,113,0.05)",
                        borderRadius: 6, fontSize: 11,
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: won ? "var(--accent)" : "var(--danger)", flexShrink: 0 }} />
                      <span style={{ color: "var(--fg-muted)", flex: 1 }}>{p.user_pseudo}</span>
                      <span style={{ color: won ? "var(--success)" : "var(--fg-muted)", fontWeight: 600 }}>{p.position}</span>
                      <span className="num" style={{ color: "var(--fg-faint)" }}>{formatAmount(Number(p.amount))}</span>
                      <span className="num" style={{ color: won ? "var(--accent)" : "var(--danger)", fontWeight: 700 }}>
                        {won ? `+${formatAmount(Number(p.potential_payout) - Number(p.amount))}` : `-${formatAmount(Number(p.amount))}`}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          </Tabs.Content>
        </AnimatePresence>
      </Tabs.Root>
    </div>
  );
}
