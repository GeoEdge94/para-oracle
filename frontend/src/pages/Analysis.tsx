import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { API, type Bet, type Layer, type OracleResult } from "@/lib/api";
import { ChevronLeft, Play, Copy } from "lucide-react";

type NDVILayerKey = "ndvi_t0" | "ndvi_t1" | "delta" | "mask";

const LAYER_SLUGS: Record<NDVILayerKey, string> = {
  ndvi_t0: "ndvi-t0",
  ndvi_t1: "ndvi-t1",
  delta: "delta-ndvi",
  mask: "mask-deforestation",
};

export function Analysis() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [bet, setBet] = useState<Bet | null>(null);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [active, setActive] = useState<Set<NDVILayerKey>>(new Set(["delta"]));
  const [result, setResult] = useState<OracleResult | null>(null);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    API.getBet(slug).then((r) => setBet(r.data));
    API.listLayers().then((r) => setLayers(r.data));
  }, [slug]);

  useEffect(() => {
    if (!mapContainer.current || !bet || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256 },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      center: [-52.5, -4.0],
      zoom: 5,
    });

    map.on("load", () => {
      if (bet.region_geojson) {
        map.addSource("para", { type: "geojson", data: { type: "Feature", properties: {}, geometry: bet.region_geojson } });
        map.addLayer({ id: "para-line", type: "line", source: "para", paint: { "line-color": "#10b981", "line-width": 2 } });
      }
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [bet]);

  async function resolve() {
    setResolving(true);
    try {
      const { data } = await API.resolveBet(slug);
      setResult(data);
      // refresh bet
      const r = await API.getBet(slug);
      setBet(r.data);
    } finally {
      setResolving(false);
    }
  }

  function toggle(k: NDVILayerKey) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  }

  if (!bet) return <div style={{ padding: 20 }}>Chargement...</div>;

  const resolved = bet.status.startsWith("RESOLVED");

  return (
    <div style={{ position: "relative", height: "100dvh" }}>
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 30,
        padding: "12px 16px", background: "rgba(15,23,42,0.9)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid #1e293b",
      }}>
        <button onClick={() => navigate("/")} style={{ background: "none", border: "none", color: "#cbd5e1" }}>
          <ChevronLeft size={22} />
        </button>
        <div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>Analyse NDVI</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{bet.region_name}</div>
        </div>
      </div>

      <div ref={mapContainer} style={{ position: "absolute", inset: 0 }} />

      {/* Layer toggles */}
      <div style={{
        position: "fixed", top: 72, right: 12, zIndex: 25,
        background: "rgba(30,41,59,0.95)", border: "1px solid #334155",
        borderRadius: 12, padding: 8, display: "flex", flexDirection: "column", gap: 4,
      }}>
        {(Object.keys(LAYER_SLUGS) as NDVILayerKey[]).map((k) => (
          <button key={k} onClick={() => toggle(k)} style={{
            padding: "6px 10px", fontSize: 11, borderRadius: 6,
            background: active.has(k) ? "#10b981" : "transparent",
            color: active.has(k) ? "#fff" : "#94a3b8", border: "none", textAlign: "left",
          }}>
            {k.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Bottom panel */}
      <div className="bottom-sheet" style={{ maxHeight: "55vh" }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{bet.question}</div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>
            Seuil : {bet.threshold_value} {bet.threshold_unit} · Seuil NDVI : Δ &lt; -{bet.ndvi_drop_threshold}
          </div>
        </div>

        {resolved ? (
          <div style={{ padding: 14, background: bet.result_bool ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)", borderRadius: 10, marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase" }}>Resultat</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: bet.result_bool ? "#34d399" : "#f87171" }}>
              {bet.result_bool ? "YES" : "NO"}
            </div>
            <div style={{ fontSize: 13, color: "#cbd5e1", marginTop: 4 }}>
              Surface deforestee : <strong>{Number(bet.resolved_value).toFixed(2)} km²</strong>
            </div>
          </div>
        ) : (
          <button className="btn btn-primary" onClick={resolve} disabled={resolving}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 }}>
            <Play size={16} /> {resolving ? "Resolution en cours..." : "Declencher l'oracle"}
          </button>
        )}

        {result && <EvidencePanel r={result} />}
      </div>
    </div>
  );
}

function EvidencePanel({ r }: { r: OracleResult }) {
  function copy(v: string) { navigator.clipboard.writeText(v); }
  const rows: [string, string][] = [
    ["IPFS CID", r.evidence.ipfs_cid],
    ["Script", r.evidence.script_hash],
    ["NDVI T0", r.evidence.ndvi_t0_hash],
    ["NDVI T1", r.evidence.ndvi_t1_hash],
    ["Delta", r.evidence.delta_hash],
    ["Mask", r.evidence.mask_hash],
  ];
  return (
    <div>
      <div style={{ fontSize: 11, color: "#94a3b8", textTransform: "uppercase", marginBottom: 6 }}>Preuves</div>
      <div style={{ fontSize: 11, color: "#cbd5e1", marginBottom: 8 }}>
        Produits Sentinel-2 : {r.evidence.sentinel_products_t0.length + r.evidence.sentinel_products_t1.length} scenes
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
            <span style={{ color: "#94a3b8", width: 60 }}>{k}</span>
            <code style={{ color: "#cbd5e1", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {v || "—"}
            </code>
            {v && <button onClick={() => copy(v)} style={{ background: "none", border: "none", color: "#94a3b8" }}><Copy size={12} /></button>}
          </div>
        ))}
      </div>
    </div>
  );
}
