import { useEffect, useState } from "react";
import { Copy, ExternalLink, Shield, Terminal, Download, ChevronDown, ChevronUp, CheckCircle2, Circle } from "lucide-react";
import type { OracleEvidence } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

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
  const { locale } = useI18n();
  const [countdown, setCountdown] = useState("");
  const [auditOpen, setAuditOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [auditStep, setAuditStep] = useState<0 | 1 | 2 | 3>(0);
  const [downloadedSize, setDownloadedSize] = useState<number | null>(null);

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

  const copy = (s: string, tag?: string) => {
    navigator.clipboard.writeText(s);
    setCopied(tag || s);
    setTimeout(() => setCopied(null), 1500);
  };

  const auditCmd = evidence.data_cid
    ? `curl -s ${gateway}${evidence.data_cid} > /tmp/data.json && python scripts/resolution_script.py /tmp/data.json`
    : "";

  async function downloadAudit() {
    if (!evidence.data_cid) return;
    setAuditStep(1);
    try {
      const res = await fetch(`${gateway}${evidence.data_cid}`);
      const blob = await res.blob();
      setDownloadedSize(blob.size);
      setAuditStep(2);
      // Browser download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "data.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setAuditStep(3);
    } catch {
      setAuditStep(0);
    }
  }

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
          fontFamily: mono ? "var(--font-mono)" : "inherit",
        }}>
          {shortHash(value)}
        </span>
        <button
          onClick={() => copy(value, label)}
          style={{ background: "transparent", border: "none", color: copied === label ? "#10b981" : "#64748b", cursor: "pointer", padding: 2 }}
          title="Copy"
          aria-label={`Copy ${label}`}
        >
          <Copy size={11} />
        </button>
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#10b981", display: "inline-flex" }}
            title={locale === "fr" ? "Ouvrir" : "Open"}
            aria-label={locale === "fr" ? `Ouvrir ${label}` : `Open ${label}`}
          >
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

  const i18n = locale === "fr" ? {
    title: "Preuve Web3",
    mock_chain: "MOCK CHAIN",
    fingerprint: "Fingerprint",
    data: "data.json (IPFS)",
    script: "resolution_script.py",
    schema: "schema_v1.json",
    tls: "TLS proof",
    tx: "Transaction on-chain",
    resid: "Resolution ID",
    bond: "Caution",
    audit_title: "Audit trustless",
    audit_desc: "Vérifiable publiquement par quiconque, sans confiance en GeoEdge.",
    audit_step1: "Ouvrir la tx sur Polygonscan (voir le fingerprint on-chain)",
    audit_step2: "Télécharger data.json depuis IPFS Pinata",
    audit_step3: "Run le script et comparer les hash",
    audit_download: "Télécharger data.json",
    audit_downloaded: "Téléchargé",
    audit_copy_cmd: "Copier la commande",
    audit_copied: "Copié !",
    audit_show: "Montrer les étapes d'audit",
    audit_hide: "Masquer",
  } : {
    title: "Web3 Evidence",
    mock_chain: "MOCK CHAIN",
    fingerprint: "Fingerprint",
    data: "data.json (IPFS)",
    script: "resolution_script.py",
    schema: "schema_v1.json",
    tls: "TLS proof",
    tx: "On-chain transaction",
    resid: "Resolution ID",
    bond: "Bond",
    audit_title: "Trustless audit",
    audit_desc: "Publicly verifiable by anyone, without trusting GeoEdge.",
    audit_step1: "Open the tx on Polygonscan (see the on-chain fingerprint)",
    audit_step2: "Download data.json from Pinata IPFS",
    audit_step3: "Run the script and compare hashes",
    audit_download: "Download data.json",
    audit_downloaded: "Downloaded",
    audit_copy_cmd: "Copy command",
    audit_copied: "Copied!",
    audit_show: "Show audit steps",
    audit_hide: "Hide",
  };

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
        <span style={{ fontSize: 12, fontWeight: 700, color: "#10b981" }}>{i18n.title}</span>
        {evidence.chain_mock && (
          <span style={{
            marginLeft: "auto",
            fontSize: 9, padding: "1px 6px", borderRadius: 3,
            background: "#fbbf2422", color: "#fbbf24", fontWeight: 600,
          }}>
            {i18n.mock_chain}
          </span>
        )}
      </div>

      {evidence.fingerprint_sha256 && (
        <Row label={i18n.fingerprint} value={evidence.fingerprint_sha256} />
      )}
      {evidence.data_cid && (
        <Row label={i18n.data} value={evidence.data_cid} link={`${gateway}${evidence.data_cid}`} />
      )}
      {evidence.script_cid && (
        <Row label={i18n.script} value={evidence.script_cid} link={`${gateway}${evidence.script_cid}`} />
      )}
      {evidence.schema_cid && (
        <Row label={i18n.schema} value={evidence.schema_cid} link={`${gateway}${evidence.schema_cid}`} />
      )}
      {evidence.tls_proof_cid && (
        <Row label={i18n.tls} value={evidence.tls_proof_cid} link={`${gateway}${evidence.tls_proof_cid}`} />
      )}
      {evidence.chain_tx_hash && (
        <Row label={i18n.tx} value={evidence.chain_tx_hash} link={explorerUrl} />
      )}
      {evidence.resolution_id && (
        <Row label={i18n.resid} value={evidence.resolution_id} />
      )}

      {(evidence.bond_amount_usdc || evidence.dispute_status) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0 2px", fontSize: 11 }}>
          {evidence.bond_amount_usdc ? (
            <span style={{ color: "#94a3b8" }}>
              {i18n.bond} <strong style={{ color: "#e2e8f0" }}>{evidence.bond_amount_usdc} USDC</strong>
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

      {/* Audit CTA */}
      {(evidence.data_cid && evidence.chain_tx_hash) && (
        <>
          <button
            onClick={() => setAuditOpen((v) => !v)}
            style={{
              marginTop: 10,
              width: "100%",
              padding: "8px 10px",
              background: "rgba(16, 185, 129, 0.08)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              borderRadius: 6,
              color: "#10b981",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 0.3,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Terminal size={12} />
              {auditOpen ? i18n.audit_hide : i18n.audit_show}
            </span>
            {auditOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {auditOpen && (
            <div style={{
              marginTop: 8,
              padding: 10,
              background: "rgba(10, 15, 26, 0.5)",
              border: "1px solid #1e293b",
              borderRadius: 6,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#e2e8f0", marginBottom: 2 }}>{i18n.audit_title}</div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 10, lineHeight: 1.45 }}>{i18n.audit_desc}</div>

              {/* Step 1: open Polygonscan */}
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setAuditStep((s) => (s < 1 ? 1 : s))}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 8px",
                  borderRadius: 4,
                  marginBottom: 4,
                  background: auditStep >= 1 ? "rgba(16, 185, 129, 0.08)" : "transparent",
                  textDecoration: "none",
                  color: "#cbd5e1",
                  fontSize: 11,
                  transition: "background 0.15s",
                }}
              >
                {auditStep >= 1 ? <CheckCircle2 size={13} color="#10b981" /> : <Circle size={13} color="#64748b" />}
                <span style={{ flex: 1 }}>1. {i18n.audit_step1}</span>
                <ExternalLink size={11} color="#10b981" />
              </a>

              {/* Step 2: download data.json */}
              <button
                onClick={downloadAudit}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 8px",
                  borderRadius: 4,
                  width: "100%",
                  marginBottom: 4,
                  background: auditStep >= 2 ? "rgba(16, 185, 129, 0.08)" : "transparent",
                  border: 0,
                  color: "#cbd5e1",
                  fontSize: 11,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {auditStep >= 2 ? <CheckCircle2 size={13} color="#10b981" /> : <Circle size={13} color="#64748b" />}
                <span style={{ flex: 1 }}>
                  2. {i18n.audit_step2}
                  {downloadedSize !== null && auditStep >= 2 && (
                    <span style={{ color: "#64748b", marginLeft: 6 }}>({downloadedSize} B)</span>
                  )}
                </span>
                <Download size={11} color="#10b981" />
              </button>

              {/* Step 3: run script */}
              <div style={{
                display: "flex", alignItems: "flex-start", gap: 8,
                padding: "6px 8px",
                borderRadius: 4,
                background: auditStep >= 3 ? "rgba(16, 185, 129, 0.08)" : "transparent",
                fontSize: 11,
                color: "#cbd5e1",
              }}>
                {auditStep >= 3 ? <CheckCircle2 size={13} color="#10b981" /> : <Circle size={13} color="#64748b" />}
                <div style={{ flex: 1 }}>
                  <div style={{ marginBottom: 6 }}>3. {i18n.audit_step3}</div>
                  <div style={{
                    display: "flex",
                    gap: 6,
                    padding: "6px 8px",
                    background: "#0a0f1a",
                    borderRadius: 4,
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "#10b981",
                    overflowX: "auto",
                    whiteSpace: "nowrap",
                  }}>
                    <span style={{ opacity: 0.6 }}>$</span>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{auditCmd}</span>
                    <button
                      onClick={() => copy(auditCmd, "cmd")}
                      style={{
                        background: "transparent",
                        border: 0,
                        color: copied === "cmd" ? "#10b981" : "#64748b",
                        cursor: "pointer",
                        padding: 0,
                        flexShrink: 0,
                      }}
                      aria-label={i18n.audit_copy_cmd}
                    >
                      <Copy size={11} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
