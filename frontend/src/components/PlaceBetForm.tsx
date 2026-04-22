import { useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { API, type BetMarketStats } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useMissions } from "@/lib/engage";

type Props = {
  slug: string;
  betStatus: string;
  stats: BetMarketStats | null;
  onPlaced: () => void;
};

export function PlaceBetForm({ slug, betStatus, stats, onPlaced }: Props) {
  const { t, formatAmount } = useI18n();
  const { bump: bumpMission } = useMissions();
  const [position, setPosition] = useState<"YES" | "NO">("YES");
  const [amount, setAmount] = useState("");
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");

  if (betStatus !== "OPEN") return null;

  const amountNum = parseFloat(amount) || 0;
  const yesVol = (stats?.yes_volume ?? 0) + (position === "YES" ? amountNum : 0);
  const noVol = (stats?.no_volume ?? 0) + (position === "NO" ? amountNum : 0);
  const total = yesVol + noVol;
  const pool = position === "YES" ? yesVol : noVol;
  const estimatedOdds = pool > 0 ? Math.max(total / pool, 1.01) : 2.0;
  const estimatedPayout = amountNum * estimatedOdds;

  async function submit() {
    if (amountNum < 1) {
      setError(t("wallet.amount"));
      return;
    }
    setPlacing(true);
    setError("");
    try {
      const { data } = await API.placeBet(slug, position, amountNum);
      toast.success(t("wallet.success"), {
        description: `${position} · ${formatAmount(amountNum)} @ ${data.odds.toFixed(3)}× → ${formatAmount(data.potential_payout)}`,
      });
      bumpMission("predict");
      setAmount("");
      onPlaced();
    } catch (e: any) {
      const msg = e?.response?.data?.detail || t("wallet.insufficient");
      setError(msg);
      toast.error(msg);
    } finally {
      setPlacing(false);
    }
  }

  return (
    <div className="place-bet-form">
      <div className="pbf-title">{t("wallet.place_bet")}</div>

      <div className="pbf-position-row">
        <button
          className={`pbf-pos-btn pbf-yes ${position === "YES" ? "active" : ""}`}
          onClick={() => setPosition("YES")}
        >
          <TrendingUp size={14} /> YES
        </button>
        <button
          className={`pbf-pos-btn pbf-no ${position === "NO" ? "active" : ""}`}
          onClick={() => setPosition("NO")}
        >
          <TrendingDown size={14} /> NO
        </button>
      </div>

      <div className="pbf-amount-row">
        <input
          type="number"
          min={1}
          step={10}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={t("wallet.amount")}
          className="pbf-input"
        />
        <div className="pbf-presets">
          {[10, 50, 100, 500].map((v) => (
            <button key={v} className="pbf-preset" onClick={() => setAmount(String(v))}>{v}</button>
          ))}
        </div>
      </div>

      {amountNum > 0 && (
        <div className="pbf-preview">
          <div className="pbf-preview-row">
            <span>{t("wallet.odds")}</span>
            <span style={{ fontWeight: 700 }}>{estimatedOdds.toFixed(3)}x</span>
          </div>
          <div className="pbf-preview-row">
            <span>{t("wallet.potential_payout")}</span>
            <span style={{ fontWeight: 700, color: "#34d399" }}>{formatAmount(estimatedPayout)}</span>
          </div>
        </div>
      )}

      {error && <div className="pbf-error">{error}</div>}

      <motion.button
        className="btn btn-primary"
        onClick={submit}
        disabled={placing || amountNum < 1}
        whileTap={{ scale: 0.97 }}
        whileHover={{ y: -1 }}
        transition={{ type: "spring", stiffness: 420, damping: 28 }}
        style={{ width: "100%", marginTop: 8 }}
      >
        {placing ? t("wallet.placing") : t("wallet.confirm")}
      </motion.button>
    </div>
  );
}
