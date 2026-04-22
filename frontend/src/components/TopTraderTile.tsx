import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Crown, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import { Avatar } from "@/components/Avatar";
import { NumberTicker } from "@/components/NumberTicker";
import { useI18n } from "@/lib/i18n";

type Entry = { pseudo: string; balance: number; total_won: number; total_lost: number };

/**
 * Top trader spotlight — fetches leaderboard and highlights #1 with
 * avatar, PnL, accuracy (computed). Pure social proof, honest data.
 */
export function TopTraderTile({ onClick }: { onClick?: () => void }) {
  const { t, formatAmount } = useI18n();
  const [top, setTop] = useState<Entry | null>(null);

  useEffect(() => {
    api
      .get<Entry[]>("/auth/leaderboard")
      .then((r) => {
        const entries = r.data;
        if (entries.length > 0) setTop(entries[0]);
      })
      .catch(() => {});
  }, []);

  if (!top) return null;
  const pnl = top.total_won - top.total_lost;
  const totalStake = top.total_won + top.total_lost;
  const accuracy = totalStake > 0 ? Math.round((top.total_won / totalStake) * 100) : 0;

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      className="bento-tile span-2"
      data-variant="warn"
      style={{ cursor: onClick ? "pointer" : "default", textAlign: "left", background: "linear-gradient(145deg, rgba(251,191,36,0.12) 0%, rgba(168,85,247,0.06) 100%)", border: "1px solid rgba(251,191,36,0.28)" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <div className="bento-label" style={{ color: "#fbbf24" }}>Top trader · semaine</div>
        <Crown size={13} color="#fbbf24" />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
        <Avatar seed={top.pseudo} size={46} radius={10} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="display" style={{ fontSize: 18, color: "var(--fg-strong)", letterSpacing: -0.3 }}>
            {top.pseudo}
          </div>
          <div className="mono" style={{ fontSize: 10, color: "var(--fg-faint)", marginTop: 2, letterSpacing: 0.3 }}>
            Solde: <span className="num" style={{ color: "var(--fg-muted)" }}>{formatAmount(top.balance)}</span>
          </div>
        </div>
        {onClick && <ChevronRight size={14} color="var(--fg-faint)" />}
      </div>

      <div style={{ display: "flex", gap: 14, borderTop: "1px solid rgba(251,191,36,0.15)", paddingTop: 10 }}>
        <div style={{ flex: 1 }}>
          <div className="mono" style={{ fontSize: 8, color: "var(--fg-faint)", letterSpacing: 1, textTransform: "uppercase" }}>PnL</div>
          <div className="num" style={{ fontSize: 16, fontWeight: 800, color: pnl >= 0 ? "var(--success)" : "var(--danger)", fontFamily: "var(--font-mono)" }}>
            {pnl >= 0 ? "+" : ""}
            <NumberTicker value={pnl} decimals={0} />
            <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 2 }}>€</span>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div className="mono" style={{ fontSize: 8, color: "var(--fg-faint)", letterSpacing: 1, textTransform: "uppercase" }}>Précision</div>
          <div className="num" style={{ fontSize: 16, fontWeight: 800, color: "var(--fg-strong)", fontFamily: "var(--font-mono)" }}>
            <NumberTicker value={accuracy} />
            <span style={{ fontSize: 11, opacity: 0.7 }}>%</span>
          </div>
        </div>
      </div>
    </motion.button>
  );
}
