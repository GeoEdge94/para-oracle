import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API } from "@/lib/api";

export function Login() {
  const navigate = useNavigate();
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
    } catch (err) {
      setError("Erreur de connexion. Backend accessible ?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>
            Para<span style={{ color: "#10b981" }}>Oracle</span>
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
            Oracle Sentinel-2 · Para deforestation
          </div>
        </div>

        <form className="card" onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ fontSize: 12, color: "#94a3b8" }}>Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

          <label style={{ fontSize: 12, color: "#94a3b8" }}>Mot de passe (mock)</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />

          {error && <div style={{ color: "#f87171", fontSize: 12 }}>{error}</div>}

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? "Connexion..." : "Se connecter"}
          </button>

          <div style={{ fontSize: 11, color: "#64748b", textAlign: "center", marginTop: 8 }}>
            Demo mock — n'importe quel mail/mdp fonctionne
          </div>
        </form>
      </div>
    </div>
  );
}
