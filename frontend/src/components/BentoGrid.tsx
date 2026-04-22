import type { CSSProperties, ReactNode } from "react";
import { motion } from "framer-motion";

type Variant = "default" | "accent" | "warn" | "info" | "purple";

export function BentoGrid({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div className="bento-grid" style={style}>{children}</div>;
}

type TileProps = {
  children: ReactNode;
  variant?: Variant;
  span?: 1 | 2 | 3 | 4;
  rows?: 1 | 2;
  onClick?: () => void;
  delay?: number;
  className?: string;
  style?: CSSProperties;
};

export function BentoTile({ children, variant = "default", span = 1, rows = 1, onClick, delay = 0, className = "", style }: TileProps) {
  const classes = [
    "bento-tile",
    span > 1 && `span-${span}`,
    rows > 1 && `rows-${rows}`,
    className,
  ].filter(Boolean).join(" ");

  const isBtn = !!onClick;
  const commonProps = {
    className: classes,
    style: { ...(isBtn ? { cursor: "pointer" } : {}), ...style },
    "data-variant": variant !== "default" ? variant : undefined,
  } as const;

  const content = (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, delay, ease: [0.16, 1, 0.3, 1] }}
      {...commonProps}
      {...(isBtn ? { whileHover: { y: -2 }, whileTap: { scale: 0.98 }, onClick, role: "button", tabIndex: 0 } : {})}
    >
      {children}
    </motion.div>
  );
  return content;
}
