import { useEffect, useRef } from "react";
import createGlobe from "cobe";

type Marker = { location: [number, number]; size: number };

type Props = {
  markers?: Marker[];
  size?: number;
  opacity?: number;
};

// Cobe-based WebGL globe, positioned behind the login card as a hero.
// Slow autoroll + emerald glow for ParaOracle identity.
export function GlobeHero({ markers = [], size = 640, opacity = 1 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phiRef = useRef(0);
  const pointerRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = size;
    const height = size;

    const globe = createGlobe(canvas, {
      devicePixelRatio: dpr,
      width: width * dpr,
      height: height * dpr,
      phi: 0,
      theta: 0.28,
      dark: 1,
      diffuse: 1.2,
      mapSamples: 16_000,
      mapBrightness: 4.6,
      mapBaseBrightness: 0.08,
      baseColor: [0.12, 0.18, 0.26],
      markerColor: [16 / 255, 185 / 255, 129 / 255],
      glowColor: [0.062, 0.3, 0.24],
      scale: 1,
      offset: [0, 0],
      markers,
      onRender: (state) => {
        if (pointerRef.current === null) phiRef.current += 0.0026;
        state.phi = phiRef.current;
        state.width = width * dpr;
        state.height = height * dpr;
      },
    });

    return () => globe.destroy();
  }, [markers, size]);

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
