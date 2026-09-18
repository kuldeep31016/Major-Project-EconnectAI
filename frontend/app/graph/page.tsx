"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Filter,
  Loader2,
  Map as MapIcon,
  Network,
  Share2,
  Star,
  Waypoints,
} from "lucide-react";

import { AppShell } from "@/components/dashboard/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { PixelInspector } from "@/components/maps/pixel-inspector";
import { GraphLegend } from "@/components/graph/connectivity-graph";
import { EASE } from "@/components/shared/motion";
import { useAnalysis } from "@/hooks/use-analysis";
import { getConnectivity, getGraph, getHabitatMask } from "@/lib/data";
import { SENSITIVITY_META } from "@/lib/constants";
import { fmtRatio } from "@/utils/format";

const ConnectivityGraph = dynamic(
  () => import("@/components/graph/connectivity-graph").then((m) => m.ConnectivityGraph),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full w-full place-items-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-[#15803d]" />
          <span className="text-[11px] text-muted-foreground">Building network…</span>
        </div>
      </div>
    ),
  },
);

export default function GraphPage() {
  const { sceneId, scene, selectedPatchId, setSelectedPatchId, removedPatchIds } = useAnalysis();

  const graph = getGraph(sceneId);
  const mask = getHabitatMask(sceneId);
  const conn = getConnectivity(sceneId);

  const [minStrength, setMinStrength] = useState(0);
  const [criticalOnly, setCriticalOnly] = useState(false);

  const selectedPatch = useMemo(
    () => mask.patches.find((p) => p.id === selectedPatchId) ?? null,
    [mask.patches, selectedPatchId],
  );

  const hubs = graph.nodes.filter((n) => n.isHub);
  const criticalNodes = graph.nodes.filter((n) => n.sensitivity === "critical");
  const criticalEdges = graph.edges.filter((e) => e.critical);
  const visibleEdges = graph.edges.filter(
    (e) => e.strength >= minStrength && (!criticalOnly || e.critical),
  );

  const ranked = [...graph.nodes].sort((a, b) => b.importance - a.importance);

  return (
    <AppShell
      title="Habitat Connectivity Graph"
      subtitle={`${graph.nodes.length} patches · ${graph.edges.length} functional links · ${graph.clusters.length} clusters`}
      bleed
      actions={
        <>
          <Button asChild variant="outline" size="sm" className="hidden md:inline-flex">
            <Link href="/analysis">
              <MapIcon className="h-3.5 w-3.5" />
              Map
            </Link>
          </Button>
          <Button asChild size="sm" className="bg-gradient-eco font-semibold text-[#ffffff]">
            <Link href="/simulation">
              Simulate
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </>
      }
    >
      <div className="flex h-[calc(100vh-4rem)] flex-col lg:flex-row">
        {/* ------------------------------------------------- graph pane */}
        <div className="relative min-h-[420px] flex-1 border-b border-foreground/[0.08] lg:border-b-0 lg:border-r">
          <div className="absolute inset-0 bg-aurora opacity-60" />

          <ConnectivityGraph
            key={sceneId}
            graph={graph}
            selectedPatchId={selectedPatchId}
            onSelectPatch={setSelectedPatchId}
            removedPatchIds={removedPatchIds}
            minStrength={minStrength}
            showCriticalOnly={criticalOnly}
            className="relative h-full w-full"
          />

          {/* filter panel */}
          <div className="absolute left-4 top-4 z-10 w-[236px] overflow-hidden rounded-2xl glass-strong shadow-xl">
            <div className="flex items-center gap-2 border-b border-foreground/[0.08] px-3.5 py-2.5 text-[12px] font-semibold">
              <Filter className="h-3.5 w-3.5 text-[#15803d]" />
              Network filters
            </div>
            <div className="space-y-3.5 p-3.5">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Min link strength
                  </span>
                  <span className="text-[11px] font-bold tabular text-[#15803d]">
                    {fmtRatio(minStrength)}
                  </span>
                </div>
                <Slider
                  value={minStrength * 100}
                  min={0}
                  max={90}
                  onValueChange={(v) => setMinStrength(v / 100)}
                  aria-label="Minimum link strength"
                />
                <div className="mt-1.5 text-[10px] text-muted-foreground">
                  {visibleEdges.length} of {graph.edges.length} links shown
                </div>
              </div>

              <label className="flex cursor-pointer items-center justify-between gap-3">
                <span>
                  <span className="block text-[11.5px] font-medium">Critical links only</span>
                  <span className="block text-[9.5px] text-muted-foreground">
                    {criticalEdges.length} bridging corridors
                  </span>
                </span>
                <Switch
                  checked={criticalOnly}
                  onCheckedChange={setCriticalOnly}
                  aria-label="Show critical links only"
                />
              </label>
            </div>
          </div>

          {/* legend */}
          <div className="pointer-events-none absolute inset-x-4 bottom-4 z-10 flex justify-center">
            <div className="pointer-events-auto max-w-full overflow-x-auto rounded-2xl glass-strong px-4 py-2.5 shadow-xl">
              <GraphLegend />
            </div>
          </div>

          <PixelInspector
            patch={selectedPatch}
            cell={null}
            graph={graph}
            onClose={() => setSelectedPatchId(null)}
          />
        </div>

        {/* ---------------------------------------------- side summary */}
        <aside className="scroll-slim w-full shrink-0 overflow-y-auto bg-sidebar/60 p-4 lg:w-[350px]">
          <div className="space-y-4">
            {/* topology */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Network topology</CardTitle>
                <CardDescription>{conn.grade ?? "Interface score (Eq. 7)"}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ["Nodes", graph.nodes.length, "#1e5f8a"],
                    ["Links", graph.edges.length, "#15803d"],
                    ["Clusters", graph.clusters.length, "#6d5bd0"],
                    ["Critical links", criticalEdges.length, "#f59e0b"],
                    ["Hub patches", hubs.length, "#22c55e"],
                    ["Link density", conn.linkDensity, "#94a3b8"],
                  ].map(([label, value, color]) => (
                    <div
                      key={label as string}
                      className="rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2.5"
                    >
                      <div className="text-[17px] font-bold leading-none tabular" style={{ color: color as string }}>
                        {value as number}
                      </div>
                      <div className="mt-1 text-[9.5px] uppercase tracking-wider text-muted-foreground">
                        {label as string}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* clusters */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Functional clusters</CardTitle>
                <CardDescription>Spatially coherent sub-networks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {graph.clusters.map((c, i) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.06, ease: EASE }}
                    className="flex items-center gap-2.5 rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2.5"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: c.color }}
                    />
                    <span className="min-w-0 flex-1 truncate text-[12px] font-medium">
                      {c.label}
                    </span>
                    <span className="shrink-0 text-[11px] tabular text-muted-foreground">
                      {c.nodeIds.length} patches
                    </span>
                  </motion.div>
                ))}
              </CardContent>
            </Card>

            {/* critical alert */}
            {criticalNodes.length > 0 && (
              <div className="rounded-2xl border border-[#ef4444]/20 bg-[#ef4444]/8 p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-[#ef4444]" />
                  <span className="text-[12px] font-semibold text-[#ef4444]">
                    {criticalNodes.length} critical bridge
                    {criticalNodes.length === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  These patches have no redundant route. Removing any one splits the network into
                  disconnected sub-graphs.
                </p>
                <div className="mt-3 space-y-1.5">
                  {criticalNodes.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => setSelectedPatchId(n.id)}
                      className="flex w-full items-center gap-2 rounded-lg border border-[#ef4444]/20 bg-[#ef4444]/8 px-2.5 py-2 text-left transition-colors hover:bg-[#ef4444]/16"
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#ef4444]" />
                      <span className="min-w-0 flex-1 truncate text-[11px]">{n.label}</span>
                      <span className="shrink-0 text-[10px] tabular text-[#ef4444]">
                        {n.degree} links
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ranked patches */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Patch importance ranking</CardTitle>
                <CardDescription>Quality-weighted betweenness centrality</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {ranked.slice(0, 8).map((n, i) => {
                  const sens = SENSITIVITY_META[n.sensitivity];
                  const active = n.id === selectedPatchId;
                  return (
                    <button
                      key={n.id}
                      onClick={() => setSelectedPatchId(active ? null : n.id)}
                      className={`flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors ${
                        active
                          ? "border-[#15803d]/35 bg-[#15803d]/10"
                          : "border-foreground/[0.08] bg-foreground/[0.03] hover:bg-foreground/[0.08]"
                      }`}
                    >
                      <span className="w-4 shrink-0 text-[10px] font-bold tabular text-muted-foreground">
                        {i + 1}
                      </span>
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: sens.color }}
                      />
                      <span className="min-w-0 flex-1 truncate text-[11.5px]">{n.label}</span>
                      {n.isHub && <Star className="h-3 w-3 shrink-0 text-[#f59e0b]" />}
                      <span className="shrink-0 text-[11px] font-bold tabular">
                        {Math.round(n.importance * 100)}
                      </span>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            {/* how to read */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Reading this graph</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 text-[11px] leading-relaxed text-muted-foreground">
                <div className="flex gap-2.5">
                  <Waypoints className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1e5f8a]" />
                  <span>
                    <b className="text-foreground">Node size</b> encodes patch area; the number is
                    ecological importance out of 100.
                  </span>
                </div>
                <div className="flex gap-2.5">
                  <Network className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#15803d]" />
                  <span>
                    <b className="text-foreground">Ring colour</b> is connectivity sensitivity —
                    red rings are irreplaceable bridges.
                  </span>
                </div>
                <div className="flex gap-2.5">
                  <Share2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#f59e0b]" />
                  <span>
                    <b className="text-foreground">Amber dashed links</b> are critical corridors;
                    line thickness is ecological flow strength.
                  </span>
                </div>
                <div className="flex gap-2.5">
                  <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#f59e0b]" />
                  <span>
                    <b className="text-foreground">Starred nodes</b> are hubs — high degree and
                    high bridging score.
                  </span>
                </div>
                <p className="pt-1">
                  Click any node to open its explainability panel, or click a link to trace which
                  species flows it carries.
                </p>
              </CardContent>
            </Card>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
