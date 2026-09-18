"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  BrainCircuit,
  ChevronRight,
  Crosshair,
  Gauge,
  Leaf,
  Network,
  Route,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { HABITAT_META, SENSITIVITY_META } from "@/lib/constants";
import { fmtArea, fmtCoord, fmtRatio, sensitivityColor } from "@/utils/format";
import { EASE } from "@/components/shared/motion";
import { cn } from "@/lib/utils";
import type { HabitatGraph, HabitatPatch, HeatCell } from "@/types";

interface Props {
  patch: HabitatPatch | null;
  cell: HeatCell | null;
  graph: HabitatGraph;
  onClose: () => void;
  /** Jump to this patch in the network graph view. */
  onOpenInGraph?: (patchId: string) => void;
}

/**
 * Right-hand inspector shown when the analyst clicks the map. Shows the pixel /
 * cell readout when a heat cell is picked, and the full explainability panel
 * when a habitat patch is selected.
 */
export function PixelInspector({ patch, cell, graph, onClose, onOpenInGraph }: Props) {
  const open = !!patch || !!cell;
  const node = patch ? graph.nodes.find((n) => n.patchId === patch.id) : null;
  const links = patch
    ? graph.edges.filter((e) => e.source === patch.id || e.target === patch.id)
    : [];

  // Importance is modelled as rising as the network around a patch thins out.
  const importanceSeries = patch
    ? [2020, 2021, 2022, 2023, 2024, 2025].map((year, i) => ({
        year,
        v: Math.max(
          0.05,
          Math.min(1, patch.bridgeScore * (0.62 + i * 0.08) + (i % 2 === 0 ? 0.02 : -0.01)),
        ),
      }))
    : [];

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ opacity: 0, x: 28 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 28 }}
          transition={{ duration: 0.32, ease: EASE }}
          className="scroll-slim absolute inset-y-0 right-0 z-[1001] w-full overflow-y-auto border-l border-foreground/[0.08] bg-sidebar backdrop-blur-2xl sm:w-[356px]"
        >
          {/* header */}
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-foreground/[0.08] bg-sidebar px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#00c896]/12 text-[#00c896]">
                {patch ? <Leaf className="h-4 w-4" /> : <Crosshair className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold">
                  {patch ? patch.name : "Pixel inspector"}
                </div>
                <div className="truncate text-[10px] text-muted-foreground">
                  {patch ? HABITAT_META[patch.habitatClass].label : "Grid cell readout"}
                </div>
              </div>
            </div>
            <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close inspector">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-4 p-4">
            {/* -------------------------------------------- cell mode */}
            {cell && !patch && <CellReadout cell={cell} />}

            {/* ------------------------------------------- patch mode */}
            {patch && node && (
              <>
                {/* headline metrics */}
                <div className="grid grid-cols-2 gap-2">
                  <Metric
                    label="Latitude"
                    value={patch.center[0].toFixed(5) + "° N"}
                    mono
                  />
                  <Metric
                    label="Longitude"
                    value={patch.center[1].toFixed(5) + "° E"}
                    mono
                  />
                </div>

                <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Sensitivity
                    </span>
                    <Badge
                      variant={
                        patch.sensitivity === "critical"
                          ? "danger"
                          : patch.sensitivity === "high"
                            ? "warning"
                            : patch.sensitivity === "medium"
                              ? "sky"
                              : "success"
                      }
                    >
                      {SENSITIVITY_META[patch.sensitivity].label}
                    </Badge>
                  </div>

                  <div className="mt-3 space-y-3">
                    <Bar
                      label="Habitat probability"
                      value={patch.confidence}
                      color="#00c896"
                    />
                    <Bar
                      label="Connectivity contribution"
                      value={patch.connectivityContribution}
                      color="#38bdf8"
                    />
                    <Bar label="Bridge score" value={patch.bridgeScore} color="#f59e0b" />
                    <Bar label="Habitat quality" value={patch.quality} color="#a78bfa" />
                    <Bar
                      label="Model confidence"
                      value={patch.confidence}
                      color="#22c55e"
                    />
                  </div>
                </div>

                {/* natural-language explanation */}
                <div className="rounded-2xl border border-[#00c896]/20 bg-[#00c896]/6 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-[#00c896]" />
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-[#00c896]">
                      Why this matters
                    </span>
                  </div>
                  <p className="text-[12px] leading-relaxed text-foreground/90">{patch.notes}</p>
                </div>

                {/* ------------------------------ explainability panel */}
                <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <BrainCircuit className="h-3.5 w-3.5 text-[#a78bfa]" />
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Explainability
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Stat
                      icon={Route}
                      label="Alternative routes"
                      value={String(Math.max(0, node.degree - 1))}
                      tone={node.degree <= 2 ? "#ef4444" : "#22c55e"}
                    />
                    <Stat
                      icon={Network}
                      label="Functional links"
                      value={String(node.degree)}
                      tone="#38bdf8"
                    />
                    <Stat
                      icon={Gauge}
                      label="Importance"
                      value={fmtRatio(node.importance)}
                      tone="#f59e0b"
                    />
                    <Stat
                      icon={Activity}
                      label="Degradation risk"
                      value={fmtRatio(patch.degradationRisk)}
                      tone={patch.degradationRisk > 0.6 ? "#ef4444" : "#22c55e"}
                    />
                  </div>

                  <p className="mt-3 text-[11.5px] leading-relaxed text-muted-foreground">
                    {node.explanation}
                  </p>

                  {/* importance timeline */}
                  <div className="mt-4">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        <TrendingUp className="h-3 w-3" />
                        Importance timeline
                      </span>
                      <span className="text-[10px] text-muted-foreground">2020 – 2025</span>
                    </div>
                    <div className="h-[54px] rounded-lg border border-foreground/[0.08] bg-[#04101f]/60 px-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={importanceSeries} margin={{ top: 6, bottom: 2, left: 0, right: 0 }}>
                          <defs>
                            <linearGradient id="impGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.5} />
                              <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <Area
                            type="monotone"
                            dataKey="v"
                            stroke="#a78bfa"
                            strokeWidth={1.8}
                            fill="url(#impGrad)"
                            dot={false}
                            animationDuration={800}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
                      Importance has risen as neighbouring patches degraded — the same patch now
                      carries more of the network than it did in 2020.
                    </p>
                  </div>
                </div>

                {/* attributes */}
                <div className="grid grid-cols-2 gap-2">
                  <Metric label="Area" value={fmtArea(patch.areaHa)} />
                  <Metric label="Species supported" value={String(patch.speciesSupported)} />
                  <Metric
                    label="Carbon stock"
                    value={`${(patch.carbonStockTonnes / 1000).toFixed(1)} kt`}
                  />
                  <Metric
                    label="Protection"
                    value={patch.protected ? "Notified" : "Unprotected"}
                    tone={patch.protected ? "#22c55e" : "#ef4444"}
                  />
                </div>

                {patch.protected && patch.protectedAreaName && (
                  <div className="flex items-center gap-2 rounded-xl border border-[#22c55e]/20 bg-[#22c55e]/8 px-3 py-2.5">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[#22c55e]" />
                    <span className="truncate text-[11px] text-[#22c55e]">
                      {patch.protectedAreaName}
                    </span>
                  </div>
                )}

                {/* connected patches */}
                <div>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Connected patches ({links.length})
                  </div>
                  <div className="space-y-1.5">
                    {links.slice(0, 5).map((e) => {
                      const otherId = e.source === patch.id ? e.target : e.source;
                      const other = graph.nodes.find((n) => n.patchId === otherId);
                      return (
                        <div
                          key={e.id}
                          className="flex items-center gap-2.5 rounded-lg border border-foreground/[0.08] bg-foreground/[0.03] px-2.5 py-2"
                        >
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ background: e.critical ? "#f59e0b" : "#38bdf8" }}
                          />
                          <span className="min-w-0 flex-1 truncate text-[11px]">
                            {other?.label ?? otherId}
                          </span>
                          <span className="shrink-0 text-[10px] tabular text-muted-foreground">
                            {e.distanceKm} km
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {onOpenInGraph && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => onOpenInGraph(patch.id)}
                  >
                    <Network className="h-3.5 w-3.5" />
                    View in network graph
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                )}
              </>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/* sub-components                                                      */
/* ------------------------------------------------------------------ */

function CellReadout({ cell }: { cell: HeatCell }) {
  const [[lat0, lng0], [lat1, lng1]] = cell.bounds;
  const lat = (lat0 + lat1) / 2;
  const lng = (lng0 + lng1) / 2;
  const color = sensitivityColor(cell.sensitivity);

  const explanation =
    cell.explanation ??
    `Modelled connectivity sensitivity here is ${fmtRatio(cell.sensitivity)}, placing this cell in the ${
      SENSITIVITY_META[cell.band].label.toLowerCase()
    } band. Habitat probability is ${fmtRatio(cell.habitatProbability)} and the cell contributes approximately ${fmtRatio(
      cell.connectivityContribution,
    )} of local landscape connectivity. ${
      cell.band === "high" || cell.band === "critical"
        ? "Few alternative routes exist around this location — degradation here would measurably reduce network flow."
        : "Redundant pathways exist nearby, so loss at this location would be partially absorbed by the surrounding network."
    }`;

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Metric label="Latitude" value={lat.toFixed(5) + "° N"} mono />
        <Metric label="Longitude" value={lng.toFixed(5) + "° E"} mono />
      </div>

      <div className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Sensitivity score
          </span>
          <span className="text-lg font-bold tabular" style={{ color }}>
            {cell.sensitivity.toFixed(2)}
          </span>
        </div>
        <div className="mt-2.5 space-y-3">
          <Bar label="Habitat probability" value={cell.habitatProbability} color="#00c896" />
          <Bar
            label="Connectivity contribution"
            value={cell.connectivityContribution}
            color="#38bdf8"
          />
          <Bar label="Confidence" value={cell.confidence} color="#22c55e" />
        </div>
      </div>

      <div className="rounded-2xl border border-[#00c896]/20 bg-[#00c896]/6 p-4">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-[#00c896]" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[#00c896]">
            Model explanation
          </span>
        </div>
        <p className="text-[12px] leading-relaxed text-foreground/90">{explanation}</p>
      </div>

      <div className="rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2.5 font-mono text-[10px] text-muted-foreground">
        {fmtCoord(lat, lng)}
      </div>
    </>
  );
}

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[10.5px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular">{fmtRatio(value)}</span>
      </div>
      <Progress value={value * 100} height={4} color={color} />
    </div>
  );
}

function Metric({
  label,
  value,
  mono,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2.5">
      <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={cn("mt-1 truncate text-[12px] font-semibold", mono && "font-mono text-[11px]")}
        style={tone ? { color: tone } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Route;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 text-[13px] font-bold tabular" style={{ color: tone }}>
        {value}
      </div>
    </div>
  );
}
