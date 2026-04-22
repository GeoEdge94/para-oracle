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
      diffuse: pro ? 1.4 : 1.2,
      mapSamples: pro ? 60_000 : 16_000,
      mapBrightness: pro ? 9 : 4.6,
      mapBaseBrightness: pro ? 0.25 : 0.05,
      baseColor: pro ? [0.55, 0.68, 0.92] : [0.12, 0.18, 0.26],
      markerColor: mc,
      glowColor: pro ? [0.45, 0.6, 0.95] : [0.062, 0.3, 0.24],
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
      {/* Atmospheric halo — subtle outer glow so the sphere reads as a planet against dark bg */}
      {pro && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: "4%",
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 40% 38%, rgba(120,160,230,0.18) 0%, rgba(70,100,180,0.10) 42%, rgba(0,0,0,0) 68%)",
            filter: "blur(2px)",
            pointerEvents: "none",
          }}
        />
      )}
      {/* Outer soft glow ring */}
      {pro && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: "-4%",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(90,140,230,0) 48%, rgba(90,140,230,0.18) 52%, rgba(90,140,230,0) 70%)",
            filter: "blur(6px)",
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
