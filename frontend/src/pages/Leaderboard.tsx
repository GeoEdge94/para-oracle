import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Trophy, Medal } from "lucide-react";
import { motion } from "framer-motion";
import { api, API, type UserBet } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { LocaleToggle } from "@/components/LocaleToggle";
import { Skeleton } from "@/components/Skeleton";
import { computeXP, daysUntilNextMonday, leagueFor, useStreak } from "@/lib/engage";
import { NumberTicker } from "@/components/NumberTicker";
import { Avatar } from "@/components/Avatar";

type Entry = {
  pseudo: string;
  balance: number;
  total_won: number;
  total_lost: number;
};

export function LeaderboardPage() {
  const navigate = useNavigate();
  const { t, formatAmount } = useI18n();
  const { current: streak, longest } = useStreak();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [myBets, setMyBets] = useState<UserBet[]>([]);

  useEffect(() => {
    api
      .get("/auth/leaderboard")
      .then((r) => {
        setEntries(r.data);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    // Fetch my bets (for XP computation) — best-effort across all markets, parallel
    API.listBets().then(async (r) => {
      const results = await Promise.all(
        r.data.slice(0, 40).map((b) =>
          API.myBets(b.slug).then((res) => res.data.positions || []).catch(() => [] as UserBet[])
        )
      );
      setMyBets(results.flat());
    }).catch(() => {});
  }, []);

  const xp = useMemo(() => computeXP(myBets, Math.max(streak, longest)), [myBets, streak, longest]);
  const league = leagueFor(xp);
  const leagues: { key: "bronze" | "silver" | "gold" | "platinum" | "diamond"; color: string }[] = [
    { key: "bronze", color: "#cd7f32" },
    { key: "silver", color: "#cbd5e1" },
    { key: "gold", color: "#fbbf24" },
    { key: "platinum", color: "#e2e8f0" },
    { key: "diamond", color: "#67e8f9" },
  ];

  return (
    <div style={{ minHeight: "100dvh", background: "var(--surface-1)", color: "var(--fg)" }}>
      <div style={{
        position: "sticky", top: 0, zIndex: 30,
        padding: "10px 14px", background: "var(--bg)",
        display: "flex", alignItems: "center", gap: 10,
        borderBottom: "1px solid var(--border-muted)",
      }}>
        <button
          onClick={() => navigate("/")}
          className="topbar-icon-btn"
          aria-label={t("common.back")}
          style={{ width: 32, height: 32 }}
        >
          <ChevronLeft size={18} />
        </button>
        <Trophy size={16} color="var(--warning)" />
        <span style={{ fontWeight: 700, fontSize: 14, flex: 1, color: "var(--fg-strong)" }}>{t("wallet.leaderboard")}</span>
        <LocaleToggle />
      </div>

      <div style={{ padding: "16px 14px", maxWidth: 520, margin: "0 auto" }}>
        {/* Weekly League panel */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          style={{
            marginBottom: 20,
            padding: 18,
            borderRadius: "var(--radius-lg)",
            background: `linear-gradient(145deg, ${leagues.find((l) => l.key === league.league)?.color}14 0%, var(--surface-2) 60%)`,
            border: `1px solid ${leagues.find((l) => l.key === league.league)?.color}35`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <div className="bento-label">{t("engage.league")}</div>
            <div className="mono" style={{ fontSize: 10, color: "var(--fg-faint)", letterSpacing: 0.6 }}>
              {t("engage.league_reset_in", { n: daysUntilNextMonday() })}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
            <Trophy size={32} color={leagues.find((l) => l.key === league.league)?.color} />
            <div style={{ flex: 1 }}>
              <div className="display" style={{ fontSize: 26, color: leagues.find((l) => l.key === league.league)?.color, letterSpacing: -0.5 }}>
                {t(`engage.league_${league.league}`)}
              </div>
              <div className="num" style={{ fontSize: 12, color: "var(--fg-muted)", marginTop: 2 }}>
                <NumberTicker value={xp} /> XP
              </div>
            </div>
          </div>

          {/* League ladder */}
          <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            {leagues.map((l) => {
              const current = l.key === league.league;
              const below = leagues.findIndex((x) => x.key === league.league) > leagues.findIndex((x) => x.key === l.key);
              return (
                <div
                  key={l.key}
                  style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 2,
                    background: current ? l.color : below ? `${l.color}55` : "var(--border-muted)",
                    transition: "background 220ms",
                  }}
                />
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--fg-faint)", letterSpacing: 0.5, textTransform: "uppercase" }}>
            {leagues.map((l) => (
              <span key={l.key} style={{ color: l.key === league.league ? l.color : "inherit", fontWeight: l.key === league.league ? 700 : 500, flex: 1, textAlign: "center" }}>
                {t(`engage.league_${l.key}`)}
              </span>
            ))}
          </div>
        </motion.div>

        {!loaded && (
          <>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card" style={{ padding: 12, marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
                <Skeleton width={32} height={32} radius={8} />
                <div style={{ flex: 1 }}>
                  <Skeleton width="45%" height={13} style={{ marginBottom: 6 }} />
                  <Skeleton width="30%" height={9} />
                </div>
                <div style={{ textAlign: "right", width: 90 }}>
                  <Skeleton width="100%" height={13} style={{ marginBottom: 6 }} />
                  <Skeleton width="60%" height={9} style={{ marginLeft: "auto" }} />
                </div>
              </div>
            ))}
          </>
        )}
        {loaded && entries.map((e, i) => {
          const pnl = e.total_won - e.total_lost;
          const isTop3 = i < 3;
          const medalColors = ["#fbbf24", "#94a3b8", "#cd7f32"];
          return (
            <motion.div
              key={e.pseudo}
              className="card"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              style={{
                padding: 12, marginBottom: 8,
                display: "flex", alignItems: "center", gap: 12,
                border: isTop3 ? `1px solid ${medalColors[i]}33` : undefined,
              }}>
              <div className="mono" style={{
                width: 22, textAlign: "center",
                fontSize: 12, fontWeight: 700, color: isTop3 ? medalColors[i] : "var(--fg-faint)",
                flexShrink: 0,
              }}>
                {isTop3 ? <Medal size={14} color={medalColors[i]} /> : String(i + 1).padStart(2, "0")}
              </div>
              <Avatar seed={e.pseudo} size={36} radius={8} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--fg-strong)" }}>{e.pseudo}</div>
                <div className="mono" style={{ fontSize: 10, color: "var(--fg-faint)", letterSpacing: 0.2 }}>
                  {t("wallet.balance")}: {formatAmount(e.balance)}
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div className="num" style={{ fontSize: 14, fontWeight: 700, color: pnl >= 0 ? "var(--success)" : "var(--danger)" }}>
                  {pnl >= 0 ? "+" : ""}{formatAmount(pnl)}
                </div>
                <div style={{ fontSize: 10, color: "var(--fg-faint)" }}>
                  {t("wallet.pnl")}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
