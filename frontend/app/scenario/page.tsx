"use client";

import dynamic from "next/dynamic";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FlaskConical, Pencil, Play, Save } from "lucide-react";
import { AppShell } from "@/components/dashboard/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAnalysis } from "@/hooks/use-analysis";
import { useAuth } from "@/hooks/use-auth";
import { fetchRuns, postScenario, saveScenario, type ScenarioResult } from "@/lib/api";
import type { RunSummary } from "@/types";
import { getGraph, getHabitatMask, getHeatmap, getRestoration } from "@/lib/data";
import type { LatLng } from "@/types";
import { cn } from "@/lib/utils";
import { fmtIndex } from "@/utils/format";

const GisMap = dynamic(() => import("@/components/maps/gis-map"), { ssr: false });

type Kind = "remove_patches" | "remove_polygon" | "restore" | "restore_multi" | "tau" | "threshold" | "compare_periods";
const KINDS: { id: Kind; label: string; hint: string }[] = [
  { id: "remove_patches", label: "A · Remove patch", hint: "click patches on the map" },
  { id: "remove_polygon", label: "B · Remove inside polygon", hint: "draw an impact area" },
  { id: "restore", label: "C · Restore candidate", hint: "pick one candidate" },
  { id: "restore_multi", label: "D · Restore several", hint: "pick several candidates" },
  { id: "tau", label: "E · Compare τ 3/5/8 km", hint: "dispersal threshold sensitivity" },
  { id: "threshold", label: "F · Compare thresholds", hint: "re-extract patches at other probabilities" },
  { id: "compare_periods", label: "G · Compare periods", hint: "two observation dates" },
];

function Delta({ label, b, s, fmt }: { label: string; b: number; s: number; fmt: (v: number) => string }) {
  const d = s - b;
  const pct = b ? (100 * d) / b : 0;
  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 border-t border-foreground/[0.06] py-1.5 text-[12px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular">{fmt(b)}</span>
      <span className="tabular font-semibold">{fmt(s)}</span>
      <span className={cn("tabular text-[11px]", d < 0 ? "text-[#b91c1c]" : d > 0 ? "text-[#15803d]" : "text-muted-foreground")}>{d === 0 ? "—" : `${d > 0 ? "+" : ""}${pct.toFixed(1)} %`}</span>
    </div>
  );
}

export default function ScenarioLab() {
  return <Suspense><ScenarioLabView /></Suspense>;
}

function ScenarioLabView() {
  const { user } = useAuth();
  const params = useSearchParams();
  const wanted = params.get("type") as Kind | null;
  const { sceneId, scene, runId, dataSource, selectedPatchId, setSelectedPatchId, removedPatchIds, togglePatchRemoved, clearRemoved } = useAnalysis();
  const live = dataSource.mode === "live";
  const mask = getHabitatMask(sceneId);
  const graph = getGraph(sceneId);
  const heatmap = getHeatmap(sceneId);
  const restoration = getRestoration(sceneId);
  const [kind, setKind] = useState<Kind>(wanted && KINDS.some((k) => k.id === wanted) ? wanted : "remove_patches");
  const [drawing, setDrawing] = useState(false);
  // inputs and the result are scoped to (landscape, run): switching either starts from a clean slate
  const scope = `${sceneId}|${runId}`;
  const [inputs, setInputs] = useState<{ scope: string; polygon: LatLng[]; cands: string[] }>({ scope, polygon: [], cands: [] });
  const polygon = inputs.scope === scope ? inputs.polygon : [];
  const cands = inputs.scope === scope ? inputs.cands : [];
  const setPolygon = (f: (p: LatLng[]) => LatLng[]) => setInputs((i) => ({ scope, polygon: f(i.scope === scope ? i.polygon : []), cands: i.scope === scope ? i.cands : [] }));
  const setCands = (f: (c: string[]) => string[]) => setInputs((i) => ({ scope, polygon: i.scope === scope ? i.polygon : [], cands: f(i.scope === scope ? i.cands : []) }));
  const [otherRun, setOtherRun] = useState("");
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [res, setRes] = useState<{ scope: string; data: ScenarioResult | null } | null>(null);
  const result = res?.scope === scope ? res.data : null;
  const setResult = (d: ScenarioResult | null) => setRes({ scope, data: d });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchRuns(sceneId).then((r) => { if (!cancelled) setRuns(r.filter((x) => x.resultKind !== "synthetic")); }).catch(() => { if (!cancelled) setRuns([]); });
    return () => { cancelled = true; };
  }, [sceneId]);

  const isPolygonReady = kind === "remove_polygon" && polygon.length >= 3;
  const canRun = (kind === "remove_patches" && removedPatchIds.length > 0) ||
    isPolygonReady ||
    ((kind === "restore" || kind === "restore_multi") && cands.length > 0) ||
    (kind === "compare_periods" && !!otherRun) ||
    kind === "tau" || kind === "threshold";

  const run = useCallback(async () => {
    setBusy(true); setError(null); setSaved(null);
    try {
      if (live) {
        const body: Record<string, unknown> = { type: kind };
        if (kind === "remove_patches") body.patch_ids = removedPatchIds;
        if (kind === "remove_polygon") body.polygon = polygon;
        if (kind === "restore" || kind === "restore_multi") body.candidate_ids = cands;
        if (kind === "compare_periods") body.other_run_id = otherRun;
        const resData = await postScenario(sceneId, runId, body);
        setResult(resData);
      } else {
        // No backend run loaded: never fabricate numbers — scenarios are exact server-side recomputations only.
        setResult(null);
        setError("Backend offline or no analysis run loaded — scenarios need the live API (start the backend and reload).");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [live, kind, removedPatchIds, polygon, cands, otherRun, sceneId, runId]);

  const variants = (result as { variants?: Record<string, unknown>[] } | null)?.variants;
  const scenarioGraph = useMemo(() => {
    if (!result || !("edges_after" in result) || !result.edges_after) return graph;
    return { ...graph, edges: result.edges_after.map((e, i) => ({ id: `s${i}`, source: e.source, target: e.target, strength: e.weight, distanceKm: e.distance_km, resistance: 1 - e.weight, critical: false, speciesFlow: [] })) };
  }, [result, graph]);
  const removedForMap = result && "removed_patch_ids" in result && result.removed_patch_ids ? result.removed_patch_ids : removedPatchIds;

  return (
    <AppShell title="Scenario Lab" subtitle={`${scene.shortName} · every result is an exact recomputation, labelled SIMULATED or OBSERVED`} bleed>
      <div className="grid h-[calc(100vh-4rem)] grid-cols-1 lg:grid-cols-[340px_1fr_380px]">
        {/* ------------------------------------------------ controls */}
        <div className="scroll-slim overflow-y-auto border-r border-foreground/[0.08] p-3 space-y-3">
          <div className="space-y-1">
            {KINDS.map((k) => (
              <button key={k.id} onClick={() => { setKind(k.id); setResult(null); }} className={cn("w-full rounded-xl border px-3 py-2 text-left transition-all", kind === k.id ? "border-[#0f5132] bg-[#0f5132]/10 shadow-sm" : "border-foreground/[0.08] hover:bg-foreground/[0.03]")}>
                <div className="text-[12.5px] font-semibold">{k.label}</div><div className="text-[10.5px] text-muted-foreground">{k.hint}</div>
              </button>
            ))}
          </div>
          {kind === "remove_patches" && <div className="text-[11.5px] text-muted-foreground">Selected: {removedPatchIds.join(", ") || "click patches on the map"} {removedPatchIds.length > 0 && <button className="ml-1 underline text-[#0f5132] font-semibold" onClick={clearRemoved}>clear</button>}</div>}
          {kind === "remove_polygon" && (
            <div className="space-y-2 rounded-xl border border-dashed border-[#0f5132]/30 bg-[#0f5132]/5 p-3 text-[11.5px]">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">Draw Impact Area</span>
                <span className="text-muted-foreground">{polygon.length} points</span>
              </div>
              <Button size="sm" variant={drawing ? "default" : "outline"} className="w-full" onClick={() => { setDrawing((d) => !d); if (drawing && polygon.length > 0) {} }}>
                <Pencil className="h-3.5 w-3.5" /> {drawing ? "Finish Drawing" : "Click to Draw Polygon on Map"}
              </Button>
              {polygon.length > 0 && (
                <button onClick={() => setPolygon(() => [])} className="text-[10.5px] text-muted-foreground hover:text-red-600 underline">
                  Clear drawn polygon
                </button>
              )}
            </div>
          )}
          {(kind === "restore" || kind === "restore_multi") && (
            <div className="space-y-1">
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">Candidates (ranked by gain)</div>
              {restoration.actions.map((a) => (
                <button key={a.id} onClick={() => setCands((s) => kind === "restore" ? [a.id] : s.includes(a.id) ? s.filter((x) => x !== a.id) : [...s, a.id])} className={cn("flex w-full items-center justify-between rounded-lg border px-2.5 py-2 text-[11.5px] transition", cands.includes(a.id) ? "border-[#15803d] bg-[#15803d]/10 font-semibold" : "border-foreground/[0.08]")}>
                  <span>#{a.rank} {a.id} · {a.areaHa} ha</span><span className="tabular text-emerald-700 font-semibold">+{a.connectivityGain.toFixed(2)} %</span>
                </button>
              ))}
            </div>
          )}
          {kind === "compare_periods" && (
            <label className="block text-[11.5px]">Compare with run
              <select value={otherRun} onChange={(e) => setOtherRun(e.target.value)} className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-2 py-1.5">
                <option value="">select…</option>
                {runs.filter((r) => r.runId !== dataSource.provenance?.runId).map((r) => <option key={r.runId} value={r.runId}>{r.runId}{r.sceneYear ? ` (${r.sceneYear})` : ""}</option>)}
              </select>
            </label>
          )}
          <Button className="w-full bg-[#0f5132] text-white hover:bg-[#0b3d26]" disabled={busy || !canRun} onClick={run}>
            <Play className="h-3.5 w-3.5" /> {busy ? "Computing Simulation…" : "Run scenario"}
          </Button>
          {error && <div className="rounded-lg bg-red-50 p-2 text-[11.5px] text-[#b91c1c] border border-red-200">{error}</div>}
        </div>

        {/* ------------------------------------------------ map */}
        <div className="relative min-h-[420px]">
          <GisMap scene={scene} mask={mask} graph={scenarioGraph} heatmap={heatmap}
            layers={{ satellite: true, probability: false, habitat: true, heatmap: false, connectivity: true, protectedAreas: false, labels: false }}
            basemap="satellite" heatOpacity={0.5} selectedPatchId={selectedPatchId}
            onSelectPatch={(id) => { if (kind === "remove_patches" && id) togglePatchRemoved(id); else setSelectedPatchId(id); }}
            removedPatchIds={removedForMap} drawing={drawing} drawnPolygon={polygon} onDrawPoint={(p) => setPolygon((s) => [...s, p])} className="h-full w-full" />
          <div className="pointer-events-none absolute left-3 top-3 z-[900] rounded-lg bg-white/90 px-3 py-1.5 text-[11px] shadow">
            {result ? <span className={cn("font-semibold", result.label.startsWith("SIM") ? "text-[#c2410c]" : "text-[#1e5f8a]")}>{result.label}</span> : <span>{live ? "REAL DATA · baseline" : "no analysis for this landscape yet"}</span>}
          </div>
        </div>

        {/* ------------------------------------------------ result */}
        <div className="scroll-slim overflow-y-auto border-l border-foreground/[0.08] p-3 space-y-3">
          {!result ? (
            <Card><CardContent className="p-5 text-[12.5px] text-muted-foreground"><FlaskConical className="mb-2 h-5 w-5 text-[#6d5bd0]" />Choose a scenario, select inputs and run. The result shows baseline → scenario → difference for IIC, PC, ECA, links and components, the affected patches and an explanation built from the computed values.</CardContent></Card>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-1"><CardTitle className="flex items-center justify-between text-[13px]">{KINDS.find((k) => k.id === result.type)?.label}<Badge variant={result.label.startsWith("SIM") ? "warning" : "sky"}>{result.label}</Badge></CardTitle><CardDescription>{JSON.stringify(result.parameters)}</CardDescription></CardHeader>
                <CardContent>
                  {"scenario" in result && result.scenario && (
                    <>
                      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-[9.5px] uppercase tracking-wider text-muted-foreground"><span /><span>baseline</span><span>scenario</span><span>Δ</span></div>
                      <Delta label="IIC" b={result.baseline.iic} s={result.scenario.iic} fmt={fmtIndex} />
                      <Delta label="PC" b={result.baseline.pc} s={result.scenario.pc} fmt={fmtIndex} />
                      <Delta label="ECA (ha)" b={result.baseline.eca_ha} s={result.scenario.eca_ha} fmt={(v) => v.toFixed(0)} />
                      <Delta label="Habitat (ha)" b={result.baseline.habitat_area_ha} s={result.scenario.habitat_area_ha} fmt={(v) => v.toFixed(0)} />
                      <Delta label="Links" b={result.baseline.n_edges} s={result.scenario.n_edges} fmt={(v) => String(v)} />
                      <Delta label="Components" b={result.baseline.n_components} s={result.scenario.n_components} fmt={(v) => String(v)} />
                    </>
                  )}
                  {variants && (
                    <table className="w-full text-[11.5px]"><thead className="text-[9.5px] uppercase tracking-wider text-muted-foreground"><tr><th className="text-left">{result.type === "tau" ? "τ" : "thr"}</th><th>links</th><th>comp.</th><th>IIC</th><th>ECA %</th><th>{result.type === "tau" ? "ρ" : "patches"}</th></tr></thead>
                      <tbody className="tabular text-center">{variants.map((v, i) => <tr key={i} className="border-t border-foreground/[0.06]"><td className="py-1 text-left">{String(v.tau_km ?? v.threshold)}</td><td>{String(v.n_edges ?? "—")}</td><td>{String(v.n_components ?? "—")}</td><td>{typeof v.iic === "number" ? fmtIndex(v.iic) : "—"}</td><td>{typeof v.eca_pct_of_habitat === "number" ? v.eca_pct_of_habitat.toFixed(1) : "—"}</td><td>{result.type === "tau" ? (typeof v.spearman_vs_reference === "number" ? v.spearman_vs_reference.toFixed(2) : "—") : String(v.n_patches ?? "—")}</td></tr>)}</tbody></table>
                  )}
                </CardContent>
              </Card>
              <Card><CardHeader className="pb-1"><CardTitle className="text-[13px]">Explanation (from computed values)</CardTitle></CardHeader><CardContent className="text-[12px] leading-relaxed">{result.explanation}</CardContent></Card>
              {"affected_patch_ids" in result && result.affected_patch_ids && result.affected_patch_ids.length > 0 && (
                <Card><CardHeader className="pb-1"><CardTitle className="text-[13px]">Affected patches</CardTitle></CardHeader><CardContent className="text-[12px]">{result.affected_patch_ids.join(", ")}{result.newly_isolated_patch_ids?.length ? <div className="mt-1 text-[#b91c1c]">Newly isolated: {result.newly_isolated_patch_ids.join(", ")}</div> : null}</CardContent></Card>
              )}
              {"lost_patch_ids" in result && (
                <Card><CardHeader className="pb-1"><CardTitle className="text-[13px]">Patch-level change</CardTitle><CardDescription>matched by centroid proximity (&lt; 300 m); model outputs, no cause attributed</CardDescription></CardHeader>
                  <CardContent className="text-[12px] space-y-1"><div>Without counterpart in later period ({result.lost_patch_ids?.length}): {result.lost_patch_ids?.join(", ") || "—"}</div><div>New in later period ({result.gained_patch_ids?.length}): {result.gained_patch_ids?.join(", ") || "—"}</div>
                    {result.matched && result.matched.length > 0 && <table className="mt-1 w-full text-[11px]"><thead className="text-[9.5px] uppercase text-muted-foreground"><tr><th className="text-left">A → B</th><th>area</th><th>S_A → S_B</th><th>rank</th></tr></thead><tbody className="tabular text-center">{result.matched.slice(0, 12).map((x, i) => <tr key={i} className="border-t border-foreground/[0.06]"><td className="text-left">{x.patch_a} → {x.patch_b}</td><td>{x.area_a.toFixed(0)} → {x.area_b.toFixed(0)}</td><td>{x.S_a.toFixed(3)} → {x.S_b.toFixed(3)}</td><td>{x.rank_a} → {x.rank_b}</td></tr>)}</tbody></table>}
                  </CardContent></Card>
              )}
              {user && (
                <Button size="sm" variant="outline" onClick={async () => { const s = await saveScenario({ study_area_id: sceneId, run_id: dataSource.provenance?.runId ?? runId, type: result.type, params: result.parameters, result: { baseline: result.baseline, scenario: (result as { scenario?: unknown }).scenario, difference: (result as { difference?: unknown }).difference, explanation: result.explanation, label: result.label } }); setSaved(`Saved as scenario #${s.id} (audited).`); }}><Save className="h-3.5 w-3.5" /> Save to record</Button>
              )}
              {saved && <div className="text-[11.5px] text-[#0f5132]">{saved}</div>}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
