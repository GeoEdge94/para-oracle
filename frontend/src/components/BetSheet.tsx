import { useEffect, useState } from "react";
import { X, ExternalLink } from "lucide-react";
import type { Bet, BetMarketStats, UserBetSummary } from "@/lib/api";
import { API } from "@/lib/api";
import { MarketStats } from "./MarketStats";

function statusBadge(status: string) {
  if (status === "RESOLVED_YES") return <span className="badge badge-yes">Resolu · YES</span>;
  if (status === "RESOLVED_NO") return <span className="badge badge-no">Resolu · NO</span>;
  return <span className="badge badge-open">{status}</span>;
}

export function BetSheet({ bet, onClose, onOpen }: { bet: Bet; onClose: () => void; onOpen: () => void }) {
  const [stats, setStats] = useState<BetMarketStats | null>(null);
  const [myBets, setMyBets] = useState<UserBetSummary | null>(null);

  useEffect(() => {
    API.marketStats(bet.slug).then((r) => setStats(r.data)).catch(() => {});
    API.myBets(bet.slug).then((r) => setMyBets(r.data)).catch(() => {});
  }, [bet.slug]);

  return (
    <div className="bottom-sheet">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{ flex: 1, marginRight: 12 }}>
          {statusBadge(bet.status)}
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 8, lineHeight: 1.4 }}>{bet.question}</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#94a3b8" }}>
          <X size={20} />
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        <div style={{ padding: 10, background: "#0f172a", borderRadius: 10 }}>
          <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase" }}>Periode</div>
          <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>
            {bet.period_start} → {bet.period_end}
          </div>
        </div>
        <div style={{ padding: 10, background: "#0f172a", borderRadius: 10 }}>
          <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase" }}>Seuil</div>
          <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>
            {bet.threshold_value} {bet.threshold_unit}
          </div>
        </div>
      </div>

      <MarketStats stats={stats} myBets={myBets} />

      {bet.resolved_value !== null && (
        <div style={{ padding: 10, background: "rgba(16,185,129,0.08)", borderRadius: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase" }}>Surface deforestee</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#34d399" }}>
            {Number(bet.resolved_value).toFixed(2)} km²
          </div>
        </div>
      )}

      <button className="btn btn-primary" onClick={onOpen} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <ExternalLink size={16} /> Voir l'analyse NDVI
      </button>
    </div>
  );
}
