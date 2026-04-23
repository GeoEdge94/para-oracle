import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import { Bell, Zap, Trophy, Satellite, X, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Bet, UserBet } from "@/lib/api";
import { isBoosted, formatCountdown, rankFor, computeXP, useStreak } from "@/lib/engage";
import { useI18n } from "@/lib/i18n";

type Props = {
  bets: Bet[];
  myBets: UserBet[];
};

type Notif = {
  id: string;
  kind: "rank" | "boosted" | "resolved";
  title: string;
  body: string;
  href?: string;
  ts: number;
  accent: string;
  icon: React.ReactNode;
};

const LS_READ = "para_notifs_read";
const LS_RANK = "para_notifs_rank";

function loadRead(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(LS_READ) ?? "[]")); } catch { return new Set(); }
}
function saveRead(s: Set<string>) {
  try { localStorage.setItem(LS_READ, JSON.stringify([...s])); } catch {}
}

export function NotificationsBell({ bets, myBets }: Props) {
  const navigate = useNavigate();
  const { t, formatAmount } = useI18n();
  const { current: streak, longest } = useStreak();
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState<Set<string>>(() => loadRead());

  // Rank-up detection
  const xp = useMemo(() => computeXP(myBets, Math.max(streak, longest)), [myBets, streak, longest]);
  const rank = rankFor(xp);
  useEffect(() => {
    try {
      const prev = localStorage.getItem(LS_RANK);
      if (prev && prev !== rank.current.key) {
        // Rank changed — we'll surface it as notif via notifs array.
      }
      localStorage.setItem(LS_RANK, rank.current.key);
    } catch {}
  }, [rank.current.key]);

  const notifs = useMemo<Notif[]>(() => {
    const out: Notif[] = [];
    const now = Date.now();

    // Boosted markets (J-1)
    for (const b of bets) {
      if (!isBoosted(b.period_end, b.status)) continue;
      out.push({
        id: `boost-${b.slug}`,
        kind: "boosted",
        title: b.region_name,
        body: `Ferme dans ${formatCountdown(b.period_end)} · +25% XP sur prédiction juste`,
        href: `/analysis/${b.slug}`,
        ts: now,
        accent: "#fbbf24",
        icon: <Zap size={14} color="#fbbf24" />,
      });
    }

    // Resolutions of bets the user actually placed (week window)
    const myBetSlugs = new Set(myBets.map((b) => b.bet_id));
    for (const b of bets) {
      if (!b.status.startsWith("RESOLVED")) continue;
      if (!myBetSlugs.has(b.slug)) continue;
      const resolvedAt = b.resolved_at ? new Date(b.resolved_at).getTime() : 0;
      if (now - resolvedAt > 14 * 86_400_000) continue;
      const myPosition = myBets.find((p) => p.bet_id === b.slug)?.position;
      const won = myPosition && ((b.result_bool && myPosition === "YES") || (!b.result_bool && myPosition === "NO"));
      out.push({
        id: `resolve-${b.slug}`,
        kind: "resolved",
        title: b.region_name,
        body: won ? `Prédiction juste · ${b.result_bool ? "YES" : "NO"}` : `Oracle a tranché · ${b.result_bool ? "YES" : "NO"}`,
        href: `/analysis/${b.slug}`,
        ts: resolvedAt || now,
        accent: won ? "#34d399" : "#f87171",
        icon: <Satellite size={14} color={won ? "#34d399" : "#f87171"} />,
      });
    }

    // Current rank card (informational, always visible in drawer)
    out.push({
      id: `rank-${rank.current.key}-${rank.pct}`,
      kind: "rank",
      title: `Rang : ${t(`engage.rank_${rank.current.key}`)}`,
      body: rank.next ? `${rank.pct}% vers ${t(`engage.rank_${rank.next.key}`)} · ${rank.current.max - xp} XP restants` : `Rang max atteint · ${xp} XP`,
      ts: now,
      accent: rank.current.color,
      icon: <Trophy size={14} color={rank.current.color} />,
    });

    // Sort by most recent first, cap at 20
    return out.sort((a, b) => b.ts - a.ts).slice(0, 20);
  }, [bets, myBets, rank.current.key, rank.current.max, rank.next, rank.pct, xp, t]);

  const unreadCount = notifs.filter((n) => !read.has(n.id)).length;

  function markAllRead() {
    const next = new Set(read);
    for (const n of notifs) next.add(n.id);
    setRead(next);
    saveRead(next);
  }
  function openNotif(n: Notif) {
    const next = new Set(read); next.add(n.id); setRead(next); saveRead(next);
    if (n.href) { setOpen(false); navigate(n.href); }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="topbar-icon-btn" aria-label="Notifications" title="Notifications">
          <Bell size={14} />
          {unreadCount > 0 && (
            <span className="mono" style={{
              position: "absolute",
              top: -4, right: -4,
              minWidth: 16, height: 16,
              padding: "0 4px",
              borderRadius: 8,
              background: "var(--accent)",
              color: "#fff",
              fontSize: 9,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1.5px solid var(--bg)",
            }}>
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="cmd-overlay" />
        <Dialog.Content
          className="notif-drawer"
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Dialog.Title className="sr-only">Notifications</Dialog.Title>
          <div className="notif-header">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Bell size={14} color="var(--accent)" />
              <span style={{ fontWeight: 700, fontSize: 13 }}>Notifications</span>
              {unreadCount > 0 && (
                <span className="mono" style={{ fontSize: 9, color: "var(--fg-faint)", letterSpacing: 0.5 }}>
                  {unreadCount} non lu{unreadCount > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={markAllRead}
                className="mono"
                style={{ background: "transparent", border: "1px solid var(--border-muted)", color: "var(--fg-subtle)", padding: "4px 8px", borderRadius: 4, fontSize: 10, cursor: "pointer", letterSpacing: 0.3 }}
                title="Tout marquer comme lu"
                aria-label="Tout marquer comme lu"
              >
                <CheckCircle2 size={10} style={{ verticalAlign: "middle", marginRight: 4 }} />
                Tout lu
              </button>
              <Dialog.Close asChild>
                <button className="topbar-icon-btn" aria-label="Close" style={{ width: 28, height: 28 }}><X size={14} /></button>
              </Dialog.Close>
            </div>
          </div>
          <div className="notif-list">
            <AnimatePresence initial={false}>
              {notifs.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--fg-faint)", fontSize: 12, fontStyle: "italic" }}>
                  Aucune notification pour le moment.
                </div>
              ) : notifs.map((n, i) => {
                const unread = !read.has(n.id);
                return (
                  <motion.button
                    key={n.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => openNotif(n)}
                    className="notif-item"
                    data-unread={unread || undefined}
                  >
                    <span className="notif-icon" style={{ borderColor: `${n.accent}44`, background: `${n.accent}14` }}>
                      {n.icon}
                    </span>
                    <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--fg-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {n.title}
                      </div>
                      <div className="mono" style={{ fontSize: 10, color: "var(--fg-muted)", marginTop: 2, letterSpacing: 0.2 }}>
                        {n.body}
                      </div>
                    </div>
                    {unread && <span style={{ width: 6, height: 6, borderRadius: 3, background: n.accent }} />}
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
