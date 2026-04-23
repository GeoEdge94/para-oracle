import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Search, SlidersHorizontal, Bookmark, Share2, Flame, Droplets, Pickaxe, Thermometer,
  Snowflake, Building2, Fish, TrendingUp, Trees,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { API, api, type Bet, type BetMarketStats } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { LocaleToggle } from "@/components/LocaleToggle";
import { NotificationsBell } from "@/components/NotificationsBell";
import { Avatar } from "@/components/Avatar";
import { BottomNav } from "@/components/BottomNav";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { BoostedBadge } from "@/components/BoostedBadge";
import { isBoosted } from "@/lib/engage";
import type { UserBet } from "@/lib/api";

const UNSPLASH = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=96&h=96&q=70`;

const CAT_META: Record<string, { color: string; icon: LucideIcon; image: string; i18nKey: string }> = {
  deforestation: { color: "#10b981", icon: Trees, image: UNSPLASH("1542601906990-b4d3fb778b09"), i18nKey: "categories.deforestation" },
  wildfire:      { color: "#f59e0b", icon: Flame, image: UNSPLASH("1600166898405-da9535204843"), i18nKey: "categories.wildfire" },
  flood:         { color: "#3b82f6", icon: Droplets, image: UNSPLASH("1547683905-f686c993aae5"), i18nKey: "categories.flood" },
  mining:        { color: "#a855f7", icon: Pickaxe, image: UNSPLASH("1581094288338-2314dddb7ece"), i18nKey: "categories.mining" },
  drought:       { color: "#ef4444", icon: Thermometer, image: UNSPLASH("1583212292454-1fe6229603b7"), i18nKey: "categories.drought" },
  glacier:       { color: "#06b6d4", icon: Snowflake, image: UNSPLASH("1531176175280-33e81d8ea784"), i18nKey: "categories.deforestation" },
  urbanization:  { color: "#f97316", icon: Building2, image: UNSPLASH("1486325212027-8081e485255e"), i18nKey: "categories.urban" },
  water_quality: { color: "#0ea5e9", icon: Fish, image: UNSPLASH("1502691876148-a84978e59af8"), i18nKey: "categories.water_quality" },
};

type BetStatsMap = Record<string, BetMarketStats | null>;

const TRENDING_KEY = "__trending__";
const BOOSTED_KEY = "__boosted__";

function useBetStats(bets: Bet[]): BetStatsMap {
  const [stats, setStats] = useState<BetStatsMap>({});
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      bets.slice(0, 30).map((b) =>
        API.marketStats(b.slug).then((r) => ({ slug: b.slug, data: r.data })).catch(() => ({ slug: b.slug, data: null }))
      )
    ).then((rows) => {
      if (cancelled) return;
      const map: BetStatsMap = {};
      for (const r of rows) map[r.slug] = r.data;
      setStats(map);
    });
    return () => { cancelled = true; };
  }, [bets]);
  return stats;
}

function monthDay(iso: string, locale: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US", { month: "short", day: "numeric" });
}

function useMyBetSlugs(bets: Bet[]) {
  const [mine, setMine] = useState<Set<string>>(new Set());
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      bets.slice(0, 30).map((b) =>
        API.myBets(b.slug).then((r) => ({ slug: b.slug, positions: r.data.positions || [] as UserBet[] })).catch(() => ({ slug: b.slug, positions: [] as UserBet[] }))
      )
    ).then((rows) => {
      if (cancelled) return;
      const s = new Set<string>();
      for (const r of rows) if (r.positions.length > 0) s.add(r.slug);
      setMine(s);
    });
    return () => { cancelled = true; };
  }, [bets]);
  return mine;
}

export function Home() {
  const navigate = useNavigate();
  const { t, locale, formatAmount } = useI18n();
  const [bets, setBets] = useState<Bet[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>(TRENDING_KEY);
  const [activeRegionChip, setActiveRegionChip] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem("para_bookmarks");
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  });

  useEffect(() => {
    API.listBets().then((r) => setBets(r.data)).catch(() => {});
  }, []);

  const stats = useBetStats(bets);
  const mine = useMyBetSlugs(bets);

  // Build category list from actual bets
  const categories = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of bets) counts[b.category] = (counts[b.category] || 0) + 1;
    const order = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    return [
      { key: TRENDING_KEY, label: t("engage.trending") },
      { key: BOOSTED_KEY, label: t("cmd.closes_today") },
      ...order.map((k) => ({ key: k, label: t(CAT_META[k]?.i18nKey ?? `categories.${k}`) })),
    ];
  }, [bets, t]);

  // Filter bets by selected category
  const catFiltered = useMemo(() => {
    if (activeCategory === TRENDING_KEY) {
      return [...bets].sort((a, b) => {
        const va = Number(stats[a.slug]?.total_volume ?? 0);
        const vb = Number(stats[b.slug]?.total_volume ?? 0);
        return vb - va;
      });
    }
    if (activeCategory === BOOSTED_KEY) {
      return bets.filter((b) => isBoosted(b.period_end, b.status));
    }
    return bets.filter((b) => b.category === activeCategory);
  }, [bets, activeCategory, stats]);

  // Sub-filter chips: unique top regions from current filter
  const regionChips = useMemo(() => {
    const regions = new Set<string>();
    for (const b of catFiltered) regions.add(b.region_name);
    return Array.from(regions).slice(0, 6);
  }, [catFiltered]);

  const displayed = useMemo(() => {
    if (!activeRegionChip) return catFiltered;
    return catFiltered.filter((b) => b.region_name === activeRegionChip);
  }, [catFiltered, activeRegionChip]);

  function toggleBookmark(slug: string, e: React.MouseEvent) {
    e.stopPropagation();
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      localStorage.setItem("para_bookmarks", JSON.stringify([...next]));
      return next;
    });
  }

  function openSearch() {
    window.dispatchEvent(new CustomEvent("open-command-palette"));
  }

  return (
    <div className="has-bottom-nav" style={{ height: "100dvh", overflowY: "auto", overflowX: "hidden", background: "var(--bg)" }}>
      {/* Topbar — logo + locale + notifications + avatar */}
      <div className="feed-topbar">
        <button
          onClick={() => navigate("/map")}
          className="feed-logo"
          style={{ background: "none", border: 0, cursor: "pointer", padding: 0 }}
          aria-label={t("home.dashboard")}
        >
          <span>Geo<span className="accent">Edge</span></span>
        </button>

        <div className="feed-topbar-actions">
          <LocaleToggle />
          <NotificationsBell bets={bets} myBets={[]} />
          <ConnectWalletButton />
          <button
            onClick={() => navigate("/wallet")}
            aria-label={t("wallet.title")}
            style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }}
          >
            <Avatar seed="demo" size={28} radius={14} />
          </button>
        </div>
      </div>

      {/* Category tabs (horizontal scroll) */}
      <div className="feed-cat-tabs">
        {categories.map((c) => (
          <button
            key={c.key}
            className={`feed-cat-tab${c.key === activeCategory ? " feed-cat-tab-active" : ""}`}
            onClick={() => { setActiveCategory(c.key); setActiveRegionChip(null); }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Search + filter + bookmark icons */}
      <div className="feed-search-row">
        <input
          className="feed-search-input"
          type="text"
          placeholder={t("cmd.search_placeholder")}
          onFocus={openSearch}
          readOnly
        />
        <button className="feed-search-icon-btn" aria-label={t("home.search")} onClick={() => navigate("/map")}>
          <SlidersHorizontal size={16} />
        </button>
        <button className="feed-search-icon-btn" aria-label="Bookmarks" onClick={() => setActiveCategory(BOOSTED_KEY)}>
          <Bookmark size={16} />
        </button>
      </div>

      {/* Region sub-chips */}
      {regionChips.length > 0 && (
        <div className="feed-chips">
          <button
            className={`feed-chip${activeRegionChip === null ? " feed-chip-active" : ""}`}
            onClick={() => setActiveRegionChip(null)}
          >
            {t("categories.all")}
          </button>
          {regionChips.map((r) => (
            <button
              key={r}
              className={`feed-chip${activeRegionChip === r ? " feed-chip-active" : ""}`}
              onClick={() => setActiveRegionChip((prev) => (prev === r ? null : r))}
            >
              {r}
            </button>
          ))}
        </div>
      )}

      {/* Market cards */}
      <div className="feed-list">
        {displayed.slice(0, 40).map((b, i) => {
          const meta = CAT_META[b.category] ?? CAT_META.deforestation;
          const s = stats[b.slug];
          const yesPct = s ? Math.round(s.yes_pct) : null;
          const volume = s ? Number(s.total_volume) : 0;
          const isMine = mine.has(b.slug);
          const isBookmarked = bookmarks.has(b.slug);
          const boosted = isBoosted(b.period_end, b.status);
          const yesLabel = yesPct !== null ? `${yesPct}%` : "—";
          const noPct = yesPct !== null ? 100 - yesPct : null;

          return (
            <motion.button
              key={b.slug}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.2), duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="feed-card"
              onClick={() => navigate(`/market/${b.slug}`)}
              style={{
                border: boosted ? `1px solid rgba(251,191,36,0.35)` : undefined,
              }}
            >
              <div className="feed-card-head">
                <div
                  className="feed-card-icon feed-card-icon-image"
                  style={{ background: `${meta.color}1f`, color: meta.color, borderColor: `${meta.color}4d` }}
                >
                  <img
                    src={meta.image}
                    alt=""
                    loading="lazy"
                    onError={(e) => {
                      const img = e.currentTarget as HTMLImageElement;
                      img.style.display = "none";
                      const fallback = img.nextElementSibling as HTMLElement | null;
                      if (fallback) fallback.style.display = "inline-flex";
                    }}
                  />
                  <span className="feed-card-icon-fallback" aria-hidden style={{ display: "none" }}>
                    <meta.icon size={18} />
                  </span>
                </div>
                <div className="feed-card-title">{b.question}</div>
                {boosted && <BoostedBadge periodEnd={b.period_end} status={b.status} variant="pill" />}
              </div>

              <div className="feed-card-row">
                <span className="feed-card-date">{monthDay(b.period_start, locale)}</span>
                <span
                  className="feed-card-pct"
                  style={{ color: meta.color, ["--pct" as string]: `${yesPct ?? 0}%` }}
                >
                  {yesLabel}
                </span>
                <div className="feed-card-buttons">
                  <span className="feed-btn-yes">{t("crisis.yes")}</span>
                  <span className="feed-btn-no">{t("crisis.no")}</span>
                </div>
              </div>

              {noPct !== null && (
                <div className="feed-card-row">
                  <span className="feed-card-date">{monthDay(b.period_end, locale)}</span>
                  <span
                    className="feed-card-pct"
                    style={{ color: "var(--fg-muted)", ["--pct" as string]: `${noPct}%` }}
                  >
                    {noPct}%
                  </span>
                  <div className="feed-card-buttons" aria-hidden>
                    <span className="feed-btn-yes" style={{ opacity: 0.35 }}>{t("crisis.yes")}</span>
                    <span className="feed-btn-no" style={{ opacity: 0.35 }}>{t("crisis.no")}</span>
                  </div>
                </div>
              )}

              <div className="feed-card-foot">
                <span className="feed-card-volume">
                  {volume > 0 ? `${formatAmount(volume)} Vol.` : meta.i18nKey ? t(meta.i18nKey) : b.index_type}
                </span>
                <div className="feed-card-foot-actions">
                  {isMine && (
                    <span
                      className="mono"
                      style={{ fontSize: 10, color: "var(--accent)", fontWeight: 700, letterSpacing: 0.4 }}
                      aria-label="Position ouverte"
                    >
                      ●
                    </span>
                  )}
                  <button
                    aria-label="Share"
                    onClick={(e) => {
                      e.stopPropagation();
                      const url = `${location.origin}/market/${b.slug}`;
                      const shown = () => toast.success(t("common.copied"), { description: url, duration: 2500, position: "top-right" });
                      if (navigator.clipboard?.writeText) {
                        navigator.clipboard.writeText(url).then(shown, shown);
                      } else {
                        shown();
                      }
                    }}
                  >
                    <Share2 size={14} />
                  </button>
                  <button
                    aria-label="Bookmark"
                    onClick={(e) => toggleBookmark(b.slug, e)}
                    style={{ color: isBookmarked ? "var(--accent)" : "inherit" }}
                  >
                    <Bookmark size={14} fill={isBookmarked ? "currentColor" : "none"} />
                  </button>
                </div>
              </div>
            </motion.button>
          );
        })}

        {displayed.length === 0 && bets.length > 0 && (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--fg-faint)", fontSize: 13 }}>
            {t("cmd.no_results")}
          </div>
        )}

        {bets.length === 0 && (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--fg-faint)", fontSize: 13 }}>
            {t("common.loading")}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
