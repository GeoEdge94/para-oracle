import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { TrendingUp, TrendingDown, Zap } from "lucide-react";
import type { Bet, BetMarketStats } from "@/lib/api";
import { API } from "@/lib/api";
import { isBoosted } from "@/lib/engage";
import { useVisibleInterval } from "@/lib/usePageVisibility";

type Props = {
  bets: Bet[];
  pollMs?: number;
};

type Snapshot = {
  slug: string;
  regionName: string;
  index: string;
  yesPct: number;
  delta: number; // pct points vs previous snapshot
  boosted: boolean;
};

const CAT_COLORS: Record<string, string> = {
  deforestation: "#10b981", wildfire: "#f59e0b", flood: "#3b82f6",
  mining: "#a855f7", drought: "#ef4444", glacier: "#06b6d4",
  urbanization: "#f97316", water_quality: "#0ea5e9",
};

/**
 * Bloomberg/Polymarket-style price ticker. Computes implied YES% from
 * real /user-bets/by-bet/{slug}/stats every pollMs ms, computes delta
 * vs previous snapshot, renders as infinite marquee.
 */
export function TradingTicker({ bets, pollMs = 20_000 }: Props) {
  const navigate = useNavigate();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const prevRef = useRef<Record<string, number>>({});

  const cancelRef = useRef(false);
  const fetchAll = useRef(async () => {});
  useEffect(() => {
    cancelRef.current = false;
    fetchAll.current = async () => {
      const open = bets.filter((b) => b.status === "OPEN").slice(0, 18);
      const results = await Promise.all(
        open.map(async (b) => {
          try {
            const { data } = await API.marketStats(b.slug);
            return { b, stats: data };
          } catch {
            return { b, stats: null as BetMarketStats | null };
          }
        }),
      );
      if (cancelRef.current) return;
      const next: Snapshot[] = results
        .filter((r) => r.stats && r.stats.total_bets > 0)
        .map(({ b, stats }) => {
          const yesPct = Math.round(stats!.yes_pct);
          const prev = prevRef.current[b.slug] ?? yesPct;
          const delta = yesPct - prev;
          prevRef.current[b.slug] = yesPct;
          return {
            slug: b.slug,
            regionName: b.region_name,
            index: b.index_type,
            yesPct,
            delta,
            boosted: isBoosted(b.period_end, b.status),
          };
        });
      setSnapshots(next);
    };
    fetchAll.current();
    return () => { cancelRef.current = true; };
  }, [bets]);

  useVisibleInterval(() => { fetchAll.current(); }, pollMs);

  const items = useMemo(() => {
    // Duplicate for seamless marquee loop
    return [...snapshots, ...snapshots];
  }, [snapshots]);

  if (snapshots.length === 0) return null;

  return (
    <div className="trading-ticker" role="marquee" aria-label="Market price ticker">
      <div className="tt-label">
        <span className="mono" style={{ color: "var(--fg-faint)", fontSize: 9, letterSpacing: 1.4 }}>
          LIVE PRICES
        </span>
        <span className="tt-pulse" />
      </div>
      <div className="tt-viewport">
        <div className="tt-track">
          {items.map((s, i) => {
            const up = s.delta > 0;
            const down = s.delta < 0;
            const deltaColor = up ? "var(--success)" : down ? "var(--danger)" : "var(--fg-faint)";
            const catColor = "#64748b";
            return (
              <motion.button
                key={`${s.slug}-${i}`}
                onClick={() => navigate(`/analysis/${s.slug}`)}
                whileHover={{ y: -1 }}
                className="tt-item"
              >
                {s.boosted && <Zap size={9} color="#fbbf24" />}
                <span className="mono" style={{ color: "var(--fg-muted)", fontSize: 10, fontWeight: 600 }}>
                  {s.regionName.length > 26 ? s.regionName.slice(0, 24) + "…" : s.regionName}
                </span>
                <span className="mono" style={{ color: catColor, fontSize: 9 }}>
                  {s.index}
                </span>
                <span className="mono data" style={{ color: "var(--fg-strong)", fontSize: 11, fontWeight: 700 }}>
                  {s.yesPct}%
                </span>
                <span className="mono data" style={{ color: deltaColor, fontSize: 10, display: "inline-flex", alignItems: "center", gap: 2 }}>
                  {up ? <TrendingUp size={9} /> : down ? <TrendingDown size={9} /> : null}
                  {s.delta === 0 ? "—" : `${up ? "+" : ""}${s.delta.toFixed(1)}`}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
