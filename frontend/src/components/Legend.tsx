type Props = {
  category: "ndvi" | "delta" | "mask";
};

/**
 * Mini legend shown when an NDVI-family layer is visible.
 * Uses the same color ramps as the backend pipeline (viridis / RdYlGn / binary).
 */
export function Legend({ category }: Props) {
  if (category === "mask") {
    return (
      <div className="legend">
        <div className="legend-title">Masque déforestation</div>
        <div className="legend-swatch">
          <span style={{ background: "#dc2626", width: 14, height: 14, borderRadius: 2, display: "inline-block" }} />
          <span style={{ fontSize: 10 }}>Δ NDVI &lt; -0.3</span>
        </div>
      </div>
    );
  }
  if (category === "delta") {
    return (
      <div className="legend">
        <div className="legend-title">Δ NDVI (T1 − T0)</div>
        <div className="legend-ramp legend-ramp-delta" />
        <div className="legend-scale">
          <span>-0.5</span>
          <span>0</span>
          <span>+0.5</span>
        </div>
      </div>
    );
  }
  return (
    <div className="legend">
      <div className="legend-title">NDVI</div>
      <div className="legend-ramp legend-ramp-ndvi" />
      <div className="legend-scale">
        <span>-1</span>
        <span>0</span>
        <span>+1</span>
      </div>
    </div>
  );
}
