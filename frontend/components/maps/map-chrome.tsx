"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  Crosshair,
  Layers as LayersIcon,
  Maximize2,
  Minimize2,
  Navigation,
  Ruler,
  Satellite,
  SlidersHorizontal,
  Square,
  X,
} from "lucide-react";

import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { BASEMAPS, HABITAT_META, SENSITIVITY_META, type BasemapId } from "@/lib/constants";
import { toDMS } from "@/utils/format";
import { EASE } from "@/components/shared/motion";
import { cn } from "@/lib/utils";
import type { LayerState } from "@/components/maps/gis-map";
import type { HabitatMask } from "@/types";

/* ------------------------------------------------------------------ */
/* layer control                                                       */
/* ------------------------------------------------------------------ */

const LAYER_LABELS: { key: keyof LayerState; label: string; hint: string }[] = [
  { key: "satellite", label: "Satellite imagery", hint: "Base scene" },
  { key: "habitat", label: "Habitat mask", hint: "Segmented patches" },
  { key: "heatmap", label: "Sensitivity heatmap", hint: "Marginal importance" },
  { key: "connectivity", label: "Connectivity graph", hint: "Functional links" },
  { key: "protectedAreas", label: "Protected areas", hint: "Notified boundaries" },
  { key: "labels", label: "Place labels", hint: "Hybrid basemap only" },
];

export function LayerControl({
  layers,
  onChange,
  basemap,
  onBasemapChange,
  heatOpacity,
  onHeatOpacityChange,
  open,
  onOpenChange,
}: {
  layers: LayerState;
  onChange: (next: LayerState) => void;
  basemap: BasemapId;
  onBasemapChange: (id: BasemapId) => void;
  heatOpacity: number;
  onHeatOpacityChange: (v: number) => void;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <div className="absolute right-3 top-3 z-[1000]">
      <AnimatePresence mode="wait">
        {open ? (
          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: 0.95, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -6 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="w-[264px] overflow-hidden rounded-2xl glass-strong shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-foreground/[0.08] px-3.5 py-2.5">
              <div className="flex items-center gap-2 text-[12px] font-semibold">
                <LayersIcon className="h-3.5 w-3.5 text-[#00c896]" />
                Layers
              </div>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                aria-label="Close layer panel"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* basemap */}
            <div className="border-b border-foreground/[0.08] p-3">
              <div className="mb-2 text-[9.5px] font-semibold uppercase tracking-widest text-muted-foreground">
                Basemap
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {BASEMAPS.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => onBasemapChange(b.id)}
                    className={cn(
                      "rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors",
                      basemap === b.id
                        ? "border-[#00c896]/40 bg-[#00c896]/12 text-[#00c896]"
                        : "border-foreground/[0.08] bg-foreground/[0.04] text-muted-foreground hover:bg-foreground/[0.08]",
                    )}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {/* toggles */}
            <div className="space-y-2.5 p-3">
              {LAYER_LABELS.map((l) => (
                <label
                  key={l.key}
                  className="flex cursor-pointer items-center justify-between gap-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[11.5px] font-medium">{l.label}</span>
                    <span className="block truncate text-[9.5px] text-muted-foreground">
                      {l.hint}
                    </span>
                  </span>
                  <Switch
                    checked={layers[l.key]}
                    onCheckedChange={(v) => onChange({ ...layers, [l.key]: v })}
                    aria-label={l.label}
                  />
                </label>
              ))}
            </div>

            {/* opacity */}
            <div className="border-t border-foreground/[0.08] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  <SlidersHorizontal className="h-3 w-3" />
                  Heatmap opacity
                </span>
                <span className="text-[11px] font-bold tabular text-[#00c896]">
                  {Math.round(heatOpacity * 100)}%
                </span>
              </div>
              <Slider
                value={heatOpacity * 100}
                min={0}
                max={100}
                onValueChange={(v) => onHeatOpacityChange(v / 100)}
                aria-label="Heatmap opacity"
              />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="button"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.18 }}
          >
            <Button
              size="icon"
              onClick={() => onOpenChange(true)}
              className="rounded-xl glass-strong text-foreground shadow-xl hover:bg-foreground/10"
              aria-label="Open layer panel"
            >
              <LayersIcon className="h-4 w-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* legend                                                              */
/* ------------------------------------------------------------------ */

export function MapLegend({
  mask,
  showHabitat = true,
  showSensitivity = true,
  className,
}: {
  mask: HabitatMask;
  showHabitat?: boolean;
  showSensitivity?: boolean;
  className?: string;
}) {
  /*
   * Collapsed by default: map panes vary a lot in height (split view halves
   * them), and an expanded legend can overrun a short pane. The sensitivity
   * ramp — the map's primary encoding — stays visible either way.
   */
  const [open, setOpen] = useState(false);

  return (
    <div
      className={cn(
        "pointer-events-auto w-[180px] overflow-hidden rounded-2xl glass-strong shadow-xl",
        className,
      )}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-foreground/[0.05]"
      >
        <span className="text-[9.5px] font-semibold uppercase tracking-widest text-muted-foreground">
          Legend
        </span>
        <ChevronDown
          className={cn(
            "ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform",
            !open && "-rotate-90",
          )}
        />
      </button>

      {/* Sensitivity ramp always visible — it is the map's primary encoding. */}
      {showSensitivity && (
        <div className="px-3 pb-2.5">
          <div className="h-2 rounded-full bg-gradient-to-r from-[#22c55e] via-[#f59e0b] to-[#ef4444]" />
          <div className="mt-1 flex justify-between text-[8.5px] text-muted-foreground">
            <span>Low</span>
            <span>Med</span>
            <span>High</span>
            <span>Crit</span>
          </div>
        </div>
      )}

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE }}
            className="overflow-hidden"
          >
            {showHabitat && (
              <div className="border-t border-foreground/[0.08] p-3">
                <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Habitat class
                </div>
                <div className="space-y-1">
                  {mask.classes.slice(0, 5).map((c) => (
                    <div key={c.habitatClass} className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-sm"
                        style={{ background: HABITAT_META[c.habitatClass].color }}
                      />
                      <span className="min-w-0 flex-1 truncate text-[9.5px] text-muted-foreground">
                        {c.label}
                      </span>
                      <span className="shrink-0 text-[9px] tabular text-muted-foreground/70">
                        {c.coveragePct}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-foreground/[0.08] p-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="h-0 w-4 shrink-0 border-t-2 border-dashed border-[#f59e0b]" />
                  <span className="text-[9.5px] text-muted-foreground">Critical corridor</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-0 w-4 shrink-0 border-t-2 border-[#38bdf8]" />
                  <span className="text-[9.5px] text-muted-foreground">Functional link</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-4 shrink-0 rounded-sm border border-dashed border-[#22c55e]" />
                  <span className="text-[9.5px] text-muted-foreground">Protected area</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* compass + scale + coordinates                                       */
/* ------------------------------------------------------------------ */

export function NorthArrow({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "grid h-11 w-11 place-items-center rounded-xl glass-strong shadow-xl",
        className,
      )}
      aria-label="North arrow"
    >
      <svg viewBox="0 0 32 32" className="h-7 w-7">
        <path d="M16 4 L20.5 20 L16 16.5 L11.5 20 Z" fill="#00c896" />
        <path d="M16 4 L11.5 20 L16 16.5 Z" fill="#00c896" fillOpacity="0.55" />
        <text
          x="16"
          y="30"
          textAnchor="middle"
          fontSize="9"
          fontWeight="700"
          fill="#f8fafc"
          fontFamily="var(--font-sans)"
        >
          N
        </text>
      </svg>
    </div>
  );
}

export function CoordinateReadout({
  cursor,
  zoom,
  epsg,
  className,
}: {
  cursor: { lat: number; lng: number } | null;
  zoom: number;
  epsg: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl glass-strong px-3 py-2 font-mono text-[10px] shadow-xl",
        className,
      )}
    >
      <Crosshair className="h-3 w-3 shrink-0 text-[#00c896]" />
      {cursor ? (
        <>
          <span className="tabular">{toDMS(cursor.lat, "lat")}</span>
          <span className="text-white/20">|</span>
          <span className="tabular">{toDMS(cursor.lng, "lng")}</span>
        </>
      ) : (
        <span className="text-muted-foreground">Move cursor over map</span>
      )}
      <span className="text-white/20">|</span>
      <span className="text-muted-foreground">z{zoom}</span>
      <span className="hidden text-muted-foreground sm:inline">{epsg}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* tool rail                                                           */
/* ------------------------------------------------------------------ */

export function MapToolbar({
  fullscreen,
  onToggleFullscreen,
  drawing,
  onToggleDraw,
  measuring,
  onToggleMeasure,
  onResetView,
  className,
}: {
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  drawing?: boolean;
  onToggleDraw?: () => void;
  measuring?: boolean;
  onToggleMeasure?: () => void;
  onResetView: () => void;
  className?: string;
}) {
  const tools = [
    {
      icon: fullscreen ? Minimize2 : Maximize2,
      label: fullscreen ? "Exit fullscreen" : "Fullscreen",
      onClick: onToggleFullscreen,
      active: false,
    },
    onToggleDraw && {
      icon: Square,
      label: drawing ? "Cancel drawing" : "Draw polygon",
      onClick: onToggleDraw,
      active: !!drawing,
    },
    onToggleMeasure && {
      icon: Ruler,
      label: measuring ? "Cancel measure" : "Measure distance",
      onClick: onToggleMeasure,
      active: !!measuring,
    },
    {
      icon: Navigation,
      label: "Reset view",
      onClick: onResetView,
      active: false,
    },
  ].filter(Boolean) as {
    icon: typeof Square;
    label: string;
    onClick: () => void;
    active: boolean;
  }[];

  return (
    <div
      className={cn(
        "flex flex-col gap-1 overflow-hidden rounded-xl glass-strong p-1 shadow-xl",
        className,
      )}
    >
      {tools.map((t) => (
        <Tooltip key={t.label} content={t.label} side="left">
          <button
            onClick={t.onClick}
            className={cn(
              "grid h-8 w-8 place-items-center rounded-lg transition-colors",
              t.active
                ? "bg-[#00c896]/18 text-[#00c896]"
                : "text-muted-foreground hover:bg-foreground/[0.08] hover:text-foreground",
            )}
            aria-label={t.label}
            aria-pressed={t.active}
          >
            <t.icon className="h-4 w-4" />
          </button>
        </Tooltip>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* mini map                                                            */
/* ------------------------------------------------------------------ */

export function MiniMap({
  scene,
  cursor,
  className,
}: {
  scene: { center: [number, number] | number[]; bounds: number[][] };
  cursor: { lat: number; lng: number } | null;
  className?: string;
}) {
  const [[minLat, minLng], [maxLat, maxLng]] = scene.bounds as [number[], number[]];
  const x = cursor ? ((cursor.lng - minLng) / (maxLng - minLng)) * 100 : null;
  const y = cursor ? ((maxLat - cursor.lat) / (maxLat - minLat)) * 100 : null;

  return (
    <div
      className={cn(
        "relative h-[86px] w-[112px] overflow-hidden rounded-xl glass-strong shadow-xl",
        className,
      )}
      aria-label="Mini map"
    >
      <div className="absolute inset-0 bg-[#04101f]" />
      <div className="absolute inset-0 bg-grid opacity-50" />
      <div className="absolute inset-[18%] rounded-md border border-[#00c896]/50 bg-[#00c896]/10" />
      <div className="absolute left-1.5 top-1.5 flex items-center gap-1 text-[8px] text-muted-foreground">
        <Satellite className="h-2.5 w-2.5" />
        Extent
      </div>
      {x !== null && y !== null && x >= 0 && x <= 100 && y >= 0 && y <= 100 && (
        <div
          className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#00c896] ring-2 ring-[#00c896]/30"
          style={{ left: `${x}%`, top: `${y}%` }}
        />
      )}
    </div>
  );
}
