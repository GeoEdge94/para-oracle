import { useEffect, useMemo, useState } from "react";
import { Satellite, Activity, Zap, Users } from "lucide-react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { Avatar } from "@/components/Avatar";

type BetLite = { slug: string; status: string; region_geojson: unknown };
type LeaderEntry = { pseudo: string; balance: number; total_won: number; total_lost: number };

export function WhyParaOracle() {
  const [bets, setBets] = useState<BetLite[]>([]);
  const [traders, setTraders] = useState<LeaderEntry[]>([]);

  useEffect(() => {
    api.get<BetLite[]>("/bets").then((r) => setBets(r.data)).catch(() => {});
    api.get<LeaderEntry[]>("/auth/leaderboard").then((r) => setTraders(r.data)).catch(() => {});
  }, []);

  const openCount = useMemo(() => bets.filter((b) => b.status === "OPEN").length, [bets]);
  const top3 = traders.slice(0, 3);

  return (
    <section className="why-section">
      <div className="why-inner">
        <div className="why-header">
          <span className="mono" style={{ fontSize: 10, color: "var(--fg-faint)", letterSpacing: 2, textTransform: "uppercase" }}>
            Pourquoi ParaOracle
          </span>
          <h2 className="display" style={{ fontSize: "clamp(28px, 4vw, 44px)", letterSpacing: -1, margin: "8px 0 10px", lineHeight: 1.1 }}>
            Un oracle, pas un casino.
          </h2>
          <p className="serif" style={{ fontSize: 16, color: "var(--fg-muted)", fontStyle: "italic", maxWidth: 560, lineHeight: 1.5 }}>
            Chaque prédiction est résolue par des données satellite vérifiables. Tu lis la planète, le marché te répond.
          </p>
        </div>

        <div className="why-grid">
          {/* Card 1 — Big stat + curve */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="why-card why-card-stat"
          >
            <div className="why-stat-inner">
              <div className="why-stat-viz">
                <svg className="why-curve" viewBox="0 0 254 104" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <path d="M112.891 97.7022C140.366 97.0802 171.004 94.6715 201.087 87.5116C210.43 85.2881 219.615 82.6412 228.284 78.2473C232.198 76.3179 235.905 73.9942 239.348 71.3124C241.85 69.2557 243.954 66.7571 245.555 63.9408C249.34 57.3235 248.281 50.5341 242.498 45.6109C239.033 42.7237 235.228 40.2703 231.169 38.3054C219.443 32.7209 207.141 28.4382 194.482 25.534C184.013 23.1927 173.358 21.7755 162.64 21.2989C161.376 21.3512 160.113 21.181 158.908 20.796C158.034 20.399 156.857 19.1682 156.962 18.4535C157.115 17.8927 157.381 17.3689 157.743 16.9139C158.104 16.4588 158.555 16.0821 159.067 15.8066C160.14 15.4683 161.274 15.3733 162.389 15.5286C179.805 15.3566 196.626 18.8373 212.998 24.462C220.978 27.2494 228.798 30.4747 236.423 34.1232C240.476 36.1159 244.202 38.7131 247.474 41.8258C254.342 48.2578 255.745 56.9397 251.841 65.4892C249.793 69.8582 246.736 73.6777 242.921 76.6327C236.224 82.0192 228.522 85.4602 220.502 88.2924C205.017 93.7847 188.964 96.9081 172.738 99.2109C153.442 101.949 133.993 103.478 114.506 103.79C91.1468 104.161 67.9334 102.97 45.1169 97.5831C36.0094 95.5616 27.2626 92.1655 19.1771 87.5116C13.839 84.5746 9.1557 80.5802 5.41318 75.7725C-0.54238 67.7259 -1.13794 59.1763 3.25594 50.2827C5.82447 45.3918 9.29572 41.0315 13.4863 37.4319C24.2989 27.5721 37.0438 20.9681 50.5431 15.7272C68.1451 8.8849 86.4883 5.1395 105.175 2.83669C129.045 0.0992292 153.151 0.134761 177.013 2.94256C197.672 5.23215 218.04 9.01724 237.588 16.3889C240.089 17.3418 242.498 18.5197 244.933 19.6446C246.627 20.4387 247.725 21.6695 246.997 23.615C246.455 25.1105 244.814 25.5605 242.63 24.5811C230.322 18.9961 217.233 16.1904 204.117 13.4376C188.761 10.3438 173.2 8.36665 157.558 7.52174C129.914 5.70776 102.154 8.06792 75.2124 14.5228C60.6177 17.8788 46.5758 23.2977 33.5102 30.6161C26.6595 34.3329 20.4123 39.0673 14.9818 44.658C12.9433 46.8071 11.1336 49.1622 9.58207 51.6855C4.87056 59.5336 5.61172 67.2494 11.9246 73.7608C15.2064 77.0494 18.8775 79.925 22.8564 82.3236C31.6176 87.7101 41.3848 90.5291 51.3902 92.5804C70.6068 96.5773 90.0219 97.7419 112.891 97.7022Z" fill="currentColor" />
                </svg>
                <span className="display num why-stat-value">{openCount || "—"}</span>
              </div>
              <h3 className="why-stat-title">Marchés ouverts</h3>
              <p className="why-stat-sub">Sentinel-2 scanne en continu. Aucun oracle manuel.</p>
            </div>
          </motion.div>

          {/* Card 2 — Radial icon Oracle Sentinel-2 */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.45, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
            className="why-card why-card-radial"
          >
            <div className="why-radial-inner">
              <div className="why-radial-icon">
                <div className="why-radial-core">
                  <Satellite size={28} strokeWidth={1.4} color="var(--accent)" />
                </div>
                <span className="why-radial-orbit" />
                <span className="why-radial-orbit why-radial-orbit-2" />
              </div>
              <div className="why-radial-body">
                <h3 className="why-card-title">Oracle Sentinel-2</h3>
                <p className="why-card-sub">
                  Pipeline déterministe NDVI · Δ calculé sur les bandes B4 / B8 · hash reproductible évaluable on-chain.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Card 3 — Sparkline + real-time */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.45, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="why-card why-card-chart"
          >
            <div className="why-chart-wrap">
              <svg className="why-chart-line" viewBox="0 0 386 123" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path
                  fillRule="evenodd" clipRule="evenodd"
                  d="M3 123C3 123 14.3298 94.153 35.1282 88.0957C55.9266 82.0384 65.9333 80.5508 65.9333 80.5508C65.9333 80.5508 80.699 80.5508 92.1777 80.5508C103.656 80.5508 100.887 63.5348 109.06 63.5348C117.233 63.5348 117.217 91.9728 124.78 91.9728C132.343 91.9728 142.264 78.03 153.831 80.5508C165.398 83.0716 186.825 91.9728 193.761 91.9728C200.697 91.9728 206.296 63.5348 214.07 63.5348C221.844 63.5348 238.653 93.7771 244.234 91.9728C249.814 90.1684 258.8 60 266.19 60C272.075 60 284.1 88.057 286.678 88.0957C294.762 88.2171 300.192 72.9284 305.423 72.9284C312.323 72.9284 323.377 65.2437 335.553 63.5348C347.729 61.8259 348.218 82.07 363.639 80.5508C367.875 80.1335 372.949 82.2017 376.437 87.1008C379.446 91.3274 381.054 97.4325 382.521 104.647C383.479 109.364 382.521 123 382.521 123"
                  fill="url(#why-gradient)"
                />
                <path
                  className="why-chart-stroke"
                  d="M3 121.077C3 121.077 15.3041 93.6691 36.0195 87.756C56.7349 81.8429 66.6632 80.9723 66.6632 80.9723C66.6632 80.9723 80.0327 80.9723 91.4656 80.9723C102.898 80.9723 100.415 64.2824 108.556 64.2824C116.696 64.2824 117.693 92.1332 125.226 92.1332C132.759 92.1332 142.07 78.5115 153.591 80.9723C165.113 83.433 186.092 92.1332 193 92.1332C199.908 92.1332 205.274 64.2824 213.017 64.2824C220.76 64.2824 237.832 93.8946 243.39 92.1332C248.948 90.3718 257.923 60.5 265.284 60.5C271.145 60.5 283.204 87.7182 285.772 87.756C293.823 87.8746 299.2 73.0802 304.411 73.0802C311.283 73.0802 321.425 65.9506 333.552 64.2824C345.68 62.6141 346.91 82.4553 362.27 80.9723C377.629 79.4892 383 106.605 383 106.605"
                  stroke="currentColor" strokeWidth="2.5" fill="none"
                />
                <defs>
                  <linearGradient id="why-gradient" x1="3" y1="60" x2="3" y2="123" gradientUnits="userSpaceOnUse">
                    <stop stopColor="var(--accent)" stopOpacity="0.35" />
                    <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className="why-card-body">
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, justifyContent: "center" }}>
                <Zap size={13} color="var(--accent)" />
                <h3 className="why-card-title" style={{ margin: 0 }}>Temps réel</h3>
              </div>
              <p className="why-card-sub">
                Implied YES par marché, mise à jour toutes les 20 secondes depuis les positions communautaires.
              </p>
            </div>
          </motion.div>

          {/* Card 4 — Window mockup with bar chart */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.45, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="why-card why-card-window"
          >
            <div className="why-card-inner-split">
              <div className="why-card-left">
                <div className="why-icon-ring">
                  <Activity size={18} strokeWidth={1.4} />
                </div>
                <div>
                  <h3 className="why-card-title">Bento terminal</h3>
                  <p className="why-card-sub">
                    Volume total, positions, trader classé, streak… Toute la data dans un seul écran inspiré de Polymarket et Bloomberg.
                  </p>
                </div>
              </div>
              <div className="why-window">
                <div className="why-window-bar">
                  <span /><span /><span />
                </div>
                <div className="why-window-content">
                  <div className="mono why-window-head">
                    <span className="why-window-dot-live" /> LIVE · {openCount} MARKETS
                  </div>
                  <div className="why-window-bars">
                    {[62, 40, 78, 55, 88, 33, 70, 45, 82, 50].map((h, i) => (
                      <span
                        key={i}
                        className="why-window-bar-item"
                        style={{ height: `${h}%`, animationDelay: `${i * 60}ms` }}
                      />
                    ))}
                  </div>
                  <div className="mono why-window-foot">
                    <span>YES 52%</span>
                    <span>NO 48%</span>
                    <span className="why-window-updated">+1.2 pts</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Card 5 — Connected avatars */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.45, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="why-card why-card-social"
          >
            <div className="why-card-inner-split">
              <div className="why-card-left">
                <div className="why-icon-ring">
                  <Users size={18} strokeWidth={1.4} />
                </div>
                <div>
                  <h3 className="why-card-title">Communauté active</h3>
                  <p className="why-card-sub">
                    Chaque position est publique. Observe les meilleurs, compare tes prédictions, apprends à lire la planète.
                  </p>
                </div>
              </div>
              <div className="why-social">
                {top3.length > 0 ? top3.map((t, i) => {
                  const pnl = t.total_won - t.total_lost;
                  const side = i % 2 === 0 ? "right" : "left";
                  return (
                    <div key={t.pseudo} className={`why-social-row why-social-${side}`}>
                      {side === "left" && <Avatar seed={t.pseudo} size={28} radius={14} />}
                      <span className="why-social-pill">
                        <span className="mono" style={{ fontSize: 9, color: "var(--fg-faint)" }}>#{i + 1}</span>
                        <span style={{ fontSize: 11, fontWeight: 600 }}>{t.pseudo}</span>
                        <span className="mono" style={{ fontSize: 10, color: pnl >= 0 ? "var(--success)" : "var(--danger)", fontWeight: 700 }}>
                          {pnl >= 0 ? "+" : ""}{pnl.toFixed(0)} €
                        </span>
                      </span>
                      {side === "right" && <Avatar seed={t.pseudo} size={28} radius={14} />}
                    </div>
                  );
                }) : [0, 1, 2].map((i) => (
                  <div key={i} className={`why-social-row why-social-${i % 2 === 0 ? "right" : "left"}`} style={{ opacity: 0.3 }}>
                    <span className="why-social-pill">—</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        <div className="why-footer">
          <span className="mono" style={{ color: "var(--fg-faint)", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase" }}>
            Sources · ESA Copernicus · INPE PRODES · INPE DETER
          </span>
        </div>
      </div>
    </section>
  );
}
