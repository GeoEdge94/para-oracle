import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { API, api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { LocaleToggle } from "@/components/LocaleToggle";
import { GlobeHero } from "@/components/GlobeHero";

type BetLite = { slug: string; region_geojson: GeoJSON.Polygon | GeoJSON.MultiPolygon | null; status: string };

function centroidOf(geom: GeoJSON.Polygon | GeoJSON.MultiPolygon): [number, number] | null {
  try {
    const ring = geom.type === "MultiPolygon" ? geom.coordinates[0][0] : geom.coordinates[0];
    let sx = 0, sy = 0, n = 0;
    for (const [x, y] of ring) { sx += x; sy += y; n++; }
    return [sy / n, sx / n]; // [lat, lng]
  } catch { return null; }
}

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

  const markers = useMemo(() => {
    return bets
      .map((b) => {
        if (!b.region_geojson) return null;
        const c = centroidOf(b.region_geojson);
        if (!c) return null;
        const open = b.status === "OPEN";
        return { location: c as [number, number], size: open ? 0.08 : 0.05 };
      })
      .filter(Boolean) as { location: [number, number]; size: number }[];
  }, [bets]);

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

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, position: "relative", overflow: "hidden" }}>
      <div className="login-bg" aria-hidden>
        <div className="login-grid" />
      </div>

      {/* Globe hero — occupies ~56% viewport height on desktop, sits behind card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
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
        <GlobeHero markers={markers} size={Math.min(720, typeof window !== "undefined" ? window.innerWidth * 1.05 : 640)} opacity={0.85} />
      </motion.div>

      {/* Subtle vignette to ensure card legibility over the globe */}
      <div aria-hidden style={{
        position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse at 50% 62%, transparent 0%, rgba(5,8,15,0.45) 58%, rgba(5,8,15,0.85) 100%)",
      }} />

      <div style={{ position: "fixed", top: 12, right: 12, zIndex: 10 }}>
        <LocaleToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.25 }}
        style={{ width: "100%", maxWidth: 380, position: "relative", zIndex: 2 }}
      >
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div className="display" style={{ fontSize: 36, letterSpacing: -1 }}>
            Para<span style={{ color: "var(--accent)" }}>Oracle</span>
          </div>
          <div className="serif" style={{ fontSize: 15, color: "var(--fg-muted)", marginTop: 6, fontStyle: "italic" }}>
            {t("auth.subtitle")}
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            padding: 20,
            borderRadius: "var(--radius-lg)",
            background: "rgba(10, 15, 26, 0.72)",
            backdropFilter: "blur(16px) saturate(130%)",
            border: "1px solid rgba(51, 65, 85, 0.7)",
            boxShadow: "var(--shadow-lg), inset 0 1px 0 rgba(255,255,255,0.03)",
          }}
        >
          <label style={{ fontSize: 11, color: "var(--fg-subtle)", letterSpacing: 0.6, textTransform: "uppercase" }}>Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />

          <label style={{ fontSize: 11, color: "var(--fg-subtle)", letterSpacing: 0.6, textTransform: "uppercase" }}>{t("auth.password_label")}</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />

          {error && <div style={{ color: "var(--danger)", fontSize: 12 }}>{error}</div>}

          <motion.button
            className="btn btn-primary"
            type="submit"
            disabled={loading}
            whileTap={{ scale: 0.97 }}
            whileHover={{ y: -1 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            style={{ marginTop: 8 }}
          >
            {loading ? t("auth.login_loading") : t("auth.login_btn")}
          </motion.button>

          <div style={{ fontSize: 11, color: "var(--fg-faint)", textAlign: "center", marginTop: 8 }}>
            {t("auth.demo_hint")}
          </div>
        </form>

        {bets.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            style={{ textAlign: "center", fontSize: 10, color: "var(--fg-faint)", marginTop: 14, letterSpacing: 1.5, textTransform: "uppercase" }}
          >
            <span className="num">{bets.length}</span> marchés actifs · Sentinel-2 · temps réel
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
