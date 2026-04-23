import { useEffect, useState } from "react";
import { Wallet as WalletIcon, Copy, ExternalLink, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import * as Dialog from "@radix-ui/react-dialog";
import { API, type WalletBalance } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

function shortAddr(addr: string, head = 6, tail = 4): string {
  if (!addr) return "";
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

/**
 * Topbar button that reflects the on-chain wallet state.
 *
 * When backend reports mode="onchain":
 *   - Pill shows balance (tUSDC) + short address.
 *   - Click opens a Dialog with address, token contract, Polygonscan link,
 *     copy-to-clipboard, and faucet hint.
 * When mode="simulator":
 *   - Pill shows "Connect" and on click opens the same Dialog with a
 *     CTA to enable on-chain mode (points to docs).
 */
export function ConnectWalletButton() {
  const { t } = useI18n();
  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchBalance = () => {
      API.walletBalance()
        .then((r) => { if (!cancelled) setWallet(r.data); })
        .catch(() => {});
    };
    fetchBalance();
    const id = setInterval(fetchBalance, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const onchain = wallet?.mode === "onchain";
  const addr = wallet?.wallet_address || "";
  const currency = wallet?.currency || "tUSDC";
  const bal = wallet?.balance ?? 0;

  function copy(s: string) {
    navigator.clipboard.writeText(s);
    toast.success(t("common.copied"));
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          className={`cwb-pill${onchain ? " cwb-pill-connected" : ""}`}
          aria-label={onchain ? t("wallet.wallet_connected") : t("wallet.wallet_connect")}
        >
          <WalletIcon size={13} />
          {onchain ? (
            <>
              <span className="cwb-pill-balance num">
                {bal.toFixed(2)}
              </span>
              <span className="cwb-pill-currency">{currency}</span>
            </>
          ) : (
            <span className="cwb-pill-label">{t("wallet.wallet_connect")}</span>
          )}
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="cwb-overlay" />
        <Dialog.Content className="cwb-dialog" aria-describedby={undefined}>
          <div className="cwb-dialog-head">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="cwb-dialog-icon">
                <WalletIcon size={16} color="var(--accent)" />
              </div>
              <Dialog.Title asChild>
                <h3 className="cwb-dialog-title">
                  {onchain ? t("wallet.wallet_connected") : t("wallet.wallet_connect")}
                </h3>
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button className="cwb-dialog-close" aria-label={t("common.close")}>
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          {onchain && wallet ? (
            <>
              <div className="cwb-dialog-status">
                <CheckCircle2 size={14} color="var(--accent)" />
                <span>{t("wallet.status_live")} · Polygon Amoy (80002)</span>
              </div>

              <div className="cwb-info-grid">
                <InfoRow
                  label={t("wallet.balance")}
                  value={`${bal.toFixed(2)} ${currency}`}
                  mono
                />
                <InfoRow
                  label={t("wallet.address")}
                  value={shortAddr(addr, 8, 6)}
                  mono
                  onCopy={() => copy(addr)}
                  extLink={`https://amoy.polygonscan.com/address/${addr}`}
                />
                <InfoRow
                  label={t("wallet.token")}
                  value={`tUSDC · ${shortAddr(wallet.token_contract || "", 6, 4)}`}
                  mono
                  extLink={`https://amoy.polygonscan.com/token/${wallet.token_contract}`}
                />
                {wallet.treasury_address && (
                  <InfoRow
                    label={t("wallet.treasury")}
                    value={shortAddr(wallet.treasury_address, 6, 4)}
                    mono
                    extLink={`https://amoy.polygonscan.com/address/${wallet.treasury_address}`}
                  />
                )}
              </div>

              <div className="cwb-dialog-hint">
                {t("wallet.connect_hint")}
              </div>
            </>
          ) : (
            <>
              <div className="cwb-dialog-status">
                <span style={{ width: 10, height: 10, borderRadius: 5, background: "var(--warning)" }} />
                <span>{t("wallet.mode_simulator")}</span>
              </div>
              <div className="cwb-dialog-hint" style={{ marginTop: 12 }}>
                {t("wallet.mode_simulator_hint")}
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function InfoRow({ label, value, mono, onCopy, extLink }: {
  label: string;
  value: string;
  mono?: boolean;
  onCopy?: () => void;
  extLink?: string;
}) {
  return (
    <div className="cwb-info-row">
      <span className="cwb-info-label">{label}</span>
      <div className="cwb-info-val" style={{ fontFamily: mono ? "var(--font-mono)" : "inherit" }}>
        <span>{value}</span>
        {onCopy && (
          <button className="cwb-info-btn" onClick={onCopy} aria-label="Copy">
            <Copy size={11} />
          </button>
        )}
        {extLink && (
          <a
            className="cwb-info-btn"
            href={extLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open"
          >
            <ExternalLink size={11} />
          </a>
        )}
      </div>
    </div>
  );
}
