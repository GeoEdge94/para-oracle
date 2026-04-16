import { useI18n } from "@/lib/i18n";

type Props = { category: "ndvi" | "delta" | "mask" };

export function Legend({ category }: Props) {
  const { t } = useI18n();

  if (category === "mask") {
    return (
      <div className="legend">
        <div className="legend-title">{t("legend.mask_title")}</div>
        <div className="legend-swatch">
          <span style={{ background: "#dc2626", width: 14, height: 14, borderRadius: 2, display: "inline-block" }} />
          <span style={{ fontSize: 10 }}>{t("legend.mask_label")}</span>
        </div>
      </div>
    );
  }
  if (category === "delta") {
    return (
      <div className="legend">
        <div className="legend-title">{t("legend.delta_title")}</div>
        <div className="legend-ramp legend-ramp-delta" />
        <div className="legend-scale"><span>-0.5</span><span>0</span><span>+0.5</span></div>
      </div>
    );
  }
  return (
    <div className="legend">
      <div className="legend-title">{t("legend.ndvi_title")}</div>
      <div className="legend-ramp legend-ramp-ndvi" />
      <div className="legend-scale"><span>-1</span><span>0</span><span>+1</span></div>
    </div>
  );
}
