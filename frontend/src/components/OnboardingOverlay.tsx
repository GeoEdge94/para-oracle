import { useState } from "react";
import { ChevronLeft, Layers, Calendar, GripHorizontal, Map, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const STEP_KEYS = [
  { icon: <Map size={20} />, titleKey: "onboarding.step0_title", descKey: "onboarding.step0_desc", anchor: "center" },
  { icon: <ChevronLeft size={20} />, titleKey: "onboarding.step1_title", descKey: "onboarding.step1_desc", anchor: "top-left" },
  { icon: <Calendar size={20} />, titleKey: "onboarding.step2_title", descKey: "onboarding.step2_desc", anchor: "top" },
  { icon: <Layers size={20} />, titleKey: "onboarding.step3_title", descKey: "onboarding.step3_desc", anchor: "bottom-right" },
  { icon: <GripHorizontal size={20} />, titleKey: "onboarding.step4_title", descKey: "onboarding.step4_desc", anchor: "bottom" },
] as const;

type Props = { onDismiss: () => void };

export function OnboardingOverlay({ onDismiss }: Props) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const current = STEP_KEYS[step];
  const isLast = step === STEP_KEYS.length - 1;

  return (
    <div className="onboarding-overlay" onClick={(e) => e.stopPropagation()}>
      <div className="onboarding-backdrop" onClick={onDismiss} />

      <div className={`onboarding-card onboarding-${current.anchor}`}>
        <button className="onboarding-close" onClick={onDismiss}>
          <X size={16} />
        </button>

        <div className="onboarding-icon">{current.icon}</div>
        <div className="onboarding-title">{t(current.titleKey)}</div>
        <div className="onboarding-desc">{t(current.descKey)}</div>

        <div className="onboarding-footer">
          <div className="onboarding-dots">
            {STEP_KEYS.map((_, i) => (
              <span key={i} className={`onboarding-dot ${i === step ? "active" : ""}`} />
            ))}
          </div>
          <button className="onboarding-btn" onClick={() => (isLast ? onDismiss() : setStep(step + 1))}>
            {isLast ? t("common.letsgo") : t("common.next")}
          </button>
        </div>
      </div>
    </div>
  );
}
