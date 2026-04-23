import { useEffect, useRef } from "react";
import createGlobe from "cobe";

type Marker = { location: [number, number]; size: number };

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
        ? [0.14, 0.78, 0.56]   // emerald a bit more saturated so markers read
        : [16 / 255, 185 / 255, 129 / 255];

    const globe = createGlobe(canvas, {
      devicePixelRatio: dpr,
      width: width * dpr,
      height: height * dpr,
      phi: 0,
      theta: 0.28,
      dark: 1,
      diffuse: pro ? 1.2 : 1.2,
      mapSamples: pro ? 16_000 : 16_000,
      mapBrightness: pro ? 4 : 4.6,
      mapBaseBrightness: pro ? 0 : 0.05,
      baseColor: pro ? [0.28, 0.4, 0.62] : [0.12, 0.18, 0.26],
      markerColor: mc,
      glowColor: pro ? [0.4, 0.55, 0.9] : [0.062, 0.3, 0.24],
      scale: 1,
      offset: [0, 0],
      markers,
      onRender: (state) => {
        if (pointerRef.current === null) phiRef.current += rotationSpeed;
        state.phi = phiRef.current;
        state.width = width * dpr;
        state.height = height * dpr;
        onPhi?.(phiRef.current);
      },
    });

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
      }}
    >
      {/* Planet body — solid sphere surface w/ subtle rim light + terminator shadow */}
      {pro && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: "4%",
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 38% 32%, #3a5f9e 0%, #1f3a6e 28%, #0d1a36 62%, #05091a 86%, #030611 100%)",
            boxShadow:
              "inset -30px -40px 70px rgba(0, 0, 0, 0.55), inset 18px 22px 60px rgba(140, 180, 240, 0.10)",
            pointerEvents: "none",
          }}
        />
      )}
      {/* Outer atmosphere ring (thin halo beyond sphere edge) */}
      {pro && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: "-3%",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(90,140,230,0) 49%, rgba(110,160,240,0.28) 52%, rgba(60,100,190,0.12) 58%, rgba(90,140,230,0) 72%)",
            filter: "blur(4px)",
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
          opacity,
          contain: "layout paint size",
        }}
        aria-hidden
      />
    </div>
  );
}
