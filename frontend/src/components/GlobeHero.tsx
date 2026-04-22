import { useEffect, useRef } from "react";
import createGlobe from "cobe";

type Marker = { location: [number, number]; size: number };

type Props = {
  markers?: Marker[];
  size?: number;
  opacity?: number;
  /** Pro muted variant: no green glow, no large markers, darker base. */
  variant?: "pro" | "vivid";
};

/**
 * Cobe-based WebGL globe. "pro" variant (default): muted gray-blue earth,
 * no markers, barely-visible atmosphere glow. Feels like a real satellite
 * operations viewer. "vivid" keeps the original emerald accent.
 */
export function GlobeHero({ markers = [], size = 640, opacity = 1, variant = "pro" }: Props) {
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

    const globe = createGlobe(canvas, {
      devicePixelRatio: dpr,
      width: width * dpr,
      height: height * dpr,
      phi: 0,
      theta: 0.32,
      dark: 1,
      diffuse: pro ? 2.0 : 1.2,
      mapSamples: pro ? 38_000 : 16_000,
      mapBrightness: pro ? 2.2 : 4.6,
      mapBaseBrightness: 0.04,
      baseColor: pro ? [0.14, 0.17, 0.21] : [0.12, 0.18, 0.26],
      markerColor: pro ? [0.55, 0.62, 0.72] : [16 / 255, 185 / 255, 129 / 255],
      glowColor: pro ? [0.08, 0.11, 0.14] : [0.062, 0.3, 0.24],
      scale: 1,
      offset: [0, 0],
      // In pro mode markers are absent — the SVG constellation overlay
      // provides the network feel instead.
      markers: pro ? [] : markers,
      onRender: (state) => {
        if (pointerRef.current === null) phiRef.current += 0.0022;
        state.phi = phiRef.current;
        state.width = width * dpr;
        state.height = height * dpr;
      },
    });

    return () => globe.destroy();
  }, [markers, size, variant]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        maxWidth: "100%",
        aspectRatio: "1",
        opacity,
        contain: "layout paint size",
      }}
      aria-hidden
    />
  );
}
