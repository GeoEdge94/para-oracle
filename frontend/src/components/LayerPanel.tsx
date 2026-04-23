import { useMemo, useState } from "react";
import { Eye, EyeOff, ChevronDown, ChevronRight, Layers as LayersIcon, ArrowUp, ArrowDown, X, GripVertical } from "lucide-react";
import type { CategorisedLayer, LayerCategory } from "@/lib/layerCategories";
import { CATEGORY_ICONS, CATEGORY_I18N_KEYS } from "@/lib/layerCategories";
import { useI18n } from "@/lib/i18n";

type Props = {
  layers: CategorisedLayer[];
  onToggle: (slug: string) => void;
  onOpacity: (slug: string, opacity: number) => void;
  onReorder: (slug: string, direction: "up" | "down") => void;
  onClose?: () => void;
};

export function LayerPanel({ layers, onToggle, onOpacity, onReorder, onClose, defaultCollapsed = true }: Props & { defaultCollapsed?: boolean }) {
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [openCats, setOpenCats] = useState<Set<LayerCategory>>(new Set(["basemap", "ndvi"]));
  const [dragSlug, setDragSlug] = useState<string | null>(null);
  const [dropTargetSlug, setDropTargetSlug] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<LayerCategory, CategorisedLayer[]>();
    for (const l of layers) {
      const bucket = map.get(l.category) ?? [];
      bucket.push(l);
      map.set(l.category, bucket);
    }
    return Array.from(map.entries()).sort(
      ([a], [b]) => CATEGORY_ICONS[a].order - CATEGORY_ICONS[b].order
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

  // Drag-drop reorder: call onReorder(slug, dir) enough times to bubble
  // from srcIdx to targetIdx inside the same category group.
  function moveWithin(group: CategorisedLayer[], srcIdx: number, targetIdx: number) {
    if (srcIdx === targetIdx) return;
    const dir: "up" | "down" = targetIdx < srcIdx ? "up" : "down";
    const slug = group[srcIdx].slug;
    const steps = Math.abs(targetIdx - srcIdx);
    for (let i = 0; i < steps; i++) onReorder(slug, dir);
  }

  if (collapsed) {
    return (
      <button onClick={() => setCollapsed(false)} className="layer-panel-handle" title={t("layers.title")} aria-label={t("layers.title")}>
        <LayersIcon size={18} />
      </button>
    );
  }

  return (
    <div className="layer-panel">
      <div className="layer-panel-header">
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <LayersIcon size={15} color="var(--accent)" />
          <span>{t("layers.title")}</span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={() => setCollapsed(true)} className="layer-panel-icon-btn" title={t("common.reduce")} aria-label={t("common.reduce")}>
            <ChevronDown size={14} />
          </button>
          {onClose && (
            <button onClick={onClose} className="layer-panel-icon-btn" title={t("common.close")} aria-label={t("common.close")}>
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
              {(() => { const Icon = CATEGORY_ICONS[cat].icon; return <Icon size={13} style={{ marginLeft: 2 }} />; })()}
              <span style={{ flex: 1, textAlign: "left" }}>{t(CATEGORY_I18N_KEYS[cat])}</span>
              <span style={{ fontSize: 10, color: "var(--fg-faint)" }}>
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
                    isDragging={dragSlug === l.slug}
                    isDropTarget={dropTargetSlug === l.slug}
                    onToggle={() => onToggle(l.slug)}
                    onOpacity={(op) => onOpacity(l.slug, op)}
                    onReorder={(dir) => onReorder(l.slug, dir)}
                    onDragStart={() => setDragSlug(l.slug)}
                    onDragOver={() => setDropTargetSlug(l.slug)}
                    onDragEnd={() => { setDragSlug(null); setDropTargetSlug(null); }}
                    onDrop={() => {
                      if (!dragSlug || dragSlug === l.slug) { setDragSlug(null); setDropTargetSlug(null); return; }
                      const srcIdx = group.findIndex((g) => g.slug === dragSlug);
                      if (srcIdx >= 0) moveWithin(group, srcIdx, idx);
                      setDragSlug(null);
                      setDropTargetSlug(null);
                    }}
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

function LayerRow({ layer, isBasemap, canMoveUp, canMoveDown, isDragging, isDropTarget, onToggle, onOpacity, onReorder, onDragStart, onDragOver, onDragEnd, onDrop }: {
  layer: CategorisedLayer;
  isBasemap: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  onToggle: () => void;
  onOpacity: (op: number) => void;
  onReorder: (dir: "up" | "down") => void;
  onDragStart: () => void;
  onDragOver: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
}) {
  const { t } = useI18n();
  const draggable = !isBasemap;
  return (
    <div
      className="layer-row"
      data-visible={layer.visible}
      data-dragging={isDragging || undefined}
      data-drop-target={isDropTarget || undefined}
      draggable={draggable}
      onDragStart={(e) => {
        if (!draggable) return;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", layer.slug);
        onDragStart();
      }}
      onDragOver={(e) => {
        if (!draggable) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOver();
      }}
      onDragEnd={onDragEnd}
      onDrop={(e) => {
        if (!draggable) return;
        e.preventDefault();
        onDrop();
      }}
    >
      {draggable && (
        <span className="layer-row-grip" aria-hidden title={t("layers.move_up")}>
          <GripVertical size={11} />
        </span>
      )}
      <button onClick={onToggle} className="layer-row-toggle" title={layer.visible ? t("layers.hide_layer") : t("layers.show_layer")} aria-label={layer.visible ? t("layers.hide_layer") : t("layers.show_layer")}>
        {layer.visible ? <Eye size={14} color="var(--accent)" /> : <EyeOff size={14} color="#475569" />}
      </button>

      <div className="layer-row-info">
        <div className="layer-row-name" title={layer.name}>{layer.name}</div>
        {layer.visible && !isBasemap && (
          <input type="range" min={0} max={100} step={5}
            value={Math.round(layer.opacity * 100)}
            onChange={(e) => onOpacity(Number(e.target.value) / 100)}
            className="layer-row-opacity"
            title={t("layers.opacity", { pct: Math.round(layer.opacity * 100) })}
          />
        )}
      </div>

      {!isBasemap && (
        <div className="layer-row-order">
          <button onClick={() => onReorder("up")} disabled={!canMoveUp} className="layer-panel-icon-btn" title={t("layers.move_up")} aria-label={t("layers.move_up")}>
            <ArrowUp size={11} />
          </button>
          <button onClick={() => onReorder("down")} disabled={!canMoveDown} className="layer-panel-icon-btn" title={t("layers.move_down")} aria-label={t("layers.move_down")}>
            <ArrowDown size={11} />
          </button>
        </div>
      )}
    </div>
  );
}
