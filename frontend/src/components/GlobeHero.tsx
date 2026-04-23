import { useEffect, useRef } from "react";
import createGlobe, { type COBEOptions } from "cobe";

type Marker = { location: [number, number]; size: number };
// cobe's onRender callback receives a mutable state object we can tweak each
// frame. The official COBEOptions type omits it, so we extend locally.
type CobeState = {
  phi: number;
  width: number;
  height: number;
};
type ExtendedCobeOptions = COBEOptions & { onRender?: (state: CobeState) => void };

type Props = {
  markers?: Marker[];
  size?: number;
  opacity?: number;
  /** Pro muted variant: no green glow, smaller markers, darker base. */
  variant?: "pro" | "vivid";
  /** Accent color for markers [r,g,b] in 0-1 range. Defaults to emerald. */
  markerColor?: [number, number, number];
  /** Autorotation speed (default 0.0022, set 0 to freeze) */
  rotationSpeed?: number;
  /** Optional phi callback fires every frame with current rotation angle */
  onPhi?: (phi: number) => void;
};

export function GlobeHero({
  markers = [],
  size = 640,
  opacity = 1,
  variant = "pro",
  markerColor,
  rotationSpeed = 0.0022,
  onPhi,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phiRef = useRef(0);
  const pointerRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = size;
    const height = size;

    const pro = variant === "pro";
    const mc: [number, number, number] = markerColor
      ? markerColor
      : pro
        ? [0.35, 1.0, 0.8]     // bright cyan-emerald — after screen blend over navy ocean reads as continents
        : [16 / 255, 185 / 255, 129 / 255];

    const globe = createGlobe(canvas, {
      devicePixelRatio: dpr,
      width: width * dpr,
      height: height * dpr,
      phi: 0,
      theta: 0.28,
      dark: 1,
      diffuse: 1.4,
      mapSamples: pro ? 40_000 : 16_000,
      mapBrightness: pro ? 26 : 4.6,
      baseColor: pro ? [0, 0, 0] : [0.12, 0.18, 0.26],
      markerColor: mc,
      glowColor: pro ? [0.45, 0.65, 1.0] : [0.062, 0.3, 0.24],
      scale: 1,
      offset: [0, 0],
      markers,
      onRender: (state: CobeState) => {
        if (pointerRef.current === null) phiRef.current += rotationSpeed;
        state.phi = phiRef.current;
        state.width = width * dpr;
        state.height = height * dpr;
        onPhi?.(phiRef.current);
      },
    } as ExtendedCobeOptions);

    return () => globe.destroy();
  }, [markers, size, variant, markerColor, rotationSpeed, onPhi]);

  const pro = variant === "pro";

  return (
    <div
      style={{
        position: "relative",
        width: `${size}px`,
        height: `${size}px`,
        maxWidth: "100%",
        isolation: "isolate",
      }}
    >
      {/* Outer atmosphere halo */}
      {pro && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: "-3%",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(120,160,230,0) 49%, rgba(120,170,240,0.30) 53%, rgba(70,110,200,0.12) 60%, rgba(120,160,230,0) 76%)",
            filter: "blur(4px)",
            pointerEvents: "none",
          }}
        />
      )}
      {/* Ocean body — navy sphere w/ day-side rim light + terminator shadow */}
      {pro && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: "3%",
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 38% 32%, #24407a 0%, #122a5a 30%, #081535 65%, #030a1e 100%)",
            boxShadow:
              "inset -30px -36px 80px rgba(0,0,0,0.55), inset 18px 22px 60px rgba(140,180,240,0.12)",
            pointerEvents: "none",
          }}
        />
      )}
      <canvas
        ref={canvasRef}
        style={{
          position: "relative",
          width: `${size}px`,
          height: `${size}px`,
          maxWidth: "100%",
          aspectRatio: "1",
          mixBlendMode: pro ? "lighten" : "normal",
          opacity,
        }}
        aria-hidden
      />
    </div>
  );
}
