import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import { formatCountdown, getBoostTier } from "@/lib/engage";

type Props = {
  periodEnd: string;
  status: string;
  variant?: "pill" | "inline" | "ribbon";
  showMultiplier?: boolean;
  className?: string;
  style?: React.CSSProperties;
};

export function BoostedBadge({ periodEnd, status, variant = "pill", showMultiplier = true, className, style }: Props) {
  const [, setTick] = useState(0);
  // Re-render once per 30s for countdown updates. If sprint tier, per 1s.
  useEffect(() => {
    const tier = getBoostTier(periodEnd, status);
    if (tier === "none") return;
    const interval = tier === "sprint" ? 1000 : 30_000;
    const id = setInterval(() => setTick((t) => t + 1), interval);
    return () => clearInterval(id);
  }, [periodEnd, status]);

  const tier = getBoostTier(periodEnd, status);
  if (tier === "none") return null;

  const sprint = tier === "sprint";
  const color = sprint ? "#f87171" : "#fbbf24";
  const bg = sprint ? "rgba(248,113,113,0.14)" : "rgba(251,191,36,0.14)";
  const border = sprint ? "rgba(248,113,113,0.4)" : "rgba(251,191,36,0.38)";
  const label = sprint ? "CLOSING" : "J-1";

  if (variant === "inline") {
    return (
      <span
        className={`mono ${className ?? ""}`}
        style={{ color, fontSize: 10, fontWeight: 700, letterSpacing: 0.6, ...style }}
        title={`Market closes ${new Date(periodEnd + "T23:59:59Z").toUTCString()}`}
      >
        {label} · {formatCountdown(periodEnd)}
        {showMultiplier && <span style={{ opacity: 0.7, marginLeft: 4 }}>· +25% XP</span>}
      </span>
    );
  }

  if (variant === "ribbon") {
    return (
      <div
        className={`mono ${className ?? ""}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 10px",
          background: bg,
          borderBottom: `1px solid ${border}`,
          color,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.8,
          textTransform: "uppercase",
          width: "100%",
          ...style,
        }}
      >
        <Zap size={11} />
        <span>{label}</span>
        <span style={{ opacity: 0.6 }}>·</span>
        <span>{formatCountdown(periodEnd)}</span>
        {showMultiplier && (
          <>
            <span style={{ opacity: 0.6 }}>·</span>
            <span>+25% XP</span>
          </>
        )}
      </div>
    );
  }

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className={`mono ${className ?? ""}`}
      title={`Market closes ${new Date(periodEnd + "T23:59:59Z").toUTCString()}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 7px",
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: "var(--radius-sm)",
        color,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: 0.6,
        ...style,
      }}
    >
      <Zap size={9} />
      <span>{label}</span>
      <span style={{ opacity: 0.6 }}>·</span>
      <span>{formatCountdown(periodEnd)}</span>
    </motion.span>
  );
}
