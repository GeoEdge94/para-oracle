import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Trophy, Medal } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { LocaleToggle } from "@/components/LocaleToggle";

type Entry = {
  pseudo: string;
  balance: number;
  total_won: number;
  total_lost: number;
};

export function LeaderboardPage() {
  const navigate = useNavigate();
  const { t, formatAmount } = useI18n();
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    api.get("/auth/leaderboard").then((r) => setEntries(r.data)).catch(() => {});
  }, []);

  return (
    <div style={{ minHeight: "100dvh", background: "#0f172a", color: "#e2e8f0" }}>
      <div style={{
        position: "sticky", top: 0, zIndex: 30,
        padding: "10px 14px", background: "#0a0f1a",
        display: "flex", alignItems: "center", gap: 10,
        borderBottom: "1px solid #1e293b",
      }}>
        <button onClick={() => navigate("/")} style={{ background: "none", border: "none", color: "#cbd5e1", padding: 2 }}>
          <ChevronLeft size={20} />
        </button>
        <Trophy size={16} color="#fbbf24" />
        <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>{t("wallet.leaderboard")}</span>
        <LocaleToggle />
      </div>

      <div style={{ padding: "16px 14px", maxWidth: 480, margin: "0 auto" }}>
        {entries.map((e, i) => {
          const pnl = e.total_won - e.total_lost;
          const isTop3 = i < 3;
          const medalColors = ["#fbbf24", "#94a3b8", "#cd7f32"];
          return (
            <div key={e.pseudo} className="card" style={{
              padding: 12, marginBottom: 8,
              display: "flex", alignItems: "center", gap: 12,
              border: isTop3 ? `1px solid ${medalColors[i]}33` : undefined,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: isTop3 ? `${medalColors[i]}18` : "#1e293b",
                fontSize: 14, fontWeight: 800, color: isTop3 ? medalColors[i] : "#64748b",
              }}>
                {isTop3 ? <Medal size={16} color={medalColors[i]} /> : i + 1}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{e.pseudo}</div>
                <div style={{ fontSize: 10, color: "#64748b" }}>
                  {t("wallet.balance")}: {formatAmount(e.balance)}
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: pnl >= 0 ? "#34d399" : "#f87171" }}>
                  {pnl >= 0 ? "+" : ""}{formatAmount(pnl)}
                </div>
                <div style={{ fontSize: 10, color: "#64748b" }}>
                  {t("wallet.pnl")}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
