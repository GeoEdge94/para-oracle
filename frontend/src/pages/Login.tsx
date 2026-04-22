import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { API } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { LocaleToggle } from "@/components/LocaleToggle";

export function Login() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [email, setEmail] = useState("demo@para-oracle.app");
  const [password, setPassword] = useState("demo1234");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      <div style={{ position: "fixed", top: 12, right: 12, zIndex: 10 }}>
        <LocaleToggle />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        style={{ width: "100%", maxWidth: 360, position: "relative", zIndex: 1 }}
      >
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>
            Para<span style={{ color: "var(--accent)" }}>Oracle</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--fg-subtle)", marginTop: 4 }}>
            {t("auth.subtitle")}
          </div>
        </div>

        <form className="card" onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ fontSize: 12, color: "var(--fg-subtle)" }}>Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />

          <label style={{ fontSize: 12, color: "var(--fg-subtle)" }}>{t("auth.password_label")}</label>
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
      </motion.div>
    </div>
  );
}
