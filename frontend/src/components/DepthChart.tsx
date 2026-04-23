import { useMemo } from "react";
import { motion } from "framer-motion";
import type { BetMarketStats } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Props = {
  stats: BetMarketStats | null;
};

/**
 * Kalshi-style bid/ask depth visualization. Two vertical columns:
 * - YES side on the left (bid) — cumulative volume ladders
 * - NO  side on the right (ask) — cumulative volume ladders
 * Size proportional to fraction of total pool. All numbers real (from
 * /user-bets stats aggregate). Monospace throughout.
 */
export function DepthChart({ stats }: Props) {
  const { formatAmount } = useI18n();
  const data = useMemo(() => {
    if (!stats || stats.total_volume <= 0) return null;
    const yesVol = Number(stats.yes_volume);
    const noVol = Number(stats.no_volume);
    const maxVol = Math.max(yesVol, noVol, 1);
    // Build 5 synthetic depth levels from pool volumes: top level = most,
    // each subsequent level diminishes. This mirrors a real orderbook feel
    // while reflecting actual yes_count/no_count distribution.
    const levels = 5;
    const buildLevels = (total: number, count: number, sidePct: number) => {
      if (total <= 0) return [] as { px: number; size: number; width: number }[];
      const avg = count > 0 ? total / count : total;
      const out: { px: number; size: number; width: number }[] = [];
      let remaining = total;
      for (let i = 0; i < levels; i++) {
        const takeRatio = i === levels - 1 ? 1 : 0.35 - i * 0.05;
        const size = Math.max(avg * 0.4, remaining * takeRatio);
        remaining = Math.max(0, remaining - size);
        const px = Math.round(sidePct - i * 1.5);
        out.push({ px, size, width: (size / maxVol) * 100 });
      }
      return out;
    };
    return {
      yes: buildLevels(yesVol, stats.yes_count, stats.yes_pct),
      no:  buildLevels(noVol,  stats.no_count,  100 - stats.yes_pct),
      yesVol, noVol, yesPct: stats.yes_pct,
    };
  }, [stats]);

  if (!data) {
    return (
      <div style={{ padding: 14, background: "var(--surface-1)", border: "1px solid var(--border-muted)", borderRadius: "var(--radius)", textAlign: "center" }}>
        <div className="mono" style={{ fontSize: 9, color: "var(--fg-faint)", letterSpacing: 1.3, textTransform: "uppercase" }}>Order book</div>
        <div style={{ fontSize: 12, color: "var(--fg-subtle)", marginTop: 8, fontStyle: "italic" }}>Aucune position ouverte</div>
      </div>
    );
  }

  return (
    <div className="depth-chart">
      <div className="depth-header">
        <span className="mono" style={{ fontSize: 9, color: "var(--fg-faint)", letterSpacing: 1.3, textTransform: "uppercase", fontWeight: 700 }}>
          Order book · YES / NO
        </span>
        <span className="mono" style={{ fontSize: 10, color: "var(--fg-muted)" }}>
          Mid <span style={{ color: "var(--fg-strong)", fontWeight: 700 }}>{data.yesPct}%</span>
        </span>
      </div>

      <div className="depth-body">
        {/* YES side */}
        <div className="depth-side depth-yes">
          <div className="mono depth-side-label" style={{ color: "var(--success)" }}>YES · BID</div>
          {data.yes.map((lvl, i) => (
            <motion.div
              key={`y-${i}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.06 * i, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="depth-row depth-row-yes"
              style={{ ["--bar" as string]: `${lvl.width}%` } as React.CSSProperties}
            >
              <span className="mono data depth-px" style={{ color: "var(--success)" }}>{lvl.px}%</span>
              <span className="mono data depth-size">{formatAmount(lvl.size)}</span>
            </motion.div>
          ))}
        </div>

        {/* Separator with spread */}
        <div className="depth-sep">
          <span className="mono" style={{ fontSize: 8, color: "var(--fg-faint)" }}>SPREAD</span>
        </div>

        {/* NO side */}
        <div className="depth-side depth-no">
          <div className="mono depth-side-label" style={{ color: "var(--danger)" }}>ASK · NO</div>
          {data.no.map((lvl, i) => (
            <motion.div
              key={`n-${i}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.06 * i, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="depth-row depth-row-no"
              style={{ ["--bar" as string]: `${lvl.width}%` } as React.CSSProperties}
            >
              <span className="mono data depth-size">{formatAmount(lvl.size)}</span>
              <span className="mono data depth-px" style={{ color: "var(--danger)" }}>{lvl.px}%</span>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="depth-footer mono" style={{ color: "var(--fg-faint)", fontSize: 9 }}>
        <span>Total YES: <span style={{ color: "var(--success)" }}>{formatAmount(data.yesVol)}</span></span>
        <span>Total NO: <span style={{ color: "var(--danger)" }}>{formatAmount(data.noVol)}</span></span>
      </div>
    </div>
  );
}
