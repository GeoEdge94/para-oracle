import { lazy, Suspense, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { API, api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { GlobePopupCycle } from "@/components/GlobePopupCycle";
import { TradingTicker } from "@/components/TradingTicker";
import { LazyInView } from "@/components/LazyInView";
import { Satellite, ShieldCheck, FileCode2, ArrowDownRight } from "lucide-react";
import type { Bet } from "@/lib/api";

const OrionDashboard = lazy(() =>
  import("@/components/OrionDashboard").then((m) => ({ default: m.OrionDashboard })),
);
const WhyParaOracle = lazy(() =>
  import("@/components/WhyParaOracle").then((m) => ({ default: m.WhyParaOracle })),
);

type BetLite = { slug: string; region_geojson: GeoJSON.Polygon | GeoJSON.MultiPolygon | null; status: string };

export function Login({ extended = false }: { extended?: boolean } = {}) {
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

  const globeSize = typeof window !== "undefined"
    ? Math.min(620, Math.max(380, Math.floor(window.innerWidth * 0.42)))
    : 560;

  return (
    <div style={{ height: "100dvh", overflowY: "auto", overflowX: "hidden", background: "var(--bg)", position: "relative" }}>
      {/* First screen: split 2-col hero */}
      <div style={{ minHeight: "100dvh", padding: "52px 0 40px", position: "relative", overflow: "hidden" }}>
        <div className="login-bg" aria-hidden>
          <div className="login-grid" />
        </div>

        {/* Pre-auth Bloomberg ticker */}
        {bets.length > 0 && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 5 }}>
            <TradingTicker bets={bets as unknown as Bet[]} />
          </div>
        )}

        {/* Split layout */}
        <div className="login-split">
          {/* LEFT — form + branding */}
          <div className="login-col login-col-form">
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div className="display" style={{ fontSize: 30, letterSpacing: -0.7, lineHeight: 1 }}>
                Geo<span style={{ color: "var(--accent)" }}>Edge</span>
              </div>
            </div>

            <h1 className="display" style={{
              fontSize: "clamp(32px, 4vw, 44px)",
              lineHeight: 1.05,
              letterSpacing: -1.2,
              margin: "6px 0 10px",
              color: "var(--fg-strong)",
              maxWidth: 440,
            }}>
              {t("auth.hero_left")}<br />
              <span style={{ color: "var(--accent)" }}>{t("auth.hero_right")}</span>
            </h1>

            <p className="mono" style={{ fontSize: 11, color: "var(--fg-subtle)", letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 600, marginBottom: 24 }}>
              {t("auth.tagline")}
            </p>

            {extended ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  maxWidth: 520,
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <motion.button
                    className="btn btn-primary"
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    whileHover={{ y: -1 }}
                    transition={{ type: "spring", stiffness: 420, damping: 28 }}
                    style={{
                      padding: "14px 18px",
                      fontSize: 14,
                      fontWeight: 700,
                      letterSpacing: 0.2,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                    onClick={() => {
                      localStorage.setItem("para_onboarding_passed", "1");
                      navigate("/");
                    }}
                  >
                    <ArrowDownRight size={14} style={{ transform: "rotate(-45deg)" }} />
                    Explorer
                  </motion.button>
                  <motion.button
                    className="btn"
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    whileHover={{ y: -1 }}
                    transition={{ type: "spring", stiffness: 420, damping: 28 }}
                    style={{
                      padding: "14px 18px",
                      fontSize: 14,
                      fontWeight: 600,
                      letterSpacing: 0.2,
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid var(--hairline-strong)",
                      color: "var(--fg)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                    onClick={() => {
                      localStorage.setItem("para_onboarding_passed", "1");
                      navigate("/login");
                    }}
                  >
                    <ShieldCheck size={14} />
                    Se connecter
                  </motion.button>
                </div>
                <div className="mono" style={{ fontSize: 9, color: "var(--fg-faint)", letterSpacing: 1.3, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                  <span style={{ width: 4, height: 4, borderRadius: 2, background: "var(--accent)" }} />
                  Explorer = mode invité · lecture seule sur le wallet
                </div>
              </div>
            ) : (
              <form
                onSubmit={onSubmit}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  padding: "22px 22px 18px",
                  borderRadius: "var(--radius-lg)",
                  background: "rgba(10, 15, 26, 0.78)",
                  backdropFilter: "blur(10px) saturate(125%)",
                  border: "1px solid var(--hairline-strong)",
                  boxShadow: "var(--shadow-lg), inset 0 1px 0 rgba(255,255,255,0.035)",
                  maxWidth: 440,
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
            )}

            {/* Stats + trust strip */}
            {bets.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.8 }}
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, auto)",
                  gap: 28,
                  marginTop: 22,
                  maxWidth: 440,
                }}
              >
                <div>
                  <div className="display num" style={{ fontSize: 22, color: "var(--fg-strong)", letterSpacing: -0.5 }}>
                    {bets.length}
                  </div>
                  <div className="mono" style={{ fontSize: 8, color: "var(--fg-faint)", letterSpacing: 1.3, textTransform: "uppercase", marginTop: 2 }}>
                    {t("auth.stat_markets")}
                  </div>
                </div>
                <div>
                  <div className="display num" style={{ fontSize: 22, color: "var(--accent)", letterSpacing: -0.5 }}>
                    {bets.filter((b) => b.status === "OPEN").length}
                  </div>
                  <div className="mono" style={{ fontSize: 8, color: "var(--fg-faint)", letterSpacing: 1.3, textTransform: "uppercase", marginTop: 2 }}>
                    {t("auth.stat_open")}
                  </div>
                </div>
                <div>
                  <div className="display num" style={{ fontSize: 22, color: "var(--fg-strong)", letterSpacing: -0.5 }}>
                    24/7
                  </div>
                  <div className="mono" style={{ fontSize: 8, color: "var(--fg-faint)", letterSpacing: 1.3, textTransform: "uppercase", marginTop: 2 }}>
                    {t("auth.stat_uptime")}
                  </div>
                </div>
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 1 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginTop: 16,
                flexWrap: "wrap",
              }}
            >
              <TrustPill icon={<Satellite size={10} />} label={t("auth.trust_copernicus")} />
              <TrustPill icon={<FileCode2 size={10} />} label={t("auth.trust_opendata")} />
              <TrustPill icon={<ShieldCheck size={10} />} label={t("auth.trust_oracle")} />
            </motion.div>
          </div>

          {/* RIGHT — Globe + cycling popups */}
          <div className="login-col login-col-globe">
            <GlobePopupCycle size={globeSize} intervalMs={9000} />
          </div>
        </div>

        {extended && (
          <motion.a
            href="#dashboard"
            onClick={(e) => {
              e.preventDefault();
              const el = document.getElementById("dashboard");
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
              border: "1px solid var(--hairline-strong)",
              background: "rgba(10, 15, 26, 0.5)",
              backdropFilter: "blur(8px)",
            }}
          >
            <span>{t("auth.scroll_hint")}</span>
            <ArrowDownRight size={11} />
          </motion.a>
        )}
      </div>

      {extended && (
        <>
          <div id="dashboard">
            <LazyInView minHeight={600}>
              <Suspense fallback={null}>
                <OrionDashboard />
              </Suspense>
            </LazyInView>
          </div>
          <div id="why">
            <LazyInView minHeight={400}>
              <Suspense fallback={null}>
                <WhyParaOracle />
              </Suspense>
            </LazyInView>
          </div>
        </>
      )}
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
        border: "1px solid var(--hairline-strong)",
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
