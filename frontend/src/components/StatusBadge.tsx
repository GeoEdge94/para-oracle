import { useEffect, useState } from "react";
import { Satellite, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";

type Status = {
  mode: "mock" | "live";
  copernicus_authenticated: boolean;
  copernicus_message: string;
};

export function StatusBadge() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    api.get<Status>("/oracle/status").then((r) => setStatus(r.data)).catch(() => {});
  }, []);

  if (!status) return null;

  const live = status.mode === "live" && status.copernicus_authenticated;
  return (
    <div className="status-badge" data-mode={live ? "live" : "mock"} title={status.copernicus_message}>
      {live ? <Satellite size={11} /> : <AlertCircle size={11} />}
      <span>{live ? "Copernicus LIVE" : "Mode démo"}</span>
    </div>
  );
}
