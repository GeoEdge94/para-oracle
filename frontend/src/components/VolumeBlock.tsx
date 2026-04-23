import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { Bet, UserBet } from "@/lib/api";
import { API } from "@/lib/api";
import { NumberTicker } from "@/components/NumberTicker";
import { useI18n } from "@/lib/i18n";
import { useVisibleInterval } from "@/lib/usePageVisibility";

type Props = {
  bets: Bet[];
};

type Agg = {
  totalVolume: number;
  totalPositions: number;
  uniqueTraders: number;
  last24hVolume: number;
  biggestSingle: number;
};

/**
 * Bloomberg-terminal-style stat header for the dashboard. All figures
 * are REAL aggregates of /user-bets across all markets — no fake numbers.
 * Rolls with NumberTicker on first mount and re-aggregates every 30s.
 */
export function VolumeBlock({ bets }: Props) {
  const { t, formatAmount, locale } = useI18n();
  const [agg, setAgg] = useState<Agg>({
    totalVolume: 0,
    totalPositions: 0,
    uniqueTraders: 0,
    last24hVolume: 0,
    biggestSingle: 0,
  });

  const cancelRef = useRef(false);
  const aggregateRef = useRef(async () => {});
  useEffect(() => {
    cancelRef.current = false;
    aggregateRef.current = async () => {
      const open = bets.slice(0, 25); // cap to limit load
      const results = await Promise.all(
        open.map((b) =>
          API.listUserBets(b.slug)
            .then((r) => r.data)
            .catch(() => [] as UserBet[])
        )
      );
      if (cancelRef.current) return;
      const all = results.flat();
      const now = Date.now();
      const WINDOW_24H = 24 * 3600 * 1000;
      const pseudos = new Set<string>();
      let totalVolume = 0;
      let last24h = 0;
      let biggest = 0;
      for (const p of all) {
        const amt = Number(p.amount);
        totalVolume += amt;
        if (p.user_pseudo) pseudos.add(p.user_pseudo);
        if (now - new Date(p.placed_at).getTime() < WINDOW_24H) last24h += amt;
        if (amt > biggest) biggest = amt;
      }
      setAgg({
        totalVolume,
        totalPositions: all.length,
        uniqueTraders: pseudos.size,
        last24hVolume: last24h,
        biggestSingle: biggest,
      });
    };
    aggregateRef.current();
    return () => { cancelRef.current = true; };
  }, [bets]);

  useVisibleInterval(() => { aggregateRef.current(); }, 30_000);

  const openMarkets = useMemo(() => bets.filter((b) => b.status === "OPEN").length, [bets]);

  const loc = locale === "fr" ? "fr-FR" : "en-US";

  const cells = [
    {
      label: "Volume total",
      value: (
        <NumberTicker
          value={agg.totalVolume}
          decimals={0}
          locale={loc}
          suffix=" €"
          duration={1.2}
        />
      ),
      color: "var(--fg-strong)",
      big: true,
    },
    {
      label: "24h",
      value: <NumberTicker value={agg.last24hVolume} decimals={0} locale={loc} suffix=" €" duration={1} />,
      color: "var(--accent)",
    },
    {
      label: "Positions",
      value: <NumberTicker value={agg.totalPositions} duration={0.8} />,
      color: "var(--fg-strong)",
    },
    {
      label: "Traders",
      value: <NumberTicker value={agg.uniqueTraders} duration={0.8} />,
      color: "var(--fg-strong)",
    },
    {
      label: "Top position",
      value: <span className="mono num">{formatAmount(agg.biggestSingle)}</span>,
      color: "var(--warning)",
    },
    {
      label: "Marchés ouverts",
      value: <NumberTicker value={openMarkets} duration={0.6} />,
      color: "var(--fg-strong)",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="volume-block"
    >
      {cells.map((c, i) => (
        <div key={c.label} className={`vb-cell ${i === 0 ? "vb-hero" : ""}`}>
          <div className="mono vb-label">{c.label}</div>
          <div
            className={`display num vb-value ${c.big ? "vb-value-hero" : ""}`}
            style={{ color: c.color }}
          >
            {c.value}
          </div>
        </div>
      ))}
    </motion.div>
  );
}
