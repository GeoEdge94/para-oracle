import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Trophy, Medal } from "lucide-react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { LocaleToggle } from "@/components/LocaleToggle";
import { Skeleton } from "@/components/Skeleton";

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
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api
      .get("/auth/leaderboard")
      .then((r) => {
        setEntries(r.data);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  return (
    <div style={{ minHeight: "100dvh", background: "var(--surface-1)", color: "var(--fg)" }}>
      <div style={{
        position: "sticky", top: 0, zIndex: 30,
        padding: "10px 14px", background: "var(--bg)",
        display: "flex", alignItems: "center", gap: 10,
        borderBottom: "1px solid var(--border-muted)",
      }}>
        <button
          onClick={() => navigate("/")}
          className="topbar-icon-btn"
          aria-label={t("common.back")}
          style={{ width: 32, height: 32 }}
        >
          <ChevronLeft size={18} />
        </button>
        <Trophy size={16} color="var(--warning)" />
        <span style={{ fontWeight: 700, fontSize: 14, flex: 1, color: "var(--fg-strong)" }}>{t("wallet.leaderboard")}</span>
        <LocaleToggle />
      </div>

      <div style={{ padding: "16px 14px", maxWidth: 480, margin: "0 auto" }}>
        {!loaded && (
          <>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card" style={{ padding: 12, marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
                <Skeleton width={32} height={32} radius={8} />
                <div style={{ flex: 1 }}>
                  <Skeleton width="45%" height={13} style={{ marginBottom: 6 }} />
                  <Skeleton width="30%" height={9} />
                </div>
                <div style={{ textAlign: "right", width: 90 }}>
                  <Skeleton width="100%" height={13} style={{ marginBottom: 6 }} />
                  <Skeleton width="60%" height={9} style={{ marginLeft: "auto" }} />
                </div>
              </div>
            ))}
          </>
        )}
        {loaded && entries.map((e, i) => {
          const pnl = e.total_won - e.total_lost;
          const isTop3 = i < 3;
          const medalColors = ["#fbbf24", "#94a3b8", "#cd7f32"];
          return (
            <motion.div
              key={e.pseudo}
              className="card"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              style={{
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
                <div className="num" style={{ fontSize: 14, fontWeight: 700, color: pnl >= 0 ? "var(--success)" : "var(--danger)" }}>
                  {pnl >= 0 ? "+" : ""}{formatAmount(pnl)}
                </div>
                <div style={{ fontSize: 10, color: "var(--fg-faint)" }}>
                  {t("wallet.pnl")}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
