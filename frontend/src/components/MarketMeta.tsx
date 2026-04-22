import { motion } from "framer-motion";
import { Satellite, FileText, ShieldCheck, ExternalLink } from "lucide-react";
import type { Bet } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Props = { bet: Bet };

const SOURCE_CATALOG: Record<string, { label: string; href: string; tint: string }> = {
  PRODES: { label: "PRODES · INPE", href: "https://www.terrabrasilis.dpi.inpe.br/app/dashboard/deforestation/biomes/legal_amazon/rates", tint: "#fbbf24" },
  DETER: { label: "DETER · INPE", href: "https://www.terrabrasilis.dpi.inpe.br/app/dashboard/alerts/legal/amazon/aggregated/", tint: "#fb923c" },
  NDVI: { label: "NDVI Pipeline · Sentinel-2", href: "https://dataspace.copernicus.eu", tint: "#10b981" },
  "sentinel-2": { label: "Sentinel-2 · ESA Copernicus", href: "https://dataspace.copernicus.eu", tint: "#10b981" },
};

/**
 * Editorial realism block: "Resolution criteria" + oracle badge +
 * sources with external links. Inspired by Polymarket context pages.
 */
export function MarketMeta({ bet }: Props) {
  const { t } = useI18n();
  const sources = (bet.proof_layers && bet.proof_layers.length > 0
    ? bet.proof_layers
    : [bet.ground_truth_source || "sentinel-2"]
  ).map((k) => SOURCE_CATALOG[k] ?? { label: k, href: "#", tint: "#60a5fa" });

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 12 }}
    >
      {/* Resolution criteria */}
      <div
        style={{
          padding: 14,
          borderRadius: "var(--radius)",
          background: "var(--surface-1)",
          border: "1px solid var(--border-muted)",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <FileText size={13} color="var(--fg-subtle)" />
          <span className="mono" style={{ fontSize: 9, color: "var(--fg-faint)", letterSpacing: 1.3, textTransform: "uppercase", fontWeight: 700 }}>
            Resolution criteria
          </span>
        </div>
        <div className="serif" style={{ fontSize: 14, color: "var(--fg-muted)", lineHeight: 1.5, fontStyle: "italic" }}>
          Résout <strong style={{ color: "var(--fg)", fontStyle: "normal" }}>YES</strong> si{" "}
          <strong className="mono" style={{ color: "var(--fg-strong)", fontStyle: "normal" }}>
            {bet.metric || "NDVI delta"}
          </strong>{" "}
          {bet.change_direction === "decrease" ? "diminue" : "augmente"} de plus de{" "}
          <strong className="mono" style={{ color: "var(--accent)", fontStyle: "normal" }}>
            {bet.threshold_value} {bet.threshold_unit}
          </strong>{" "}
          sur la période <span className="mono" style={{ color: "var(--fg)" }}>{bet.period_start}</span>
          {" → "}
          <span className="mono" style={{ color: "var(--fg)" }}>{bet.period_end}</span>, mesuré par imagerie satellite.
        </div>

        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          <span className="mono" style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "3px 8px", borderRadius: 4,
            background: "rgba(16,185,129,0.12)",
            border: "1px solid rgba(16,185,129,0.3)",
            color: "var(--success)",
            fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase",
          }}>
            <ShieldCheck size={10} /> Oracle: Sentinel-2
          </span>
          <span className="mono" style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "3px 8px", borderRadius: 4,
            background: "var(--surface-2)",
            border: "1px solid var(--border-muted)",
            color: "var(--fg-muted)",
            fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase",
          }}>
            <Satellite size={10} /> {bet.index_type}
          </span>
        </div>
      </div>

      {/* Sources */}
      <div>
        <div className="mono" style={{ fontSize: 9, color: "var(--fg-faint)", letterSpacing: 1.3, textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>
          Sources
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {sources.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 10px",
                borderRadius: "var(--radius-sm)",
                background: "var(--surface-1)",
                border: "1px solid var(--border-muted)",
                color: "var(--fg-muted)",
                fontSize: 12,
                textDecoration: "none",
                transition: "background 120ms",
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: 3, background: s.tint }} />
              <span className="mono" style={{ flex: 1, fontSize: 11 }}>{s.label}</span>
              <ExternalLink size={11} color="var(--fg-faint)" />
            </a>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
