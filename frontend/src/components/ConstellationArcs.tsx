import { useMemo } from "react";

type Props = {
  size?: number;
  opacity?: number;
  count?: number;
  seed?: number;
  accent?: string;
};

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Floating SVG overlay that draws thin curved arcs between random points
 * on an invisible sphere. Used on the Login hero to give a "pro satellite
 * network" feel without gaming-style glowing dots.
 *
 * Each arc is a quadratic curve with an animated stroke-dashoffset for a
 * subtle "transmission" effect. Muted emerald accent at ~22% opacity.
 */
export function ConstellationArcs({ size = 640, opacity = 1, count = 14, seed = 7, accent = "#34d399" }: Props) {
  const arcs = useMemo(() => {
    const rnd = mulberry32(seed);
    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.46; // inside the globe sphere

    function pointOnSphere() {
      // Slight bias toward the visible hemisphere
      const angle = rnd() * Math.PI * 2;
      const radius = r * (0.5 + rnd() * 0.48);
      return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius * 0.88 };
    }

    const out: Array<{ d: string; delay: number; duration: number; stroke: string; sw: number; opacity: number }> = [];
    for (let i = 0; i < count; i++) {
      const p1 = pointOnSphere();
      const p2 = pointOnSphere();
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      // Lift the midpoint out of the sphere to simulate an arc in 3D
      const vx = mx - cx;
      const vy = my - cy;
      const len = Math.hypot(vx, vy) || 1;
      const lift = 20 + rnd() * 60;
      const cxq = mx + (vx / len) * lift;
      const cyq = my + (vy / len) * lift;
      out.push({
        d: `M${p1.x.toFixed(1)} ${p1.y.toFixed(1)} Q${cxq.toFixed(1)} ${cyq.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`,
        delay: rnd() * 4,
        duration: 2.5 + rnd() * 3,
        stroke: i % 4 === 0 ? "#60a5fa" : accent,
        sw: 0.8 + rnd() * 0.6,
        opacity: 0.15 + rnd() * 0.35,
      });
    }
    return out;
  }, [size, count, seed, accent]);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ opacity, pointerEvents: "none" }}
      aria-hidden
      className="constellation-arcs"
    >
      <defs>
        <radialGradient id="const-fade" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id="const-mask">
          <rect x="0" y="0" width={size} height={size} fill="url(#const-fade)" />
        </mask>
      </defs>

      <g mask="url(#const-mask)">
        {arcs.map((a, i) => (
          <g key={i}>
            <path
              d={a.d}
              stroke={a.stroke}
              strokeWidth={a.sw}
              fill="none"
              opacity={a.opacity}
              strokeLinecap="round"
              strokeDasharray="5 120"
              style={{
                animation: `const-dash ${a.duration}s linear ${a.delay}s infinite`,
              }}
            />
            <path
              d={a.d}
              stroke={a.stroke}
              strokeWidth={a.sw * 0.5}
              fill="none"
              opacity={a.opacity * 0.3}
            />
          </g>
        ))}

        {/* Fixed data nodes at the arc endpoints for some arcs */}
        {arcs.slice(0, 8).map((a, i) => {
          const m = a.d.match(/M([\d.]+) ([\d.]+)/);
          if (!m) return null;
          const x = parseFloat(m[1]);
          const y = parseFloat(m[2]);
          return (
            <g key={`n${i}`}>
              <circle cx={x} cy={y} r={1.4} fill={a.stroke} opacity={0.7} />
              <circle cx={x} cy={y} r={3.5} fill="none" stroke={a.stroke} strokeWidth={0.5} opacity={0.25}>
                <animate attributeName="r" from="2" to="6" dur="2.4s" begin={`${a.delay}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.4" to="0" dur="2.4s" begin={`${a.delay}s`} repeatCount="indefinite" />
              </circle>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
