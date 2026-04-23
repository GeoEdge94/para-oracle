import { useNavigate, useLocation } from "react-router-dom";
import { Home as HomeIcon, Search, TrendingUp, Wallet as WalletIcon } from "lucide-react";
import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { API, type WalletBalance } from "@/lib/api";
import { useEffect, useState } from "react";

type NavItem = {
  key: "home" | "search" | "trending" | "wallet";
  icon: React.ReactNode;
  labelKey: string;
  to: string;
  match: (pathname: string) => boolean;
};

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, formatAmount } = useI18n();
  const [wallet, setWallet] = useState<WalletBalance | null>(null);

  useEffect(() => {
    API.walletBalance().then((r) => setWallet(r.data)).catch(() => {});
  }, [location.pathname]);

  const items: NavItem[] = [
    {
      key: "home",
      icon: <HomeIcon size={20} />,
      labelKey: "home.dashboard",
      to: "/",
      match: (p) => p === "/",
    },
    {
      key: "search",
      icon: <Search size={20} />,
      labelKey: "home.search",
      to: "/?search=1",
      match: (p) => p === "/search",
    },
    {
      key: "trending",
      icon: <TrendingUp size={20} />,
      labelKey: "engage.trending",
      to: "/leaderboard",
      match: (p) => p.startsWith("/leaderboard"),
    },
    {
      key: "wallet",
      icon: <WalletIcon size={20} />,
      labelKey: "home.wallet_link",
      to: "/wallet",
      match: (p) => p.startsWith("/wallet"),
    },
  ];

  return (
    <nav className="bottom-nav" aria-label="Primary mobile navigation">
      {items.map((it) => {
        const active = it.match(location.pathname);
        const handler = () => {
          if (it.key === "search") {
            window.dispatchEvent(new CustomEvent("open-command-palette"));
          } else {
            navigate(it.to);
          }
        };
        return (
          <motion.button
            key={it.key}
            className={`bn-item${active ? " bn-item-active" : ""}`}
            onClick={handler}
            whileTap={{ scale: 0.92 }}
            aria-label={t(it.labelKey)}
            aria-current={active ? "page" : undefined}
          >
            <span className="bn-icon">{it.icon}</span>
            <span className="bn-label">
              {it.key === "wallet" && wallet
                ? formatAmount(Number(wallet.balance))
                : t(it.labelKey)}
            </span>
          </motion.button>
        );
      })}
    </nav>
  );
}
