import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, RefreshCw, TrendingUp, TrendingDown, Wallet as WalletIcon, MoreHorizontal, AlertTriangle, Trophy, Zap, Target } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import { API, type WalletBalance, type UserBet } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { LocaleToggle } from "@/components/LocaleToggle";
import { Skeleton } from "@/components/Skeleton";
import { RankCard } from "@/components/RankCard";
import { NumberTicker } from "@/components/NumberTicker";
import { useStreak, computeXP, computeWalletStats } from "@/lib/engage";
import { BottomNav } from "@/components/BottomNav";

export function WalletPage() {
  const navigate = useNavigate();
  const { t, formatAmount, locale } = useI18n();
  const { current: streakCurrent, longest: streakLongest } = useStreak();
  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [bets, setBets] = useState<UserBet[]>([]);
  const [betsLoaded, setBetsLoaded] = useState(false);
  const [resetting, setResetting] = useState(false);

  const xp = useMemo(() => computeXP(bets, Math.max(streakCurrent, streakLongest)), [bets, streakCurrent, streakLongest]);
  const stats = useMemo(() => computeWalletStats(bets), [bets]);
  const [confirmReset, setConfirmReset] = useState(false);

  function load() {
    API.walletBalance().then((r) => setWallet(r.data)).catch(() => {});
    setBetsLoaded(false);
    API.listBets().then(async (r) => {
      const allBets: UserBet[] = [];
      for (const b of r.data) {
        try {
          const { data } = await API.myBets(b.slug);
          allBets.push(...(data.positions || []));
        } catch {}
      }
      allBets.sort((a, b) => new Date(b.placed_at).getTime() - new Date(a.placed_at).getTime());
      setBets(allBets);
      setBetsLoaded(true);
    }).catch(() => setBetsLoaded(true));
  }

  useEffect(load, []);

  async function reset() {
    setResetting(true);
    try {
      await API.resetWallet();
      load();
      toast.success(t("wallet.reset_confirm"));
    } catch {
      toast.error(t("auth.error"));
    } finally {
      setResetting(false);
    }
  }

  if (!wallet) return <div style={{ padding: 20 }}>{t("common.loading")}</div>;

  const pnl = wallet.total_won - wallet.total_lost;
  const roi = wallet.total_lost > 0 ? (pnl / wallet.total_lost) * 100 : 0;

  return (
    <div className="has-bottom-nav" style={{ minHeight: "100dvh", background: "var(--surface-1)", color: "var(--fg)" }}>
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
        <WalletIcon size={16} color="var(--accent)" />
        <span style={{ fontWeight: 700, fontSize: 14, flex: 1, color: "var(--fg-strong)" }}>{t("wallet.title")}</span>
        <LocaleToggle />
        <button
          className="topbar-icon-btn"
          aria-label={t("wallet.reset")}
          title={t("wallet.reset")}
          style={{ width: 32, height: 32 }}
          onClick={() => setConfirmReset(true)}
        >
          <MoreHorizontal size={16} />
        </button>
      </div>

      {/* Reset confirmation dialog */}
      <Dialog.Root open={confirmReset} onOpenChange={setConfirmReset}>
        <Dialog.Portal>
          <Dialog.Overlay className="cmd-overlay" />
          <Dialog.Content className="confirm-dialog" aria-describedby={undefined}>
            <Dialog.Title style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: "var(--fg-strong)", marginBottom: 6 }}>
              <AlertTriangle size={16} color="var(--warning)" />
              Réinitialiser le portefeuille ?
            </Dialog.Title>
            <p className="serif" style={{ fontSize: 14, color: "var(--fg-muted)", fontStyle: "italic", marginBottom: 16, lineHeight: 1.5 }}>
              Ton historique sera effacé et ton solde remis à 10 000 €. Les rangs et badges obtenus depuis ton historique peuvent être affectés.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setConfirmReset(false)} style={{ padding: "8px 14px", fontSize: 12 }}>
                Annuler
              </button>
              <button
                className="btn btn-primary"
                onClick={() => { setConfirmReset(false); reset(); }}
                disabled={resetting}
                style={{ padding: "8px 14px", fontSize: 12, background: "var(--danger)" }}
              >
                {resetting ? "Réinitialisation…" : "Confirmer la réinitialisation"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div style={{ padding: "16px 14px", maxWidth: 480, margin: "0 auto" }}>
        {/* Rank card */}
        <div style={{ marginBottom: 14 }}>
          <RankCard xp={xp} />
        </div>

        {/* Balance card */}
        <div className="card" style={{ marginBottom: 16, textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "var(--fg-subtle)", textTransform: "uppercase", letterSpacing: 1 }}>{t("wallet.balance")}</div>
          <div className="display num" style={{ fontSize: 36, color: "var(--accent)", margin: "8px 0", letterSpacing: -0.5 }}>
            <NumberTicker value={Number(wallet.balance)} decimals={2} locale={locale === "fr" ? "fr-FR" : "en-US"} suffix=" €" />
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 24, fontSize: 12 }}>
            <div>
              <div style={{ color: "var(--fg-subtle)", fontSize: 10 }}>{t("wallet.total_won")}</div>
              <div className="num" style={{ color: "var(--success)", fontWeight: 600 }}>+{formatAmount(wallet.total_won)}</div>
            </div>
            <div>
              <div style={{ color: "var(--fg-subtle)", fontSize: 10 }}>{t("wallet.total_lost")}</div>
              <div className="num" style={{ color: "var(--danger)", fontWeight: 600 }}>-{formatAmount(wallet.total_lost)}</div>
            </div>
            <div>
              <div style={{ color: "var(--fg-subtle)", fontSize: 10 }}>{t("wallet.pnl")}</div>
              <div className="num" style={{ color: pnl >= 0 ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>
                {pnl >= 0 ? "+" : ""}{formatAmount(pnl)}
              </div>
            </div>
          </div>
        </div>

        {/* Performance block \u2014 what a pro trader wants to see */}
        {betsLoaded && stats.totalDecided > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            style={{ marginBottom: 16 }}
          >
            <div className="mono" style={{ fontSize: 9, color: "var(--fg-faint)", letterSpacing: 1.3, textTransform: "uppercase", fontWeight: 600, marginBottom: 6 }}>
              Performance
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 8,
              padding: 14,
              borderRadius: "var(--radius)",
              background: "var(--surface-1)",
              border: "1px solid var(--border-muted)",
            }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "var(--fg-faint)", letterSpacing: 0.5, textTransform: "uppercase" }}>
                  <Trophy size={10} /> Meilleur mois
                </div>
                <div className="display num" style={{ fontSize: 18, color: stats.bestMonth && stats.bestMonth.pnl > 0 ? "var(--success)" : "var(--fg-muted)", marginTop: 2, letterSpacing: -0.3 }}>
                  {stats.bestMonth ? (
                    <>
                      {stats.bestMonth.pnl > 0 ? "+" : ""}{formatAmount(stats.bestMonth.pnl)}
                    </>
                  ) : (
                    "\u2014"
                  )}
                </div>
                <div className="mono" style={{ fontSize: 9, color: "var(--fg-faint)", marginTop: 2 }}>
                  {stats.bestMonth?.month ?? "\u2014"}
                </div>
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "var(--fg-faint)", letterSpacing: 0.5, textTransform: "uppercase" }}>
                  <Zap size={10} /> Record de victoires
                </div>
                <div className="display num" style={{ fontSize: 18, color: "var(--fg-strong)", marginTop: 2, letterSpacing: -0.3 }}>
                  {stats.bestWinStreak} <span style={{ fontSize: 11, color: "var(--fg-subtle)" }}>d'aff.</span>
                </div>
                <div className="mono" style={{ fontSize: 9, color: "var(--fg-faint)", marginTop: 2 }}>
                  Actuel&nbsp;: {stats.currentWinStreak}
                </div>
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "var(--fg-faint)", letterSpacing: 0.5, textTransform: "uppercase" }}>
                  <Target size={10} /> Taux de r\u00e9ussite
                </div>
                <div className="display num" style={{ fontSize: 18, color: "var(--fg-strong)", marginTop: 2, letterSpacing: -0.3 }}>
                  {Math.round(stats.winRate * 100)}<span style={{ fontSize: 11, color: "var(--fg-subtle)" }}>%</span>
                </div>
                <div className="mono" style={{ fontSize: 9, color: "var(--fg-faint)", marginTop: 2 }}>
                  sur {stats.totalDecided} pr\u00e9dictions
                </div>
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "var(--fg-faint)", letterSpacing: 0.5, textTransform: "uppercase" }}>
                  <TrendingUp size={10} /> PnL annualis\u00e9
                </div>
                <div className="display num" style={{ fontSize: 18, color: stats.annualizedPnL >= 0 ? "var(--success)" : "var(--danger)", marginTop: 2, letterSpacing: -0.3 }}>
                  {stats.annualizedPnL >= 0 ? "+" : ""}{stats.annualizedPnL.toFixed(1)}<span style={{ fontSize: 11, opacity: 0.7 }}>%</span>
                </div>
                <div className="mono" style={{ fontSize: 9, color: "var(--fg-faint)", marginTop: 2 }}>
                  Mise&nbsp;: {formatAmount(stats.totalInvested)}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* History */}
        <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 8, letterSpacing: 0.5 }}>
          {t("wallet.history")} ({bets.length})
        </div>

        {!betsLoaded && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card" style={{ padding: 10, display: "flex", alignItems: "center", gap: 10 }}>
                <Skeleton width={28} height={28} radius={6} />
                <div style={{ flex: 1 }}>
                  <Skeleton width="60%" height={11} style={{ marginBottom: 6 }} />
                  <Skeleton width="35%" height={9} />
                </div>
                <div style={{ textAlign: "right", width: 70 }}>
                  <Skeleton width="100%" height={11} style={{ marginBottom: 6 }} />
                  <Skeleton width="80%" height={9} style={{ marginLeft: "auto" }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {betsLoaded && bets.length === 0 && (
          <div style={{ textAlign: "center", padding: 20, color: "var(--fg-faint)", fontSize: 12 }}>
            {t("wallet.no_bets")}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {betsLoaded && bets.map((ub) => (
            <div key={ub.id} className="card" style={{ padding: 10, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
                background: ub.position === "YES" ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)" }}>
                {ub.position === "YES" ? <TrendingUp size={14} color="#34d399" /> : <TrendingDown size={14} color="#f87171" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {ub.position} · {formatAmount(ub.amount)} @ {Number(ub.odds).toFixed(3)}x
                </div>
                <div style={{ fontSize: 10, color: "#64748b" }}>
                  {new Date(ub.placed_at).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US")}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, fontWeight: 700,
                  color: ub.status === "WON" ? "#34d399" : ub.status === "LOST" ? "#f87171" : "#fbbf24" }}>
                  {ub.status}
                </div>
                <div style={{ fontSize: 10, color: "#94a3b8" }}>
                  {formatAmount(ub.potential_payout)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
