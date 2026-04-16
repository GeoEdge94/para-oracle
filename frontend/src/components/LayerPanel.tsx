import { useMemo, useState } from "react";
import { Eye, EyeOff, ChevronDown, ChevronRight, Layers as LayersIcon, ArrowUp, ArrowDown, X } from "lucide-react";
import type { CategorisedLayer, LayerCategory } from "@/lib/layerCategories";
import { CATEGORY_META } from "@/lib/layerCategories";

type Props = {
  layers: CategorisedLayer[];
  onToggle: (slug: string) => void;
  onOpacity: (slug: string, opacity: number) => void;
  onReorder: (slug: string, direction: "up" | "down") => void;
  onClose?: () => void;
};

export function LayerPanel({ layers, onToggle, onOpacity, onReorder, onClose, defaultCollapsed = true }: Props & { defaultCollapsed?: boolean }) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [openCats, setOpenCats] = useState<Set<LayerCategory>>(new Set(["basemap", "ndvi"]));

  const grouped = useMemo(() => {
    const map = new Map<LayerCategory, CategorisedLayer[]>();
    for (const l of layers) {
      const bucket = map.get(l.category) ?? [];
      bucket.push(l);
      map.set(l.category, bucket);
    }
    return Array.from(map.entries()).sort(
      ([a], [b]) => CATEGORY_META[a].order - CATEGORY_META[b].order
    );
  }, [layers]);

  function toggleCat(c: LayerCategory) {
    setOpenCats((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="layer-panel-handle"
        title="Couches"
      >
        <LayersIcon size={18} />
      </button>
    );
  }

  return (
    <div className="layer-panel">
      <div className="layer-panel-header">
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <LayersIcon size={15} color="#10b981" />
          <span>Couches</span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={() => setCollapsed(true)} className="layer-panel-icon-btn" title="Reduire">
            <ChevronDown size={14} />
          </button>
          {onClose && (
            <button onClick={onClose} className="layer-panel-icon-btn" title="Fermer">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="layer-panel-body">
        {grouped.map(([cat, group]) => (
          <div key={cat} className="layer-group">
            <button onClick={() => toggleCat(cat)} className="layer-group-header">
              {openCats.has(cat) ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              <span style={{ marginLeft: 2 }}>{CATEGORY_META[cat].icon}</span>
              <span style={{ flex: 1, textAlign: "left" }}>{CATEGORY_META[cat].label}</span>
              <span style={{ fontSize: 10, color: "#64748b" }}>
                {group.filter((l) => l.visible).length}/{group.length}
              </span>
            </button>

            {openCats.has(cat) && (
              <div className="layer-group-items">
                {group.map((l, idx) => (
                  <LayerRow
                    key={l.slug}
                    layer={l}
                    isBasemap={cat === "basemap"}
                    canMoveUp={idx > 0}
                    canMoveDown={idx < group.length - 1}
                    onToggle={() => onToggle(l.slug)}
                    onOpacity={(op) => onOpacity(l.slug, op)}
                    onReorder={(dir) => onReorder(l.slug, dir)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function LayerRow({
  layer,
  isBasemap,
  canMoveUp,
  canMoveDown,
  onToggle,
  onOpacity,
  onReorder,
}: {
  layer: CategorisedLayer;
  isBasemap: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onToggle: () => void;
  onOpacity: (op: number) => void;
  onReorder: (dir: "up" | "down") => void;
}) {
  return (
    <div className="layer-row" data-visible={layer.visible}>
      <button onClick={onToggle} className="layer-row-toggle" title={layer.visible ? "Masquer" : "Afficher"}>
        {layer.visible ? <Eye size={14} color="#10b981" /> : <EyeOff size={14} color="#475569" />}
      </button>

      <div className="layer-row-info">
        <div className="layer-row-name" title={layer.name}>
          {layer.name}
        </div>
        {layer.visible && !isBasemap && (
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(layer.opacity * 100)}
            onChange={(e) => onOpacity(Number(e.target.value) / 100)}
            className="layer-row-opacity"
            title={`Opacite ${Math.round(layer.opacity * 100)}%`}
          />
        )}
      </div>

      {!isBasemap && (
        <div className="layer-row-order">
          <button
            onClick={() => onReorder("up")}
            disabled={!canMoveUp}
            className="layer-panel-icon-btn"
            title="Monter"
          >
            <ArrowUp size={11} />
          </button>
          <button
            onClick={() => onReorder("down")}
            disabled={!canMoveDown}
            className="layer-panel-icon-btn"
            title="Descendre"
          >
            <ArrowDown size={11} />
          </button>
        </div>
      )}
    </div>
  );
}
