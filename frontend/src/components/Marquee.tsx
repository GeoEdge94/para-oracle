import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  speedSeconds?: number;
  pauseOnHover?: boolean;
  fade?: boolean;
  direction?: "left" | "right";
  className?: string;
};

/**
 * Infinite marquee — duplicates children once, scrolls via CSS keyframes.
 * Pause on hover/focus. Gradient edge masks for seamless fade.
 */
export function Marquee({
  children,
  speedSeconds = 32,
  pauseOnHover = true,
  fade = true,
  direction = "left",
  className = "",
}: Props) {
  return (
    <div
      className={`mq-wrap ${fade ? "mq-fade" : ""} ${pauseOnHover ? "mq-pause" : ""} ${className}`}
      role="marquee"
      aria-live="off"
    >
      <div
        className="mq-track"
        style={{
          animationDuration: `${speedSeconds}s`,
          animationDirection: direction === "right" ? "reverse" : "normal",
        }}
      >
        <div className="mq-group" aria-hidden={false}>{children}</div>
        <div className="mq-group" aria-hidden>{children}</div>
      </div>
    </div>
  );
}
