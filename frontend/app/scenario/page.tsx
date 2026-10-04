"use client";

import dynamic from "next/dynamic";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useReducedMotion } from "framer-motion";
import { BarChart3, Loader2, Play, X } from "lucide-react";
import { AppShell } from "@/components/dashboard/app-shell";
import { Button } from "@/components/ui/button";
import { useAnalysis } from "@/hooks/use-analysis";
import { useAuth } from "@/hooks/use-auth";
import { saveScenario, type ScenarioResult } from "@/lib/api";
import { getGraph, getHabitatMask, getHeatmap, getRestoration } from "@/lib/data";
import { cn } from "@/lib/utils";
import type { Kind } from "@/components/simulation/scenario-kinds";
import { ScenarioChooser } from "@/components/simulation/scenario-chooser";
import { ScenarioSetup } from "@/components/simulation/scenario-setup";
import { useScenarioSetup } from "@/components/simulation/use-scenario-setup";
import { ScenarioEmpty, ScenarioResults } from "@/components/simulation/scenario-results";
import { animates, buildMapView, candidateIdOfMarker, lonBesideDrawer, playbackSteps, type Phase } from "@/components/simulation/scenario-map";
import { ScenarioMapStyles } from "@/components/simulation/scenario-map-styles";

const GisMap = dynamic(() => import("@/components/maps/gis-map"), { ssr: false });

/** Run timeline (ms after the result arrives): fly to the area, play the map change step by step, then count up the results. */
const T = { fly: 850, step: 850, settle: 600 };

export default function ScenarioLab() {
  return <Suspense><ScenarioLabView /></Suspense>;
}

function Section({ n, title, children, className }: { n: number; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={className}>
      <div className="mb-2 flex items-center gap-2">
        <span className="grid h-5 w-5 place-items-center rounded-full bg-[#0f5132] text-[10.5px] font-bold text-white">{n}</span>
        <h2 className="text-[13px] font-bold text-[#0f172a]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ScenarioLabView() {
  const { user } = useAuth();
  const params = useSearchParams();
  const wanted = params.get("type");
  const reduceMotion = useReducedMotion();
  const { sceneId, scene, runId, dataSource, selectedPatchId, setSelectedPatchId, removedPatchIds } = useAnalysis();
  const mask = getHabitatMask(sceneId);
  const graph = getGraph(sceneId);
  const heatmap = getHeatmap(sceneId);
  const restoration = getRestoration(sceneId);
  const setup = useScenarioSetup(wanted);
  const { kind, result, polygon, cands, point, drawing } = setup;
  const scope = `${sceneId}|${runId}`;
  const [saved, setSaved] = useState<string | null>(null);
  const [anim, setAnim] = useState<{ phase: Phase; step: number }>({ phase: "idle", step: 0 });
  const [focus, setFocus] = useState<{ lat: number; lon: number; zoom?: number; nonce: number } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const timers = useRef<number[]>([]);
  const clearTimers = () => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = []; };
  useEffect(() => () => clearTimers(), []);
  // a new landscape / run / scenario kind or changed inputs drop the result: stop any playback of it
  useEffect(() => { if (!result) clearTimers(); }, [result, scope]);

  /** Plays the run on the map: fly → step 1 → step 2 → step 3 → results count up. */
  const playback = useCallback((r: ScenarioResult) => {
    clearTimers();
    const steps = playbackSteps(r).length;
    if (reduceMotion || !animates(r)) { setAnim({ phase: "done", step: steps }); setDrawerOpen(true); return; }
    setDrawerOpen(false);
    setAnim({ phase: "reset", step: 0 });
    const f = buildMapView({ kind: r.type as Kind, phase: "done", result: r, mask, graph, picked: [], cands: [], actions: [] }).focus;
    if (f) setFocus((o) => ({ ...f, lon: lonBesideDrawer(f.lon, f.zoom), nonce: (o?.nonce ?? 0) + 1 }));
    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    const start = f ? T.fly : 120;
    for (let i = 0; i < steps; i++) at(start + i * T.step, () => setAnim({ phase: "play", step: i }));
    at(start + steps * T.step + T.settle, () => { setAnim({ phase: "done", step: steps }); setDrawerOpen(true); });
  }, [reduceMotion, mask, graph]);

  const run = useCallback(async () => {
    setSaved(null); clearTimers(); setAnim({ phase: "computing", step: 0 });
    const data = await setup.run();
    if (data) playback(data); else setAnim({ phase: "idle", step: 0 });
  }, [setup, playback]);

  const phase: Phase = result ? anim.phase : anim.phase === "computing" ? "computing" : "idle";
  const view = useMemo(() => buildMapView({ kind, phase, result, mask, graph, picked: removedPatchIds, cands, actions: restoration.actions }),
    [kind, phase, result, mask, graph, removedPatchIds, cands, restoration.actions]);
  const markers = view.markers.map((m) => { const c = candidateIdOfMarker(m.id); return c ? { ...m, onClick: () => setup.pickCandidate(c) } : m; });
  const steps = playbackSteps(result);
  const playing = phase === "reset" || phase === "play";

  const save = result && user ? async () => {
    try {
      const s = await saveScenario({ study_area_id: sceneId, run_id: dataSource.provenance?.runId ?? runId, type: result.type, params: result.parameters, result: { baseline: result.baseline, scenario: result.scenario, difference: result.difference, explanation: result.explanation, label: result.label } });
      setSaved(`Saved as scenario #${s.id} (recomputed on the server, audited).`);
    } catch (e) { setSaved(`Could not save: ${e instanceof Error ? e.message : String(e)}`); }
  } : undefined;

  return (
    <AppShell title="Scenario Lab" subtitle={`${scene.shortName} · each result is an exact recomputation, labelled SIMULATED`} bleed>
      <ScenarioMapStyles />
      <div className="relative grid grid-cols-1 border-t border-black/[0.05] lg:h-[calc(100dvh-68px)] lg:min-h-[520px] lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_380px]">
        {/* ------------------------------------------------ 1–2: choose + set up */}
        <aside className="flex min-h-0 flex-col border-r border-black/[0.06] bg-[#fbfcfb]">
          <div className="scroll-slim min-h-0 flex-1 space-y-5 overflow-y-auto p-3.5">
            <Section n={1} title="Choose a change"><ScenarioChooser value={kind} onChange={setup.setKind} disabled={setup.disabledKinds} /></Section>
            <Section n={2} title="Set it up"><ScenarioSetup s={setup} actions={restoration.actions} /></Section>
          </div>
          <div className="sticky bottom-0 z-10 border-t border-black/[0.06] bg-white/90 p-3 backdrop-blur">
            <Button className="h-11 w-full rounded-xl bg-[#0f5132] text-[14px] font-bold text-white shadow-[0_8px_20px_-10px_rgba(15,81,50,0.8)] hover:bg-[#0b3d26]" disabled={setup.busy || playing || !setup.canRun} onClick={run}>
              {setup.busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Computing…</> : <><Play className="h-4 w-4" /> Run scenario</>}
            </Button>
            {setup.error && <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-[12px] text-[#b91c1c]">{setup.error}</div>}
          </div>
        </aside>

        {/* ------------------------------------------------ map */}
        <div className="relative min-h-[440px] lg:min-h-0">
          <GisMap scene={scene} mask={view.mask} graph={view.graph} heatmap={heatmap}
            layers={{ satellite: true, probability: false, habitat: true, heatmap: false, connectivity: true, protectedAreas: false, labels: false }}
            basemap="satellite" heatOpacity={0.5} selectedPatchId={selectedPatchId}
            onSelectPatch={(id) => { if (setup.picksPatches && id) setup.pickPatch(id); else setSelectedPatchId(id); }}
            removedPatchIds={view.removedPatchIds} patchStyle={view.patchStyle} markers={markers} focus={focus}
            drawing={drawing} drawnPolygon={kind === "add_patch" ? (point ? [point] : []) : polygon}
            onDrawPoint={setup.drawPoint}
            className={cn("scn-map h-full w-full", phase === "play" && "scn-play")} />

          <div className="pointer-events-none absolute left-14 top-3 z-[900] flex items-center gap-2">
            <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm backdrop-blur", result ? (result.label.startsWith("SIM") ? "bg-[#fff7ed]/95 text-[#c2410c]" : "bg-[#e0f2fe]/95 text-[#1e5f8a]") : "bg-white/90 text-[#0f5132]")}>
              {result ? result.label : setup.live ? "Real data · today" : "No analysis for this landscape yet"}
            </span>
            {drawing && <span className="rounded-full bg-[#0f5132] px-2.5 py-1 text-[11px] font-semibold text-white shadow">{kind === "add_patch" ? "Click to place the patch" : "Click to add points"}</span>}
          </div>

          {/* computing / playback overlay */}
          {(phase === "computing" || playing) && (
            <div className="pointer-events-none absolute inset-x-0 bottom-5 z-[900] flex justify-center px-3">
              <div className="flex items-center gap-1 rounded-2xl bg-[#0b1f17]/90 p-1.5 text-white shadow-2xl backdrop-blur">
                {phase === "computing" ? (
                  <span className="flex items-center gap-2 px-3 py-1.5 text-[13px] font-semibold"><Loader2 className="h-4 w-4 animate-spin text-[#00e599]" /> Recomputing the network…</span>
                ) : steps.map((s, i) => {
                  const on = phase === "play" && i <= anim.step;
                  return (
                    <span key={s.label} className={cn("flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[12.5px] font-semibold transition-all duration-300", on ? "bg-white/10 text-white" : "text-white/40")}>
                      <span className={cn("grid h-5 w-5 place-items-center rounded-full text-[10.5px] font-bold transition-colors", on ? (i === anim.step ? "bg-[#00e599] text-[#053321]" : "bg-white/80 text-[#0b1f17]") : "bg-white/10")}>{i + 1}</span>{s.label}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* legend after a run */}
          {phase === "done" && animates(result) && (
            <div className="pointer-events-none absolute bottom-3 left-3 z-[900] flex flex-wrap gap-x-3 gap-y-1 rounded-xl bg-white/92 px-3 py-2 text-[11px] font-medium text-[#334155] shadow">
              {result?.removed_patch_ids?.length ? <><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm border border-dashed border-[#ef4444] bg-[#ef4444]/20" />Removed</span><span className="flex items-center gap-1.5"><i className="w-4 border-t-2 border-dashed border-[#ef4444]" />Link cut</span></> : null}
              {result && ["restore", "restore_multi", "add_patch"].includes(result.type) ? <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#00e599]" />Added</span> : null}
              {result && ["restore", "restore_multi", "add_patch", "radius"].includes(result.type) ? <span className="flex items-center gap-1.5"><i className="w-4 border-t-[3px] border-[#00e599]" />New link</span> : null}
              {result?.type === "reduce_area" ? <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-sm bg-[#f59e0b]/60" />Shrunk</span> : null}
              <span className="flex items-center gap-1.5"><i className="w-4 border-t-2 border-[#1e5f8a]" />Link</span>
            </div>
          )}

          {result && !drawerOpen && !playing && (
            <button onClick={() => setDrawerOpen(true)} className="absolute right-3 top-3 z-[950] hidden items-center gap-1.5 rounded-full bg-[#0f5132] px-3 py-1.5 text-[12px] font-semibold text-white shadow-lg lg:flex xl:hidden">
              <BarChart3 className="h-3.5 w-3.5" /> Show results
            </button>
          )}
        </div>

        {/* ------------------------------------------------ results (column on xl, drawer over the map on lg) */}
        <aside className={cn(
          "scroll-slim overflow-y-auto border-l border-black/[0.06] bg-[#f6f8f7] p-3.5 pb-24",
          "lg:absolute lg:bottom-3 lg:right-3 lg:top-3 lg:z-[950] lg:w-[340px] lg:rounded-2xl lg:border lg:shadow-2xl",
          "xl:static xl:z-auto xl:w-auto xl:rounded-none xl:border-0 xl:border-l xl:shadow-none",
          (!drawerOpen || playing) && result && "lg:max-xl:hidden",
          !result && "lg:max-xl:hidden",
        )}>
          {result && (
            <div className="mb-2 flex justify-end xl:hidden">
              <button onClick={() => setDrawerOpen(false)} className="hidden items-center gap-1 rounded-full px-2 py-1 text-[11.5px] font-semibold text-muted-foreground hover:bg-black/[0.04] lg:flex" aria-label="Hide results"><X className="h-3.5 w-3.5" /> Hide</button>
            </div>
          )}
          <ScenarioResults
            result={result}
            playing={playing}
            steps={steps}
            step={phase === "play" ? anim.step : -1}
            onReplay={animates(result) ? () => result && playback(result) : undefined}
            onSave={save}
            saved={saved}
            empty={phase === "computing"
              ? <div className="flex items-center gap-2 rounded-2xl border border-black/[0.06] bg-white p-5 text-[13px] font-semibold text-[#0f5132]"><Loader2 className="h-4 w-4 animate-spin" /> Recomputing the network…</div>
              : <ScenarioEmpty />}
          />
        </aside>
      </div>
    </AppShell>
  );
}
