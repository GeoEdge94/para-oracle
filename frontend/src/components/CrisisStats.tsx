import type { Bet } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Props = { bets: Bet[] };

export function CrisisStats({ bets }: Props) {
  const { t } = useI18n();
  const open = bets.filter((b) => b.status === "OPEN").length;
  const resolvedYes = bets.filter((b) => b.status === "RESOLVED_YES").length;
  const resolvedNo = bets.filter((b) => b.status === "RESOLVED_NO").length;
  const byCat: Record<string, number> = {};
  for (const b of bets) byCat[b.category] = (byCat[b.category] || 0) + 1;
  const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="crisis-stats">
      <div className="cs-item">
        <span className="cs-live" />
        <span className="cs-label">{t("crisis.live")}</span>
      </div>
      <div className="cs-sep" />
      <div className="cs-item">
        <span className="cs-value">{bets.length}</span>
        <span className="cs-label">{t("crisis.markets")}</span>
      </div>
      <div className="cs-sep" />
      <div className="cs-item">
        <span className="cs-value" style={{ color: "#10b981" }}>{open}</span>
        <span className="cs-label">{t("crisis.open")}</span>
      </div>
      <div className="cs-sep" />
      <div className="cs-item">
        <span className="cs-value" style={{ color: "#34d399" }}>{resolvedYes}</span>
        <span className="cs-label">{t("crisis.yes")}</span>
      </div>
      <div className="cs-sep" />
      <div className="cs-item">
        <span className="cs-value" style={{ color: "#f87171" }}>{resolvedNo}</span>
        <span className="cs-label">{t("crisis.no")}</span>
      </div>
      {topCat && (
        <>
          <div className="cs-sep" />
          <div className="cs-item">
            <span className="cs-value" style={{ fontSize: 11 }}>{topCat[0].toUpperCase()}</span>
            <span className="cs-label">{t("crisis.top", { n: topCat[1] })}</span>
          </div>
        </>
      )}
    </div>
  );
}
