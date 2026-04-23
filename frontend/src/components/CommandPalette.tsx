import { useEffect, useState } from "react";
import { Command } from "cmdk";
import * as Dialog from "@radix-ui/react-dialog";
import { useNavigate } from "react-router-dom";
import { Home, Map as MapIcon, Wallet, Trophy, LogOut, Search, Zap, Globe } from "lucide-react";
import { API, type Bet } from "@/lib/api";
import { isBoosted } from "@/lib/engage";
import { useI18n } from "@/lib/i18n";

const SHORTCUT_LABEL = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform) ? "⌘ K" : "Ctrl K";

export function CommandPaletteTrigger({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="cmd-trigger"
      aria-label="Open command palette"
    >
      <Search size={12} />
      <span>Chercher...</span>
      <kbd className="mono">{SHORTCUT_LABEL}</kbd>
    </button>
  );
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [bets, setBets] = useState<Bet[]>([]);
  const navigate = useNavigate();
  const { t } = useI18n();

  useEffect(() => {
    let gPending = false;
    let gTimer: ReturnType<typeof setTimeout> | null = null;
    function clearG() { gPending = false; if (gTimer) clearTimeout(gTimer); gTimer = null; }
    function onKey(e: KeyboardEvent) {
      const tgt = e.target as HTMLElement | null;
      const typing = tgt && ["INPUT", "TEXTAREA"].includes(tgt.tagName);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (typing) return;
      // Vim/Linear-style "g + letter" navigation
      if (!gPending && e.key.toLowerCase() === "g" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        gPending = true;
        gTimer = setTimeout(clearG, 1100);
        return;
      }
      if (gPending && !e.metaKey && !e.ctrlKey) {
        const k = e.key.toLowerCase();
        const map: Record<string, string> = { h: "/", m: "/map", w: "/wallet", l: "/leaderboard" };
        if (map[k]) {
          e.preventDefault();
          clearG();
          navigate(map[k]);
          return;
        }
        clearG();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (gTimer) clearTimeout(gTimer);
    };
  }, [navigate]);

  useEffect(() => {
    if (open && bets.length === 0) {
      API.listBets().then((r) => setBets(r.data)).catch(() => {});
    }
  }, [open, bets.length]);

  function go(path: string) {
    setOpen(false);
    setQuery("");
    navigate(path);
  }

  function logout() {
    setOpen(false);
    localStorage.removeItem("para_token");
    navigate("/login");
  }

  const boostedBets = bets.filter((b) => isBoosted(b.period_end, b.status));

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="cmd-overlay" />
        <Dialog.Content className="cmd-content" aria-describedby={undefined}>
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <Command shouldFilter loop>
            <div className="cmd-input-wrap">
              <Search size={14} color="var(--fg-faint)" />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Marché, action, page..."
                autoFocus
              />
              <kbd className="mono cmd-esc">ESC</kbd>
            </div>
            <Command.List className="cmd-list">
              <Command.Empty className="cmd-empty">Aucun résultat</Command.Empty>

              <Command.Group heading="Navigation" className="cmd-group">
                <Command.Item onSelect={() => go("/")} value="home dashboard bento">
                  <Home size={14} /> <span>Tableau de bord</span> <kbd className="mono">G H</kbd>
                </Command.Item>
                <Command.Item onSelect={() => go("/map")} value="map carte">
                  <MapIcon size={14} /> <span>Carte globale</span> <kbd className="mono">G M</kbd>
                </Command.Item>
                <Command.Item onSelect={() => go("/wallet")} value="wallet portefeuille balance">
                  <Wallet size={14} /> <span>Portefeuille</span> <kbd className="mono">G W</kbd>
                </Command.Item>
                <Command.Item onSelect={() => go("/leaderboard")} value="leaderboard classement league">
                  <Trophy size={14} /> <span>Classement</span> <kbd className="mono">G L</kbd>
                </Command.Item>
              </Command.Group>

              {boostedBets.length > 0 && (
                <Command.Group heading="Ferme aujourd'hui" className="cmd-group">
                  {boostedBets.slice(0, 5).map((b) => (
                    <Command.Item
                      key={b.slug}
                      onSelect={() => go(`/analysis/${b.slug}`)}
                      value={`j-1 boosted ${b.region_name} ${b.category}`}
                    >
                      <Zap size={14} color="#fbbf24" />
                      <span style={{ flex: 1 }}>{b.region_name}</span>
                      <span className="mono" style={{ color: "#fbbf24", fontSize: 10 }}>J-1</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              <Command.Group heading={`Marchés (${bets.length})`} className="cmd-group">
                {bets.slice(0, 20).map((b) => (
                  <Command.Item
                    key={b.slug}
                    onSelect={() => go(`/analysis/${b.slug}`)}
                    value={`${b.region_name} ${b.category} ${b.index_type} ${b.slug}`}
                  >
                    <Globe size={14} color="var(--fg-faint)" />
                    <span style={{ flex: 1 }}>{b.region_name}</span>
                    <span className="mono" style={{ color: "var(--fg-faint)", fontSize: 10 }}>{b.index_type}</span>
                  </Command.Item>
                ))}
              </Command.Group>

              <Command.Group heading="Session" className="cmd-group">
                <Command.Item onSelect={logout} value="logout deconnexion">
                  <LogOut size={14} color="var(--danger)" /> <span>Se déconnecter</span>
                </Command.Item>
              </Command.Group>
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
