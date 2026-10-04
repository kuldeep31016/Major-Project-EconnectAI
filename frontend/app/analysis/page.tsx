"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  BarChart3,
  Crosshair,
  FlaskConical,
  Info,
  Leaf,
  Loader2,
  Maximize2,
  Minimize2,
  Network,
  PanelRightOpen,
  Play,
  Radar,
  Satellite,
  X,
} from "lucide-react";

import { AppShell } from "@/components/dashboard/app-shell";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { LayerControl } from "@/components/maps/map-chrome";
import type { LayerState } from "@/components/maps/gis-map";
import { useAnalysis } from "@/hooks/use-analysis";
import { useAuth } from "@/hooks/use-auth";
import { getConnectivity, getGraph, getHabitatMask, getHeatmap, getRestoration } from "@/lib/data";
import { fetchProbabilityBounds, probabilityPngUrl, registerDetection, saveScenario } from "@/lib/api";
import { requestMapFocus, useMapFocus } from "@/lib/map-focus";
import { plainPurpose } from "@/lib/plain-language";
import type { BasemapId } from "@/lib/constants";
import type { HabitatPatch } from "@/types";
import { SensitivityExplorer } from "@/components/analysis/sensitivity-explorer";
import { EvidenceDrawer } from "@/components/analysis/evidence-drawer";
import { PatchImportance } from "@/components/analysis/patch-importance";
import {
  ImpactThumbnail,
  MiniInset,
  NetworkCard,
  PanelCard,
  RealtimePanel,
  SelectedPatchCard,
} from "@/components/analysis/interactive-map-panels";
import { ScenarioChooser } from "@/components/simulation/scenario-chooser";
import { ScenarioSetup } from "@/components/simulation/scenario-setup";
import { ScenarioResults } from "@/components/simulation/scenario-results";
import { ScenarioMapStyles } from "@/components/simulation/scenario-map-styles";
import { buildMapView, candidateIdOfMarker } from "@/components/simulation/scenario-map";
import { useScenarioSetup } from "@/components/simulation/use-scenario-setup";
import { cn } from "@/lib/utils";

// Leaflet touches window on import — must not run during SSR.
const GisMap = dynamic(() => import("@/components/maps/gis-map"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center bg-[#0b1f17]">
      <Loader2 className="h-6 w-6 animate-spin text-[#00e599]" />
    </div>
  ),
});

type Preset = "satellite" | "habitat" | "connectivity";
const OFF: LayerState = { satellite: true, probability: false, habitat: true, heatmap: false, connectivity: false, protectedAreas: false, labels: true };
/** The three views in the header: each is just a layer / basemap preset (Map Layers still allows any mix). */
const PRESETS: Record<Preset, { label: string; short: string; icon: typeof Satellite; basemap: BasemapId; layers: LayerState }> = {
  satellite: { label: "Satellite View", short: "Satellite", icon: Satellite, basemap: "satellite", layers: { ...OFF, connectivity: true } },
  habitat: { label: "Habitat Layer", short: "Habitat", icon: Leaf, basemap: "terrain", layers: { ...OFF, probability: true } },
  connectivity: { label: "Connectivity", short: "Network", icon: Network, basemap: "dark", layers: { ...OFF, heatmap: true, connectivity: true } },
};

export default function AnalysisPage() {
  return <Suspense><InteractiveMap /></Suspense>;
}

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#0f172a] text-[11.5px] font-bold text-white">{n}</span>
        <h2 className="text-[14.5px] font-bold text-[#0f172a]">{title}</h2>
        {hint && <Tooltip content={hint}><Info tabIndex={0} className="h-3.5 w-3.5 cursor-help text-[#94a3b8]" /></Tooltip>}
      </div>
      {children}
    </section>
  );
}

function InteractiveMap() {
  const { sceneId, scene, setSceneId, selectedPatchId, setSelectedPatchId, dataSource, runId, setRunId, runs: areaRuns, bundleVersion, removedPatchIds } = useAnalysis();
  const { user, can } = useAuth();
  const focus = useMapFocus();
  const params = useSearchParams();
  const live = dataSource.mode === "live";
  // the right column as a drawer on 1024–1399 px; a ?patch= deep link opens it
  const [detailsOpen, setDetailsOpen] = useState(() => !!params.get("patch"));

  // Deep links: /analysis?scene=<id>&patch=<id>  or  ?scene=<id>&lat=&lon=   (#sensitivity opens the explorer)
  const wantScene = params.get("scene"); const wantPatch = params.get("patch");
  const wantLat = Number(params.get("lat")); const wantLon = Number(params.get("lon"));
  useEffect(() => {
    if (wantScene && wantScene !== sceneId) setSceneId(wantScene);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantScene]);
  useEffect(() => {
    if (wantScene && wantScene !== sceneId) return;
    if (wantPatch) {
      const p = getHabitatMask(sceneId).patches.find((x) => x.id === wantPatch);
      if (p) { setSelectedPatchId(p.id); requestMapFocus(p.center[0], p.center[1], 14); }
    } else if (wantLat && wantLon) requestMapFocus(wantLat, wantLon, 14);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantScene, wantPatch, wantLat, wantLon, sceneId, bundleVersion]);

  // Real runs expose their probability raster as a bounded PNG overlay (tagged by run so it never goes stale).
  const [probRes, setProbRes] = useState<{ key: string; data: { url: string; bounds: [[number, number], [number, number]] } | null } | null>(null);
  const probKey = `${sceneId}|${dataSource.provenance?.runId ?? ""}`;
  const probOverlay = probRes?.key === probKey ? probRes.data : null;
  useEffect(() => {
    let cancelled = false;
    const prov = dataSource.provenance;
    if (dataSource.mode !== "live" || !prov || prov.dataSource.type !== "probability_raster") return;
    const key = probKey;
    fetchProbabilityBounds(sceneId, prov.runId).then((b) => {
      if (!cancelled) setProbRes({ key, data: b ? { url: probabilityPngUrl(sceneId, prov.runId), bounds: b } : null });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneId, runId, dataSource.provenance?.runId, bundleVersion]);

  const mask = getHabitatMask(sceneId);
  const graph = getGraph(sceneId);
  const heatmap = getHeatmap(sceneId);
  const conn = getConnectivity(sceneId);
  const restoration = getRestoration(sceneId);
  const currentRun = runId === "latest" ? areaRuns.find((r) => r.studyAreaId === sceneId && r.isLatest) : areaRuns.find((r) => r.runId === runId);

  /* -------------------------------------------------------------- map view state */
  const [preset, setPreset] = useState<Preset>("satellite");
  const [layers, setLayers] = useState<LayerState>(PRESETS.satellite.layers);
  const [basemap, setBasemap] = useState<BasemapId>("satellite");
  const [heatOpacity, setHeatOpacity] = useState(0.62);
  const [layerPanelOpen, setLayerPanelOpen] = useState(false);
  const [cursor, setCursor] = useState<{ lat: number; lng: number } | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  const applyPreset = (p: Preset) => { setPreset(p); setLayers(PRESETS[p].layers); setBasemap(PRESETS[p].basemap); };

  /* -------------------------------------------------------------- panels */
  const [tab, setTab] = useState<"scenario" | "realtime">("scenario");
  const [importanceOpen, setImportanceOpen] = useState(false);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [evidenceFor, setEvidenceFor] = useState<string | null>(null);
  const [reviewMsg, setReviewMsg] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => { if (window.location.hash === "#sensitivity") setExplorerOpen(true); }, 0);
    return () => window.clearTimeout(t);
  }, []);

  /* -------------------------------------------------------------- scenario (exact server recomputation) */
  const setup = useScenarioSetup(params.get("type"));
  const { kind, result } = setup;
  const [showSim, setShowSim] = useState(true);
  const simOn = !!result && showSim;
  const runScenario = async () => {
    setSaved(null);
    const r = await setup.run();
    if (!r) return;
    setShowSim(true);
    setDetailsOpen(true);
    const f = buildMapView({ kind: r.type as typeof kind, phase: "done", result: r, mask, graph, picked: [], cands: [], actions: [] }).focus;
    if (f) requestMapFocus(f.lat, f.lon, f.zoom);
  };
  const saveResult = result && user ? async () => {
    try {
      const s = await saveScenario({ study_area_id: sceneId, run_id: dataSource.provenance?.runId ?? runId, type: result.type, params: result.parameters, result: { baseline: result.baseline, scenario: result.scenario, difference: result.difference, explanation: result.explanation, label: result.label } });
      setSaved(`Saved as scenario #${s.id} (recomputed on the server, audited).`);
    } catch (e) { setSaved(`Could not save: ${e instanceof Error ? e.message : String(e)}`); }
  } : undefined;
  const scenarioMode = tab === "scenario";
  const view = useMemo(
    () => (scenarioMode || simOn
      ? buildMapView({ kind, phase: simOn ? "done" : "idle", result: simOn ? result : null, mask, graph, picked: scenarioMode ? removedPatchIds : [], cands: scenarioMode ? setup.cands : [], actions: restoration.actions })
      : null),
    [scenarioMode, simOn, kind, result, mask, graph, removedPatchIds, setup.cands, restoration.actions],
  );
  // patches read as bright outlines on imagery / the dark basemap (scenario styles - picked, removed, added - win)
  const bright = basemap !== "terrain";
  const patchStyle = (p: HabitatPatch) => view?.patchStyle?.(p)
    ?? (layers.heatmap ? { color: "#4ade80", fillOpacity: 0 } : bright ? { color: "#4ade80", fillColor: "#22c55e", fillOpacity: 0.3 } : null);
  const markers = (view?.markers ?? []).map((m) => { const c = candidateIdOfMarker(m.id); return c ? { ...m, onClick: () => setup.pickCandidate(c) } : m; });

  /* -------------------------------------------------------------- selection */
  // The patch card opens only after a click on THIS page (or an explicit ?patch= deep link) — a patch picked
  // elsewhere in the app (shared selection) must not open here unasked.
  const [pickedHere, setPickedHere] = useState(false);
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
  const cardPatchId = pickedHere || wantPatch ? selectedPatchId : null;
  const selectedPatch = useMemo(() => (view?.mask ?? mask).patches.find((p) => p.id === cardPatchId) ?? null, [view, mask, cardPatchId]);
  const selectedCell = useMemo(() => heatmap.cells.find((c) => c.id === selectedCellId) ?? null, [heatmap.cells, selectedCellId]);
  const pickPatch = (id: string | null) => {
    setPickedHere(true);
    setSelectedCellId(null);
    setSelectedPatchId(id);
    if (id) setDetailsOpen(true);
    if (id && scenarioMode && setup.picksPatches) setup.pickPatch(id);
  };
  const pickCell = (id: string | null) => { setPickedHere(true); setSelectedCellId(id); setSelectedPatchId(null); if (id) setDetailsOpen(true); };
  const simulateLoss = (id: string) => {
    setTab("scenario");
    if (kind !== "remove_patches") setup.setKind("remove_patches");
    if (!removedPatchIds.includes(id)) setup.pickPatch(id);
  };
  const verify = async (p: HabitatPatch) => {
    if (!dataSource.provenance) return;
    try {
      const d = await registerDetection({ study_area_id: sceneId, run_id: dataSource.provenance.runId, object_type: "patch", object_id: p.id, lat: p.center[0], lon: p.center[1], summary: `${p.areaHa} ha · rank #${p.criticalityRank ?? "—"} · confidence ${(p.confidence * 100).toFixed(0)} %` });
      setReviewMsg(`Registered as detection #${d.id} (${d.status}) — see Field Reports → verification queue.`);
    } catch (e) { setReviewMsg(e instanceof Error ? e.message : String(e)); }
  };

  const year = currentRun?.sceneYear ?? null;
  const realLabel = live ? `Real data${year ? ` · ${year}` : ""}` : "No analysis loaded";

  /* -------------------------------------------------------------- right column */
  const rightColumn = (
    <>
      <SelectedPatchCard
        patch={selectedPatch}
        cell={selectedCell}
        mask={mask}
        graph={graph}
        live={live}
        canReview={can("review_detections") && !!dataSource.provenance}
        onClose={() => { setSelectedPatchId(null); setSelectedCellId(null); setReviewMsg(null); }}
        onEvidence={setEvidenceFor}
        onVerify={verify}
        onSimulateLoss={simulateLoss}
        note={reviewMsg}
      />
      <NetworkCard mask={mask} graph={graph} conn={conn} onExplorer={() => setExplorerOpen(true)} />
      {result ? (
        <PanelCard icon={BarChart3} title="Simulation Result">
          <ScenarioResults result={result} playing={false} steps={[]} step={-1} onSave={saveResult} saved={saved} />
        </PanelCard>
      ) : (
        <PanelCard icon={BarChart3} title="Simulation Preview">
          <ImpactThumbnail bounds={scene.bounds as number[][]} heatmap={heatmap} onOpen={() => applyPreset("connectivity")} />
          <p className="mt-2.5 text-[11.5px] leading-snug text-muted-foreground">
            Where losing habitat would weaken the network most (connectivity sensitivity of this run). Run a scenario to see an exact recomputation.
          </p>
        </PanelCard>
      )}
      <button
        onClick={() => setImportanceOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#1e5f8a]/20 bg-[#f0f7fc] px-4 py-3 text-[14px] font-bold text-[#1e5f8a] shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:bg-[#e3f0f9]"
      >
        <BarChart3 className="h-4 w-4" /> View Full Analysis Results <ArrowUpRight className="h-4 w-4" />
      </button>
    </>
  );

  return (
    <AppShell title="Interactive Map" hideTitle bleed>
      <ScenarioMapStyles />
      <style>{`
        .im-map .leaflet-control-zoom{border:0!important;border-radius:12px!important;overflow:hidden;box-shadow:0 8px 20px -8px rgba(15,23,42,.35)!important;margin:12px 0 0 12px!important}
        .im-map .leaflet-control-zoom a{background:#fff!important;width:40px!important;height:40px!important;line-height:40px!important;font-size:20px!important;color:#0f172a!important;border-bottom:1px solid rgba(15,23,42,.08)!important}
        .im-map.im-bright path.leaflet-interactive[stroke="#1e5f8a"]{stroke:#22d3ee}
        .im-map .leaflet-control-scale{margin:0 14px 14px 0!important}
        .im-map .leaflet-control-scale-line{background:rgba(255,255,255,.85);border-color:#0f172a;color:#0f172a;font-weight:600}
      `}</style>
      <div className={cn("flex flex-col bg-[#f4f7f5]", fullscreen ? "fixed inset-0 z-[70]" : "lg:h-[calc(100dvh-68px)] lg:min-h-[520px]")}>
        {/* ------------------------------------------------ heading */}
        {!fullscreen && (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 pb-3 pt-3.5 sm:px-5 lg:flex-nowrap">
            <div className="min-w-0 flex-1">
              <h1 className="flex items-center gap-2 text-[26px] font-black leading-tight tracking-tight text-[#0f172a]">
                Interactive Map
                <Tooltip content={plainPurpose("/analysis") ?? "Explore the habitat map and its connectivity network."}><Info tabIndex={0} className="h-5 w-5 cursor-help text-[#64748b]" /></Tooltip>
              </h1>
              <p className="mt-0.5 truncate text-[13px] text-[#475569]">
                Explore mangrove habitats, run what-if scenarios and check the latest satellite pass · {scene.shortName} · {mask.totals.patchCount} patches
              </p>
            </div>
            <div role="tablist" aria-label="Map view" className="grid w-full shrink-0 grid-cols-3 gap-2 sm:flex sm:w-auto">
              {(Object.keys(PRESETS) as Preset[]).map((p) => {
                const P = PRESETS[p];
                const on = preset === p;
                return (
                  <button key={p} role="tab" aria-selected={on} onClick={() => applyPreset(p)}
                    className={cn("flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl border px-3 text-[13px] font-semibold transition-colors wd:h-11 wd:px-4 wd:text-[14px]",
                      on ? "border-transparent bg-[#15803d] text-white shadow-[0_8px_18px_-10px_rgba(21,128,61,0.9)]" : "border-black/[0.06] bg-white text-[#0f172a] hover:bg-[#f0fdf4]")}>
                    <P.icon className="h-[18px] w-[18px] shrink-0" /> <span className="sm:hidden">{P.short}</span><span className="hidden sm:inline">{P.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className={cn("relative grid min-h-0 flex-1 grid-cols-1 gap-3 px-3 pb-3 sm:px-4 lg:grid-cols-[300px_minmax(0,1fr)] wd:grid-cols-[320px_minmax(0,1fr)_316px] 2xl:grid-cols-[340px_minmax(0,1fr)_340px]", fullscreen && "pt-3")}>
          {/* ------------------------------------------------ left: scenario lab / real-time */}
          <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="p-3 pb-0">
              <div role="tablist" aria-label="Panel" className="grid grid-cols-2 gap-1 rounded-xl bg-[#f1f5f3] p-1">
                {([["scenario", "Scenario Lab", FlaskConical], ["realtime", "Real-time Analysis", Radar]] as const).map(([k, label, Icon]) => (
                  <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setup.setDrawing(false); }}
                    className={cn("flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-1 text-[13px] font-semibold transition-colors",
                      tab === k ? "bg-[#15803d] text-white shadow-sm" : "text-[#334155] hover:bg-white")}>
                    <Icon className="hidden h-4 w-4 wd:block" /> {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="scroll-slim min-h-0 flex-1 space-y-5 overflow-y-auto p-3.5">
              {tab === "scenario" ? (
                <>
                  <Step n={1} title="Choose a change" hint="Every change is recomputed exactly on the server and labelled SIMULATED.">
                    <ScenarioChooser value={kind} onChange={setup.setKind} disabled={setup.disabledKinds} groups={["lose", "gain"]} />
                  </Step>
                  <Step n={2} title="Test the assumptions" hint="Re-run the analysis with other settings to see whether the result holds.">
                    <ScenarioChooser value={kind} onChange={setup.setKind} disabled={setup.disabledKinds} groups={["test"]} />
                  </Step>
                  <Step n={3} title="Set it up">
                    <ScenarioSetup s={setup} actions={restoration.actions} />
                  </Step>
                </>
              ) : (
                <RealtimePanel areaId={sceneId} onShowRun={(id) => setRunId(id)} />
              )}
            </div>
            {tab === "scenario" && (
              <div className="border-t border-black/[0.06] bg-white p-3">
                <Button className="h-12 w-full rounded-xl bg-[#15803d] text-[15px] font-bold text-white shadow-[0_10px_22px_-12px_rgba(21,128,61,0.9)] hover:bg-[#126b33]" disabled={setup.busy || !setup.canRun} onClick={runScenario}>
                  {setup.busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Computing…</> : <><Play className="h-4 w-4" /> Run scenario</>}
                </Button>
                {setup.error && <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-[12px] text-[#b91c1c]">{setup.error}</div>}
              </div>
            )}
          </aside>

          {/* ------------------------------------------------ map */}
          <div className={cn("im-map relative order-first h-[62vh] min-h-[380px] overflow-hidden rounded-2xl border border-black/[0.06] bg-[#0b1f17] shadow-[0_1px_2px_rgba(15,23,42,0.04)] lg:order-none lg:h-auto lg:min-h-0", bright && "im-bright")}>
            <GisMap
              key={`${sceneId}-${mapKey}`}
              scene={scene}
              mask={view?.mask ?? mask}
              graph={view?.graph ?? graph}
              heatmap={heatmap}
              layers={layers}
              basemap={basemap}
              heatOpacity={heatOpacity}
              probabilityOverlay={probOverlay}
              selectedPatchId={cardPatchId}
              onSelectPatch={pickPatch}
              onCellClick={pickCell}
              removedPatchIds={view?.removedPatchIds}
              patchStyle={patchStyle}
              markers={markers}
              drawing={scenarioMode && setup.drawing}
              drawnPolygon={scenarioMode ? (kind === "add_patch" ? (setup.point ? [setup.point] : []) : setup.polygon) : []}
              onDrawPoint={setup.drawPoint}
              focus={focus}
              onCursorMove={setCursor}
              scalePosition="bottomright"
              className="h-full w-full"
            />

            {/* left tool rail under the zoom buttons */}
            <div className="absolute left-3 top-[104px] z-[1000] flex flex-col gap-2">
              {[
                { label: "Fit the study area", icon: Crosshair, onClick: () => setMapKey((k) => k + 1) },
                { label: fullscreen ? "Exit full screen" : "Full screen", icon: fullscreen ? Minimize2 : Maximize2, onClick: () => setFullscreen((v) => !v) },
                { label: "Patch details & network", icon: PanelRightOpen, onClick: () => setDetailsOpen(true), lgOnly: true },
              ].map((t) => (
                <Tooltip key={t.label} content={t.label} side="right">
                  <button onClick={t.onClick} aria-label={t.label} className={cn("h-10 w-10 place-items-center rounded-xl bg-white text-[#0f172a] shadow-[0_8px_20px_-8px_rgba(15,23,42,0.35)] hover:bg-[#f8faf9]", "lgOnly" in t ? "hidden lg:grid wd:hidden" : "grid")}>
                    <t.icon className="h-[18px] w-[18px]" />
                  </button>
                </Tooltip>
              ))}
            </div>

            {/* data chips: real run vs simulated preview */}
            <div className="absolute left-16 top-3 z-[1000] flex max-w-[calc(100%-8rem)] items-center gap-1 rounded-xl bg-white/95 p-1 shadow-lg">
              <button onClick={() => setShowSim(false)} aria-pressed={!simOn}
                className={cn("truncate rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-colors sm:px-3 sm:text-[12.5px]", !simOn ? "bg-[#15803d] text-white" : "text-[#334155] hover:bg-black/[0.04]")}>
                {realLabel}
              </button>
              <Tooltip content={result ? `${result.label}: an exact recomputation, not an observation.` : "Run a scenario first."}>
                <button onClick={() => result && setShowSim(true)} aria-pressed={simOn} aria-disabled={!result}
                  className={cn("truncate rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-colors sm:px-3 sm:text-[12.5px]", simOn ? "bg-[#c2410c] text-white" : result ? "text-[#334155] hover:bg-black/[0.04]" : "cursor-not-allowed text-[#94a3b8]")}>
                  Simulation<span className="hidden sm:inline"> (preview)</span>
                </button>
              </Tooltip>
            </div>
            {scenarioMode && setup.drawing && (
              <div className="pointer-events-none absolute left-1/2 top-16 z-[1000] -translate-x-1/2 rounded-full bg-[#0f5132] px-3 py-1.5 text-[12px] font-semibold text-white shadow">
                {kind === "add_patch" ? "Click the map to place the patch" : "Click the map to add points"}
              </div>
            )}

            {/* right controls: details drawer (1024–1279 px) + layers */}
            <div className="absolute right-3 top-3 z-[1001] flex items-start gap-2">
              <LayerControl
                className="relative right-auto top-auto"
                buttonLabel={<span className="hidden wd:inline">Map Layers</span>}
                layers={layers}
                onChange={(l) => { setLayers(l); }}
                basemap={basemap}
                onBasemapChange={setBasemap}
                heatOpacity={heatOpacity}
                onHeatOpacityChange={setHeatOpacity}
                open={layerPanelOpen}
                onOpenChange={setLayerPanelOpen}
              />
            </div>

            {/* inset */}
            <div className="absolute bottom-3 left-3 z-[1000] hidden wd:block">
              <MiniInset bounds={scene.bounds as number[][]} label={scene.shortName} cursor={cursor} onFit={() => setMapKey((k) => k + 1)} />
            </div>

            {/* sensitivity explorer (τ · k · metric) */}
            {explorerOpen && (
              <div className="absolute left-16 top-16 z-[1002] w-[320px] max-w-[calc(100%-5rem)]">
                <div className="mb-1.5 flex justify-end">
                  <button onClick={() => setExplorerOpen(false)} className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11.5px] font-semibold shadow"><X className="h-3.5 w-3.5" /> Close explorer</button>
                </div>
                <div className="max-h-[calc(100%-3rem)] overflow-y-auto scroll-slim"><SensitivityExplorer /></div>
              </div>
            )}

            {evidenceFor && <EvidenceDrawer objectType="patch" objectId={evidenceFor} onClose={() => setEvidenceFor(null)} />}
          </div>

          {/* full results: the leave-one-out ranking of every patch */}
          {importanceOpen && (
            <div className="absolute inset-x-3 bottom-3 top-0 z-[1100] flex flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-2xl sm:inset-x-4">
              <div className="flex items-center justify-between border-b border-black/[0.06] px-4 py-2.5">
                <div className="text-[14px] font-bold text-[#0f172a]">Full analysis results · patch importance</div>
                <div className="flex items-center gap-2">
                  <Link href="/reports" className="hidden items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold text-[#0f5132] hover:bg-[#f0fdf4] sm:flex">Report <ArrowUpRight className="h-3.5 w-3.5" /></Link>
                  <button onClick={() => setImportanceOpen(false)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold text-[#334155] hover:bg-black/[0.04]"><X className="h-4 w-4" /> Back to map</button>
                </div>
              </div>
              <div className="relative min-h-0 flex-1">
                <PatchImportance onExplain={(id) => setEvidenceFor(id)} onShowOnMap={(id) => { setImportanceOpen(false); pickPatch(id); const p = mask.patches.find((x) => x.id === id); if (p) requestMapFocus(p.center[0], p.center[1], 14); }} />
              </div>
            </div>
          )}
          {/* ------------------------------------------------ right: details (column on xl, drawer over the map on lg) */}
          <aside className={cn(
            "scroll-slim min-h-0 space-y-3 overflow-y-auto",
            "lg:absolute lg:bottom-6 lg:right-7 lg:top-3 lg:z-[1004] lg:w-[316px] lg:rounded-2xl lg:bg-[#f4f7f5]/95 lg:p-2 lg:shadow-2xl lg:backdrop-blur",
            "wd:static wd:z-auto wd:w-auto wd:rounded-none wd:bg-transparent wd:p-0 wd:shadow-none wd:backdrop-blur-none",
            !detailsOpen && "lg:max-wd:hidden",
          )}>
            <div className="hidden justify-end lg:flex wd:hidden">
              <button onClick={() => setDetailsOpen(false)} className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11.5px] font-semibold text-[#334155] shadow-sm" aria-label="Hide details"><X className="h-3.5 w-3.5" /> Hide</button>
            </div>
            {rightColumn}
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
