"use client";

import dynamic from "next/dynamic";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useReducedMotion } from "framer-motion";
import { BarChart3, Loader2, MousePointerClick, Pencil, Play, X } from "lucide-react";
import { AppShell } from "@/components/dashboard/app-shell";
import { Button } from "@/components/ui/button";
import { SelectMenu } from "@/components/ui/select-menu";
import { useAnalysis } from "@/hooks/use-analysis";
import { useAuth } from "@/hooks/use-auth";
import { fetchRuns, postScenario, saveScenario, type ScenarioResult } from "@/lib/api";
import type { LatLng, RunSummary } from "@/types";
import { getGraph, getHabitatMask, getHeatmap, getRestoration } from "@/lib/data";
import { cn } from "@/lib/utils";
import { GLOSSARY } from "@/components/shared/term";
import { Tooltip } from "@/components/ui/tooltip";
import { GROUPS, isKind, kindInfo, type Kind } from "@/components/simulation/scenario-kinds";
import { ScenarioChooser } from "@/components/simulation/scenario-chooser";
import { CandidatePicker } from "@/components/simulation/candidate-picker";
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

function Picked({ ids, empty, onClear }: { ids: string[]; empty: string; onClear: () => void }) {
  if (!ids.length) return <div className="flex items-center gap-2 rounded-xl border border-dashed border-black/15 bg-white px-3 py-2.5 text-[12px] text-muted-foreground"><MousePointerClick className="h-4 w-4 text-[#15803d]" />{empty}</div>;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {ids.map((id) => <span key={id} className="rounded-lg bg-[#fee2e2] px-2 py-1 text-[12px] font-bold text-[#b91c1c]">{id}</span>)}
      <button className="ml-1 text-[11.5px] font-semibold text-[#0f5132] underline-offset-2 hover:underline" onClick={onClear}>Clear</button>
    </div>
  );
}

function ScenarioLabView() {
  const { user } = useAuth();
  const params = useSearchParams();
  const wanted = params.get("type");
  const reduceMotion = useReducedMotion();
  const { sceneId, scene, runId, runs: areaRuns, dataSource, selectedPatchId, setSelectedPatchId, removedPatchIds, togglePatchRemoved, clearRemoved } = useAnalysis();
  // the displayed run: some stored runs no longer have their probability raster, which the Thresholds scenario needs
  const currentRun = runId === "latest" ? areaRuns.find((r) => r.studyAreaId === sceneId && r.isLatest) : areaRuns.find((r) => r.runId === runId);
  const disabledKinds: Partial<Record<Kind, string>> = currentRun && currentRun.probabilityRaster === false
    ? { threshold: "Not available for this run: its probability raster is not on this server. Use a new analysis or a satellite (near-real-time) run." }
    : {};
  const live = dataSource.mode === "live";
  const mask = getHabitatMask(sceneId);
  const graph = getGraph(sceneId);
  const heatmap = getHeatmap(sceneId);
  const restoration = getRestoration(sceneId);
  const [kind, setKindRaw] = useState<Kind>(isKind(wanted) ? wanted : "remove_patches");
  const [drawing, setDrawing] = useState(false);
  // inputs and the result are scoped to (landscape, run): switching either starts from a clean slate
  const scope = `${sceneId}|${runId}`;
  const [inputs, setInputs] = useState<{ scope: string; polygon: LatLng[]; cands: string[] }>({ scope, polygon: [], cands: [] });
  const polygon = useMemo(() => (inputs.scope === scope ? inputs.polygon : []), [inputs, scope]);
  const cands = useMemo(() => (inputs.scope === scope ? inputs.cands : []), [inputs, scope]);
  const setPolygon = (f: (p: LatLng[]) => LatLng[]) => setInputs((i) => ({ scope, polygon: f(i.scope === scope ? i.polygon : []), cands: i.scope === scope ? i.cands : [] }));
  const setCands = (f: (c: string[]) => string[]) => setInputs((i) => ({ scope, polygon: i.scope === scope ? i.polygon : [], cands: f(i.scope === scope ? i.cands : []) }));
  const [otherRun, setOtherRun] = useState("");
  const [retainPct, setRetainPct] = useState(50);
  const [areaHa, setAreaHa] = useState(5);
  const [tauKm, setTauKm] = useState(3);
  const [taus, setTaus] = useState("3, 5, 8");
  const [ks, setKs] = useState("2, 3, 4");
  const [point, setPoint] = useState<LatLng | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [res, setRes] = useState<{ scope: string; data: ScenarioResult | null } | null>(null);
  const result = res?.scope === scope ? res.data : null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [anim, setAnim] = useState<{ phase: Phase; step: number }>({ phase: "idle", step: 0 });
  const [focus, setFocus] = useState<{ lat: number; lon: number; zoom?: number; nonce: number } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const timers = useRef<number[]>([]);
  const clearTimers = () => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = []; };
  useEffect(() => () => clearTimers(), []);

  const setResult = (d: ScenarioResult | null) => { clearTimers(); setRes({ scope, data: d }); if (!d) setAnim({ phase: "idle", step: 0 }); };
  const setKind = (k: Kind) => { setKindRaw(k); setDrawing(false); setResult(null); setError(null); };

  useEffect(() => {
    let cancelled = false;
    fetchRuns(sceneId).then((r) => { if (!cancelled) setRuns(r.filter((x) => x.resultKind !== "synthetic")); }).catch(() => { if (!cancelled) setRuns([]); });
    return () => { cancelled = true; };
  }, [sceneId]);

  const multi = kind === "restore_multi";
  const pickCandidate = (id: string) => { setResult(null); setCands((s) => (!multi ? [id] : s.includes(id) ? s.filter((x) => x !== id) : [...s, id])); };
  const pickPatch = (id: string) => { setResult(null); togglePatchRemoved(id); };

  const canRun = (kind === "remove_patches" && removedPatchIds.length > 0) ||
    (kind === "remove_polygon" && polygon.length >= 3) ||
    ((kind === "restore" || kind === "restore_multi") && cands.length > 0) ||
    (kind === "compare_periods" && !!otherRun) ||
    (kind === "reduce_area" && removedPatchIds.length > 0) || (kind === "add_patch" && !!point) ||
    kind === "radius" || kind === "sensitivity" || kind === "tau" || kind === "threshold";

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
    setBusy(true); setError(null); setSaved(null); setDrawing(false);
    clearTimers(); setAnim({ phase: "computing", step: 0 });
    try {
      if (live) {
        const body: Record<string, unknown> = { type: kind };
        if (kind === "remove_patches") body.patch_ids = removedPatchIds;
        if (kind === "remove_polygon") body.polygon = polygon;
        if (kind === "restore" || kind === "restore_multi") body.candidate_ids = cands;
        if (kind === "compare_periods") body.other_run_id = otherRun;
        if (kind === "reduce_area") { body.patch_ids = removedPatchIds; body.retain_fraction = retainPct / 100; }
        if (kind === "add_patch" && point) { body.lat = point[0]; body.lon = point[1]; body.area_ha = areaHa; }
        if (kind === "radius") body.tau_km = tauKm;
        if (kind === "sensitivity") {
          body.taus_km = taus.split(",").map(Number).filter((x) => x > 0);
          body.ks = ks.split(",").map((x) => parseInt(x, 10)).filter((x) => x > 0);
        }
        const data = await postScenario(sceneId, runId, body);
        setRes({ scope, data });
        playback(data);
      } else {
        // No backend run loaded: never fabricate numbers — scenarios are exact server-side recomputations only.
        setRes({ scope, data: null }); setAnim({ phase: "idle", step: 0 });
        setError("Needs the live analysis API — start the backend and reload.");
      }
    } catch (e) {
      setAnim({ phase: "idle", step: 0 });
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [live, kind, removedPatchIds, polygon, cands, otherRun, sceneId, runId, retainPct, point, areaHa, tauKm, taus, ks, scope, playback]);

  const phase: Phase = result ? anim.phase : anim.phase === "computing" ? "computing" : "idle";
  const view = useMemo(() => buildMapView({ kind, phase, result, mask, graph, picked: removedPatchIds, cands, actions: restoration.actions }),
    [kind, phase, result, mask, graph, removedPatchIds, cands, restoration.actions]);
  const markers = view.markers.map((m) => { const c = candidateIdOfMarker(m.id); return c ? { ...m, onClick: () => pickCandidate(c) } : m; });
  const steps = playbackSteps(result);
  const playing = phase === "reset" || phase === "play";
  const info = kindInfo(kind)!;
  const group = GROUPS.find((g) => g.id === info.group)!;
  const otherRuns = runs.filter((r) => r.runId !== dataSource.provenance?.runId);

  const save = result && user ? async () => {
    try {
      const s = await saveScenario({ study_area_id: sceneId, run_id: dataSource.provenance?.runId ?? runId, type: result.type, params: result.parameters, result: { baseline: result.baseline, scenario: result.scenario, difference: result.difference, explanation: result.explanation, label: result.label } });
      setSaved(`Saved as scenario #${s.id} (recomputed on the server, audited).`);
    } catch (e) { setSaved(`Could not save: ${e instanceof Error ? e.message : String(e)}`); }
  } : undefined;

  const input = "w-full rounded-lg border border-black/[0.1] bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-[#15803d] focus:ring-2 focus:ring-[#15803d]/15";

  return (
    <AppShell title="Scenario Lab" subtitle={`${scene.shortName} · each result is an exact recomputation, labelled SIMULATED`} bleed>
      <ScenarioMapStyles />
      <div className="relative grid grid-cols-1 border-t border-black/[0.05] lg:h-[calc(100dvh-68px)] lg:min-h-[520px] lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_380px]">
        {/* ------------------------------------------------ 1–2: choose + set up */}
        <aside className="flex min-h-0 flex-col border-r border-black/[0.06] bg-[#fbfcfb]">
          <div className="scroll-slim min-h-0 flex-1 space-y-5 overflow-y-auto p-3.5">
            <Section n={1} title="Choose a change"><ScenarioChooser value={kind} onChange={setKind} disabled={disabledKinds} /></Section>
            <Section n={2} title="Set it up">
              <div className="space-y-3 rounded-2xl border border-black/[0.06] bg-white p-3">
                <div className="flex items-start gap-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `${group.tone}14`, color: group.tone }}><info.icon className="h-4 w-4" /></span>
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-bold leading-snug text-[#0f172a]">{info.desc}</div>
                    <div className="mt-0.5 text-[12px] text-muted-foreground">{info.todo}</div>
                  </div>
                </div>

                {(kind === "remove_patches" || kind === "reduce_area") && <Picked ids={removedPatchIds} empty="Click patches on the map" onClear={() => { setResult(null); clearRemoved(); }} />}
                {kind === "reduce_area" && (
                  <label className="block text-[12px] font-medium text-[#334155]">
                    <span className="flex justify-between"><span>Area kept</span><b className="tabular text-[#0f172a]">{retainPct}%</b></span>
                    <input type="range" min={5} max={95} step={5} value={retainPct} onChange={(e) => setRetainPct(Number(e.target.value))} className="mt-1 w-full accent-[#15803d]" />
                  </label>
                )}
                {kind === "remove_polygon" && (
                  <div className="space-y-2">
                    <Button size="sm" variant={drawing ? "default" : "outline"} className="w-full" onClick={() => setDrawing((d) => !d)}>
                      <Pencil className="h-3.5 w-3.5" /> {drawing ? "Done drawing" : polygon.length ? "Add more points" : "Draw on the map"}
                    </Button>
                    <div className="flex items-center justify-between text-[12px] text-muted-foreground">
                      <span><b className="text-[#0f172a]">{polygon.length}</b> point{polygon.length === 1 ? "" : "s"}{polygon.length > 0 && polygon.length < 3 ? " · need 3" : ""}</span>
                      {polygon.length > 0 && <button onClick={() => { setResult(null); setPolygon(() => []); }} className="font-semibold text-[#0f5132] hover:underline">Clear</button>}
                    </div>
                  </div>
                )}
                {kind === "add_patch" && (
                  <div className="space-y-2">
                    <Button size="sm" variant={drawing ? "default" : "outline"} className="w-full" onClick={() => setDrawing((d) => !d)}>
                      <Pencil className="h-3.5 w-3.5" /> {drawing ? "Click the map to place it" : point ? "Move the patch" : "Place on the map"}
                    </Button>
                    <div className="text-[12px] text-muted-foreground">{point ? `At ${point[0].toFixed(4)}, ${point[1].toFixed(4)}` : "No location yet"}</div>
                    <label className="flex items-center gap-2 text-[12px] font-medium text-[#334155]">Size
                      <input type="number" min={0.1} max={10000} step={0.5} value={areaHa} onChange={(e) => setAreaHa(Number(e.target.value))} className={cn(input, "w-24")} /> ha</label>
                    <div className="text-[11px] text-muted-foreground">Made up by you — not detected habitat.</div>
                  </div>
                )}
                {kind === "radius" && (
                  <label className="block text-[12px] font-medium text-[#334155]">
                    <span className="flex justify-between">
                      <Tooltip content={GLOSSARY["τ"]}><span tabIndex={0} className="cursor-help underline decoration-dotted underline-offset-2">Travel distance</span></Tooltip>
                      <b className="tabular text-[#0f172a]">{tauKm} km</b>
                    </span>
                    <input type="range" min={1} max={15} step={0.5} value={tauKm} onChange={(e) => setTauKm(Number(e.target.value))} className="mt-1 w-full accent-[#1e5f8a]" />
                  </label>
                )}
                {kind === "sensitivity" && (
                  <div className="grid grid-cols-2 gap-2 text-[12px] font-medium text-[#334155]">
                    <label className="block">Distances (km)<input value={taus} onChange={(e) => setTaus(e.target.value)} className={cn(input, "mt-1")} /></label>
                    <label className="block">Neighbours<input value={ks} onChange={(e) => setKs(e.target.value)} className={cn(input, "mt-1")} /></label>
                  </div>
                )}
                {kind === "compare_periods" && (
                  otherRuns.length
                    ? <SelectMenu label="Compare with run" value={otherRun} onChange={(v) => { setResult(null); setOtherRun(v); }} options={[{ value: "", label: "Choose a run…" }, ...otherRuns.map((r) => ({ value: r.runId, label: r.sceneYear ? String(r.sceneYear) : r.runId, hint: r.runId }))]} menuClassName="w-[260px]" />
                    : <div className="text-[12px] text-muted-foreground">No other run for this landscape yet.</div>
                )}
              </div>
              {(kind === "restore" || kind === "restore_multi") && (
                <div className="mt-3">
                  <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.08em] text-[#475569]"><span>Candidates · best first</span>{cands.length > 0 && <span className="normal-case tracking-normal text-[#15803d]">{cands.length} picked</span>}</div>
                  <CandidatePicker actions={restoration.actions} selected={cands} multi={multi} onToggle={pickCandidate} />
                  <p className="mt-2 text-[11px] leading-snug text-muted-foreground">Candidates are model output — field check first.</p>
                </div>
              )}
            </Section>
          </div>
          <div className="sticky bottom-0 z-10 border-t border-black/[0.06] bg-white/90 p-3 backdrop-blur">
            <Button className="h-11 w-full rounded-xl bg-[#0f5132] text-[14px] font-bold text-white shadow-[0_8px_20px_-10px_rgba(15,81,50,0.8)] hover:bg-[#0b3d26]" disabled={busy || playing || !canRun} onClick={run}>
              {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Computing…</> : <><Play className="h-4 w-4" /> Run scenario</>}
            </Button>
            {error && <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-[12px] text-[#b91c1c]">{error}</div>}
          </div>
        </aside>

        {/* ------------------------------------------------ map */}
        <div className="relative min-h-[440px] lg:min-h-0">
          <GisMap scene={scene} mask={view.mask} graph={view.graph} heatmap={heatmap}
            layers={{ satellite: true, probability: false, habitat: true, heatmap: false, connectivity: true, protectedAreas: false, labels: false }}
            basemap="satellite" heatOpacity={0.5} selectedPatchId={selectedPatchId}
            onSelectPatch={(id) => { if ((kind === "remove_patches" || kind === "reduce_area") && id) pickPatch(id); else setSelectedPatchId(id); }}
            removedPatchIds={view.removedPatchIds} patchStyle={view.patchStyle} markers={markers} focus={focus}
            drawing={drawing} drawnPolygon={kind === "add_patch" ? (point ? [point] : []) : polygon}
            onDrawPoint={(p) => { setResult(null); if (kind === "add_patch") { setPoint(p); setDrawing(false); } else setPolygon((s) => [...s, p]); }}
            className={cn("scn-map h-full w-full", phase === "play" && "scn-play")} />

          <div className="pointer-events-none absolute left-14 top-3 z-[900] flex items-center gap-2">
            <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm backdrop-blur", result ? (result.label.startsWith("SIM") ? "bg-[#fff7ed]/95 text-[#c2410c]" : "bg-[#e0f2fe]/95 text-[#1e5f8a]") : "bg-white/90 text-[#0f5132]")}>
              {result ? result.label : live ? "Real data · today" : "No analysis for this landscape yet"}
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
