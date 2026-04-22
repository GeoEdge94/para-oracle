// ─────────────────────────────────────────────────────────────────
// Engagement layer — client-side (localStorage) streak, XP, ranks,
// missions, badges. Designed to be honest: no artificial FOMO, no
// manufactured scarcity. Streak has a weekly freeze safety-net.
// ─────────────────────────────────────────────────────────────────
import { useEffect, useState, useCallback } from "react";
import type { UserBet } from "@/lib/api";

const todayKey = () => new Date().toISOString().slice(0, 10);

type StreakData = {
  current: number;
  longest: number;
  lastCheck: string;     // ISO yyyy-mm-dd
  freezeUsedThisWeek: boolean;
  weekAnchor: string;    // ISO yyyy-mm-dd of Monday of current week
};

function weekAnchor(d = new Date()): string {
  const day = d.getUTCDay() || 7;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - (day - 1));
  return monday.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime();
  return Math.round(ms / 86_400_000);
}

const LS_STREAK = "para_engage_streak";

function loadStreak(): StreakData {
  try {
    const raw = localStorage.getItem(LS_STREAK);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { current: 0, longest: 0, lastCheck: "", freezeUsedThisWeek: false, weekAnchor: weekAnchor() };
}
function saveStreak(s: StreakData) {
  try { localStorage.setItem(LS_STREAK, JSON.stringify(s)); } catch {}
}

/**
 * Daily streak with weekly freeze safety-net.
 * - checkin(): increments if new day. Auto-freeze if 1 day missed this week.
 * - Multi-day gap (>1) breaks streak (no punishment, just reset).
 */
export function useStreak() {
  const [state, setState] = useState<StreakData>(() => loadStreak());

  const checkin = useCallback(() => {
    setState((prev) => {
      const today = todayKey();
      const thisWeek = weekAnchor();
      // Roll over week window
      let freezeUsed = prev.freezeUsedThisWeek;
      let anchor = prev.weekAnchor;
      if (anchor !== thisWeek) { freezeUsed = false; anchor = thisWeek; }

      if (!prev.lastCheck) {
        const next = { current: 1, longest: 1, lastCheck: today, freezeUsedThisWeek: freezeUsed, weekAnchor: anchor };
        saveStreak(next);
        return next;
      }
      if (prev.lastCheck === today) {
        return { ...prev, freezeUsedThisWeek: freezeUsed, weekAnchor: anchor };
      }
      const gap = daysBetween(prev.lastCheck, today);
      if (gap === 1) {
        const curr = prev.current + 1;
        const next = { current: curr, longest: Math.max(curr, prev.longest), lastCheck: today, freezeUsedThisWeek: freezeUsed, weekAnchor: anchor };
        saveStreak(next);
        return next;
      }
      if (gap === 2 && !freezeUsed) {
        // Free freeze — consume it, streak continues
        const curr = prev.current + 1;
        const next = { current: curr, longest: Math.max(curr, prev.longest), lastCheck: today, freezeUsedThisWeek: true, weekAnchor: anchor };
        saveStreak(next);
        return next;
      }
      // Streak breaks
      const next = { current: 1, longest: prev.longest, lastCheck: today, freezeUsedThisWeek: freezeUsed, weekAnchor: anchor };
      saveStreak(next);
      return next;
    });
  }, []);

  // Auto-checkin on first mount per tab
  useEffect(() => { checkin(); }, [checkin]);

  const activeToday = state.lastCheck === todayKey();
  return { ...state, activeToday, checkin };
}

// ─── XP / Rank ─────────────────────────────────────────────────────
export type Rank = {
  key: "obs" | "ana" | "for" | "ora" | "grand";
  min: number;
  max: number;
  color: string;
  icon: string;
};
export const RANKS: Rank[] = [
  { key: "obs",   min: 0,     max: 200,    color: "#94a3b8", icon: "👁" },
  { key: "ana",   min: 200,   max: 800,    color: "#60a5fa", icon: "🔬" },
  { key: "for",   min: 800,   max: 2400,   color: "#10b981", icon: "📡" },
  { key: "ora",   min: 2400,  max: 6000,   color: "#fbbf24", icon: "🔮" },
  { key: "grand", min: 6000,  max: Infinity, color: "#a855f7", icon: "🌍" },
];

export function rankFor(xp: number): { current: Rank; next: Rank | null; pct: number } {
  const idx = RANKS.findIndex((r) => xp < r.max);
  const safe = idx === -1 ? RANKS.length - 1 : idx;
  const current = RANKS[safe];
  const next = safe < RANKS.length - 1 ? RANKS[safe + 1] : null;
  const span = current.max === Infinity ? 1 : current.max - current.min;
  const pct = current.max === Infinity ? 100 : Math.min(100, Math.round(((xp - current.min) / span) * 100));
  return { current, next, pct };
}

/**
 * Derive XP from wallet history.
 * Formula rewards correct lecture + diversification, not quantity:
 *   +10 base per decided bet
 *   +40 if WON
 *   +5 per distinct market observed (diminishing after 10)
 *   +25 per streak day (capped at 180)
 */
export function computeXP(bets: UserBet[], streakDays: number): number {
  const decided = bets.filter((b) => b.status !== "PENDING").length;
  const won = bets.filter((b) => b.status === "WON").length;
  const uniqueMarkets = new Set(bets.map((b) => b.bet_id)).size;
  const diversBonus = Math.min(uniqueMarkets, 10) * 5;
  const streakBonus = Math.min(streakDays, 180) * 25;
  return decided * 10 + won * 40 + diversBonus + streakBonus;
}

// ─── Daily missions (deterministic from ymd + user token) ─────────
const LS_MISSIONS = "para_engage_missions_";
type MissionProgress = Record<string, number>; // key -> count done today
export type Mission = {
  key: "check" | "predict" | "analyze";
  target: number;
  i18nKey: string;
};
export const DAILY_MISSIONS: Mission[] = [
  { key: "check", target: 3, i18nKey: "engage.mission_check" },
  { key: "predict", target: 1, i18nKey: "engage.mission_predict" },
  { key: "analyze", target: 1, i18nKey: "engage.mission_analyze" },
];

export function useMissions() {
  const today = todayKey();
  const storageKey = LS_MISSIONS + today;
  const [progress, setProgress] = useState<MissionProgress>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {};
  });

  const bump = useCallback((key: Mission["key"]) => {
    setProgress((prev) => {
      const next = { ...prev, [key]: (prev[key] ?? 0) + 1 };
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [storageKey]);

  const done = DAILY_MISSIONS.filter((m) => (progress[m.key] ?? 0) >= m.target).length;
  const total = DAILY_MISSIONS.length;
  return { progress, bump, done, total, missions: DAILY_MISSIONS };
}

// ─── Badges ────────────────────────────────────────────────────────
export type Badge = {
  key: string;
  earned: boolean;
  i18nKey: string;
  icon: string;
  tint: string;
};
export function computeBadges(bets: UserBet[], streak: number, longest: number): Badge[] {
  const won = bets.filter((b) => b.status === "WON").length;
  const decided = bets.filter((b) => b.status !== "PENDING").length;
  const accuracy = decided ? won / decided : 0;
  const uniqueMarkets = new Set(bets.map((b) => b.bet_id)).size;
  return [
    { key: "first_bet",   earned: bets.length >= 1,       i18nKey: "engage.badge_first_bet",    icon: "🎯", tint: "#60a5fa" },
    { key: "week_streak", earned: Math.max(streak, longest) >= 7,  i18nKey: "engage.badge_week_streak",  icon: "🔥", tint: "#f59e0b" },
    { key: "month_streak",earned: Math.max(streak, longest) >= 30, i18nKey: "engage.badge_month_streak", icon: "🌟", tint: "#fbbf24" },
    { key: "accurate",    earned: decided >= 5 && accuracy >= 0.7,  i18nKey: "engage.badge_accurate",  icon: "🎖", tint: "#a855f7" },
    { key: "diversified", earned: uniqueMarkets >= 5,     i18nKey: "engage.badge_diversified",  icon: "🧭", tint: "#10b981" },
    { key: "earth",       earned: decided >= 20,          i18nKey: "engage.badge_earth",        icon: "🌍", tint: "#34d399" },
  ];
}

// ─── Weekly League (local, virtual) ────────────────────────────────
// Positionned from local XP vs a simulated population snapshot to avoid
// backend changes. Honest: it's a practice league.
export type League = "bronze" | "silver" | "gold" | "platinum" | "diamond";
const LEAGUE_THRESHOLDS: Record<League, number> = {
  bronze: 0, silver: 200, gold: 800, platinum: 2000, diamond: 5000,
};
export function leagueFor(xp: number): { league: League; progressPct: number; nextAt: number } {
  const order: League[] = ["bronze", "silver", "gold", "platinum", "diamond"];
  let current: League = "bronze";
  for (const l of order) if (xp >= LEAGUE_THRESHOLDS[l]) current = l;
  const idx = order.indexOf(current);
  const floor = LEAGUE_THRESHOLDS[current];
  const nextL = order[idx + 1];
  const ceil = nextL ? LEAGUE_THRESHOLDS[nextL] : floor + 1;
  const pct = nextL ? Math.round(((xp - floor) / (ceil - floor)) * 100) : 100;
  return { league: current, progressPct: Math.min(100, pct), nextAt: nextL ? ceil : floor };
}
export function daysUntilNextMonday(): number {
  const d = new Date();
  const day = d.getUTCDay() || 7;
  return 8 - day; // reset Monday 00 UTC
}
