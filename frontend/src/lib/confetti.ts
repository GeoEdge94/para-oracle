import confetti from "canvas-confetti";

/**
 * Preset confetti scenes. Used sparingly — ethic rule: we celebrate
 * informed decisions, not gambling wins. Always symmetric with a
 * "missed" scene for losses so feedback is emotional but balanced.
 */

const EMERALD = ["#10b981", "#34d399", "#6ee7b7", "#a7f3d0", "#ffffff"];
const CORAL = ["#f87171", "#fca5a5", "#fde68a", "#fbbf24", "#ffffff"];

export function celebrate() {
  // Two wide bursts from the sides for a "premium" balanced feel
  const defaults = {
    spread: 55,
    ticks: 90,
    gravity: 0.9,
    decay: 0.93,
    startVelocity: 42,
    colors: EMERALD,
  } as const;
  confetti({ ...defaults, angle: 60, particleCount: 70, origin: { x: 0, y: 0.7 } });
  confetti({ ...defaults, angle: 120, particleCount: 70, origin: { x: 1, y: 0.7 } });
  // Top shimmer
  setTimeout(() => {
    confetti({
      particleCount: 40,
      spread: 120,
      startVelocity: 25,
      ticks: 70,
      origin: { x: 0.5, y: 0.1 },
      colors: EMERALD,
      gravity: 0.5,
      scalar: 0.9,
    });
  }, 180);
}

export function missedSpark() {
  // Gentle amber mist — "informative", not punishing
  confetti({
    particleCount: 40,
    spread: 45,
    startVelocity: 22,
    ticks: 60,
    origin: { x: 0.5, y: 0.4 },
    colors: CORAL,
    gravity: 1.2,
    scalar: 0.75,
    decay: 0.94,
  });
}

export function rankUp() {
  // Purple-emerald burst for rank-up moments
  confetti({
    particleCount: 120,
    spread: 110,
    startVelocity: 45,
    ticks: 100,
    origin: { y: 0.6 },
    colors: ["#a855f7", "#10b981", "#fbbf24", "#ffffff"],
    gravity: 0.8,
    scalar: 1.1,
  });
}
