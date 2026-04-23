import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Bet, UserBet } from "@/lib/api";
import { API } from "@/lib/api";
import { Avatar } from "@/components/Avatar";
import { useI18n } from "@/lib/i18n";
import { useVisibleInterval } from "@/lib/usePageVisibility";

type Props = {
  bets: Bet[];
  maxShown?: number;
  pollMs?: number;
};

type ActivityItem = {
  key: string;
  userPseudo: string;
  position: "YES" | "NO";
  amount: number;
  betSlug: string;
  regionName: string;
  placedAt: string;
};

function agoLabel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 10_000) return "à l'instant";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}j`;
}

/**
 * Polls /user-bets for a rolling window of community activity. Shows
 * the latest N actions in a marquee-style bottom bar. Tone: sober,
 * monospace, Polymarket-style "live" feel — no fake randomization.
 */
export function LiveActivityTicker({ bets, maxShown = 12, pollMs = 12_000 }: Props) {
  const { formatAmount } = useI18n();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [, setTick] = useState(0);
  const seenRef = useRef<Set<string>>(new Set());

  const betMap = useMemo(() => {
    const m = new Map<string, Bet>();
    for (const b of bets) m.set(b.slug, b);
    return m;
  }, [bets]);

  const cancelRef = useRef(false);
  const fetchActivityRef = useRef(async () => {});
  useEffect(() => {
    cancelRef.current = false;
    fetchActivityRef.current = async () => {
      // Sample a few slugs to limit load (20 is enough for rolling feel)
      const slugs = bets.slice(0, 20).map((b) => b.slug);
      const results = await Promise.all(
        slugs.map((slug) =>
          API.listUserBets(slug)
            .then((r) => r.data.map((ub) => ({ ...ub, betSlug: slug })))
            .catch(() => [] as (UserBet & { betSlug: string })[])
        )
      );
      if (cancelRef.current) return;
      const all = results.flat();
      all.sort((a, b) => new Date(b.placed_at).getTime() - new Date(a.placed_at).getTime());
      const latest = all.slice(0, maxShown * 2).map((ub) => {
        const bet = betMap.get(ub.betSlug);
        return {
          key: ub.id,
          userPseudo: ub.user_pseudo ?? "unknown",
          position: ub.position,
          amount: Number(ub.amount),
          betSlug: ub.betSlug,
          regionName: bet?.region_name ?? ub.betSlug,
          placedAt: ub.placed_at,
        } as ActivityItem;
      });
      // Only surface new items (prevents flicker + respects "live" feel)
      const fresh = latest.filter((it) => !seenRef.current.has(it.key));
      for (const it of latest) seenRef.current.add(it.key);
      setItems((prev) => {
        const merged = [...fresh, ...prev];
        return merged.slice(0, maxShown);
      });
    };
    fetchActivityRef.current();
    return () => { cancelRef.current = true; };
  }, [bets, betMap, maxShown]);

  useVisibleInterval(() => { fetchActivityRef.current(); }, pollMs);
  useVisibleInterval(() => setTick((t) => t + 1), 15_000);

  if (items.length === 0) return null;

  return (
    <div className="live-activity-ticker" aria-label="Live activity">
      <span className="mono" style={{ fontSize: 9, color: "var(--fg-faint)", letterSpacing: 1.2, textTransform: "uppercase", paddingRight: 12, flexShrink: 0 }}>
        ● LIVE
      </span>
      <div className="lat-scroll">
        <AnimatePresence initial={false}>
          {items.map((it) => (
            <motion.div
              key={it.key}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="lat-item"
            >
              <Avatar seed={it.userPseudo} size={16} radius={3} />
              <span style={{ fontWeight: 600, color: "var(--fg)" }}>{it.userPseudo}</span>
              <span style={{ color: it.position === "YES" ? "var(--success)" : "var(--danger)", fontWeight: 700 }}>
                {it.position}
              </span>
              <span className="mono" style={{ color: "var(--fg-muted)" }}>
                {formatAmount(it.amount)}
              </span>
              <span style={{ color: "var(--fg-faint)" }}>·</span>
              <span style={{ color: "var(--fg-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>
                {it.regionName}
              </span>
              <span className="mono" style={{ color: "var(--fg-faint)", fontSize: 9 }}>{agoLabel(it.placedAt)}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
