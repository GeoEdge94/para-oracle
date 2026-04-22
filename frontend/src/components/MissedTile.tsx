import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ChevronRight, History } from "lucide-react";
import type { Bet } from "@/lib/api";
import { missedOpportunities } from "@/lib/engage";
import { BentoTile } from "@/components/BentoGrid";
import { useI18n } from "@/lib/i18n";

type Props = {
  bets: Bet[];
  userBetSlugs: Set<string>;
};

/**
 * Subtle regret framing: shows recently resolved markets the user did
 * NOT predict, with the hypothetical PnL they would have earned. No
 * guilt, no red flashing — editorial, "learning" tone. Click routes
 * to the detailed analysis so the user can see why.
 */
export function MissedTile({ bets, userBetSlugs }: Props) {
  const navigate = useNavigate();
  const { t, formatAmount } = useI18n();

  const missed = missedOpportunities(bets as any, userBetSlugs).slice(0, 3);
  if (missed.length === 0) return null;

  return (
    <BentoTile span={2} delay={0.45}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div className="bento-label">Opportunités manquées</div>
        <History size={13} color="var(--fg-faint)" />
      </div>
      <div className="serif" style={{ fontSize: 12, fontStyle: "italic", color: "var(--fg-muted)", marginTop: 2, marginBottom: 10, lineHeight: 1.4 }}>
        3 marchés résolus que tu n'as pas prédit — l'oracle a tranché.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {missed.map((m, i) => (
          <motion.button
            key={m.slug}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + i * 0.05 }}
            onClick={() => navigate(`/analysis/${m.slug}`)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 10px",
              background: "var(--surface-1)",
              border: "1px solid var(--border-muted)",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <span
              className="mono"
              style={{
                padding: "2px 6px",
                fontSize: 9,
                fontWeight: 700,
                borderRadius: 3,
                background: m.outcome === "YES" ? "rgba(52,211,153,0.14)" : "rgba(248,113,113,0.14)",
                color: m.outcome === "YES" ? "var(--success)" : "var(--danger)",
              }}
            >
              {m.outcome}
            </span>
            <span style={{ flex: 1, fontSize: 12, color: "var(--fg-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {m.regionName}
            </span>
            <span className="mono num" style={{ fontSize: 11, color: "var(--fg-muted)", opacity: 0.85 }}>
              {formatAmount(m.hypotheticalPnL)}
            </span>
            <ChevronRight size={12} color="var(--fg-faint)" />
          </motion.button>
        ))}
      </div>
      <div className="mono" style={{ fontSize: 9, color: "var(--fg-faint)", marginTop: 8, letterSpacing: 0.3, textAlign: "right" }}>
        Simulation&nbsp;: 100 € @ 1.9× hypothétique
      </div>
    </BentoTile>
  );
}
