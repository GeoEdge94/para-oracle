import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Flame, Trophy, MapPin, LogOut, Map as MapIcon, Wallet as WalletIcon, Sparkles, TrendingUp, Clock, Zap } from "lucide-react";
import { API, api, type Bet, type WalletBalance, type UserBet } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { NumberTicker } from "@/components/NumberTicker";
import { BentoGrid, BentoTile } from "@/components/BentoGrid";
import { LocaleToggle } from "@/components/LocaleToggle";
import { StreakBadge } from "@/components/StreakBadge";
import { WalletBadge } from "@/components/WalletBadge";
import { Marquee } from "@/components/Marquee";
import { computeXP, computeBadges, daysUntilNextMonday, leagueFor, rankFor, RANKS, useMissions, useStreak, isBoosted, formatCountdown, hoursUntilClose } from "@/lib/engage";
import { Avatar } from "@/components/Avatar";
import { Sparkline } from "@/components/Sparkline";
import { BoostedBadge } from "@/components/BoostedBadge";
import { LiveActivityTicker } from "@/components/LiveActivityTicker";
import { TradingTicker } from "@/components/TradingTicker";
import { VolumeBlock } from "@/components/VolumeBlock";
import { TopTraderTile } from "@/components/TopTraderTile";
import { MissedTile } from "@/components/MissedTile";
import { NotificationsBell } from "@/components/NotificationsBell";

const CAT_COLORS: Record<string, string> = {
  deforestation: "#10b981", wildfire: "#f59e0b", flood: "#3b82f6",
  mining: "#a855f7", drought: "#ef4444", glacier: "#06b6d4",
  urbanization: "#f97316", water_quality: "#0ea5e9",
};

type Entry = { pseudo: string; balance: number; total_won: number; total_lost: number };

function daysUntil(iso: string): number {
  const d = new Date(iso);
  const now = new Date();
  return Math.max(0, Math.ceil((d.getTime() - now.getTime()) / 86_400_000));
}

export function Home() {
  const navigate = useNavigate();
  const { t, locale, formatAmount } = useI18n();
  const { current: streak, longest } = useStreak();
  const { progress, done, total, missions } = useMissions();

  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [myBets, setMyBets] = useState<UserBet[]>([]);
  const [leaderboard, setLeaderboard] = useState<Entry[]>([]);

  useEffect(() => {
    API.walletBalance().then((r) => setWallet(r.data)).catch(() => {});
    API.listBets().then(async (r) => {
      setBets(r.data);
      const all: UserBet[] = [];
      for (const b of r.data.slice(0, 40)) {
        try {
          const { data } = await API.myBets(b.slug);
          all.push(...(data.positions || []));
        } catch {}
      }
      all.sort((a, b) => new Date(b.placed_at).getTime() - new Date(a.placed_at).getTime());
      setMyBets(all);
    }).catch(() => {});
    api.get<Entry[]>("/auth/leaderboard").then((r) => setLeaderboard(r.data)).catch(() => {});
  }, []);

  const xp = useMemo(() => computeXP(myBets, Math.max(streak, longest)), [myBets, streak, longest]);
  const rank = rankFor(xp);
  const league = leagueFor(xp);
  const badges = useMemo(() => computeBadges(myBets, streak, longest), [myBets, streak, longest]);

  const trending = useMemo(() => {
    return bets
      .filter((b) => b.status === "OPEN")
      .sort(() => 0.5 - Math.random())
      .slice(0, 3);
  }, [bets]);

  const boostedBets = useMemo(() => {
    return bets
      .filter((b) => isBoosted(b.period_end, b.status))
      .sort((a, b) => hoursUntilClose(a.period_end) - hoursUntilClose(b.period_end))
      .slice(0, 6);
  }, [bets]);

  const nextResolve = useMemo(() => {
    return bets
      .filter((b) => b.status === "OPEN")
      .map((b) => ({ bet: b, days: daysUntil(b.period_end) }))
      .sort((a, b) => a.days - b.days)[0];
  }, [bets]);

  const liveMarketsCount = bets.filter((b) => b.status === "OPEN").length;
  const resolvedCount = bets.filter((b) => b.status.startsWith("RESOLVED")).length;

  function logout() {
    localStorage.removeItem("para_token");
    navigate("/login");
  }

  return (
    <div style={{ height: "100dvh", overflowY: "auto", overflowX: "hidden", background: "var(--bg)" }}>
      {/* Topbar */}
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div className="display" style={{ fontSize: 16, letterSpacing: -0.5 }}>
            Para<span style={{ color: "var(--accent)" }}>Oracle</span>
          </div>
          <span className="mono" style={{ fontSize: 9, color: "var(--fg-faint)", letterSpacing: 1.2 }}>/ DASHBOARD</span>
        </div>
        <div className="topbar-center">
          <button onClick={() => navigate("/map")} className="topbar-icon-btn" style={{ width: "auto", padding: "6px 12px", gap: 6 }}>
            <MapIcon size={13} /> <span style={{ fontSize: 11, fontWeight: 600 }}>{t("engage.view_map")}</span>
          </button>
        </div>
        <div className="topbar-actions">
          <StreakBadge />
          <WalletBadge onClick={() => navigate("/wallet")} />
          <NotificationsBell bets={bets} myBets={myBets} />
          <button className="topbar-icon-btn" data-variant="gold" onClick={() => navigate("/leaderboard")} title={t("wallet.leaderboard")}>
            <Trophy size={14} />
          </button>
          <span className="topbar-sep" />
          <LocaleToggle />
          <span className="topbar-sep" />
          <button className="topbar-icon-btn" data-variant="danger" onClick={logout} title="Logout">
            <LogOut size={14} />
          </button>
        </div>
      </div>

      {/* Bloomberg-style trading ticker with implied YES% and deltas */}
      {bets.length > 0 && <TradingTicker bets={bets} />}

      {/* Volume / positions / traders aggregate block */}
      {bets.length > 0 && <VolumeBlock bets={bets} />}

      {/* Hero stat row (editorial) */}
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "28px 16px 12px" }}>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="mono" style={{ fontSize: 10, color: "var(--fg-faint)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
            {new Date().toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", { weekday: "long", day: "numeric", month: "long" })}
          </div>
          <h1 className="display" style={{ fontSize: 44, lineHeight: 1.04, letterSpacing: -1.4, marginBottom: 8, maxWidth: 720 }}>
            {t("engage.home_hello")}, <span className="serif" style={{ fontStyle: "italic", color: "var(--accent)" }}>Oracle.</span>
          </h1>
          <p style={{ fontSize: 15, color: "var(--fg-muted)", maxWidth: 560, lineHeight: 1.55 }}>
            <NumberTicker value={liveMarketsCount} /> marchés ouverts · <NumberTicker value={resolvedCount} /> résolus cette saison ·
            <span className="serif" style={{ fontStyle: "italic" }}> Sentinel-2 observe la Terre en continu.</span>
          </p>
        </motion.div>
      </div>

      {/* Closing Today — boosted markets horizontal carousel */}
      {boostedBets.length > 0 && (
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "4px 16px 12px" }}>
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            style={{
              borderRadius: "var(--radius-lg)",
              background: "linear-gradient(145deg, rgba(251,191,36,0.10) 0%, var(--surface-2) 60%)",
              border: "1px solid rgba(251,191,36,0.28)",
              overflow: "hidden",
            }}
          >
            <BoostedBadge periodEnd={boostedBets[0].period_end} status={boostedBets[0].status} variant="ribbon" />
            <div style={{ padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
                <div>
                  <div className="bento-label" style={{ marginBottom: 2, color: "#fbbf24" }}>Ferme aujourd'hui</div>
                  <div className="serif" style={{ fontSize: 15, fontStyle: "italic", color: "var(--fg-muted)" }}>
                    Dernière fenêtre pour prédire · bonus +25% XP sur les prédictions justes
                  </div>
                </div>
                <span className="mono" style={{ fontSize: 10, color: "var(--fg-faint)" }}>
                  {boostedBets.length} marché{boostedBets.length > 1 ? "s" : ""}
                </span>
              </div>
              <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
                {boostedBets.map((b, i) => {
                  const color = CAT_COLORS[b.category] || "#8b5cf6";
                  return (
                    <motion.button
                      key={b.slug}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 + i * 0.04 }}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => navigate(`/analysis/${b.slug}`)}
                      style={{
                        flex: "0 0 220px",
                        background: "rgba(10,15,26,0.85)",
                        border: "1px solid rgba(251,191,36,0.25)",
                        borderRadius: "var(--radius)",
                        padding: 12,
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 4, background: color }} />
                        <BoostedBadge periodEnd={b.period_end} status={b.status} variant="pill" />
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--fg-strong)", lineHeight: 1.25, marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                        {b.region_name}
                      </div>
                      <div className="mono" style={{ fontSize: 10, color: "var(--fg-faint)", marginBottom: 6 }}>
                        {b.index_type} · {b.threshold_value.toLocaleString()} {b.threshold_unit}
                      </div>
                      <Sparkline seed={b.slug} color="#fbbf24" height={18} />
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Bento dashboard */}
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "12px 16px 48px" }}>
        <BentoGrid>
          {/* Balance tile — accent */}
          <BentoTile variant="accent" span={2} rows={2} delay={0.05} onClick={() => navigate("/wallet")}>
            <div className="bento-label">{t("wallet.balance")}</div>
            {wallet ? (
              <div className="bento-value num display" style={{ fontSize: 44, color: "var(--accent)", letterSpacing: -1 }}>
                <NumberTicker value={Number(wallet.balance)} decimals={2} locale={locale === "fr" ? "fr-FR" : "en-US"} />
                <span style={{ fontSize: 24, marginLeft: 8, opacity: 0.7 }}>€</span>
              </div>
            ) : (
              <div className="bento-value" style={{ color: "var(--fg-faint)" }}>…</div>
            )}
            {wallet && (
              <div style={{ display: "flex", gap: 18, marginTop: 18, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 9, color: "var(--fg-faint)", letterSpacing: 0.8, textTransform: "uppercase" }}>{t("wallet.total_won")}</div>
                  <div className="num" style={{ fontSize: 15, fontWeight: 700, color: "var(--success)" }}>+{formatAmount(wallet.total_won)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: "var(--fg-faint)", letterSpacing: 0.8, textTransform: "uppercase" }}>{t("wallet.pnl")}</div>
                  <div className="num" style={{ fontSize: 15, fontWeight: 700, color: (wallet.total_won - wallet.total_lost) >= 0 ? "var(--success)" : "var(--danger)" }}>
                    {(wallet.total_won - wallet.total_lost) >= 0 ? "+" : ""}{formatAmount(wallet.total_won - wallet.total_lost)}
                  </div>
                </div>
              </div>
            )}
            <div style={{ position: "absolute", right: 14, top: 14, color: "var(--accent)", opacity: 0.25 }}>
              <WalletIcon size={40} />
            </div>
          </BentoTile>

          {/* Rank tile */}
          <BentoTile variant="purple" span={2} delay={0.1} onClick={() => navigate("/wallet")}>
            <div className="bento-label">{t("engage.rank")}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `${rank.current.color}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                {rank.current.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="display" style={{ fontSize: 18, color: rank.current.color }}>
                  {t(`engage.rank_${rank.current.key}`)}
                </div>
                <div className="num" style={{ fontSize: 11, color: "var(--fg-muted)" }}>
                  <NumberTicker value={xp} /> XP
                </div>
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <div style={{ height: 4, background: "var(--surface-1)", borderRadius: 2, overflow: "hidden" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${rank.pct}%` }}
                  transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  style={{ height: "100%", background: `linear-gradient(90deg, ${rank.current.color}66, ${rank.current.color})` }}
                />
              </div>
              {rank.next && (
                <div style={{ fontSize: 10, color: "var(--fg-faint)", marginTop: 4, display: "flex", justifyContent: "space-between" }}>
                  <span>→ {rank.next.icon} {t(`engage.rank_${rank.next.key}`)}</span>
                  <span className="num">{rank.current.max - xp} XP</span>
                </div>
              )}
            </div>
          </BentoTile>

          {/* Streak tile */}
          <BentoTile variant="warn" delay={0.15}>
            <div className="bento-label">{t("engage.streak")}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
              <Flame size={28} color="#fbbf24" />
              <div className="display num" style={{ fontSize: 40, color: "#fbbf24" }}>
                <NumberTicker value={streak} />
              </div>
              <div style={{ fontSize: 11, color: "var(--fg-subtle)" }}>
                {streak <= 1 ? t("engage.streak_day") : t("engage.streak_days")}
              </div>
            </div>
            <div className="bento-sub">Max <span className="num" style={{ color: "var(--fg)" }}>{longest}</span></div>
          </BentoTile>

          {/* Next resolution tile */}
          <BentoTile variant="info" delay={0.2} onClick={nextResolve ? () => navigate(`/analysis/${nextResolve.bet.slug}`) : undefined}>
            <div className="bento-label">{t("engage.next_resolution")}</div>
            {nextResolve ? (
              <>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 4 }}>
                  <Clock size={22} color="#60a5fa" />
                  <div className="display num" style={{ fontSize: 34, color: "#60a5fa" }}>
                    <NumberTicker value={nextResolve.days} />
                  </div>
                  <div style={{ fontSize: 12, color: "var(--fg-subtle)" }}>j</div>
                </div>
                <div className="bento-sub" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nextResolve.bet.region_name}</div>
              </>
            ) : (
              <div className="bento-sub">—</div>
            )}
          </BentoTile>

          {/* Missions tile */}
          <BentoTile span={2} delay={0.25}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div className="bento-label">{t("engage.missions")}</div>
              <div className="num" style={{ fontSize: 11, color: done === total ? "var(--success)" : "var(--fg-subtle)", fontWeight: 700 }}>
                {done}/{total}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
              {missions.map((m) => {
                const prog = Math.min(progress[m.key] ?? 0, m.target);
                const isDone = prog >= m.target;
                return (
                  <div key={m.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <div style={{
                      width: 16, height: 16, borderRadius: "50%",
                      background: isDone ? "var(--accent)" : "var(--surface-1)",
                      border: `1px solid ${isDone ? "var(--accent)" : "var(--border)"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontSize: 10, fontWeight: 700,
                    }}>{isDone ? "✓" : ""}</div>
                    <span style={{ flex: 1, color: isDone ? "var(--fg-muted)" : "var(--fg)", textDecoration: isDone ? "line-through" : "none" }}>
                      {t(m.i18nKey)}
                    </span>
                    <span className="num" style={{ fontSize: 10, color: "var(--fg-faint)" }}>{prog}/{m.target}</span>
                  </div>
                );
              })}
            </div>
          </BentoTile>

          {/* League tile */}
          <BentoTile delay={0.3} onClick={() => navigate("/leaderboard")}>
            <div className="bento-label">{t("engage.league")}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
              <Trophy size={22} color={league.league === "diamond" ? "#67e8f9" : league.league === "platinum" ? "#e2e8f0" : league.league === "gold" ? "#fbbf24" : league.league === "silver" ? "#cbd5e1" : "#cd7f32"} />
              <div className="display" style={{ fontSize: 22, color: "var(--fg-strong)" }}>
                {t(`engage.league_${league.league}`)}
              </div>
            </div>
            <div className="bento-sub">
              {t("engage.league_reset_in", { n: daysUntilNextMonday() })}
            </div>
          </BentoTile>

          {/* Trending tile */}
          <BentoTile variant="accent" span={2} delay={0.35}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div className="bento-label">{t("engage.trending")}</div>
              <TrendingUp size={14} color="var(--accent)" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
              {trending.map((b, i) => {
                const color = CAT_COLORS[b.category] || "#8b5cf6";
                return (
                  <motion.button
                    key={b.slug}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.05 }}
                    onClick={() => navigate(`/analysis/${b.slug}`)}
                    style={{
                      background: "var(--surface-1)", border: "1px solid var(--border-muted)",
                      borderRadius: "var(--radius-sm)", padding: "8px 10px",
                      display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                    <span style={{ flex: 1, fontSize: 12, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {b.region_name}
                    </span>
                    <div style={{ width: 64, flexShrink: 0 }}>
                      <Sparkline seed={b.slug} color={color} height={20} />
                    </div>
                    <span className="mono" style={{ fontSize: 10, color: "var(--fg-faint)" }}>{b.index_type}</span>
                  </motion.button>
                );
              })}
            </div>
          </BentoTile>

          {/* Top trader spotlight (editorial social proof) */}
          <TopTraderTile onClick={() => navigate("/leaderboard")} />

          {/* Missed opportunities (subtle regret framing, ethical) */}
          <MissedTile bets={bets} userBetSlugs={new Set(myBets.map((b) => b.bet_id))} />

          {/* Badges shelf */}
          <BentoTile span={4} delay={0.45}>
            <div className="bento-label">{t("engage.badges")}</div>
            <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
              {badges.map((b, i) => (
                <motion.div
                  key={b.key}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + i * 0.04, type: "spring", stiffness: 300, damping: 20 }}
                  title={t(b.i18nKey)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 12px",
                    borderRadius: "var(--radius-full)",
                    background: b.earned ? `${b.tint}15` : "var(--surface-1)",
                    border: `1px solid ${b.earned ? `${b.tint}44` : "var(--border-muted)"}`,
                    opacity: b.earned ? 1 : 0.45,
                    filter: b.earned ? "none" : "grayscale(0.8)",
                  }}
                >
                  <span style={{ fontSize: 18 }}>{b.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: b.earned ? b.tint : "var(--fg-muted)" }}>
                    {t(b.i18nKey)}
                  </span>
                </motion.div>
              ))}
            </div>
          </BentoTile>
        </BentoGrid>

        {/* CTA row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 28, flexWrap: "wrap" }}
        >
          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/map")}
            className="btn btn-primary"
            style={{ paddingLeft: 24, paddingRight: 24, display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            <MapIcon size={16} /> {t("engage.view_map")}
          </motion.button>
          {nextResolve && (
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate(`/analysis/${nextResolve.bet.slug}`)}
              className="btn btn-ghost"
              style={{ paddingLeft: 24, paddingRight: 24, display: "inline-flex", alignItems: "center", gap: 8 }}
            >
              <MapPin size={16} /> {nextResolve.bet.region_name}
            </motion.button>
          )}
        </motion.div>
      </div>

      {/* Keyboard hints footer */}
      <div style={{
        maxWidth: 1120, margin: "0 auto", padding: "0 16px 24px",
        display: "flex", justifyContent: "center", gap: 14, flexWrap: "wrap",
      }}>
        {[
          { k: "⌘ K", label: "Recherche" },
          { k: "G H", label: "Dashboard" },
          { k: "G M", label: "Carte" },
          { k: "G W", label: "Portefeuille" },
          { k: "G L", label: "Classement" },
        ].map((x) => (
          <span key={x.k} className="mono" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, color: "var(--fg-faint)", letterSpacing: 0.5 }}>
            <kbd style={{
              padding: "2px 6px", borderRadius: 3,
              background: "var(--surface-2)", border: "1px solid var(--border-muted)",
              color: "var(--fg-muted)", fontSize: 10, letterSpacing: 0.3,
            }}>{x.k}</kbd>
            <span>{x.label}</span>
          </span>
        ))}
      </div>

      {/* Live community activity (bottom fixed) */}
      <div style={{ height: 40 }} aria-hidden />
      <LiveActivityTicker bets={bets} />
    </div>
  );
}
// Needed for computeXP dep resolution; kept to avoid tree-shaking surprises.
export { RANKS };
