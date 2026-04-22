import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, Satellite, TrendingUp, TrendingDown, Clock, Users, Activity, ChevronRight } from "lucide-react";
import { API, type Bet, type BetMarketStats, type UserBet } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { PriceHistoryChart } from "@/components/PriceHistoryChart";
import { DepthChart } from "@/components/DepthChart";
import { MarketMeta } from "@/components/MarketMeta";
import { BoostedBadge } from "@/components/BoostedBadge";
import { NumberTicker } from "@/components/NumberTicker";
import { Avatar } from "@/components/Avatar";
import { Sparkline } from "@/components/Sparkline";
import { LocaleToggle } from "@/components/LocaleToggle";
import { StatusBadge } from "@/components/StatusBadge";
import { isBoosted, formatCountdown } from "@/lib/engage";

const CAT_COLORS: Record<string, string> = {
  deforestation: "#10b981", wildfire: "#f59e0b", flood: "#3b82f6",
  mining: "#a855f7", drought: "#ef4444", glacier: "#06b6d4",
  urbanization: "#f97316", water_quality: "#0ea5e9",
};

/**
 * Editorial market page — Polymarket × Bloomberg hybrid. Heavy on
 * typography (Instrument Serif title, Geist display prices), two-column
 * layout on desktop with main/side split, sticky "Prédire" CTA that
 * deep-links to /analysis/:slug for actual betting UI.
 */
export function Market() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { t, formatAmount, locale, betQ, betDesc } = useI18n();

  const [bet, setBet] = useState<Bet | null>(null);
  const [allBets, setAllBets] = useState<Bet[]>([]);
  const [stats, setStats] = useState<BetMarketStats | null>(null);
  const [positions, setPositions] = useState<UserBet[]>([]);

  useEffect(() => {
    API.getBet(slug).then((r) => setBet(r.data)).catch(() => {});
    API.marketStats(slug).then((r) => setStats(r.data)).catch(() => {});
    API.listUserBets(slug).then((r) => setPositions(r.data)).catch(() => {});
    API.listBets().then((r) => setAllBets(r.data)).catch(() => {});
  }, [slug]);

  const relatedMarkets = useMemo(() => {
    if (!bet) return [];
    return allBets
      .filter((b) => b.slug !== bet.slug && b.category === bet.category && b.status === "OPEN")
      .slice(0, 4);
  }, [allBets, bet]);

  const topPositions = useMemo(() => {
    return [...positions].sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 8);
  }, [positions]);

  if (!bet) {
    return (
      <div style={{ height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--fg-faint)" }}>
        {t("common.loading")}
      </div>
    );
  }

  const color = CAT_COLORS[bet.category] || "#8b5cf6";
  const boosted = isBoosted(bet.period_end, bet.status);
  const resolved = bet.status.startsWith("RESOLVED");
  const totalVolume = Number(stats?.total_volume ?? 0);
  const yesPct = Math.round(stats?.yes_pct ?? 50);

  return (
    <div style={{ height: "100dvh", overflowY: "auto", overflowX: "hidden", background: "var(--bg)", color: "var(--fg)" }}>
      {/* Editorial topbar */}
      <div style={{
        position: "sticky", top: 0, zIndex: 20,
        padding: "10px 14px", background: "rgba(5,8,15,0.85)", backdropFilter: "blur(12px)",
        display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--border-muted)",
      }}>
        <button onClick={() => navigate(-1)} className="topbar-icon-btn" aria-label={t("common.back")} style={{ width: 32, height: 32 }}>
          <ChevronLeft size={18} />
        </button>
        <span className="mono" style={{ fontSize: 10, color: "var(--fg-faint)", letterSpacing: 1.2, textTransform: "uppercase" }}>
          Market &nbsp;/&nbsp; <span style={{ color: "var(--fg-muted)" }}>{bet.slug}</span>
        </span>
        <span style={{ flex: 1 }} />
        {boosted && <BoostedBadge periodEnd={bet.period_end} status={bet.status} variant="pill" />}
        <LocaleToggle />
        <span className="topbar-sep" />
        <StatusBadge />
      </div>

      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "40px 16px 80px" }}>
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="mono" style={{ fontSize: 10, color: "var(--fg-faint)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: color }} />
              {bet.category.replace(/_/g, " ")}
            </span>
            <span style={{ margin: "0 10px", color: "var(--border)" }}>·</span>
            <span>{bet.region_name}</span>
            <span style={{ margin: "0 10px", color: "var(--border)" }}>·</span>
            <span>{bet.index_type}</span>
          </div>
          <h1 className="serif" style={{
            fontSize: "clamp(28px, 5vw, 52px)",
            lineHeight: 1.1,
            fontStyle: "italic",
            color: "var(--fg-strong)",
            maxWidth: 860,
            letterSpacing: -0.3,
            margin: 0,
            marginBottom: 12,
          }}>
            {betQ(bet)}
          </h1>
          {betDesc(bet) && (
            <p style={{ fontSize: 15, color: "var(--fg-muted)", lineHeight: 1.6, maxWidth: 680, margin: 0 }}>
              {betDesc(bet)}
            </p>
          )}

          {/* Hero metrics */}
          <div style={{ display: "flex", gap: 0, marginTop: 24, borderTop: "1px solid var(--border-muted)", borderBottom: "1px solid var(--border-muted)" }}>
            <HeroCell label="Implied YES">
              <div className="display num" style={{ fontSize: 32, color: resolved ? (bet.result_bool ? "var(--success)" : "var(--danger)") : "var(--fg-strong)", letterSpacing: -0.6 }}>
                <NumberTicker value={yesPct} suffix="%" />
              </div>
            </HeroCell>
            <HeroCell label="Volume total">
              <div className="display num" style={{ fontSize: 22, color: "var(--fg-strong)", letterSpacing: -0.3 }}>
                <NumberTicker value={totalVolume} decimals={0} locale={locale === "fr" ? "fr-FR" : "en-US"} />
                <span style={{ fontSize: 13, opacity: 0.6 }}> €</span>
              </div>
            </HeroCell>
            <HeroCell label="Positions">
              <div className="display num" style={{ fontSize: 22, color: "var(--fg-strong)", letterSpacing: -0.3 }}>
                <NumberTicker value={stats?.total_bets ?? 0} />
              </div>
            </HeroCell>
            <HeroCell label={resolved ? "Résolu" : "Ferme dans"}>
              <div className="display num" style={{ fontSize: 18, color: boosted ? "#fbbf24" : "var(--fg-strong)", letterSpacing: -0.3 }}>
                {resolved ? (
                  <span style={{ fontSize: 14, color: bet.result_bool ? "var(--success)" : "var(--danger)" }}>{bet.result_bool ? "YES" : "NO"}</span>
                ) : (
                  formatCountdown(bet.period_end)
                )}
              </div>
            </HeroCell>
          </div>
        </motion.div>

        {/* Main 2-col layout */}
        <div className="market-layout" style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: 24, marginTop: 28 }}>
          {/* MAIN column */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            style={{ display: "flex", flexDirection: "column", gap: 20 }}
          >
            {/* Price history chart */}
            <section>
              <SectionLabel>Price history</SectionLabel>
              <div style={{ background: "var(--surface-1)", border: "1px solid var(--border-muted)", borderRadius: "var(--radius)", padding: 14 }}>
                <PriceHistoryChart bet={bet} height={220} />
              </div>
            </section>

            {/* Depth chart */}
            <section>
              <SectionLabel>Order book</SectionLabel>
              <DepthChart stats={stats} />
            </section>

            {/* Editorial meta (criteria + sources) */}
            <section>
              <SectionLabel>Resolution</SectionLabel>
              <MarketMeta bet={bet} />
            </section>

            {/* Period timeline */}
            <section>
              <SectionLabel>Timeline</SectionLabel>
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                background: "var(--surface-1)",
                border: "1px solid var(--border-muted)",
                borderRadius: "var(--radius)",
                overflow: "hidden",
              }}>
                <TimelineCell icon={<Clock size={12} color="var(--fg-faint)" />} label="Period start" value={bet.period_start} />
                <TimelineCell icon={<Clock size={12} color="var(--fg-faint)" />} label="Period end" value={bet.period_end} />
                <TimelineCell icon={<Satellite size={12} color="var(--accent)" />} label="Oracle" value={bet.ground_truth_source || "Sentinel-2"} />
              </div>
            </section>
          </motion.div>

          {/* SIDE column */}
          <motion.aside
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            style={{ display: "flex", flexDirection: "column", gap: 20 }}
          >
            {/* CTA card */}
            <div style={{
              padding: 16,
              borderRadius: "var(--radius-lg)",
              background: `linear-gradient(145deg, ${color}12 0%, var(--surface-2) 70%)`,
              border: `1px solid ${color}35`,
            }}>
              <div className="bento-label">Action</div>
              <div className="serif" style={{ fontSize: 14, fontStyle: "italic", color: "var(--fg-muted)", margin: "4px 0 12px", lineHeight: 1.45 }}>
                {resolved ? "Marché résolu — revoir l'analyse NDVI" : "Place ta prédiction sur ce marché"}
              </div>
              <motion.button
                whileTap={{ scale: 0.97 }}
                whileHover={{ y: -1 }}
                transition={{ type: "spring", stiffness: 420, damping: 28 }}
                onClick={() => navigate(`/analysis/${bet.slug}`)}
                className="btn btn-primary"
                style={{ width: "100%", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                {resolved ? "Voir l'analyse" : "Prédire ce marché"} <ChevronRight size={14} />
              </motion.button>
            </div>

            {/* YES vs NO split */}
            {stats && totalVolume > 0 && (
              <div>
                <SectionLabel>YES vs NO</SectionLabel>
                <div style={{ padding: 14, background: "var(--surface-1)", border: "1px solid var(--border-muted)", borderRadius: "var(--radius)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 6 }}>
                    <span style={{ color: "var(--success)", display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 700 }}>
                      <TrendingUp size={11} /> YES {yesPct}%
                    </span>
                    <span style={{ color: "var(--danger)", display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 700 }}>
                      {100 - yesPct}% NO <TrendingDown size={11} />
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 2, height: 6, borderRadius: 3, overflow: "hidden", background: "var(--surface-2)", marginBottom: 8 }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${yesPct}%` }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} style={{ background: "var(--success)" }} />
                    <motion.div initial={{ width: 0 }} animate={{ width: `${100 - yesPct}%` }} transition={{ duration: 0.6, delay: 0.05, ease: [0.16, 1, 0.3, 1] }} style={{ background: "var(--danger)" }} />
                  </div>
                  <div className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--fg-faint)" }}>
                    <span>{stats.yes_count} positions YES</span>
                    <span>{stats.no_count} positions NO</span>
                  </div>
                </div>
              </div>
            )}

            {/* Top positions (social proof) */}
            {topPositions.length > 0 && (
              <div>
                <SectionLabel>
                  <Users size={11} style={{ verticalAlign: "middle", marginRight: 4 }} />
                  Top positions
                </SectionLabel>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {topPositions.map((p, i) => (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.25 + i * 0.03 }}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "6px 10px",
                        background: "var(--surface-1)",
                        border: "1px solid var(--border-muted)",
                        borderRadius: "var(--radius-sm)",
                      }}
                    >
                      <Avatar seed={p.user_pseudo ?? "anon"} size={20} radius={3} />
                      <span style={{ fontSize: 11, fontWeight: 600, flex: 1, color: "var(--fg)" }}>
                        {p.user_pseudo ?? "anon"}
                      </span>
                      <span className="mono" style={{
                        fontSize: 9, fontWeight: 700,
                        padding: "2px 5px",
                        borderRadius: 3,
                        background: p.position === "YES" ? "rgba(52,211,153,0.14)" : "rgba(248,113,113,0.14)",
                        color: p.position === "YES" ? "var(--success)" : "var(--danger)",
                      }}>
                        {p.position}
                      </span>
                      <span className="mono num" style={{ fontSize: 11, color: "var(--fg-muted)" }}>
                        {formatAmount(Number(p.amount))}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Related markets */}
            {relatedMarkets.length > 0 && (
              <div>
                <SectionLabel>
                  <Activity size={11} style={{ verticalAlign: "middle", marginRight: 4 }} />
                  Related markets
                </SectionLabel>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {relatedMarkets.map((r) => {
                    const rc = CAT_COLORS[r.category] || "#8b5cf6";
                    return (
                      <button
                        key={r.slug}
                        onClick={() => { navigate(`/market/${r.slug}`); window.scrollTo(0, 0); }}
                        style={{
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "8px 10px",
                          background: "var(--surface-1)",
                          border: "1px solid var(--border-muted)",
                          borderRadius: "var(--radius-sm)",
                          cursor: "pointer",
                          textAlign: "left",
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: 3, background: rc }} />
                        <span style={{ flex: 1, fontSize: 11, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.region_name}
                        </span>
                        <div style={{ width: 56, flexShrink: 0 }}>
                          <Sparkline seed={r.slug} color={rc} height={14} />
                        </div>
                        <ChevronRight size={11} color="var(--fg-faint)" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.aside>
        </div>
      </div>
    </div>
  );
}

function HeroCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, padding: "16px 18px", borderRight: "1px solid var(--border-muted)" }}>
      <div className="mono" style={{ fontSize: 9, color: "var(--fg-faint)", letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 600, marginBottom: 4 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mono" style={{ fontSize: 9, color: "var(--fg-faint)", letterSpacing: 1.3, textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>
      {children}
    </div>
  );
}

function TimelineCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ padding: 12, borderRight: "1px solid var(--border-muted)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 9, color: "var(--fg-faint)", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 3 }}>
        {icon} {label}
      </div>
      <div className="mono" style={{ fontSize: 12, color: "var(--fg-strong)", fontWeight: 600 }}>{value}</div>
    </div>
  );
}
