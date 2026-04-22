import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { API, api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { LocaleToggle } from "@/components/LocaleToggle";
import { GlobeHero } from "@/components/GlobeHero";
import { ConstellationArcs } from "@/components/ConstellationArcs";
import { TradingTicker } from "@/components/TradingTicker";
import { WhyParaOracle } from "@/components/WhyParaOracle";
import { Satellite, ShieldCheck, FileCode2, ArrowDownRight } from "lucide-react";
import type { Bet } from "@/lib/api";

type BetLite = { slug: string; region_geojson: GeoJSON.Polygon | GeoJSON.MultiPolygon | null; status: string };

export function Login() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [email, setEmail] = useState("demo@para-oracle.app");
  const [password, setPassword] = useState("demo1234");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [bets, setBets] = useState<BetLite[]>([]);

  useEffect(() => {
    api.get<BetLite[]>("/bets").then((r) => setBets(r.data)).catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await API.login(email, password);
      localStorage.setItem("para_token", data.token);
      localStorage.setItem("para_user", JSON.stringify({ email: data.email, pseudo: data.pseudo }));
      navigate("/");
    } catch {
      setError(t("auth.error"));
    } finally {
      setLoading(false);
    }
  }

  const globeSize = Math.min(860, typeof window !== "undefined" ? window.innerWidth * 1.1 : 720);

  return (
    <div style={{ height: "100dvh", overflowY: "auto", overflowX: "hidden", background: "var(--bg)", position: "relative" }}>
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, position: "relative", overflow: "hidden" }}>
        <div className="login-bg" aria-hidden>
          <div className="login-grid" />
        </div>

        {/* Globe hero — pro muted variant, full centered */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 0,
          }}
        >
          <div style={{ position: "relative", width: globeSize, height: globeSize }}>
            <GlobeHero size={globeSize} opacity={0.92} variant="pro" />
            {/* Overlay: thin animated arcs = satellite network feel */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1.8, delay: 0.6 }}
              style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
            >
              <ConstellationArcs size={globeSize} opacity={0.9} count={18} seed={11} />
            </motion.div>
          </div>
        </motion.div>

        {/* Editorial vignette for form legibility, lighter than before */}
        <div aria-hidden style={{
          position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse at 50% 55%, transparent 0%, rgba(5,8,15,0.38) 55%, rgba(5,8,15,0.78) 100%)",
        }} />

        {/* Pre-auth Bloomberg ticker */}
        {bets.length > 0 && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 5 }}>
            <TradingTicker bets={bets as unknown as Bet[]} />
          </div>
        )}

        <div style={{ position: "fixed", top: bets.length > 0 ? 52 : 12, right: 12, zIndex: 10 }}>
          <LocaleToggle />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
          style={{ width: "100%", maxWidth: 420, position: "relative", zIndex: 2 }}
        >
          {/* Brand mark */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{
                width: 34, height: 34,
                borderRadius: 8,
                background: "rgba(16,185,129,0.08)",
                border: "1px solid rgba(16,185,129,0.22)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Satellite size={16} strokeWidth={1.6} color="var(--accent)" />
              </div>
              <div className="display" style={{ fontSize: 28, letterSpacing: -0.6, lineHeight: 1 }}>
                Para<span style={{ color: "var(--accent)" }}>Oracle</span>
              </div>
            </div>
            <div className="mono" style={{ fontSize: 10, color: "var(--fg-subtle)", letterSpacing: 2.2, textTransform: "uppercase", fontWeight: 600 }}>
              Climate prediction market · Sentinel-2 oracle
            </div>
          </div>

          <form
            onSubmit={onSubmit}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
              padding: "22px 22px 18px",
              borderRadius: "var(--radius-lg)",
              background: "rgba(10, 15, 26, 0.78)",
              backdropFilter: "blur(18px) saturate(135%)",
              border: "1px solid rgba(51, 65, 85, 0.7)",
              boxShadow: "var(--shadow-lg), inset 0 1px 0 rgba(255,255,255,0.035)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label className="mono" style={{ fontSize: 9, color: "var(--fg-subtle)", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600 }}>Email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label className="mono" style={{ fontSize: 9, color: "var(--fg-subtle)", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600 }}>{t("auth.password_label")}</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
            </div>

            {error && <div style={{ color: "var(--danger)", fontSize: 12 }}>{error}</div>}

            <motion.button
              className="btn btn-primary"
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.97 }}
              whileHover={{ y: -1 }}
              transition={{ type: "spring", stiffness: 420, damping: 28 }}
              style={{ marginTop: 6, padding: "12px 20px", fontSize: 14, fontWeight: 600 }}
            >
              {loading ? t("auth.login_loading") : t("auth.login_btn")}
            </motion.button>

            <div className="mono" style={{ fontSize: 9, color: "var(--fg-faint)", textAlign: "center", marginTop: 4, letterSpacing: 0.5, textTransform: "uppercase" }}>
              {t("auth.demo_hint")}
            </div>
          </form>

          {/* Live stats strip */}
          {bets.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.8 }}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 0,
                marginTop: 20,
                padding: "14px 0",
                borderTop: "1px solid var(--border-muted)",
                borderBottom: "1px solid var(--border-muted)",
              }}
            >
              <div style={{ textAlign: "center", borderRight: "1px solid var(--border-muted)" }}>
                <div className="display num" style={{ fontSize: 22, color: "var(--fg-strong)", letterSpacing: -0.5 }}>
                  {bets.length}
                </div>
                <div className="mono" style={{ fontSize: 8, color: "var(--fg-faint)", letterSpacing: 1.3, textTransform: "uppercase", marginTop: 2 }}>
                  Markets
                </div>
              </div>
              <div style={{ textAlign: "center", borderRight: "1px solid var(--border-muted)" }}>
                <div className="display num" style={{ fontSize: 22, color: "var(--accent)", letterSpacing: -0.5 }}>
                  {bets.filter((b) => b.status === "OPEN").length}
                </div>
                <div className="mono" style={{ fontSize: 8, color: "var(--fg-faint)", letterSpacing: 1.3, textTransform: "uppercase", marginTop: 2 }}>
                  Open
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div className="display num" style={{ fontSize: 22, color: "var(--fg-strong)", letterSpacing: -0.5 }}>
                  24/7
                </div>
                <div className="mono" style={{ fontSize: 8, color: "var(--fg-faint)", letterSpacing: 1.3, textTransform: "uppercase", marginTop: 2 }}>
                  Sentinel-2
                </div>
              </div>
            </motion.div>
          )}

          {/* Trust signals */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 1 }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 14,
              marginTop: 16,
              flexWrap: "wrap",
            }}
          >
            <TrustPill icon={<Satellite size={10} />} label="ESA Copernicus" />
            <TrustPill icon={<FileCode2 size={10} />} label="Open data" />
            <TrustPill icon={<ShieldCheck size={10} />} label="Deterministic oracle" />
          </motion.div>
        </motion.div>

        {/* Sober scroll affordance */}
        <motion.a
          href="#why"
          onClick={(e) => {
            e.preventDefault();
            const el = document.getElementById("why");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: 1.4, duration: 0.6 }}
          whileHover={{ opacity: 1, y: 2 }}
          className="mono"
          style={{
            position: "absolute", bottom: 22, left: "50%", transform: "translateX(-50%)",
            display: "inline-flex", alignItems: "center", gap: 6,
            color: "var(--fg-subtle)", zIndex: 3,
            fontSize: 10, letterSpacing: 2, textTransform: "uppercase", fontWeight: 600,
            textDecoration: "none",
            padding: "6px 12px",
            borderRadius: 999,
            border: "1px solid var(--border-muted)",
            background: "rgba(10, 15, 26, 0.5)",
            backdropFilter: "blur(8px)",
          }}
        >
          <span>How the oracle works</span>
          <ArrowDownRight size={11} />
        </motion.a>
      </div>

      {/* Features section under the fold */}
      <div id="why">
        <WhyParaOracle />
      </div>
    </div>
  );
}

function TrustPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span
      className="mono"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 8px",
        borderRadius: 999,
        border: "1px solid var(--border-muted)",
        background: "rgba(10, 15, 26, 0.55)",
        color: "var(--fg-subtle)",
        fontSize: 9,
        letterSpacing: 1.1,
        textTransform: "uppercase",
        fontWeight: 600,
      }}
    >
      {icon}
      <span>{label}</span>
    </span>
  );
}
