import { useMemo, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

export type DatePreset = "T0" | "T1" | "today" | "custom";

type Props = {
  periodStart: string;       // ISO date (YYYY-MM-DD)
  periodEnd: string;
  selectedDate: string;      // ISO date currently applied to {date}-aware tiles
  onChange: (iso: string, preset: DatePreset) => void;
  affectedLayers: number;    // number of {date}-aware layers currently visible (hint)
};

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function yesterdayIso(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return iso(d);
}

function formatShort(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y.slice(2)}`;
}

export function DateSelector({ periodStart, periodEnd, selectedDate, onChange, affectedLayers }: Props) {
  const [expanded, setExpanded] = useState(false);
  const todayIso = useMemo(yesterdayIso, []);

  const activePreset: DatePreset =
    selectedDate === periodStart ? "T0" :
    selectedDate === periodEnd ? "T1" :
    selectedDate === todayIso ? "today" :
    "custom";

  function shift(days: number) {
    const d = new Date(selectedDate);
    d.setUTCDate(d.getUTCDate() + days);
    onChange(iso(d), "custom");
  }

  return (
    <div className="date-selector">
      <div className="date-selector-row">
        <button
          className="date-chip"
          data-active={activePreset === "T0"}
          onClick={() => onChange(periodStart, "T0")}
          title={`Début période : ${formatShort(periodStart)}`}
        >
          <span className="date-chip-label">T0</span>
          <span className="date-chip-date">{formatShort(periodStart)}</span>
        </button>

        <button
          className="date-chip"
          data-active={activePreset === "T1"}
          onClick={() => onChange(periodEnd, "T1")}
          title={`Fin période : ${formatShort(periodEnd)}`}
        >
          <span className="date-chip-label">T1</span>
          <span className="date-chip-date">{formatShort(periodEnd)}</span>
        </button>

        <button
          className="date-chip"
          data-active={activePreset === "today"}
          onClick={() => onChange(todayIso, "today")}
          title="Dernière imagerie disponible (J-1)"
        >
          <span className="date-chip-label">Aujourd'hui</span>
          <span className="date-chip-date">{formatShort(todayIso)}</span>
        </button>

        <button
          className="date-chip date-chip-cal"
          data-active={expanded || activePreset === "custom"}
          onClick={() => setExpanded((e) => !e)}
          title="Date personnalisée"
        >
          <Calendar size={13} />
        </button>
      </div>

      {expanded && (
        <div className="date-selector-custom">
          <button className="layer-panel-icon-btn" onClick={() => shift(-1)} title="Jour précédent">
            <ChevronLeft size={14} />
          </button>
          <input
            type="date"
            value={selectedDate}
            min={periodStart}
            max={todayIso}
            onChange={(e) => onChange(e.target.value, "custom")}
            className="date-input"
          />
          <button className="layer-panel-icon-btn" onClick={() => shift(1)} title="Jour suivant">
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {affectedLayers > 0 && (
        <div className="date-hint">
          {affectedLayers} couche{affectedLayers > 1 ? "s" : ""} NASA affectée{affectedLayers > 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
