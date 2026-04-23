import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts/core";
import "echarts-gl";
import { motion } from "framer-motion";
import type { Bet, BetMarketStats, UserBet } from "@/lib/api";

type Props = {
  bet: Bet;
  stats: BetMarketStats | null;
  positions: UserBet[];
};

function seed(slug: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < slug.length; i++) h = Math.imul(h ^ slug.charCodeAt(i), 16777619);
  h >>>= 0;
  return () => {
    h = Math.imul(h ^ (h >>> 15), h | 1);
    h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
    return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
  };
}

const AXIS_COLOR = "#334155";
const AXIS_LABEL_COLOR = "#64748b";
const BG = "transparent";

/**
 * Signature 3D carousel for a market — 3 cards, echarts-gl:
 *  1) NDVI distribution (scatter3D, emerald glow)
 *  2) Position pool (scatter3D with symbolSize variable, YES/NO colored)
 *  3) NDVI terrain surface (wireframe + viridis)
 * Matches the "Sales Report" Dribbble aesthetic with editorial metrics.
 */
export function Market3DSignature({ bet, stats, positions }: Props) {
  const resolvedValue = bet.resolved_value != null ? Number(bet.resolved_value) : null;
  const threshold = Number(bet.threshold_value);
  const yesVolume = stats ? Number(stats.yes_volume) : 0;
  const noVolume  = stats ? Number(stats.no_volume)  : 0;
  const totalVolume = yesVolume + noVolume;

  return (
    <div className="m3d-wrap">
      <Card
        title="NDVI Distribution"
        metric={resolvedValue != null ? resolvedValue : threshold}
        metricUnit={bet.threshold_unit}
        subMetricLabel={resolvedValue != null ? "measured" : "threshold"}
        subMetric={resolvedValue != null ? threshold : threshold}
        subMetricUnit={bet.threshold_unit}
        accent="#34d399"
        delay={0}
        echart={
          <ReactECharts
            echarts={echarts}
            option={scatterOption(bet.slug)}
            style={{ height: 240, width: "100%" }}
            notMerge
            lazyUpdate
          />
        }
        breakdown={[
          { label: "Period", value: `${bet.period_start.slice(5)} → ${bet.period_end.slice(5)}` },
          { label: "Index", value: bet.index_type },
          { label: "Region", value: bet.region_name.split(",")[0] },
        ]}
      />

      <Card
        title="Position Pool"
        metric={totalVolume}
        metricUnit="€"
        subMetricLabel="positions"
        subMetric={stats?.total_bets ?? positions.length}
        subMetricUnit=""
        accent="#60a5fa"
        delay={0.08}
        echart={
          <ReactECharts
            echarts={echarts}
            option={bubbleOption(bet.slug, yesVolume, noVolume, stats?.yes_count ?? 0, stats?.no_count ?? 0)}
            style={{ height: 240, width: "100%" }}
            notMerge
            lazyUpdate
          />
        }
        breakdown={[
          { label: "YES pool",  value: `${yesVolume.toFixed(0)} €`,  color: "var(--success)" },
          { label: "NO pool",   value: `${noVolume.toFixed(0)} €`,   color: "var(--danger)" },
          { label: "Implied",   value: `${Math.round(stats?.yes_pct ?? 50)}%` },
        ]}
      />

      <Card
        title="NDVI Terrain"
        metric={bet.ndvi_drop_threshold ? Math.abs(Number(bet.ndvi_drop_threshold)) : 0.3}
        metricUnit="Δ"
        subMetricLabel="direction"
        subMetric={bet.change_direction === "decrease" ? "↓ decrease" : "↑ increase"}
        subMetricUnit=""
        accent="#a855f7"
        delay={0.16}
        echart={
          <ReactECharts
            echarts={echarts}
            option={surfaceOption(bet.slug)}
            style={{ height: 240, width: "100%" }}
            notMerge
            lazyUpdate
          />
        }
        breakdown={[
          { label: "Oracle",   value: bet.ground_truth_source || "Sentinel-2" },
          { label: "Metric",   value: bet.metric || "NDVI" },
          { label: "Direction", value: bet.change_direction === "decrease" ? "below" : "above" },
        ]}
      />
    </div>
  );
}

function scatterOption(slug: string) {
  const rnd = seed(slug);
  const data: [number, number, number, number][] = [];
  for (let i = 0; i < 28; i++) {
    data.push([
      Math.round(rnd() * 180),
      Math.round(50 + rnd() * 450),
      Math.round(50 + rnd() * 180),
      2 + rnd() * 3,
    ]);
  }
  return {
    backgroundColor: BG,
    tooltip: { show: false },
    grid3D: {
      boxWidth: 120, boxDepth: 100, boxHeight: 90,
      viewControl: { autoRotate: true, autoRotateSpeed: 4, distance: 200, beta: 30, alpha: 12 },
      light: { main: { intensity: 1.2 }, ambient: { intensity: 0.3 } },
      axisLine: { lineStyle: { color: AXIS_COLOR } },
      axisPointer: { show: false },
      splitLine: { lineStyle: { color: AXIS_COLOR, opacity: 0.35 } },
      environment: BG,
    },
    xAxis3D: { type: "value", min: 0, max: 180, axisLabel: { color: AXIS_LABEL_COLOR, fontSize: 10, fontFamily: "Geist Mono" }, name: "" },
    yAxis3D: { type: "value", min: 50, max: 500, axisLabel: { color: AXIS_LABEL_COLOR, fontSize: 10, fontFamily: "Geist Mono" }, name: "" },
    zAxis3D: { type: "value", min: 50, max: 250, axisLabel: { color: AXIS_LABEL_COLOR, fontSize: 10, fontFamily: "Geist Mono" }, name: "" },
    series: [
      {
        type: "scatter3D",
        data,
        symbolSize: 10,
        itemStyle: {
          color: "#34d399",
          opacity: 0.9,
          borderColor: "#34d399",
          borderWidth: 0,
        },
        emphasis: { itemStyle: { color: "#6ee7b7" } },
      },
    ],
  };
}

function bubbleOption(slug: string, yesVol: number, noVol: number, yesN: number, noN: number) {
  const rnd = seed(slug + "pool");
  const total = yesVol + noVol;
  const bubbles: Array<{ name: string; value: [number, number, number, number]; itemStyle: { color: string; opacity: number } }> = [];

  // YES bubbles
  const yesCount = Math.max(yesN || 0, 1) + 2;
  for (let i = 0; i < yesCount; i++) {
    const w = (total > 0 ? yesVol / yesCount : 1) * (0.6 + rnd() * 0.8);
    const size = 8 + Math.sqrt(w) * 0.8;
    bubbles.push({
      name: `YES ${i}`,
      value: [rnd() * 180, 60 + rnd() * 380, 60 + rnd() * 180, size],
      itemStyle: { color: "#34d399", opacity: 0.85 },
    });
  }
  const noCount = Math.max(noN || 0, 1) + 2;
  for (let i = 0; i < noCount; i++) {
    const w = (total > 0 ? noVol / noCount : 1) * (0.6 + rnd() * 0.8);
    const size = 8 + Math.sqrt(w) * 0.8;
    bubbles.push({
      name: `NO ${i}`,
      value: [rnd() * 180, 60 + rnd() * 380, 60 + rnd() * 180, size],
      itemStyle: { color: "#f87171", opacity: 0.85 },
    });
  }
  // Neutral accent
  for (let i = 0; i < 4; i++) {
    bubbles.push({
      name: `n${i}`,
      value: [rnd() * 180, 60 + rnd() * 380, 60 + rnd() * 180, 6 + rnd() * 4],
      itemStyle: { color: "#a855f7", opacity: 0.7 },
    });
  }

  return {
    backgroundColor: BG,
    tooltip: { show: false },
    grid3D: {
      boxWidth: 120, boxDepth: 100, boxHeight: 90,
      viewControl: { autoRotate: true, autoRotateSpeed: 5, distance: 200, beta: 40, alpha: 14 },
      light: { main: { intensity: 1.4 }, ambient: { intensity: 0.5 } },
      axisLine: { lineStyle: { color: AXIS_COLOR } },
      axisPointer: { show: false },
      splitLine: { lineStyle: { color: AXIS_COLOR, opacity: 0.35 } },
      environment: BG,
    },
    xAxis3D: { type: "value", min: 0, max: 180, axisLabel: { color: AXIS_LABEL_COLOR, fontSize: 10, fontFamily: "Geist Mono" }, name: "" },
    yAxis3D: { type: "value", min: 50, max: 500, axisLabel: { color: AXIS_LABEL_COLOR, fontSize: 10, fontFamily: "Geist Mono" }, name: "" },
    zAxis3D: { type: "value", min: 50, max: 250, axisLabel: { color: AXIS_LABEL_COLOR, fontSize: 10, fontFamily: "Geist Mono" }, name: "" },
    series: [
      {
        type: "scatter3D",
        data: bubbles.map((b) => ({ value: b.value.slice(0, 3), symbolSize: b.value[3], itemStyle: b.itemStyle, name: b.name })),
        itemStyle: { borderWidth: 0 },
      },
    ],
  };
}

function surfaceOption(slug: string) {
  const rnd = seed(slug + "surface");
  // Generate a 28x28 smooth heightmap using a couple of gaussian humps
  const size = 28;
  const humps = [
    { cx: rnd() * size, cy: rnd() * size, amp: 40 + rnd() * 40, sig: 4 + rnd() * 3 },
    { cx: rnd() * size, cy: rnd() * size, amp: 30 + rnd() * 40, sig: 3 + rnd() * 3 },
    { cx: rnd() * size, cy: rnd() * size, amp: 22 + rnd() * 30, sig: 2.5 + rnd() * 2 },
  ];
  const data: [number, number, number][] = [];
  let zmin = Infinity, zmax = -Infinity;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let z = 0;
      for (const h of humps) {
        const dx = x - h.cx, dy = y - h.cy;
        z += h.amp * Math.exp(-(dx * dx + dy * dy) / (2 * h.sig * h.sig));
      }
      z += (rnd() - 0.5) * 4;
      data.push([x, y, z]);
      if (z < zmin) zmin = z;
      if (z > zmax) zmax = z;
    }
  }
  return {
    backgroundColor: BG,
    tooltip: { show: false },
    visualMap: {
      show: false,
      dimension: 2,
      min: zmin,
      max: zmax,
      inRange: {
        color: ["#1e293b", "#2563eb", "#0ea5e9", "#10b981", "#a3e635", "#fde047"],
      },
    },
    grid3D: {
      boxWidth: 120, boxDepth: 100, boxHeight: 80,
      viewControl: { autoRotate: true, autoRotateSpeed: 6, distance: 200, beta: 40, alpha: 20 },
      light: { main: { intensity: 1.6 }, ambient: { intensity: 0.4 } },
      axisLine: { lineStyle: { color: AXIS_COLOR } },
      axisPointer: { show: false },
      splitLine: { lineStyle: { color: AXIS_COLOR, opacity: 0.3 } },
      environment: BG,
    },
    xAxis3D: { type: "value", min: 0, max: size - 1, axisLabel: { color: AXIS_LABEL_COLOR, fontSize: 10, fontFamily: "Geist Mono" }, name: "" },
    yAxis3D: { type: "value", min: 0, max: size - 1, axisLabel: { color: AXIS_LABEL_COLOR, fontSize: 10, fontFamily: "Geist Mono" }, name: "" },
    zAxis3D: { type: "value", min: zmin, max: zmax, axisLabel: { color: AXIS_LABEL_COLOR, fontSize: 10, fontFamily: "Geist Mono" }, name: "" },
    series: [
      {
        type: "surface",
        wireframe: { show: true, lineStyle: { color: "#ffffff", opacity: 0.18 } },
        shading: "color",
        data,
      },
    ],
  };
}

function Card({
  title, metric, metricUnit, subMetricLabel, subMetric, subMetricUnit, accent, delay, echart, breakdown,
}: {
  title: string;
  metric: number | string | null;
  metricUnit: string;
  subMetricLabel: string;
  subMetric: number | string;
  subMetricUnit: string;
  accent: string;
  delay: number;
  echart: React.ReactNode;
  breakdown: Array<{ label: string; value: string; color?: string }>;
}) {
  const primary = useMemo(() => typeof metric === "number" ? metric.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) : String(metric ?? "—"), [metric]);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
      className="m3d-card"
    >
      <div className="m3d-head">
        <div className="m3d-title">{title}</div>
        <span className="m3d-dot" style={{ background: accent }} />
      </div>

      <div className="m3d-chart">{echart}</div>

      <div className="m3d-metrics">
        <div className="m3d-metric">
          <div className="m3d-metric-label mono">Measured</div>
          <div className="m3d-metric-value display num" style={{ color: accent }}>
            {primary}
            {metricUnit && <span className="m3d-metric-unit">{metricUnit}</span>}
          </div>
        </div>
        <div className="m3d-metric">
          <div className="m3d-metric-label mono">{subMetricLabel}</div>
          <div className="m3d-metric-value display num" style={{ color: "var(--fg-strong)" }}>
            {typeof subMetric === "number" ? subMetric.toLocaleString("fr-FR") : subMetric}
            {subMetricUnit && <span className="m3d-metric-unit">{subMetricUnit}</span>}
          </div>
        </div>
      </div>

      <div className="m3d-break">
        {breakdown.map((b) => (
          <div key={b.label} className="m3d-break-row">
            <span className="mono m3d-break-label">{b.label}</span>
            <span className="mono m3d-break-value" style={b.color ? { color: b.color } : undefined}>{b.value}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
