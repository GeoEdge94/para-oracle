import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { API } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export function WalletBadge({ onClick }: { onClick?: () => void }) {
  const { formatAmount } = useI18n();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    API.walletBalance().then((r) => setBalance(r.data.balance)).catch(() => {});
  }, []);

  if (balance === null) return null;

  return (
    <button onClick={onClick} className="wallet-badge" title="Wallet">
      <Wallet size={12} />
      <span>{formatAmount(balance)}</span>
    </button>
  );
}
