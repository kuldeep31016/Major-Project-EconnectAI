"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  FlaskConical,
  Loader2,
  Map as MapIcon,
  RotateCcw,
  Scissors,
  Sprout,
  Star,
} from "lucide-react";

import { AppShell } from "@/components/dashboard/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { SelectMenu } from "@/components/ui/select-menu";
import { PixelInspector } from "@/components/maps/pixel-inspector";
import { GraphLegend, type EdgeMark, type ExtraNode } from "@/components/graph/connectivity-graph";
import { GraphKey } from "@/components/graph/graph-key";
import { TwinResult } from "@/components/graph/twin-result";
import { pairKey } from "@/components/graph/layout";
import { EASE } from "@/components/shared/motion";
import { useAnalysis } from "@/hooks/use-analysis";
import { postScenario, type ScenarioResult } from "@/lib/api";
import { getConnectivity, getGraph, getHabitatMask, getRestoration } from "@/lib/data";
import { SENSITIVITY_META } from "@/lib/constants";
import { fmtRatio } from "@/utils/format";
import { cn } from "@/lib/utils";
import type { GraphEdge, HabitatGraph } from "@/types";

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

/** The restore what-if also returns the added site(s) — not in the shared ScenarioResult type. */
type AddedSite = { id: string; area_ha: number; centroid: [number, number] };
type TwinRes = ScenarioResult & { added?: AddedSite[] };
type TwinAnim = { kind: "remove" | "restore"; ids: string[]; phase: "run" | "done" };

/** Minimum time the removal animation plays before the recomputed result replaces it (presentation only). */
const REMOVE_ANIM_MS = 2300;

/** Least-squares line y = a·x + b (used to map patch centroids → the run's node coordinates). */
function fitLine(xs: number[], ys: number[]) {
  const n = xs.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n, my = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  const a = den ? num / den : 0;
  return (x: number) => a * x + (my - a * mx);
}

const CARD = "rounded-2xl border border-black/[0.06] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

export default function GraphPage() {
  const { sceneId, runId, dataSource, selectedPatchId, setSelectedPatchId, removedPatchIds } = useAnalysis();
  const restoration = getRestoration(sceneId);
  const graph = getGraph(sceneId);
  const mask = getHabitatMask(sceneId);
  const conn = getConnectivity(sceneId);

  // digital twin: one exact what-if at a time, scoped to (landscape, run)
  const twinScope = `${sceneId}|${runId}`;
  const [twin, setTwin] = useState<{ scope: string; busy: boolean; res: TwinRes | null; err: string | null; anim: TwinAnim | null }>({ scope: twinScope, busy: false, res: null, err: null, anim: null });
  const inScope = twin.scope === twinScope;
  const twinRes = inScope ? twin.res : null;
  const anim = inScope ? twin.anim : null;
  const [cand, setCand] = useState("");

  const runTwin = async (body: Record<string, unknown>, kind: TwinAnim["kind"], ids: string[]) => {
    const started = performance.now();
    setTwin({ scope: twinScope, busy: true, res: null, err: null, anim: { kind, ids, phase: "run" } });
    try {
      const res = (await postScenario(sceneId, runId, body)) as TwinRes;
      const wait = kind === "remove" ? REMOVE_ANIM_MS - (performance.now() - started) : 0;
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      setTwin({ scope: twinScope, busy: false, res, err: null, anim: { kind, ids, phase: "done" } });
    } catch (e) {
      setTwin({ scope: twinScope, busy: false, res: null, err: e instanceof Error ? e.message : String(e), anim: null });
    }
  };
  const resetTwin = () => setTwin({ scope: twinScope, busy: false, res: null, err: null, anim: null });

  const [minStrength, setMinStrength] = useState(0);
  const [criticalOnly, setCriticalOnly] = useState(false);

  const selectedPatch = useMemo(
    () => mask.patches.find((p) => p.id === selectedPatchId) ?? null,
    [mask.patches, selectedPatchId],
  );

  const hubs = graph.nodes.filter((n) => n.isHub);
  // cut vertices (articulation points): removing one increases the number of components
  const criticalNodes = graph.nodes.filter((n) => n.isCutVertex);
  const criticalEdges = graph.edges.filter((e) => e.critical);
  const visibleEdges = graph.edges.filter(
    (e) => e.strength >= minStrength && (!criticalOnly || e.critical),
  );
  const ranked = [...graph.nodes].sort((a, b) => b.importance - a.importance);
  const maxImp = Math.max(...graph.nodes.map((n) => n.importance), 1e-9);

  /*
   * The what-if network = the scenario's recomputed links (edges_after). Links that disappeared are kept as faint
   * red "lost" lines and new links are marked "gained" so the graph can animate the difference. Shared links keep
   * their original id so React Flow morphs them in place.
   */
  const gNodes = graph.nodes, gEdges = graph.edges, patches = mask.patches;
  const twinView = (() => {
    if (!twinRes?.edges_after) return null;
    const added = twinRes.added ?? [];
    const known = new Set([...gNodes.map((n) => n.id), ...added.map((a) => a.id)]);
    const base = new Map(gEdges.map((e) => [pairKey(e.source, e.target), e]));
    const after = new Map(twinRes.edges_after.filter((e) => known.has(e.source) && known.has(e.target)).map((e) => [pairKey(e.source, e.target), e]));
    const marks: Record<string, EdgeMark> = {};
    const edges: GraphEdge[] = [];
    after.forEach((e, k) => {
      const old = base.get(k);
      if (old) edges.push({ ...old, strength: e.weight, distanceKm: e.distance_km, resistance: 1 - e.weight, critical: false });
      else {
        marks[k] = "gained";
        edges.push({ id: `g-${k}`, source: e.source, target: e.target, strength: e.weight, distanceKm: e.distance_km, resistance: 1 - e.weight, critical: false, speciesFlow: [] });
      }
    });
    base.forEach((e, k) => { if (!after.has(k)) { marks[k] = "lost"; edges.push({ ...e, critical: false }); } });

    // place added restoration sites from their centroid, using the same lat/lon → node-space mapping as the run
    let extra: ExtraNode[] = [];
    if (added.length) {
      const pts = gNodes.flatMap((n) => {
        const p = patches.find((x) => x.id === n.patchId);
        return p ? [{ lat: p.center[0], lon: p.center[1], x: n.position.x, y: n.position.y }] : [];
      });
      if (pts.length >= 2) {
        const fx = fitLine(pts.map((p) => p.lon), pts.map((p) => p.x));
        const fy = fitLine(pts.map((p) => p.lat), pts.map((p) => p.y));
        extra = added.map((a) => ({ id: a.id, label: a.id, areaHa: a.area_ha, raw: { x: fx(a.centroid[1]), y: fy(a.centroid[0]) } }));
      }
    }
    return { edges, marks, extra };
  })();
  const viewGraph: HabitatGraph = twinView ? { ...graph, edges: twinView.edges } : graph;

  const removing = anim?.kind === "remove" && anim.phase === "run" ? anim.ids : undefined;
  const twinRemoved = twinRes?.removed_patch_ids ?? removedPatchIds;
  const lostCount = twinView ? Object.values(twinView.marks).filter((m) => m === "lost").length : 0;
  const gainedCount = twinView ? Object.values(twinView.marks).filter((m) => m === "gained").length : 0;

  const candOptions = [
    { value: "", label: "Pick a restoration site…" },
    ...restoration.actions.map((a) => ({
      value: a.id,
      label: `${a.id} · ${a.areaHa} ha`,
      hint: a.category === "uncertain_habitat" ? "Uncertain habitat · needs a field check" : a.newLinks != null ? `${a.newLinks} new link${a.newLinks === 1 ? "" : "s"}` : undefined,
    })),
  ];

  return (
    <AppShell
      title="Habitat Connectivity Graph"
      subtitle={`${graph.nodes.length} patches · ${graph.edges.length} links · ${graph.clusters.length} groups`}
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
        <div className="relative min-h-[420px] flex-1 overflow-hidden border-b border-[#0f5132]/10 lg:border-b-0 lg:border-r">
          {/* green-tinted canvas */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(900px 520px at 18% 8%, rgba(22,163,74,0.13), transparent 62%)," +
                "radial-gradient(760px 560px at 92% 96%, rgba(13,148,136,0.14), transparent 60%)," +
                "radial-gradient(520px 380px at 70% 30%, rgba(0,229,153,0.07), transparent 70%)," +
                "linear-gradient(180deg, #f3faf6 0%, #e9f5f0 100%)",
            }}
          />
          <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_120px_rgba(15,81,50,0.08)]" />

          <ConnectivityGraph
            key={sceneId}
            graph={viewGraph}
            selectedPatchId={selectedPatchId}
            onSelectPatch={setSelectedPatchId}
            removedPatchIds={twinRemoved}
            removingPatchIds={removing}
            edgeMarks={twinView?.marks}
            extraNodes={twinView?.extra}
            minStrength={minStrength}
            showCriticalOnly={criticalOnly}
            className="relative h-full w-full"
          />

          {/* filter panel */}
          <div className="absolute left-4 top-4 z-10 w-[224px] overflow-hidden rounded-2xl border border-black/[0.06] bg-white/90 shadow-[0_10px_30px_-12px_rgba(15,81,50,0.3)] backdrop-blur">
            <div className="space-y-3.5 p-3.5">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11.5px] font-semibold">Hide weak links</span>
                  <span className="rounded-full bg-[#f0fdf4] px-1.5 text-[11px] font-bold tabular text-[#15803d]">
                    ≥ {fmtRatio(minStrength)}
                  </span>
                </div>
                <Slider
                  value={minStrength * 100}
                  min={0}
                  max={90}
                  onValueChange={(v) => setMinStrength(v / 100)}
                  aria-label="Minimum link strength"
                />
                <div className="mt-1.5 text-[10.5px] text-muted-foreground tabular">
                  {visibleEdges.length} of {graph.edges.length} links shown
                </div>
              </div>

              <label className="flex cursor-pointer items-center justify-between gap-3">
                <span>
                  <span className="block text-[11.5px] font-semibold">Key links only</span>
                  <span className="block text-[10px] text-muted-foreground">{criticalEdges.length} hold parts together</span>
                </span>
                <Switch checked={criticalOnly} onCheckedChange={setCriticalOnly} aria-label="Show critical links only" />
              </label>
            </div>
          </div>

          {/* what-if banner on the canvas */}
          {anim && (
            <motion.div
              key={`${anim.kind}-${anim.ids.join()}-${anim.phase}`}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: EASE }}
              className={cn(
                "absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12px] font-semibold shadow-lg backdrop-blur",
                anim.kind === "remove" ? "border-[#dc2626]/20 bg-white/95 text-[#b91c1c]" : "border-[#16a34a]/20 bg-white/95 text-[#15803d]",
              )}
            >
              {anim.kind === "remove" ? <Scissors className="h-3.5 w-3.5" /> : <Sprout className="h-3.5 w-3.5" />}
              {anim.phase === "run"
                ? anim.kind === "remove" ? `Removing ${anim.ids.join(", ")}…` : `Adding ${anim.ids.join(", ")}…`
                : anim.kind === "remove"
                  ? `${anim.ids.join(", ")} removed · ${lostCount} link${lostCount === 1 ? "" : "s"} lost`
                  : `${anim.ids.join(", ")} added · ${gainedCount} new link${gainedCount === 1 ? "" : "s"}`}
              <span className="rounded-full bg-black/[0.05] px-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Simulated</span>
            </motion.div>
          )}

          {/* legend */}
          <div className="pointer-events-none absolute bottom-4 left-16 right-[160px] z-10 flex justify-center">
            <div className="pointer-events-auto max-w-full overflow-x-auto rounded-2xl border border-black/[0.06] bg-white/90 px-4 py-2.5 shadow-[0_10px_30px_-12px_rgba(15,81,50,0.3)] backdrop-blur">
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
        <aside className="scroll-slim w-full shrink-0 overflow-y-auto bg-[#f6faf8] p-4 lg:w-[360px]">
          <div className="space-y-3.5">
            {/* digital twin what-if */}
            <section className={CARD}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-[15px] font-bold tracking-tight">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#f0fdf4] text-[#15803d]"><FlaskConical className="h-4 w-4" /></span>
                  What if…?
                </h2>
                <Badge variant="warning">{twinRes?.label ?? "Simulation"}</Badge>
              </div>
              <p className="mt-1.5 text-[12px] text-muted-foreground">Remove a patch or add a site. Exact recount, not a forecast.</p>

              {dataSource.mode !== "live" ? (
                <div className="mt-3 rounded-xl bg-[#f8faf9] p-3 text-[12px] text-muted-foreground">Needs a live analysis run.</div>
              ) : (
                <div className="mt-3 space-y-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className={cn("h-10 w-full justify-start rounded-xl", selectedPatchId && "border-[#dc2626]/30 text-[#b91c1c] hover:bg-[#fef2f2]")}
                    disabled={!selectedPatchId || twin.busy}
                    onClick={() => {
                      if (!selectedPatchId) return;
                      const id = selectedPatchId;
                      setSelectedPatchId(null); // close the patch card so the whole network is visible for the animation
                      runTwin({ type: "remove_patches", patch_ids: [id] }, "remove", [id]);
                    }}
                  >
                    <Scissors className="h-4 w-4" />
                    {selectedPatchId ? `Remove ${selectedPatchId}` : "Click a patch to remove it"}
                  </Button>
                  <div className="flex gap-2">
                    <SelectMenu value={cand} options={candOptions} onChange={setCand} label="Restoration site" icon={Sprout} className="min-w-0 flex-1" />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-10 rounded-xl border-[#16a34a]/30 text-[#15803d] hover:bg-[#f0fdf4]"
                      disabled={!cand || twin.busy}
                      onClick={() => runTwin({ type: "restore", candidate_ids: [cand] }, "restore", [cand])}
                    >
                      Add
                    </Button>
                  </div>

                  {twin.busy && (
                    <div className="flex items-center gap-2 rounded-xl bg-[#f8faf9] px-3 py-2.5 text-[12px] text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#15803d]" /> Recomputing the network…
                    </div>
                  )}
                  {inScope && twin.err && <div className="rounded-xl bg-[#fef2f2] px-3 py-2 text-[12px] text-[#b91c1c]">{twin.err}</div>}
                  {twinRes?.scenario && <TwinResult key={`${twinRes.type}-${JSON.stringify(twinRes.parameters)}`} res={twinRes} />}
                  {twinRes && (
                    <button onClick={resetTwin} className="flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground">
                      <RotateCcw className="h-3.5 w-3.5" /> Back to the real network
                    </button>
                  )}
                </div>
              )}
            </section>

            {/* topology */}
            <section className={CARD}>
              <h2 className="text-[15px] font-bold tracking-tight">Network at a glance</h2>
              {conn.grade && <p className="mt-0.5 text-[12px] text-muted-foreground">{conn.grade}</p>}
              <div className="mt-3 grid grid-cols-3 gap-2">
                {([
                  ["Patches", graph.nodes.length, "#1e5f8a"],
                  ["Links", graph.edges.length, "#15803d"],
                  ["Groups", graph.clusters.length, "#6d5bd0"],
                  ["Key links", criticalEdges.length, "#f59e0b"],
                  ["Hubs", hubs.length, "#16a34a"],
                  ["Density", conn.linkDensity, "#64748b"],
                ] as const).map(([label, value, color]) => (
                  <div key={label} className="rounded-xl bg-[#f8faf9] px-2.5 py-2.5">
                    <div className="text-[19px] font-black leading-none tabular" style={{ color }}>{value}</div>
                    <div className="mt-1 text-[10.5px] font-semibold text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* bridge patches */}
            {criticalNodes.length > 0 && (
              <section className="rounded-2xl border border-[#dc2626]/15 bg-[#fef2f2] p-4">
                <div className="flex items-center gap-2 text-[13px] font-bold text-[#b91c1c]">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {criticalNodes.length} bridge patch{criticalNodes.length === 1 ? "" : "es"}
                </div>
                <p className="mt-1 text-[12px] text-[#7f1d1d]/80">Lose one and the network splits.</p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {criticalNodes.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => setSelectedPatchId(n.id)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-colors",
                        n.id === selectedPatchId ? "border-[#dc2626] bg-[#dc2626] text-white" : "border-[#dc2626]/20 bg-white text-[#b91c1c] hover:bg-[#fee2e2]",
                      )}
                    >
                      {n.label}
                      <span className="text-[10.5px] font-medium opacity-75">{n.degree} links</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* ranked patches */}
            <section className={CARD}>
              <h2 className="text-[15px] font-bold tracking-tight">Most important patches</h2>
              <p className="mt-0.5 text-[12px] text-muted-foreground">100 = the patch whose loss hurts most.</p>
              <div className="mt-3 space-y-1">
                {ranked.slice(0, 8).map((n, i) => {
                  const sens = SENSITIVITY_META[n.sensitivity];
                  const active = n.id === selectedPatchId;
                  const score = Math.round(n.importance * 100);
                  return (
                    <button
                      key={n.id}
                      onClick={() => setSelectedPatchId(active ? null : n.id)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors",
                        active ? "bg-[#f0fdf4] ring-1 ring-[#15803d]/30" : "hover:bg-[#f8faf9]",
                      )}
                    >
                      <span className="w-4 shrink-0 text-[11px] font-bold tabular text-muted-foreground">{i + 1}</span>
                      <span className="w-9 shrink-0 text-[12.5px] font-bold">{n.label}</span>
                      <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-black/[0.05]">
                        <motion.span
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{ background: sens.color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${(n.importance / maxImp) * 100}%` }}
                          transition={{ duration: 0.8, delay: i * 0.05, ease: EASE }}
                        />
                      </span>
                      {n.isHub ? <Star className="h-3 w-3 shrink-0 text-[#f59e0b]" fill="#f59e0b" /> : <span className="w-3 shrink-0" />}
                      <span className="w-7 shrink-0 text-right text-[12px] font-bold tabular">{score}</span>
                    </button>
                  );
                })}
              </div>
              <details className="group mt-2 text-[11px] text-muted-foreground">
                <summary className="cursor-pointer list-none font-semibold text-[#15803d] hover:underline">How is this calculated?</summary>
                <p className="mt-1 leading-relaxed">
                  Each patch is removed in turn and connectivity recomputed exactly. Criticality Sᵢ = ΔCᵢ / C(G) (paper Eq. 9),
                  scaled so the top patch is 100.
                </p>
              </details>
            </section>

            {/* clusters */}
            <section className={CARD}>
              <h2 className="text-[15px] font-bold tracking-tight">Connected groups</h2>
              <div className="mt-2.5 space-y-1.5">
                {graph.clusters.map((c, i) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.06, ease: EASE }}
                    className="flex items-center gap-2.5 rounded-xl bg-[#f8faf9] px-3 py-2"
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                    <span className="min-w-0 flex-1 truncate text-[12px] font-medium">{c.label}</span>
                    <span className="shrink-0 text-[11.5px] font-semibold tabular text-muted-foreground">
                      {c.nodeIds.length} patch{c.nodeIds.length === 1 ? "" : "es"}
                    </span>
                  </motion.div>
                ))}
              </div>
            </section>

            {/* how to read */}
            <section className={CARD}>
              <h2 className="mb-2.5 text-[15px] font-bold tracking-tight">How to read it</h2>
              <GraphKey tauKm={conn.research?.tauKm} k={conn.research?.k} />
            </section>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
