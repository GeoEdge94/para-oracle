import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Bet, UserBet } from "@/lib/api";
import { API } from "@/lib/api";

/**
 * Polls a sample of markets' /user-bets every `pollMs` and emits a
 * side-effect pulse (by returning a Set of recently-bumped slugs) +
 * a discreet toast for each new placement detected. Designed for Map
 * where we want live vibe without a websocket.
 */
export function usePulseOnNewBet(
  bets: Bet[],
  opts?: { pollMs?: number; pulseDurationMs?: number; sampleSize?: number }
) {
  const pollMs = opts?.pollMs ?? 6000;
  const pulseDurationMs = opts?.pulseDurationMs ?? 1200;
  const sampleSize = opts?.sampleSize ?? 18;

  const [pulsing, setPulsing] = useState<Set<string>>(new Set());
  const seenRef = useRef<Set<string>>(new Set());
  const firstPassRef = useRef(true);

  useEffect(() => {
    if (bets.length === 0) return;
    let cancelled = false;

    async function tick() {
      const startIdx = Math.floor(Math.random() * Math.max(1, bets.length - sampleSize));
      const sample = bets.slice(startIdx, startIdx + sampleSize);
      const results = await Promise.all(
        sample.map((b) =>
          API.listUserBets(b.slug)
            .then((r) => ({ bet: b, positions: r.data as UserBet[] }))
            .catch(() => ({ bet: b, positions: [] as UserBet[] }))
        )
      );
      if (cancelled) return;

      const freshPulses: string[] = [];
      const events: Array<{ slug: string; regionName: string; pseudo: string; position: "YES" | "NO"; amount: number }> = [];
      for (const { bet, positions } of results) {
        for (const p of positions) {
          if (seenRef.current.has(p.id)) continue;
          seenRef.current.add(p.id);
          if (firstPassRef.current) continue;
          freshPulses.push(bet.slug);
          events.push({
            slug: bet.slug,
            regionName: bet.region_name,
            pseudo: p.user_pseudo ?? "unknown",
            position: p.position,
            amount: Number(p.amount),
          });
        }
      }
      firstPassRef.current = false;

      if (freshPulses.length) {
        setPulsing((prev) => {
          const next = new Set(prev);
          for (const s of freshPulses) next.add(s);
          return next;
        });
        setTimeout(() => {
          setPulsing((prev) => {
            const next = new Set(prev);
            for (const s of freshPulses) next.delete(s);
            return next;
          });
        }, pulseDurationMs);
      }

      // Toast cap: max 2 per tick. Use .info text-only to stay lib-safe.
      for (const e of events.slice(0, 2)) {
        const verb = e.position === "YES" ? "▲ YES" : "▼ NO";
        toast(`${e.pseudo} · ${verb} · ${e.amount.toFixed(0)} €`, {
          description: e.regionName,
          duration: 3200,
          position: "bottom-right",
          style: {
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
            borderLeft: `3px solid ${e.position === "YES" ? "var(--success)" : "var(--danger)"}`,
          },
        });
      }
    }

    tick();
    const id = setInterval(tick, pollMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [bets, pollMs, pulseDurationMs, sampleSize]);

  return pulsing;
}
