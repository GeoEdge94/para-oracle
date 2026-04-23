import { useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

type Props = {
  seed: string;
  points?: number;
  height?: number;
  color?: string;
  trend?: "up" | "down" | "flat";
};

// Deterministic PRNG so each market's sparkline is stable across renders
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
 * Small deterministic sparkline used to communicate "this market has a
 * live history". Synthetic for now (no real price series backend-side),
 * but consistent per-market-slug so it feels authentic across renders.
 */
export function Sparkline({ seed, points = 32, height = 36, color = "var(--accent)", trend }: Props) {
  const data = useMemo(() => {
    const rnd = mulberry32(hashStr(seed));
    const drift = trend === "up" ? 0.55 : trend === "down" ? 0.45 : 0.5;
    let v = 50 + (rnd() - 0.5) * 20;
    const out: { i: number; v: number }[] = [];
    for (let i = 0; i < points; i++) {
      const step = (rnd() - drift) * 6;
      v = Math.max(8, Math.min(92, v + step));
      out.push({ i, v });
    }
    return out;
  }, [seed, points, trend]);

  const gradId = `spark-g-${hashStr(seed)}`;

  return (
    <div style={{ width: "100%", height }} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
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
