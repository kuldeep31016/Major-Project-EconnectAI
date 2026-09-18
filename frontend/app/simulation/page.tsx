"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Coins,
  Fish,
  Loader2,
  MousePointerClick,
  Pencil,
  RotateCcw,
  Route,
  Sparkles,
  Sprout,
  Target,
  TrendingDown,
  Waves as WavesIcon,
  Wind,
} from "lucide-react";

import { AppShell } from "@/components/dashboard/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Tabs } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScoreDelta, ImpactRow } from "@/components/simulation/score-delta";
import { ScenarioLineChart, PriorityBarChart, TimelineAreaChart } from "@/components/charts";
import type { LayerState } from "@/components/maps/gis-map";
import { EASE } from "@/components/shared/motion";
import { useAnalysis } from "@/hooks/use-analysis";
import {
  getConnectivity,
  getGraph,
  getHabitatMask,
  getHeatmap,
  getRestoration,
  getSimulation,
  getTimeline,
} from "@/lib/data";
import { fmtArea, fmtCurrency, fmtRatio } from "@/utils/format";
import { cn } from "@/lib/utils";
import type { LatLng, ScenarioId } from "@/types";

const GisMap = dynamic(() => import("@/components/maps/gis-map"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center bg-[#04101f]">
      <Loader2 className="h-6 w-6 animate-spin text-[#00c896]" />
    </div>
  ),
});

const SCENARIO_ICONS: Record<ScenarioId, typeof Wind> = {
  cyclone: Wind,
  "urban-expansion": Building2,
  "sea-level-rise": WavesIcon,
  aquaculture: Fish,
  "road-construction": Route,
  encroachment: AlertTriangle,
};

type Mode = "whatif" | "scenario" | "restore" | "timeline";

export default function SimulationPage() {
  const {
    sceneId,
    scene,
    removedPatchIds,
    togglePatchRemoved,
    clearRemoved,
    activeScenarioId,
    setActiveScenarioId,
    year,
    setYear,
    selectedPatchId,
    setSelectedPatchId,
  } = useAnalysis();

  const mask = getHabitatMask(sceneId);
  const graph = getGraph(sceneId);
  const heatmap = getHeatmap(sceneId);
  const conn = getConnectivity(sceneId);
  const sim = getSimulation(sceneId);
  const restoration = getRestoration(sceneId);
  const timeline = getTimeline(sceneId);

  const [mode, setMode] = useState<Mode>("whatif");
  const [drawing, setDrawing] = useState(false);
  const [polygon, setPolygon] = useState<LatLng[]>([]);
  const [computing, setComputing] = useState(false);
  const [budgetLakh, setBudgetLakh] = useState(180);

  const activeScenario = sim.scenarios.find((s) => s.id === activeScenarioId) ?? null;
  const activeYear = timeline.years.find((y) => y.year === year) ?? timeline.years.at(-1)!;

  /* -------------------------------------------------- what-if maths */

  // Removing a patch deletes its links; connectivity falls faster than area.
  const whatIf = useMemo(() => {
    if (!removedPatchIds.length) return null;

    const removedPatches = mask.patches.filter((p) => removedPatchIds.includes(p.id));
    const lostHa = removedPatches.reduce((s, p) => s + p.areaHa, 0);
    const lostPct = (lostHa / mask.totals.habitatAreaHa) * 100;

    const severedEdges = graph.edges.filter(
      (e) => removedPatchIds.includes(e.source) || removedPatchIds.includes(e.target),
    );

    // Connectivity loss weights bridging role far above raw area.
    const bridgeLoss = removedPatches.reduce(
      (s, p) => s + p.bridgeScore * 9 + p.connectivityContribution * 22,
      0,
    );
    const areaLoss = lostPct * 0.22;
    const drop = Math.min(conn.score * 0.85, bridgeLoss + areaLoss);
    const after = Math.max(0, conn.score - drop);

    // Patches left with no surviving link.
    const survivingEdges = graph.edges.filter(
      (e) => !removedPatchIds.includes(e.source) && !removedPatchIds.includes(e.target),
    );
    const connected = new Set<string>();
    survivingEdges.forEach((e) => {
      connected.add(e.source);
      connected.add(e.target);
    });
    const isolated = mask.patches.filter(
      (p) => !removedPatchIds.includes(p.id) && !connected.has(p.id),
    );

    return {
      removed: removedPatches,
      lostHa,
      lostPct,
      severedEdges,
      isolated,
      after,
      drop,
      ratio: lostPct > 0 ? drop / lostPct : 0,
      carbonLost: removedPatches.reduce((s, p) => s + p.carbonStockTonnes, 0),
      speciesAffected: removedPatches.reduce((s, p) => s + p.speciesSupported, 0),
    };
  }, [removedPatchIds, mask.patches, mask.totals.habitatAreaHa, graph.edges, conn.score]);

  /* ------------------------------------------------ restoration band */

  const band = useMemo(() => {
    const bands = restoration.budgetBands;
    return (
      [...bands].reverse().find((b) => budgetLakh >= b.minLakh) ?? bands[0]
    );
  }, [budgetLakh, restoration.budgetBands]);

  const fundedActions = restoration.actions.filter((a) => band.actionIds.includes(a.id));
  const restoredScore = Math.min(100, conn.score + band.totalGain);

  /* ---------------------------------------------- map layer wiring */

  const layers: LayerState = {
    satellite: true,
    habitat: true,
    heatmap: mode === "scenario" || mode === "timeline",
    connectivity: true,
    protectedAreas: mode === "restore",
    labels: false,
  };

  const degradedIds =
    mode === "scenario" && activeScenario
      ? activeScenario.affectedPatchIds
      : mode === "timeline"
        ? activeYear.degradedPatchIds
        : [];

  const handleDrawPoint = useCallback(
    (p: LatLng) => {
      setPolygon((prev) => [...prev, p]);
    },
    [],
  );

  /** Close the polygon and remove every patch whose centroid falls inside it. */
  const applyPolygon = () => {
    if (polygon.length < 3) return;
    setComputing(true);

    window.setTimeout(() => {
      const inside = mask.patches.filter((p) => pointInPolygon(p.center, polygon));
      inside.forEach((p) => {
        if (!removedPatchIds.includes(p.id)) togglePatchRemoved(p.id);
      });
      setDrawing(false);
      setPolygon([]);
      setComputing(false);
    }, 1200);
  };

  const resetAll = () => {
    clearRemoved();
    setPolygon([]);
    setDrawing(false);
    setActiveScenarioId(null);
  };

  return (
    <AppShell
      title="Simulation"
      subtitle={`${scene.name} · baseline connectivity ${conn.score.toFixed(1)}`}
      bleed
      actions={
        <>
          <Button variant="outline" size="sm" onClick={resetAll}>
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
        </>
      }
    >
      <div className="flex h-[calc(100vh-4rem)] flex-col xl:flex-row">
        {/* -------------------------------------------------- map pane */}
        <div className="relative min-h-[380px] flex-1 border-b border-foreground/[0.08] xl:border-b-0 xl:border-r">
          <GisMap
            key={`sim-${sceneId}`}
            scene={scene}
            mask={mask}
            graph={graph}
            heatmap={heatmap}
            layers={layers}
            basemap="satellite"
            heatOpacity={0.6}
            selectedPatchId={selectedPatchId}
            onSelectPatch={(id) => {
              if (mode === "whatif" && id) {
                togglePatchRemoved(id);
              } else {
                setSelectedPatchId(id);
              }
            }}
            removedPatchIds={removedPatchIds}
            degradedPatchIds={degradedIds}
            drawing={drawing}
            drawnPolygon={polygon}
            onDrawPoint={handleDrawPoint}
            className="h-full w-full"
          />

          {/* drawing overlay */}
          <AnimatePresence>
            {drawing && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="absolute left-1/2 top-4 z-[1000] -translate-x-1/2 rounded-2xl glass-strong px-4 py-3 shadow-2xl"
              >
                <div className="flex items-center gap-3">
                  <MousePointerClick className="h-4 w-4 shrink-0 animate-pulse text-[#ef4444]" />
                  <div className="text-[12px]">
                    <div className="font-semibold">Click the map to trace an impact area</div>
                    <div className="text-[10.5px] text-muted-foreground">
                      {polygon.length} point{polygon.length === 1 ? "" : "s"} placed · minimum 3
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setDrawing(false);
                        setPolygon([]);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={polygon.length < 3 || computing}
                      onClick={applyPolygon}
                      className="bg-[#ef4444] font-semibold text-white hover:opacity-90"
                    >
                      {computing ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Removing…
                        </>
                      ) : (
                        "Remove habitat"
                      )}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* computing scrim */}
          <AnimatePresence>
            {computing && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-[1001] grid place-items-center bg-[#050816]/70 backdrop-blur-sm"
              >
                <div className="flex flex-col items-center gap-3 rounded-2xl glass-strong px-8 py-6 shadow-2xl">
                  <Loader2 className="h-7 w-7 animate-spin text-[#ef4444]" />
                  <div className="text-center">
                    <div className="text-[13px] font-semibold">Removing habitat…</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      Re-solving network topology and connectivity indices
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* mode-specific map badge */}
          <div className="pointer-events-none absolute bottom-4 left-4 z-[1000]">
            <div className="rounded-xl glass-strong px-3 py-2 shadow-xl">
              <div className="text-[9.5px] uppercase tracking-widest text-muted-foreground">
                {mode === "whatif"
                  ? "What-if simulator"
                  : mode === "scenario"
                    ? "Scenario projection"
                    : mode === "restore"
                      ? "Restoration planner"
                      : "Temporal analysis"}
              </div>
              <div className="mt-0.5 text-[12px] font-semibold">
                {mode === "whatif"
                  ? `${removedPatchIds.length} patch${removedPatchIds.length === 1 ? "" : "es"} removed`
                  : mode === "scenario"
                    ? (activeScenario?.name ?? "No scenario active")
                    : mode === "restore"
                      ? `${fundedActions.length} interventions funded`
                      : `Year ${activeYear.year}`}
              </div>
            </div>
          </div>

          {mode === "whatif" && !drawing && (
            <div className="absolute bottom-4 right-4 z-[1000]">
              <Button
                onClick={() => setDrawing(true)}
                className="rounded-xl bg-[#ef4444] font-semibold text-white shadow-2xl hover:opacity-90"
              >
                <Pencil className="h-3.5 w-3.5" />
                Draw impact area
              </Button>
            </div>
          )}
        </div>

        {/* ------------------------------------------------ control pane */}
        <aside className="scroll-slim w-full shrink-0 overflow-y-auto bg-sidebar/60 xl:w-[400px]">
          <div className="sticky top-0 z-10 border-b border-foreground/[0.08] bg-sidebar/95 p-3 backdrop-blur">
            <Tabs
              className="w-full"
              layoutId="sim-mode"
              size="sm"
              value={mode}
              onValueChange={(v) => setMode(v as Mode)}
              items={[
                { value: "whatif", label: "What-if", icon: Target },
                { value: "scenario", label: "Scenarios", icon: Wind },
                { value: "restore", label: "Restore", icon: Sprout },
                { value: "timeline", label: "Timeline", icon: Clock },
              ]}
            />
          </div>

          <div className="space-y-4 p-4">
            {/*
              Enter-only animation, keyed on mode. AnimatePresence mode="wait"
              hangs its exit transition here (framer-motion 13 + React 19),
              which leaves the previous panel mounted forever — so the panel
              swaps immediately and only animates in.
            */}
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="space-y-4"
            >
              {/* ------------------------------------------ what-if */}
              {mode === "whatif" && (
                <div className="space-y-4">
                  {!whatIf ? (
                    <Card>
                      <CardContent className="p-5 text-center">
                        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#ef4444]/12 text-[#ef4444]">
                          <Target className="h-6 w-6" />
                        </div>
                        <h3 className="mt-4 text-[14px] font-semibold">Simulate habitat loss</h3>
                        <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                          Click any habitat patch on the map to remove it, or draw a polygon to
                          remove everything inside. The network re-solves and shows how much
                          connectivity depends on what you took away.
                        </p>
                        <Button
                          onClick={() => setDrawing(true)}
                          className="mt-4 w-full bg-[#ef4444] font-semibold text-white hover:opacity-90"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Draw impact area
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      <ScoreDelta before={conn.score} after={whatIf.after} />

                      {/* disproportionality callout */}
                      <div className="rounded-2xl border border-[#f59e0b]/20 bg-[#f59e0b]/8 p-4">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 shrink-0 text-[#f59e0b]" />
                          <span className="text-[11px] font-semibold uppercase tracking-widest text-[#f59e0b]">
                            Model interpretation
                          </span>
                        </div>
                        <p className="mt-2 text-[12px] leading-relaxed text-foreground/90">
                          You removed <b>{fmtArea(whatIf.lostHa)}</b> —{" "}
                          {whatIf.lostPct.toFixed(1)}% of habitat area — but connectivity fell{" "}
                          <b>{whatIf.drop.toFixed(1)} points</b>. That is{" "}
                          <b>{whatIf.ratio.toFixed(1)}×</b> the area loss, the signature of removing
                          bridging patches rather than interior habitat.
                          {whatIf.isolated.length > 0 && (
                            <>
                              {" "}
                              <b>{whatIf.isolated.length}</b> further patch
                              {whatIf.isolated.length === 1 ? " is" : "es are"} now fully isolated.
                            </>
                          )}
                        </p>
                      </div>

                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle>Cascade impact</CardTitle>
                          <CardDescription>Direct and knock-on effects</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <ImpactRow
                            label="Connectivity score"
                            before={conn.score}
                            after={Number(whatIf.after.toFixed(1))}
                            unit="/100"
                            index={0}
                          />
                          <ImpactRow
                            label="Habitat area"
                            before={Math.round(mask.totals.habitatAreaHa)}
                            after={Math.round(mask.totals.habitatAreaHa - whatIf.lostHa)}
                            unit="ha"
                            index={1}
                          />
                          <ImpactRow
                            label="Functional links"
                            before={graph.edges.length}
                            after={graph.edges.length - whatIf.severedEdges.length}
                            unit="links"
                            index={2}
                          />
                          <ImpactRow
                            label="Carbon stock"
                            before={Math.round(
                              mask.patches.reduce((s, p) => s + p.carbonStockTonnes, 0) / 1000,
                            )}
                            after={Math.round(
                              (mask.patches.reduce((s, p) => s + p.carbonStockTonnes, 0) -
                                whatIf.carbonLost) /
                                1000,
                            )}
                            unit="kt"
                            index={3}
                          />
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle>Removed patches ({whatIf.removed.length})</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1.5">
                          {whatIf.removed.map((p) => (
                            <div
                              key={p.id}
                              className="flex items-center gap-2.5 rounded-xl border border-[#ef4444]/20 bg-[#ef4444]/8 px-3 py-2"
                            >
                              <span className="min-w-0 flex-1 truncate text-[11.5px]">
                                {p.name}
                              </span>
                              <span className="shrink-0 text-[10px] tabular text-muted-foreground">
                                {p.areaHa} ha
                              </span>
                              <button
                                onClick={() => togglePatchRemoved(p.id)}
                                className="shrink-0 text-[10px] font-medium text-[#00c896] hover:underline"
                              >
                                restore
                              </button>
                            </div>
                          ))}

                          {whatIf.isolated.length > 0 && (
                            <div className="!mt-3 rounded-xl border border-[#f59e0b]/20 bg-[#f59e0b]/8 p-3">
                              <div className="text-[11px] font-semibold text-[#f59e0b]">
                                {whatIf.isolated.length} patch
                                {whatIf.isolated.length === 1 ? "" : "es"} now isolated
                              </div>
                              <div className="mt-1.5 space-y-1">
                                {whatIf.isolated.slice(0, 3).map((p) => (
                                  <div key={p.id} className="truncate text-[10.5px] text-muted-foreground">
                                    {p.name}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      <Button variant="outline" className="w-full" onClick={resetAll}>
                        <RotateCcw className="h-3.5 w-3.5" />
                        Restore all habitat
                      </Button>
                    </>
                  )}
                </div>
              )}

              {/* ----------------------------------------- scenarios */}
              {mode === "scenario" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    {sim.scenarios.map((s) => {
                      const Icon = SCENARIO_ICONS[s.id];
                      const active = s.id === activeScenarioId;
                      const severity =
                        s.severity === "extreme"
                          ? "#ef4444"
                          : s.severity === "severe"
                            ? "#f97316"
                            : s.severity === "moderate"
                              ? "#f59e0b"
                              : "#22c55e";
                      return (
                        <button
                          key={s.id}
                          onClick={() => setActiveScenarioId(active ? null : s.id)}
                          className={cn(
                            "group rounded-2xl border p-3 text-left transition-all",
                            active
                              ? "border-[#ef4444]/40 bg-[#ef4444]/10"
                              : "border-foreground/[0.08] bg-foreground/[0.03] hover:border-foreground/15 hover:bg-foreground/[0.06]",
                          )}
                        >
                          <div
                            className="grid h-8 w-8 place-items-center rounded-lg transition-transform group-hover:scale-105"
                            style={{ background: `${severity}22`, color: severity }}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="mt-2 truncate text-[11.5px] font-semibold">{s.name}</div>
                          <div className="mt-0.5 text-[10px] tabular" style={{ color: severity }}>
                            −{(sim.baselineScore - s.scoreAfter).toFixed(1)} pts
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {activeScenario ? (
                    <>
                      <ScoreDelta before={sim.baselineScore} after={activeScenario.scoreAfter} />

                      <Card>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between gap-2">
                            <CardTitle>{activeScenario.name}</CardTitle>
                            <Badge
                              variant={
                                activeScenario.severity === "extreme" ||
                                activeScenario.severity === "severe"
                                  ? "danger"
                                  : activeScenario.severity === "moderate"
                                    ? "warning"
                                    : "success"
                              }
                            >
                              {activeScenario.severity}
                            </Badge>
                          </div>
                          <CardDescription>{activeScenario.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <p className="text-[12px] leading-relaxed text-muted-foreground">
                            {activeScenario.narrative}
                          </p>

                          <div className="mt-4 grid grid-cols-2 gap-2">
                            {[
                              ["Habitat loss", `${activeScenario.habitatLossPct}%`, "#ef4444"],
                              ["Patches isolated", activeScenario.isolatedPatches, "#f59e0b"],
                              ["Species at risk", activeScenario.speciesAtRisk, "#f97316"],
                              ["Recovery", `${activeScenario.recoveryYears} yrs`, "#38bdf8"],
                              [
                                "Carbon loss",
                                `${Math.round(activeScenario.carbonLossTonnes / 1000)} kt`,
                                "#a78bfa",
                              ],
                              ["Confidence", fmtRatio(activeScenario.confidence), "#22c55e"],
                            ].map(([k, v, c]) => (
                              <div
                                key={k as string}
                                className="rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2.5"
                              >
                                <div
                                  className="text-[15px] font-bold leading-none tabular"
                                  style={{ color: c as string }}
                                >
                                  {v as string}
                                </div>
                                <div className="mt-1 text-[9.5px] uppercase tracking-wider text-muted-foreground">
                                  {k as string}
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-1">
                          <CardTitle>Projection to 2050</CardTitle>
                          <CardDescription>Baseline against scenario trajectory</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-2">
                          <ScenarioLineChart data={activeScenario.timeline} height={200} />
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle>Impact summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {activeScenario.impacts.map((im, i) => (
                            <ImpactRow key={im.label} {...im} index={i} />
                          ))}
                        </CardContent>
                      </Card>
                    </>
                  ) : (
                    <Card>
                      <CardContent className="p-5 text-center">
                        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#f59e0b]/12 text-[#f59e0b]">
                          <Wind className="h-6 w-6" />
                        </div>
                        <h3 className="mt-4 text-[14px] font-semibold">Select a scenario</h3>
                        <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                          Each pressure pathway re-solves the network and updates the map, heatmap
                          and KPIs. Compare them to see which threats are severe and which are
                          merely large.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* --------------------------------------- restoration */}
              {mode === "restore" && (
                <div className="space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle>Restoration budget</CardTitle>
                      <CardDescription>{band.label}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-end justify-between">
                        <div className="text-[28px] font-bold leading-none tabular text-[#00c896]">
                          {fmtCurrency(budgetLakh)}
                        </div>
                        <div className="text-right text-[10px] text-muted-foreground">
                          <div>₹10 L minimum</div>
                          <div>₹5 Cr maximum</div>
                        </div>
                      </div>

                      <div className="mt-4">
                        <Slider
                          value={budgetLakh}
                          min={10}
                          max={500}
                          step={5}
                          onValueChange={setBudgetLakh}
                          aria-label="Restoration budget"
                        />
                        <div className="mt-2 flex justify-between text-[9.5px] text-muted-foreground">
                          <span>₹10 L</span>
                          <span>₹1 Cr</span>
                          <span>₹2.5 Cr</span>
                          <span>₹5 Cr</span>
                        </div>
                      </div>

                      <p className="mt-4 text-[11.5px] leading-relaxed text-muted-foreground">
                        {band.summary}
                      </p>
                    </CardContent>
                  </Card>

                  <ScoreDelta
                    before={conn.score}
                    after={restoredScore}
                    label="Projected connectivity"
                  />

                  <Card>
                    <CardHeader className="pb-1">
                      <CardTitle>Gain by intervention</CardTitle>
                      <CardDescription>Connectivity points delivered</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <PriorityBarChart
                        height={180}
                        data={fundedActions.slice(0, 5).map((a) => ({
                          name: a.location.length > 18 ? a.location.slice(0, 17) + "…" : a.location,
                          gain: a.connectivityGain,
                          cost: a.costLakh,
                        }))}
                      />
                    </CardContent>
                  </Card>

                  <div className="space-y-2.5">
                    {fundedActions.map((a, i) => (
                      <motion.div
                        key={a.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: i * 0.06 }}
                        className="rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-4"
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              "grid h-8 w-8 shrink-0 place-items-center rounded-xl text-[12px] font-bold",
                              i === 0
                                ? "bg-[#00c896]/15 text-[#00c896]"
                                : i === 1
                                  ? "bg-[#38bdf8]/15 text-[#38bdf8]"
                                  : "bg-foreground/[0.06] text-muted-foreground",
                            )}
                          >
                            {a.rank}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate text-[12.5px] font-semibold">
                                  Priority {a.rank}
                                </div>
                                <div className="truncate text-[11px] text-muted-foreground">
                                  {a.location}
                                </div>
                              </div>
                              <div className="shrink-0 text-right">
                                <div className="text-[15px] font-bold tabular text-[#00c896]">
                                  +{a.connectivityGain}
                                </div>
                                <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                                  points
                                </div>
                              </div>
                            </div>

                            <div className="mt-2.5 flex flex-wrap gap-1.5">
                              <Badge variant="secondary">
                                <Coins className="h-3 w-3" />
                                {fmtCurrency(a.costLakh)}
                              </Badge>
                              <Badge variant="sky">
                                <Clock className="h-3 w-3" />
                                {a.timeToImpactMonths} mo
                              </Badge>
                              <Badge variant="success">
                                <CheckCircle2 className="h-3 w-3" />
                                {fmtRatio(a.confidence)} confidence
                              </Badge>
                            </div>

                            <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
                              {a.rationale}
                            </p>

                            <div className="mt-2.5 rounded-lg border border-foreground/[0.08] bg-foreground/[0.03] px-2.5 py-2">
                              <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground">
                                {a.interventionType}
                              </div>
                              <div className="mt-1 text-[10.5px] leading-snug text-muted-foreground">
                                {a.risks}
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-muted-foreground">Programme total</span>
                        <span className="font-bold tabular">
                          {fmtCurrency(band.totalCostLakh)}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[12px]">
                        <span className="text-muted-foreground">Expected gain</span>
                        <span className="font-bold tabular text-[#00c896]">
                          +{band.totalGain} points
                        </span>
                      </div>
                      <div className="mt-3">
                        <Progress value={(band.totalGain / 25) * 100} height={5} />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* ------------------------------------------ timeline */}
              {mode === "timeline" && (
                <div className="space-y-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle>Temporal analysis</CardTitle>
                      <CardDescription>Landscape change 2020 – 2025</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {/* year selector */}
                      <div className="flex gap-1.5">
                        {timeline.years.map((y) => (
                          <button
                            key={y.year}
                            onClick={() => setYear(y.year)}
                            className={cn(
                              "flex-1 rounded-xl border py-2 text-[11px] font-semibold tabular transition-all",
                              y.year === year
                                ? "border-[#00c896]/40 bg-[#00c896]/12 text-[#00c896]"
                                : "border-foreground/[0.08] bg-foreground/[0.03] text-muted-foreground hover:bg-foreground/[0.08]",
                            )}
                          >
                            {String(y.year).slice(2)}
                          </button>
                        ))}
                      </div>

                      <div className="mt-4">
                        <TimelineAreaChart
                          data={timeline.years}
                          activeYear={year}
                          height={160}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <motion.div key={year} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                    <Card>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-2">
                          <CardTitle>{activeYear.year}</CardTitle>
                          <Badge
                            variant={
                              activeYear.eventType === "conservation"
                                ? "success"
                                : activeYear.eventType === "natural"
                                  ? "warning"
                                  : activeYear.eventType === "anthropogenic"
                                    ? "danger"
                                    : "secondary"
                            }
                          >
                            {activeYear.event}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-[12px] leading-relaxed text-muted-foreground">
                          {activeYear.narrative}
                        </p>

                        <div className="mt-4 grid grid-cols-2 gap-2">
                          {[
                            ["Connectivity", activeYear.connectivityScore.toFixed(1), "#00c896"],
                            ["Habitat area", fmtArea(activeYear.habitatAreaHa), "#38bdf8"],
                            ["Patches", activeYear.patchCount, "#a78bfa"],
                            ["Critical", activeYear.criticalPatches, "#ef4444"],
                            ["Lost", `${activeYear.lostHa} ha`, "#f97316"],
                            ["Gained", `${activeYear.gainedHa} ha`, "#22c55e"],
                          ].map(([k, v, c]) => (
                            <div
                              key={k as string}
                              className="rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2.5"
                            >
                              <div
                                className="text-[15px] font-bold leading-none tabular"
                                style={{ color: c as string }}
                              >
                                {v as string}
                              </div>
                              <div className="mt-1 text-[9.5px] uppercase tracking-wider text-muted-foreground">
                                {k as string}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-4">
                          <div className="mb-1.5 flex items-center justify-between text-[10.5px]">
                            <span className="text-muted-foreground">Fragmentation index</span>
                            <span className="font-semibold tabular">
                              {activeYear.fragmentationIndex}
                            </span>
                          </div>
                          <Progress
                            value={activeYear.fragmentationIndex * 100}
                            height={5}
                            color="#f59e0b"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle>Event history</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="relative space-y-3.5 pl-5">
                        <div className="absolute bottom-2 left-[7px] top-2 w-px bg-foreground/10" />
                        {timeline.years.map((y) => (
                          <button
                            key={y.year}
                            onClick={() => setYear(y.year)}
                            className="relative block w-full text-left"
                          >
                            <span
                              className={cn(
                                "absolute -left-5 top-1 h-[9px] w-[9px] rounded-full ring-4 ring-sidebar transition-transform",
                                y.year === year && "scale-125",
                              )}
                              style={{
                                background:
                                  y.eventType === "conservation"
                                    ? "#22c55e"
                                    : y.eventType === "natural"
                                      ? "#f59e0b"
                                      : y.eventType === "anthropogenic"
                                        ? "#ef4444"
                                        : "#38bdf8",
                              }}
                            />
                            <div
                              className={cn(
                                "text-[12px] font-medium transition-colors",
                                y.year === year ? "text-foreground" : "text-muted-foreground",
                              )}
                            >
                              {y.year} · {y.event}
                            </div>
                            <div className="mt-0.5 text-[10.5px] text-muted-foreground">
                              Connectivity {y.connectivityScore.toFixed(1)} ·{" "}
                              {y.patchCount} patches
                            </div>
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </motion.div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

/* ------------------------------------------------------------------ */
/* geometry                                                            */
/* ------------------------------------------------------------------ */

/** Ray-casting point-in-polygon test. Coordinates are [lat, lng]. */
function pointInPolygon(point: LatLng, polygon: LatLng[]) {
  const [y, x] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i];
    const [yj, xj] = polygon[j];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}
