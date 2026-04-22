import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, RefreshCw, TrendingUp, TrendingDown, Wallet as WalletIcon } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { API, type WalletBalance, type UserBet } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { LocaleToggle } from "@/components/LocaleToggle";
import { Skeleton } from "@/components/Skeleton";

export function WalletPage() {
  const navigate = useNavigate();
  const { t, formatAmount, locale } = useI18n();
  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [bets, setBets] = useState<UserBet[]>([]);
  const [betsLoaded, setBetsLoaded] = useState(false);
  const [resetting, setResetting] = useState(false);

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
        <WalletIcon size={16} color="var(--accent)" />
        <span style={{ fontWeight: 700, fontSize: 14, flex: 1, color: "var(--fg-strong)" }}>{t("wallet.title")}</span>
        <LocaleToggle />
      </div>

      <div style={{ padding: "16px 14px", maxWidth: 480, margin: "0 auto" }}>
        {/* Balance card */}
        <div className="card" style={{ marginBottom: 16, textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>{t("wallet.balance")}</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#10b981", margin: "8px 0" }}>
            {formatAmount(wallet.balance)}
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 24, fontSize: 12 }}>
            <div>
              <div style={{ color: "#94a3b8", fontSize: 10 }}>{t("wallet.total_won")}</div>
              <div style={{ color: "#34d399", fontWeight: 600 }}>+{formatAmount(wallet.total_won)}</div>
            </div>
            <div>
              <div style={{ color: "#94a3b8", fontSize: 10 }}>{t("wallet.total_lost")}</div>
              <div style={{ color: "#f87171", fontWeight: 600 }}>-{formatAmount(wallet.total_lost)}</div>
            </div>
            <div>
              <div style={{ color: "#94a3b8", fontSize: 10 }}>{t("wallet.pnl")}</div>
              <div style={{ color: pnl >= 0 ? "#34d399" : "#f87171", fontWeight: 600 }}>
                {pnl >= 0 ? "+" : ""}{formatAmount(pnl)}
              </div>
            </div>
          </div>
        </div>

        {/* Reset button */}
        <motion.button
          className="btn btn-ghost"
          onClick={reset}
          disabled={resetting}
          whileTap={{ scale: 0.98 }}
          whileHover={{ y: -1 }}
          transition={{ type: "spring", stiffness: 420, damping: 28 }}
          style={{ width: "100%", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
        >
          <RefreshCw size={14} /> {t("wallet.reset")}
        </motion.button>

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
                  {ub.position} · {formatAmount(ub.amount)} @ {ub.odds.toFixed(3)}x
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
    </div>
  );
}
