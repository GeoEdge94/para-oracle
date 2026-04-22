import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Share2, Compass } from "lucide-react";
import type { Bet, OracleResult } from "@/lib/api";
import { NumberTicker } from "@/components/NumberTicker";
import { celebrate, missedSpark } from "@/lib/confetti";
import { useI18n } from "@/lib/i18n";

type Props = {
  bet: Bet;
  result: OracleResult | null;
  userPosition?: "YES" | "NO" | null;
  loading: boolean;
  onClose: () => void;
};

const STEPS = [
  "engage.resolve_step_1",
  "engage.resolve_step_2",
  "engage.resolve_step_3",
  "engage.resolve_step_4",
];

export function ResolutionScene({ bet, result, userPosition, loading, onClose }: Props) {
  const { t, locale, formatAmount } = useI18n();
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<"loading" | "reveal">("loading");

  useEffect(() => {
    if (!loading && result) {
      // Let the last step finish before reveal
      setPhase("loading");
      setStep(0);
      const s1 = setTimeout(() => setStep(1), 350);
      const s2 = setTimeout(() => setStep(2), 900);
      const s3 = setTimeout(() => setStep(3), 1500);
      const reveal = setTimeout(() => setPhase("reveal"), 2100);
      return () => { clearTimeout(s1); clearTimeout(s2); clearTimeout(s3); clearTimeout(reveal); };
    }
    if (loading) {
      setPhase("loading");
      setStep(0);
      const s1 = setTimeout(() => setStep(1), 600);
      const s2 = setTimeout(() => setStep(2), 1500);
      return () => { clearTimeout(s1); clearTimeout(s2); };
    }
  }, [loading, result]);

  const win = !!(result && userPosition && ((result.resolved_outcome === "YES" && userPosition === "YES") || (result.resolved_outcome === "NO" && userPosition === "NO")));
  const resolved = !!result && phase === "reveal";

  useEffect(() => {
    if (phase === "reveal") {
      const id = setTimeout(() => (win ? celebrate() : missedSpark()), 150);
      return () => clearTimeout(id);
    }
  }, [phase, win]);

  const nfmt = (v: number, digits = 1) =>
    v.toLocaleString(locale === "fr" ? "fr-FR" : "en-US", { maximumFractionDigits: digits });

  return (
    <motion.div
      className="resolution-scene"
      data-tone={resolved ? (win ? "win" : "miss") : "loading"}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="rs-aurora" aria-hidden />
      <button className="rs-close" onClick={onClose} aria-label={t("common.close")}>
        <X size={16} />
      </button>

      <div className="rs-content">
        <AnimatePresence mode="wait">
          {phase === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}
            >
              <div className="rs-tone">{t("engage.resolve_loading")}</div>
              <div className="display" style={{ fontSize: 52, letterSpacing: -2, textAlign: "center" }}>
                {bet.region_name}
              </div>

              <div className="rs-loading-steps">
                {STEPS.map((key, i) => (
                  <div
                    key={key}
                    className="rs-loading-step"
                    data-state={i < step ? "done" : i === step ? "active" : "pending"}
                  >
                    <span style={{ opacity: i <= step ? 1 : 0.35 }}>
                      {i < step ? "✓" : i === step ? <LoadingDot /> : "○"}
                    </span>
                    <span>{t(key)}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {phase === "reveal" && result && (
            <motion.div
              key="reveal"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, width: "100%" }}
            >
              <div className="rs-tone">
                {userPosition ? (win ? t("engage.resolved_up") : t("engage.resolved_down")) : t("verdict.title")}
              </div>

              <motion.div
                className="rs-verdict"
                data-win={userPosition ? String(win) : undefined}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
              >
                {result.resolved_outcome}
              </motion.div>

              <div className="rs-subtitle">
                {bet.region_name} · {result.evidence.period.start.slice(0, 7)} → {result.evidence.period.end.slice(0, 7)}
              </div>

              <div className="rs-stats">
                <motion.div className="rs-stat" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                  <div className="rs-stat-label">{t("verdict.detected")}</div>
                  <div className="rs-stat-value">
                    <NumberTicker value={result.surface_deforestee_km2} decimals={1} suffix=" km²" />
                  </div>
                </motion.div>
                <motion.div className="rs-stat" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                  <div className="rs-stat-label">{t("betsheet.threshold")}</div>
                  <div className="rs-stat-value">{nfmt(result.threshold_km2, 0)} km²</div>
                </motion.div>
                <motion.div className="rs-stat" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                  <div className="rs-stat-label">Delta</div>
                  <div className="rs-stat-value" style={{ color: win ? "var(--success)" : "var(--danger)" }}>
                    {result.surface_deforestee_km2 > result.threshold_km2 ? "+" : ""}
                    {nfmt(result.surface_deforestee_km2 - result.threshold_km2)}
                  </div>
                </motion.div>
              </div>

              {userPosition && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  style={{ marginTop: 4, fontSize: 13, color: "var(--fg-muted)" }}
                >
                  {t("market.your_position")}: <strong style={{ color: win ? "var(--success)" : "var(--danger)" }}>{userPosition}</strong>
                </motion.div>
              )}

              <div className="rs-actions">
                <button className="rs-cta" onClick={() => onClose()}>
                  <Compass size={16} /> {t("betsheet.view_analysis")}
                </button>
                <button
                  className="rs-cta primary"
                  onClick={() => {
                    const shareText = `${result.resolved_outcome} · ${bet.region_name} · ${nfmt(result.surface_deforestee_km2, 0)} km² (seuil ${nfmt(result.threshold_km2, 0)}) — ParaOracle`;
                    if (navigator.share) navigator.share({ title: "ParaOracle", text: shareText }).catch(() => {});
                    else navigator.clipboard?.writeText(shareText);
                  }}
                >
                  <Share2 size={16} /> {t("engage.share_result")}
                </button>
              </div>

              {win && userPosition && (
                <div style={{ marginTop: 14, fontSize: 12, color: "var(--fg-subtle)" }}>
                  {formatAmount((result.surface_deforestee_km2 - result.threshold_km2) * 0)}
                  {/* kept minimal — payout already visible in VerdictPanel */}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function LoadingDot() {
  return (
    <motion.span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: "var(--accent)",
      }}
      animate={{ scale: [1, 1.5, 1], opacity: [0.6, 1, 0.6] }}
      transition={{ repeat: Infinity, duration: 1.1, ease: "easeInOut" }}
    />
  );
}
