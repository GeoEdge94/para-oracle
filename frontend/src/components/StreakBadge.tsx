import { motion, AnimatePresence } from "framer-motion";
import { Flame, Snowflake } from "lucide-react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useStreak } from "@/lib/engage";
import { NumberTicker } from "@/components/NumberTicker";
import { useI18n } from "@/lib/i18n";

type Variant = "compact" | "full";

export function StreakBadge({ variant = "compact" }: { variant?: Variant }) {
  const { t } = useI18n();
  const { current, longest, activeToday, freezeUsedThisWeek } = useStreak();

  const dim = current === 0;
  const tooltipContent = (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: 2, minWidth: 180 }}>
      <div style={{ fontWeight: 700, fontSize: 12 }}>{t("engage.streak")}</div>
      <div style={{ color: "var(--fg-muted)", fontSize: 11 }}>
        {activeToday ? t("engage.streak_active_today") : t("engage.streak_come_back")}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 6, fontSize: 10, color: "var(--fg-faint)" }}>
        <span>Max: <strong className="num" style={{ color: "var(--fg)" }}>{longest}</strong></span>
        <span>
          {t("engage.streak_freeze")}:{" "}
          {freezeUsedThisWeek ? "✓" : "—"}
        </span>
      </div>
    </div>
  );

  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <motion.div
            className="streak-badge"
            data-dim={dim || undefined}
            data-active={activeToday || undefined}
            whileHover={{ y: -1 }}
            transition={{ type: "spring", stiffness: 420, damping: 26 }}
          >
            <motion.span
              className="streak-icon"
              animate={activeToday ? { rotate: [0, -8, 7, -4, 0] } : {}}
              transition={{ duration: 0.6, delay: 0.1 }}
              style={{ display: "inline-flex" }}
            >
              {freezeUsedThisWeek && !activeToday ? <Snowflake size={12} /> : <Flame size={12} />}
            </motion.span>
            <NumberTicker value={current} duration={0.5} />
            {variant === "full" && (
              <span style={{ fontSize: 10, color: "var(--fg-subtle)", marginLeft: 4 }}>
                {current <= 1 ? t("engage.streak_day") : t("engage.streak_days")}
              </span>
            )}
            <AnimatePresence>
              {activeToday && current > 0 && (
                <motion.span
                  key="glow"
                  className="streak-glow"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.6, 0.3] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                  aria-hidden
                />
              )}
            </AnimatePresence>
          </motion.div>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content className="tooltip-content" side="bottom" sideOffset={6}>
            {tooltipContent}
            <Tooltip.Arrow className="tooltip-arrow" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
