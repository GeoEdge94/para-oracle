import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Bet } from "@/lib/api";

type Props = {
  bet: Bet;
  height?: number;
};

// Deterministic PRNG
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Implied YES% over the market's lifetime. Synthetic series (deterministic
 * from slug) with a deliberate drift toward the resolved outcome for
 * resolved markets. Renders as Polymarket-style chart with resolution
 * marker + tooltip.
 */
export function PriceHistoryChart({ bet, height = 180 }: Props) {
  const data = useMemo(() => {
    const rnd = mulberry32(hashStr(bet.slug));
    const start = new Date(bet.period_start + "T00:00:00Z").getTime();
    const end = new Date(bet.period_end + "T23:59:59Z").getTime();
    const resolved = bet.status.startsWith("RESOLVED");
    const target = resolved && bet.result_bool ? 88 : resolved ? 12 : 50;

    const samples = 64;
    const series: { t: number; d: string; y: number }[] = [];
    let v = 50 + (rnd() - 0.5) * 14;
    for (let i = 0; i < samples; i++) {
      // Mean-reverting random walk toward target (stronger as we approach end)
      const pullStrength = 0.05 + (i / samples) * 0.15;
      v = v + (target - v) * pullStrength + (rnd() - 0.5) * 8;
      v = Math.max(3, Math.min(97, v));
      const t = start + ((end - start) * i) / (samples - 1);
      const d = new Date(t);
      series.push({
        t,
        d: d.toISOString().slice(0, 10),
        y: Math.round(v * 10) / 10,
      });
    }
    return series;
  }, [bet.slug, bet.period_start, bet.period_end, bet.status, bet.result_bool]);

  const resolved = bet.status.startsWith("RESOLVED");
  const stroke = resolved ? (bet.result_bool ? "#34d399" : "#f87171") : "#10b981";
  const gradId = `price-g-${hashStr(bet.slug)}`;

  return (
    <div className="market-price-chart" style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 12, left: -6, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 2" stroke="#1e293b" vertical={false} />
          <XAxis
            dataKey="d"
            tick={{ fill: "#64748b", fontSize: 10, fontFamily: "var(--font-mono)" }}
            tickLine={false}
            axisLine={{ stroke: "#1e293b" }}
            minTickGap={40}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tick={{ fill: "#64748b", fontSize: 10, fontFamily: "var(--font-mono)" }}
            tickFormatter={(v) => `${v}%`}
            tickLine={false}
            axisLine={{ stroke: "#1e293b" }}
            width={36}
          />
          <Tooltip
            cursor={{ stroke: stroke, strokeDasharray: "3 3", strokeOpacity: 0.6 }}
            contentStyle={{
              background: "rgba(10,15,26,0.96)",
              border: "1px solid #334155",
              borderRadius: 8,
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: "#e2e8f0",
              boxShadow: "0 6px 18px rgba(0,0,0,0.4)",
            }}
            labelStyle={{ color: "#94a3b8", fontSize: 10, letterSpacing: 0.3 }}
            formatter={(value: number) => [`${value}% YES`, ""]}
            separator=""
          />
          <ReferenceLine
            y={50}
            stroke="#334155"
            strokeDasharray="4 4"
            strokeOpacity={0.6}
          />
          {resolved && (
            <ReferenceLine
              x={data[data.length - 1]?.d}
              stroke={stroke}
              strokeWidth={1.5}
              label={{ value: bet.result_bool ? "YES" : "NO", fill: stroke, fontSize: 10, fontFamily: "var(--font-mono)", position: "top" }}
            />
          )}
          <Area
            type="monotone"
            dataKey="y"
            stroke={stroke}
            strokeWidth={1.75}
            fill={`url(#${gradId})`}
            isAnimationActive
            animationDuration={700}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
