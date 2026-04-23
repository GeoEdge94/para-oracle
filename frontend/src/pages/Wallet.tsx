import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft, ArrowDownToLine, ArrowUpFromLine, Eye, EyeOff, ScanLine,
  Search as SearchIcon, ArrowUpRight, Filter as FilterIcon, Calendar, Link as LinkIcon,
  SlidersHorizontal, Bookmark,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { API, type WalletBalance, type UserBet, type Bet } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { LocaleToggle } from "@/components/LocaleToggle";
import { NumberTicker } from "@/components/NumberTicker";
import { Avatar } from "@/components/Avatar";
import { Sparkline } from "@/components/Sparkline";
import { BottomNav } from "@/components/BottomNav";
import { DemoModeBanner } from "@/components/DemoModeBanner";

type Range = "1D" | "1W" | "1M" | "1Y" | "YTD" | "ALL";
type Tab = "positions" | "open" | "history";

function formatUsd(amount: number, currency: string | undefined): string {
  if (currency === "tUSDC") return `${amount.toFixed(2)} tUSDC`;
  return `$${amount.toFixed(2)}`;
}

function shortAddr(addr: string, head = 6, tail = 4): string {
  if (!addr) return "";
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

export function WalletPage() {
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [bets, setBets] = useState<UserBet[]>([]);
  const [allMarkets, setAllMarkets] = useState<Bet[]>([]);
  const [betsLoaded, setBetsLoaded] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [range, setRange] = useState<Range>("ALL");
  const [tab, setTab] = useState<Tab>("history");
  const [search, setSearch] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  function load() {
    setLoadError(null);
    API.walletBalance()
      .then((r) => setWallet(r.data))
      .catch((err) => {
        const status = err?.response?.status;
        console.error("[wallet] balance fetch failed", status, err?.message);
        if (status === 401) {
          // Token invalid/stale → kick to login so user can re-auth.
          localStorage.removeItem("para_token");
          navigate("/login");
          return;
        }
        setLoadError(err?.message || "network");
      });

    setBetsLoaded(false);
    API.listBets().then(async (r) => {
      setAllMarkets(r.data);
      const collected: UserBet[] = [];
      await Promise.all(
        r.data.slice(0, 40).map((b) =>
          API.myBets(b.slug)
            .then((res) => collected.push(...(res.data.positions || [])))
            .catch(() => {})
        )
      );
      collected.sort((a, b) => new Date(b.placed_at).getTime() - new Date(a.placed_at).getTime());
      setBets(collected);
      setBetsLoaded(true);
    }).catch(() => setBetsLoaded(true));
  }
  useEffect(load, []);

  async function deposit() {
    setResetting(true);
    try {
      const res = await API.resetWallet();
      if (res.data?.explorer_url) {
        toast.success(t("wallet.deposit_ok"), {
          action: {
            label: "Polygonscan",
            onClick: () => window.open(res.data.explorer_url, "_blank"),
          },
        });
      } else {
        toast.success(t("wallet.deposit_ok"));
      }
      load();
    } catch {
      toast.error(t("auth.error"));
    } finally {
      setResetting(false);
    }
  }

  function withdraw() {
    toast.info(t("wallet.withdraw_soon"));
  }

  const pnl = wallet ? wallet.total_won - wallet.total_lost : 0;
  const pnlPositive = pnl >= 0;
  const pastDayPct = 0; // placeholder — no historical snapshotting yet

  const marketBySlug = useMemo(() => {
    const m = new Map<string, Bet>();
    for (const b of allMarkets) m.set(b.slug, b);
    return m;
  }, [allMarkets]);

  const visible = useMemo(() => {
    const q = search.toLowerCase().trim();
    const filtered = bets.filter((ub) => {
      if (tab === "open") return ub.status === "PENDING";
      if (tab === "positions") return ub.status === "PENDING";
      return true; // history: all
    });
    if (!q) return filtered;
    return filtered.filter((ub) => {
      const bet = marketBySlug.get(ub.bet_id || "");
      const label = bet?.region_name || bet?.question || ub.bet_id || "";
      return label.toLowerCase().includes(q);
    });
  }, [bets, tab, search, marketBySlug]);

  if (!wallet) {
    return (
      <div className="wl-loading">
        {loadError ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: 24 }}>
            <div style={{ color: "var(--fg-muted)", fontSize: 13, textAlign: "center" }}>
              {t("auth.error")}
              <div style={{ fontSize: 10, color: "var(--fg-faint)", marginTop: 4, fontFamily: "var(--font-mono)" }}>
                {loadError}
              </div>
            </div>
            <button
              onClick={load}
              style={{
                padding: "8px 16px",
                background: "var(--accent)",
                border: 0,
                borderRadius: 8,
                color: "#0a0f1a",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {t("common.back")}…  Retry
            </button>
          </div>
        ) : (
          <div className="wl-loading-spinner" />
        )}
      </div>
    );
  }

  const currency = wallet.currency || "EUR";
  const balance = wallet.balance;
  const onchain = wallet.mode === "onchain";

  return (
    <div className="has-bottom-nav wallet-pm">
      {/* Compact header: just back + locale */}
      <div className="wallet-pm-header">
        <button onClick={() => navigate(-1)} className="wallet-pm-back" aria-label={t("common.back")}>
          <ChevronLeft size={20} />
        </button>
        <div style={{ flex: 1 }} />
        <LocaleToggle />
        <button onClick={() => navigate("/")} aria-label={t("wallet.title")}>
          <Avatar seed={wallet.pseudo || "demo"} size={28} radius={14} />
        </button>
      </div>

      <DemoModeBanner variant="wallet" />

      <div className="wallet-pm-body">
        {/* HERO : portfolio balance + available to trade */}
        <div className="wallet-pm-hero">
          <div className="wallet-pm-hero-main">
            <div className="wallet-pm-label-row">
              <span className="wallet-pm-label">{t("wallet.portfolio")}</span>
              <button className="wallet-pm-scan" aria-label="Scan">
                <ScanLine size={14} />
              </button>
            </div>
            <div className="wallet-pm-balance">
              <span className="wallet-pm-balance-amount">
                {balanceHidden ? "••••" : formatUsd(balance, currency)}
              </span>
              <button
                onClick={() => setBalanceHidden((v) => !v)}
                className="wallet-pm-eye"
                aria-label={balanceHidden ? "Show" : "Hide"}
              >
                {balanceHidden ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>
            <div className="wallet-pm-hero-sub">
              {formatUsd(0, currency)} ({pastDayPct}%) {t("wallet.past_day")}
            </div>
          </div>

          <div className="wallet-pm-hero-aside">
            <div className="wallet-pm-label" style={{ textAlign: "right" }}>{t("wallet.available_trade")}</div>
            <div className="wallet-pm-avail">
              {balanceHidden ? "••••" : formatUsd(balance, currency)}
            </div>
          </div>
        </div>

        {/* CTA buttons */}
        <div className="wallet-pm-cta">
          <button className="wallet-pm-btn wallet-pm-btn-primary" onClick={deposit} disabled={resetting}>
            <ArrowDownToLine size={16} />
            <span>{resetting ? t("wallet.depositing") : t("wallet.deposit")}</span>
          </button>
          <button className="wallet-pm-btn wallet-pm-btn-ghost" onClick={withdraw}>
            <ArrowUpFromLine size={16} />
            <span>{t("wallet.withdraw")}</span>
          </button>
        </div>

        {/* PROFIT / LOSS card */}
        <div className="wallet-pm-card">
          <div className="wallet-pm-card-head">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="wallet-pm-pnl-dot" style={{ background: pnlPositive ? "var(--success)" : "var(--danger)" }} />
              <span className="wallet-pm-card-title">{t("wallet.pnl")}</span>
            </div>
            <div className="wallet-pm-ranges">
              {(["1D", "1W", "1M", "1Y", "YTD", "ALL"] as Range[]).map((r) => (
                <button
                  key={r}
                  className={`wallet-pm-range${range === r ? " wallet-pm-range-active" : ""}`}
                  onClick={() => setRange(r)}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="wallet-pm-card-body">
            <div>
              <div className="wallet-pm-pnl-row">
                <span className="wallet-pm-pnl-amount" style={{ color: pnlPositive ? "var(--success)" : "var(--danger)" }}>
                  {pnlPositive ? "+" : ""}{formatUsd(pnl, currency)}
                </span>
                <ArrowUpRight size={18} color={pnlPositive ? "var(--success)" : "var(--danger)"} style={{ transform: pnlPositive ? "none" : "rotate(90deg)" }} />
              </div>
              <div className="wallet-pm-pnl-sub">{range === "ALL" ? t("wallet.all_time") : range}</div>
            </div>
            <div className="wallet-pm-brand">
              {onchain ? (
                <span className="wallet-pm-brand-chip wallet-pm-brand-onchain">
                  <LinkIcon size={11} /> On-chain · Amoy
                </span>
              ) : (
                <span className="wallet-pm-brand-chip">Simulateur</span>
              )}
            </div>
          </div>

          <div className="wallet-pm-spark">
            <Sparkline seed={wallet.email || "demo"} color={pnlPositive ? "#10b981" : "#f87171"} height={56} />
          </div>
        </div>

        {/* Address + on-chain info block */}
        {onchain && wallet.wallet_address && (
          <div className="wallet-pm-onchain-meta">
            <div className="wallet-pm-onchain-row">
              <span className="wallet-pm-onchain-label">{t("wallet.address")}</span>
              <button
                className="wallet-pm-onchain-value mono"
                onClick={() => {
                  navigator.clipboard?.writeText(wallet.wallet_address || "");
                  toast.success(t("common.copied"));
                }}
              >
                {shortAddr(wallet.wallet_address)}
              </button>
            </div>
            <div className="wallet-pm-onchain-row">
              <span className="wallet-pm-onchain-label">{t("wallet.token")}</span>
              <a
                className="wallet-pm-onchain-value mono"
                href={`https://amoy.polygonscan.com/token/${wallet.token_contract}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                tUSDC · {shortAddr(wallet.token_contract || "")}
              </a>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="wallet-pm-tabs">
          {(["positions", "open", "history"] as Tab[]).map((tk) => (
            <button
              key={tk}
              className={`wallet-pm-tab${tab === tk ? " wallet-pm-tab-active" : ""}`}
              onClick={() => setTab(tk)}
            >
              {t(`wallet.tab_${tk}`)}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="wallet-pm-filters">
          <div className="wallet-pm-search">
            <SearchIcon size={13} />
            <input
              placeholder={t("wallet.search_placeholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="wallet-pm-filter-chip">
            <FilterIcon size={12} /> <span>{t("wallet.filter_all")}</span>
          </button>
          <button className="wallet-pm-filter-chip">
            <span>{t("wallet.filter_newest")}</span>
          </button>
          <button className="wallet-pm-filter-chip">
            <Calendar size={12} />
          </button>
        </div>

        {/* History list */}
        <div className="wallet-pm-history">
          {!betsLoaded && (
            <div className="wallet-pm-empty">{t("common.loading")}</div>
          )}
          {betsLoaded && visible.length === 0 && (
            <div className="wallet-pm-empty">{t("wallet.empty_history")}</div>
          )}
          {betsLoaded && visible.map((ub, i) => {
            const bet = marketBySlug.get(ub.bet_id || "");
            const label = bet?.region_name || bet?.question || ub.bet_id || "Market";
            const posColor = ub.position === "YES" ? "var(--success)" : "var(--danger)";
            const statusColor = ub.status === "WON" ? "var(--success)" : ub.status === "LOST" ? "var(--danger)" : "var(--fg-subtle)";
            return (
              <motion.button
                key={ub.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.2) }}
                className="wallet-pm-row"
                onClick={() => bet?.slug && navigate(`/market/${bet.slug}`)}
              >
                <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1, textAlign: "left" }}>
                  <span className="wallet-pm-row-title">{label}</span>
                  <span className="wallet-pm-row-sub">
                    <span style={{ color: posColor, fontWeight: 700 }}>{ub.position}</span>
                    <span style={{ opacity: 0.5, margin: "0 6px" }}>·</span>
                    <span>{formatUsd(Number(ub.amount), currency)}</span>
                    <span style={{ opacity: 0.5, margin: "0 6px" }}>·</span>
                    <span>{new Date(ub.placed_at).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", { month: "short", day: "numeric" })}</span>
                  </span>
                </div>
                <span className="wallet-pm-row-status" style={{ color: statusColor }}>
                  {ub.status}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
