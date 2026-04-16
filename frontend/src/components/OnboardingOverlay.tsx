import { useState } from "react";
import { ChevronLeft, Layers, Calendar, GripHorizontal, Map, X } from "lucide-react";

const STEPS = [
  {
    icon: <Map size={20} />,
    title: "Carte interactive",
    desc: "Pincez pour zoomer, glissez pour naviguer dans la zone d'analyse.",
    anchor: "center",
  },
  {
    icon: <ChevronLeft size={20} />,
    title: "Retour",
    desc: "Appuyez ici pour revenir a la liste des paris.",
    anchor: "top-left",
  },
  {
    icon: <Calendar size={20} />,
    title: "Selecteur de date",
    desc: "Choisissez T0, T1 ou une date personnalisee pour voir l'evolution des couches satellite.",
    anchor: "top",
  },
  {
    icon: <Layers size={20} />,
    title: "Couches",
    desc: "Activez ou desactivez les couches NDVI, cadastres et imagerie satellite.",
    anchor: "bottom-right",
  },
  {
    icon: <GripHorizontal size={20} />,
    title: "Details du pari",
    desc: "Glissez vers le bas pour masquer, vers le haut pour afficher les details et le resultat.",
    anchor: "bottom",
  },
] as const;

type Props = { onDismiss: () => void };

export function OnboardingOverlay({ onDismiss }: Props) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="onboarding-overlay" onClick={(e) => e.stopPropagation()}>
      <div className="onboarding-backdrop" onClick={onDismiss} />

      <div className={`onboarding-card onboarding-${current.anchor}`}>
        <button className="onboarding-close" onClick={onDismiss}>
          <X size={16} />
        </button>

        <div className="onboarding-icon">{current.icon}</div>
        <div className="onboarding-title">{current.title}</div>
        <div className="onboarding-desc">{current.desc}</div>

        <div className="onboarding-footer">
          <div className="onboarding-dots">
            {STEPS.map((_, i) => (
              <span key={i} className={`onboarding-dot ${i === step ? "active" : ""}`} />
            ))}
          </div>
          <button
            className="onboarding-btn"
            onClick={() => (isLast ? onDismiss() : setStep(step + 1))}
          >
            {isLast ? "C'est parti !" : "Suivant"}
          </button>
        </div>
      </div>
    </div>
  );
}
