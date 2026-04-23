import { useEffect, useState } from "react";
import { Copy, ExternalLink, Shield } from "lucide-react";
import type { OracleEvidence } from "@/lib/api";

type Props = {
  evidence: OracleEvidence;
};

const AMOY_EXPLORER = "https://amoy.polygonscan.com/tx/";

function shortHash(s: string, head = 10, tail = 6): string {
  if (!s) return "";
  if (s.length <= head + tail + 3) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

function formatCountdown(targetIso: string): string {
  const target = new Date(targetIso).getTime();
  const now = Date.now();
  const diff = target - now;
  if (diff <= 0) return "window closed";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  return `${h}h ${m}m ${s}s`;
}

export function Web3Evidence({ evidence }: Props) {
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    if (!evidence.dispute_window_end) return;
    const tick = () => setCountdown(formatCountdown(evidence.dispute_window_end!));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [evidence.dispute_window_end]);

  if (!evidence.fingerprint_sha256 && !evidence.chain_tx_hash) return null;

  const gateway = (evidence.gateway_base || "https://gateway.pinata.cloud/ipfs/").replace(/\/$/, "") + "/";
  const explorerUrl = evidence.chain_tx_hash ? `${AMOY_EXPLORER}${evidence.chain_tx_hash}` : "";

  const copy = (s: string) => navigator.clipboard.writeText(s);

  const Row = ({ label, value, link, mono = true }: {
    label: string;
    value: string;
    link?: string;
    mono?: boolean;
  }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid #1e293b" }}>
      <span style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{
          fontSize: 11, color: "#cbd5e1",
          fontFamily: mono ? "monospace" : "inherit",
        }}>
          {shortHash(value)}
        </span>
        <button
          onClick={() => copy(value)}
          style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", padding: 2 }}
          title="Copy"
        >
          <Copy size={11} />
        </button>
        {link && (
          <a href={link} target="_blank" rel="noopener noreferrer" style={{ color: "#10b981" }}>
            <ExternalLink size={11} />
          </a>
        )}
      </div>
    </div>
  );

  const disputeColor = {
    NONE: "#64748b",
    PENDING: "#fbbf24",
    DISPUTED: "#ef4444",
    FINALIZED: "#10b981",
  }[evidence.dispute_status || "NONE"];

  return (
    <div style={{
      marginTop: 12,
      padding: 12,
      background: "rgba(16, 185, 129, 0.05)",
      border: "1px solid rgba(16, 185, 129, 0.2)",
      borderRadius: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <Shield size={13} color="#10b981" />
        <span style={{ fontSize: 12, fontWeight: 700, color: "#10b981" }}>Web3 Evidence</span>
        {evidence.chain_mock && (
          <span style={{
            marginLeft: "auto",
            fontSize: 9, padding: "1px 6px", borderRadius: 3,
            background: "#fbbf2422", color: "#fbbf24", fontWeight: 600,
          }}>
            MOCK CHAIN
          </span>
        )}
      </div>

      {evidence.fingerprint_sha256 && (
        <Row label="Fingerprint" value={evidence.fingerprint_sha256} />
      )}
      {evidence.data_cid && (
        <Row label="data.json (IPFS)" value={evidence.data_cid} link={`${gateway}${evidence.data_cid}`} />
      )}
      {evidence.script_cid && (
        <Row label="resolution_script.py" value={evidence.script_cid} link={`${gateway}${evidence.script_cid}`} />
      )}
      {evidence.schema_cid && (
        <Row label="schema_v1.json" value={evidence.schema_cid} link={`${gateway}${evidence.schema_cid}`} />
      )}
      {evidence.tls_proof_cid && (
        <Row label="TLS proof" value={evidence.tls_proof_cid} link={`${gateway}${evidence.tls_proof_cid}`} />
      )}
      {evidence.chain_tx_hash && (
        <Row label="Chain tx" value={evidence.chain_tx_hash} link={explorerUrl} />
      )}
      {evidence.resolution_id && (
        <Row label="Resolution ID" value={evidence.resolution_id} />
      )}

      {(evidence.bond_amount_usdc || evidence.dispute_status) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0 2px", fontSize: 11 }}>
          {evidence.bond_amount_usdc ? (
            <span style={{ color: "#94a3b8" }}>
              Bond <strong style={{ color: "#e2e8f0" }}>{evidence.bond_amount_usdc} USDC</strong>
            </span>
          ) : <span />}
          {evidence.dispute_status && (
            <span style={{
              padding: "2px 8px", borderRadius: 4,
              background: `${disputeColor}22`,
              color: disputeColor,
              fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.5,
            }}>
              {evidence.dispute_status}
              {evidence.dispute_status === "PENDING" && evidence.dispute_window_end && countdown && (
                <span style={{ marginLeft: 6, fontWeight: 500, opacity: 0.85 }}>· {countdown}</span>
              )}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
