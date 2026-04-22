import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Wallet as WalletIcon, Activity, Users, Flame, TrendingUp } from "lucide-react";
import { api, API, type Bet, type UserBet } from "@/lib/api";
import { WorldHexMap } from "@/components/WorldHexMap";
import { NumberTicker } from "@/components/NumberTicker";
import { useI18n } from "@/lib/i18n";

type Agg = {
  totalVolume: number;
  totalPositions: number;
  uniqueTraders: number;
  activePct: number;
  resolvedPct: number;
  biggest: number;
  last24hVol: number;
  volumeByMonth: number[];
};

function aggregate(bets: Bet[], all: UserBet[]): Agg {
  const now = Date.now();
  const WINDOW_24H = 24 * 3600 * 1000;
  const pseudos = new Set<string>();
  let totalVolume = 0, last24hVol = 0, biggest = 0;
  const byMonth: Record<string, number> = {};
  for (const p of all) {
    const amt = Number(p.amount);
    totalVolume += amt;
    if (p.user_pseudo) pseudos.add(p.user_pseudo);
    if (amt > biggest) biggest = amt;
    const t = new Date(p.placed_at).getTime();
    if (now - t < WINDOW_24H) last24hVol += amt;
    const month = p.placed_at.slice(0, 7);
    byMonth[month] = (byMonth[month] ?? 0) + amt;
  }
  const months = Object.keys(byMonth).sort();
  const volumeByMonth = months.map((m) => byMonth[m]);

  const openCount = bets.filter((b) => b.status === "OPEN").length;
  const resolvedCount = bets.filter((b) => b.status.startsWith("RESOLVED")).length;
  const total = bets.length || 1;
  return {
    totalVolume,
    totalPositions: all.length,
    uniqueTraders: pseudos.size,
    activePct: Math.round((openCount / total) * 100),
    resolvedPct: Math.round((resolvedCount / total) * 100),
    biggest,
    last24hVol,
    volumeByMonth,
  };
}

function Donut({ pct, color, label }: { pct: number; color: string; label: string }) {
  const size = 80;
  const strokeWidth = 7;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size}>
          <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} fill="none" />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            whileInView={{ strokeDashoffset: offset }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "Geist", fontWeight: 700, fontSize: 18, color: "var(--fg-strong)",
        }}>
          {pct}<span style={{ fontSize: 11, opacity: 0.6 }}>%</span>
        </div>
      </div>
      <div>
        <div className="mono" style={{ fontSize: 10, color: "var(--fg-muted)", fontWeight: 600 }}>
          {label}
        </div>
      </div>
    </div>
  );
}

function IconStatRow({
  icon, label, value, color,
}: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
      <div style={{
        width: 38, height: 38,
        borderRadius: 10,
        background: `${color}14`,
        border: `1px solid ${color}33`,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div className="mono" style={{ fontSize: 9, color: "var(--fg-faint)", letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 600 }}>
          {label}
        </div>
        <div className="display num" style={{ fontSize: 18, color: "var(--fg-strong)", letterSpacing: -0.3, lineHeight: 1.1, marginTop: 2 }}>
          {value}
        </div>
      </div>
    </div>
  );
}

function TimelineBar({ data }: { data: number[] }) {
  const max = Math.max(1, ...data);
  return (
    <div style={{
      display: "flex",
      alignItems: "flex-end",
      gap: 2,
      height: 36,
      padding: "0 12px",
    }}>
      {data.slice(-48).map((v, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${Math.max(4, (v / max) * 36)}px`,
            background: "linear-gradient(180deg, #fbbf24 0%, #10b981 50%, #60a5fa 100%)",
            borderRadius: 1,
            opacity: 0.75 + (i / 48) * 0.25,
          }}
        />
      ))}
    </div>
  );
}

export function OrionDashboard() {
  const { formatAmount, locale } = useI18n();
  const [bets, setBets] = useState<Bet[]>([]);
  const [all, setAll] = useState<UserBet[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await api.get<Bet[]>("/bets");
        if (cancelled) return;
        setBets(r.data);
        const userBets = await Promise.all(
          r.data.slice(0, 25).map((b) =>
            API.listUserBets(b.slug).then((rr) => rr.data).catch(() => [] as UserBet[])
          )
        );
        if (!cancelled) setAll(userBets.flat());
      } catch {}
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const agg = useMemo(() => aggregate(bets, all), [bets, all]);
  const loc = locale === "fr" ? "fr-FR" : "en-US";

  const topCat = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of bets) counts[b.category] = (counts[b.category] ?? 0) + 1;
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return best ? { name: best[0], count: best[1] } : null;
  }, [bets]);

  return (
    <section className="orion-section">
      <div className="orion-frame">
        <div className="orion-head">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 22, height: 22, borderRadius: 11,
              background: "linear-gradient(135deg, var(--accent), #60a5fa)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#031015",
            }}>P</div>
            <span className="mono" style={{ fontSize: 11, color: "var(--fg-muted)", letterSpacing: 1.3, textTransform: "uppercase", fontWeight: 700 }}>
              PARAORACLE
            </span>
          </div>
          <nav className="orion-nav mono">
            <a>Statistics</a>
            <a className="active">Overview</a>
            <a>Dashboard</a>
            <a>Analytics</a>
          </nav>
        </div>

        <div className="orion-body">
          {/* Left — big title + stats */}
          <div className="orion-left">
            <h2 className="display" style={{ fontSize: 36, letterSpacing: -1, margin: 0, color: "var(--fg-strong)" }}>
              General statistics
            </h2>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 6 }}>
              <span className="mono" style={{ fontSize: 10, color: "var(--fg-faint)", letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 600 }}>
                All positions
              </span>
              <span className="mono" style={{ fontSize: 9, color: "var(--fg-subtle)", letterSpacing: 0.5, padding: "2px 6px", border: "1px solid var(--hairline)", borderRadius: 3 }}>
                DETAIL →
              </span>
            </div>
            <div className="display num" style={{ fontSize: 54, letterSpacing: -2, lineHeight: 1, margin: "12px 0 28px", color: "var(--fg-strong)" }}>
              <NumberTicker value={agg.totalPositions} duration={1.2} locale={loc} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <IconStatRow
                icon={<WalletIcon size={17} color="#a855f7" />}
                label="Total volume"
                value={`${Math.round(agg.totalVolume).toLocaleString(loc)} €`}
                color="#a855f7"
              />
              <IconStatRow
                icon={<Activity size={17} color="var(--accent)" />}
                label="24h volume"
                value={`${Math.round(agg.last24hVol).toLocaleString(loc)} €`}
                color="#10b981"
              />
              <IconStatRow
                icon={<Flame size={17} color="#f59e0b" />}
                label="Top category"
                value={topCat ? `${topCat.name} · ${topCat.count}` : "—"}
                color="#f59e0b"
              />
              <IconStatRow
                icon={<Users size={17} color="#60a5fa" />}
                label="Unique traders"
                value={`${agg.uniqueTraders}`}
                color="#60a5fa"
              />
            </div>

            <div style={{ display: "flex", gap: 24, marginTop: 28, paddingTop: 18, borderTop: "1px solid var(--hairline)" }}>
              <Donut pct={agg.activePct} color="var(--accent)" label={`Active markets · ${bets.filter((b) => b.status === "OPEN").length}`} />
              <Donut pct={agg.resolvedPct} color="#60a5fa" label={`Resolved · ${bets.filter((b) => b.status.startsWith("RESOLVED")).length}`} />
            </div>
          </div>

          {/* Right — world hex map */}
          <div className="orion-map">
            <WorldHexMap bets={bets} />
          </div>
        </div>

        {/* Footer — sales timeline */}
        <div className="orion-foot">
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px" }}>
            <div>
              <div className="mono" style={{ fontSize: 9, color: "var(--fg-faint)", letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 600 }}>
                Activity
              </div>
              <div className="display num" style={{ fontSize: 22, color: "var(--fg-strong)", letterSpacing: -0.4 }}>
                {agg.biggest > 0 ? formatAmount(agg.biggest) : "—"}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <TimelineBar data={agg.volumeByMonth.length ? agg.volumeByMonth : [10, 20, 30, 25, 40, 55, 60, 45, 70, 80, 60, 50]} />
            </div>
            <div className="mono" style={{ fontSize: 10, color: "var(--fg-subtle)", display: "inline-flex", alignItems: "center", gap: 5 }}>
              <TrendingUp size={11} color="var(--success)" />
              live
            </div>
          </div>
        </div>

        <div className="orion-credit mono">
          PARAORACLE DATA VISUALISATION · {new Date().getFullYear()}
        </div>
      </div>
    </section>
  );
}
