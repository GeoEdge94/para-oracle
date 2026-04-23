import type { CSSProperties } from "react";

type Props = {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  style?: CSSProperties;
  className?: string;
};

export function Skeleton({ width = "100%", height = 12, radius = 6, style, className }: Props) {
  return (
    <span
      className={className}
      style={{
        display: "block",
        width,
        height,
        borderRadius: typeof radius === "number" ? radius : radius,
        background:
          "linear-gradient(90deg, rgba(30,41,59,0.6) 0%, rgba(51,65,85,0.9) 50%, rgba(30,41,59,0.6) 100%)",
        backgroundSize: "200% 100%",
        animation: "skeleton-shimmer 1.4s ease-in-out infinite",
        ...style,
      }}
    />
  );
}
