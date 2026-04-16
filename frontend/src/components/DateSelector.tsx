import { useMemo, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export type DatePreset = "T0" | "T1" | "today" | "custom";

type Props = {
  periodStart: string;
  periodEnd: string;
  selectedDate: string;
  onChange: (iso: string, preset: DatePreset) => void;
  affectedLayers: number;
};

function isoStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function yesterdayIso(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return isoStr(d);
}

export function DateSelector({ periodStart, periodEnd, selectedDate, onChange, affectedLayers }: Props) {
  const { t, ta } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const todayIso = useMemo(yesterdayIso, []);

  const months = ta("date.months_short");

  function formatShort(isoDate: string): string {
    const [y, m, d] = isoDate.split("-");
    return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y.slice(2)}`;
  }

  const activePreset: DatePreset =
    selectedDate === periodStart ? "T0" :
    selectedDate === periodEnd ? "T1" :
    selectedDate === todayIso ? "today" :
    "custom";

  function shift(days: number) {
    const d = new Date(selectedDate);
    d.setUTCDate(d.getUTCDate() + days);
    onChange(isoStr(d), "custom");
  }

  const plural = affectedLayers > 1 ? "s" : "";

  return (
    <div className="date-selector">
      <div className="date-selector-row">
        <button className="date-chip" data-active={activePreset === "T0"}
          onClick={() => onChange(periodStart, "T0")}
          title={t("date.period_start", { d: formatShort(periodStart) })}>
          <span className="date-chip-label">T0</span>
          <span className="date-chip-date">{formatShort(periodStart)}</span>
        </button>

        <button className="date-chip" data-active={activePreset === "T1"}
          onClick={() => onChange(periodEnd, "T1")}
          title={t("date.period_end", { d: formatShort(periodEnd) })}>
          <span className="date-chip-label">T1</span>
          <span className="date-chip-date">{formatShort(periodEnd)}</span>
        </button>

        <button className="date-chip" data-active={activePreset === "today"}
          onClick={() => onChange(todayIso, "today")}
          title={t("date.latest_imagery")}>
          <span className="date-chip-label">{t("date.today")}</span>
          <span className="date-chip-date">{formatShort(todayIso)}</span>
        </button>

        <button className="date-chip date-chip-cal"
          data-active={expanded || activePreset === "custom"}
          onClick={() => setExpanded((e) => !e)}
          title={t("date.custom_date")}>
          <Calendar size={13} />
        </button>
      </div>

      {expanded && (
        <div className="date-selector-custom">
          <button className="layer-panel-icon-btn" onClick={() => shift(-1)} title={t("date.prev_day")}>
            <ChevronLeft size={14} />
          </button>
          <input type="date" value={selectedDate} min={periodStart} max={todayIso}
            onChange={(e) => onChange(e.target.value, "custom")} className="date-input" />
          <button className="layer-panel-icon-btn" onClick={() => shift(1)} title={t("date.next_day")}>
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {affectedLayers > 0 && (
        <div className="date-hint">
          {t("date.affected", { n: affectedLayers, s: plural })}
        </div>
      )}
    </div>
  );
}
