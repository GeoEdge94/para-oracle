import { Info, X } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";

type Props = {
  /** Forced variant (defaults to "wallet" for Wallet page, "market" for Market). */
  variant?: "wallet" | "market" | "generic";
};

const STORAGE_KEY = "para_demo_banner_dismissed";

/**
 * Explicit "demo mode" banner. Surfaces the distinction:
 *   - Wallet placements = simulator (off-chain, 10k € virtual balance)
 *   - Oracle resolutions = REAL on-chain tx on Polygon Amoy testnet
 * Hiding ambiguity here is the main audit-trust concern. Dismissible but
 * reappears on a new session (sessionStorage).
 */
export function DemoModeBanner({ variant = "generic" }: Props) {
  const { locale } = useI18n();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return sessionStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
  });

  if (dismissed) return null;

  const titleFr = "Mode démonstration";
  const titleEn = "Demo mode";

  const bodyFr = {
    wallet: "Portefeuille simulateur — les placements de prédiction ne sont PAS on-chain. La résolution oracle EST réellement soumise sur Polygon Amoy testnet (tx vérifiables sur Polygonscan).",
    market: "Placement YES/NO simulé. Le fingerprint de résolution et la caution oracle sont réels on-chain (testnet Amoy).",
    generic: "Environnement de démonstration. Oracle on-chain réel (Polygon Amoy testnet) · portefeuille en simulateur · zéro valeur réelle en jeu.",
  };

  const bodyEn = {
    wallet: "Simulator wallet — prediction placements are NOT on-chain. Oracle resolutions ARE truly submitted on Polygon Amoy testnet (verifiable on Polygonscan).",
    market: "YES/NO placement simulated. Resolution fingerprint and oracle bond are real on-chain (Amoy testnet).",
    generic: "Demonstration environment. Real on-chain oracle (Polygon Amoy testnet) · simulator wallet · zero real money at stake.",
  };

  const title = locale === "fr" ? titleFr : titleEn;
  const body = (locale === "fr" ? bodyFr : bodyEn)[variant];

  function dismiss() {
    try { sessionStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
    setDismissed(true);
  }

  return (
    <div
      role="note"
      aria-label={title}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "10px 12px",
        margin: "8px 14px 0",
        background: "linear-gradient(90deg, rgba(251,191,36,0.08), rgba(251,191,36,0.03))",
        border: "1px solid rgba(251,191,36,0.35)",
        borderRadius: 10,
        color: "var(--fg-muted)",
        fontSize: 12,
        lineHeight: 1.45,
      }}
    >
      <Info size={14} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1 }}>
        <span style={{
          fontWeight: 700,
          color: "#fbbf24",
          marginRight: 6,
          letterSpacing: 0.2,
        }}>
          {title}
        </span>
        <span>{body}</span>
      </div>
      <button
        onClick={dismiss}
        aria-label={locale === "fr" ? "Fermer" : "Dismiss"}
        style={{
          background: "transparent",
          border: 0,
          color: "var(--fg-faint)",
          padding: 2,
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
