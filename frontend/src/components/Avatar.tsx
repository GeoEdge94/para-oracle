import { useMemo } from "react";
import { createAvatar } from "@dicebear/core";
import { thumbs } from "@dicebear/collection";

type Props = {
  seed: string;
  size?: number;
  radius?: number | string;
  className?: string;
  title?: string;
};

/**
 * Deterministic identicon from a pseudo/email/slug. Replaces generic
 * colored initials. Uses DiceBear "thumbs" — abstract, data-neutral.
 */
export function Avatar({ seed, size = 28, radius = 6, className = "", title }: Props) {
  const dataUri = useMemo(() => {
    return createAvatar(thumbs, {
      seed,
      size,
      radius: typeof radius === "number" ? radius : 0,
      backgroundType: ["gradientLinear"],
    }).toDataUri();
  }, [seed, size, radius]);

  return (
    <img
      src={dataUri}
      alt=""
      title={title ?? seed}
      width={size}
      height={size}
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: typeof radius === "number" ? radius : radius,
        flexShrink: 0,
        border: "1px solid var(--border-muted)",
        background: "var(--surface-1)",
      }}
      aria-hidden
    />
  );
}
