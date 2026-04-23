import { useEffect, useState } from "react";
import { animate, useMotionValue } from "framer-motion";

type Props = {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  style?: React.CSSProperties;
  locale?: string;
};

/**
 * Smooth number animation (spring/ease) for balances, odds, XP, etc.
 * Uses Framer Motion value + animate() to drive a tight render loop.
 */
export function NumberTicker({
  value,
  duration = 0.9,
  decimals = 0,
  prefix = "",
  suffix = "",
  className = "",
  style,
  locale = "fr-FR",
}: Props) {
  const mv = useMotionValue(0);
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    const controls = animate(mv, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate(v) {
        setDisplay(
          v.toLocaleString(locale, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          })
        );
      },
    });
    return () => controls.stop();
  }, [value, duration, decimals, locale, mv]);

  return (
    <span
      className={`num ${className}`}
      style={{ fontVariantNumeric: "tabular-nums", ...style }}
    >
      {prefix}
      {display}
      {suffix}
    </span>
  );
}
