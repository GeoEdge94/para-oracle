import type { DeforestationZone } from "@/lib/api";

type Props = {
  zones: DeforestationZone[];
};

const SOURCE_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
  PRODES: { bg: "rgba(251, 191, 36, 0.10)", border: "#fbbf24", text: "#fbbf24", label: "PRODES (INPE)" },
  DETER:  { bg: "rgba(251, 146, 60, 0.10)", border: "#fb923c", text: "#fb923c", label: "DETER (INPE)" },
  NDVI:   { bg: "rgba(16, 185, 129, 0.10)", border: "#10b981", text: "#10b981", label: "Pipeline NDVI" },
};

export function EvidenceDetail({ zones }: Props) {
  if (!zones.length) return null;

  const totalSurface = zones.reduce((s, z) => s + Number(z.surface_km2), 0);
  const sorted = [...zones].sort((a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime());

  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase" }}>Zones detectees</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>
            {zones.length} zones · {totalSurface.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km²
          </div>
        </div>
      </div>

      <div style={{ position: "relative", paddingLeft: 16 }}>
        <div style={{ position: "absolute", left: 5, top: 0, bottom: 0, width: 2, background: "#334155", borderRadius: 1 }} />

        {sorted.map((z) => {
          const src = SOURCE_COLORS[z.source] || SOURCE_COLORS.NDVI;
          const conf = Number(z.confidence) * 100;

          return (
            <div key={z.id} style={{ position: "relative", marginBottom: 12, paddingLeft: 12 }}>
              <div style={{
                position: "absolute", left: -12, top: 6,
                width: 10, height: 10, borderRadius: "50%",
                background: src.border, border: "2px solid #1e293b",
              }} />

              <div style={{
                background: src.bg, border: `1px solid ${src.border}33`,
                borderRadius: 8, padding: 10,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>{z.zone_name}</span>
                  <span style={{
                    fontSize: 9, padding: "2px 6px", borderRadius: 4,
                    background: `${src.border}22`, color: src.text, fontWeight: 600,
                  }}>
                    {src.label}
                  </span>
                </div>

                <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>
                  <span>{new Date(z.detected_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}</span>
                  <span style={{ color: "#e2e8f0", fontWeight: 600 }}>
                    {Number(z.surface_km2).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km²
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10 }}>
                  <span style={{ color: "#64748b" }}>Confiance</span>
                  <div style={{ flex: 1, height: 4, background: "#334155", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{
                      width: `${conf}%`, height: "100%", borderRadius: 2,
                      background: conf >= 90 ? "#10b981" : conf >= 80 ? "#fbbf24" : "#fb923c",
                    }} />
                  </div>
                  <span style={{ color: "#94a3b8", fontWeight: 600 }}>{conf.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
