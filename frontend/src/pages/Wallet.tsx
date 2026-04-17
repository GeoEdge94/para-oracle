import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, RefreshCw, TrendingUp, TrendingDown, Wallet as WalletIcon } from "lucide-react";
import { API, type WalletBalance, type UserBet } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { LocaleToggle } from "@/components/LocaleToggle";

export function WalletPage() {
  const navigate = useNavigate();
  const { t, formatAmount, locale } = useI18n();
  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [bets, setBets] = useState<UserBet[]>([]);
  const [resetting, setResetting] = useState(false);

  function load() {
    API.walletBalance().then((r) => setWallet(r.data)).catch(() => {});
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
    });
  }

  useEffect(load, []);

  async function reset() {
    setResetting(true);
    try {
      await API.resetWallet();
      load();
    } finally {
      setResetting(false);
    }
  }

  if (!wallet) return <div style={{ padding: 20 }}>{t("common.loading")}</div>;

  const pnl = wallet.total_won - wallet.total_lost;
  const roi = wallet.total_lost > 0 ? (pnl / wallet.total_lost) * 100 : 0;

  return (
    <div style={{ minHeight: "100dvh", background: "#0f172a", color: "#e2e8f0" }}>
      <div style={{
        position: "sticky", top: 0, zIndex: 30,
        padding: "10px 14px", background: "#0a0f1a",
        display: "flex", alignItems: "center", gap: 10,
        borderBottom: "1px solid #1e293b",
      }}>
        <button onClick={() => navigate("/")} style={{ background: "none", border: "none", color: "#cbd5e1", padding: 2 }}>
          <ChevronLeft size={20} />
        </button>
        <WalletIcon size={16} color="#10b981" />
        <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>{t("wallet.title")}</span>
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
        <button className="btn btn-ghost" onClick={reset} disabled={resetting}
          style={{ width: "100%", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <RefreshCw size={14} /> {t("wallet.reset")}
        </button>

        {/* History */}
        <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 8, letterSpacing: 0.5 }}>
          {t("wallet.history")} ({bets.length})
        </div>

        {bets.length === 0 && (
          <div style={{ textAlign: "center", padding: 20, color: "#64748b", fontSize: 12 }}>
            {t("wallet.no_bets")}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {bets.map((ub) => (
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
