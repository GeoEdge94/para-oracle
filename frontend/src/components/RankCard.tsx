import { motion } from "framer-motion";
import { RANKS, rankFor } from "@/lib/engage";
import { NumberTicker } from "@/components/NumberTicker";
import { useI18n } from "@/lib/i18n";

type Props = {
  xp: number;
  compact?: boolean;
};

const rankLabelKey: Record<string, string> = {
  obs: "engage.rank_obs",
  ana: "engage.rank_ana",
  for: "engage.rank_for",
  ora: "engage.rank_ora",
  grand: "engage.rank_grand",
};

export function RankCard({ xp, compact = false }: Props) {
  const { t } = useI18n();
  const { current, next, pct } = rankFor(xp);
  const tint = current.color;

  if (compact) {
    return (
      <div className="rank-chip" style={{ borderColor: `${tint}44`, background: `${tint}12`, color: tint }} title={t(rankLabelKey[current.key])}>
        <span style={{ fontSize: 11 }}>{current.icon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.3 }}>{t(rankLabelKey[current.key])}</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="rank-card"
      style={{
        background: `linear-gradient(145deg, ${tint}10 0%, var(--surface-2) 55%)`,
        border: `1px solid ${tint}35`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div className="rank-icon" style={{ background: `${tint}22`, color: tint }}>
          <span style={{ fontSize: 22 }}>{current.icon}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, color: "var(--fg-faint)", letterSpacing: 1, textTransform: "uppercase", fontWeight: 600 }}>
            {t("engage.rank")}
          </div>
          <div className="display" style={{ fontSize: 20, lineHeight: 1.1, color: tint, letterSpacing: -0.3 }}>
            {t(rankLabelKey[current.key])}
          </div>
          <div className="num" style={{ fontSize: 11, color: "var(--fg-muted)", marginTop: 3 }}>
            <NumberTicker value={xp} /> XP
          </div>
        </div>
      </div>

      <div className="rank-progress-wrap">
        <div className="rank-progress-track">
          <motion.div
            className="rank-progress-fill"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            style={{ background: `linear-gradient(90deg, ${tint}66, ${tint})` }}
          />
        </div>
        <div className="rank-progress-meta">
          {next ? (
            <>
              <span>
                {t("engage.rank_progress", { current: xp - current.min, next: current.max - current.min })}
              </span>
              <span style={{ color: tint }}>
                → {next.icon} {t(rankLabelKey[next.key])}
              </span>
            </>
          ) : (
            <span>{t("engage.rank_max")}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
