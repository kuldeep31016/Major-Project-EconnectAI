"use client";

import { useEffect, useMemo, useState } from "react";
import { useAnalysis } from "@/hooks/use-analysis";
import { fetchRuns, postScenario, type ScenarioResult } from "@/lib/api";
import type { LatLng, RunSummary } from "@/types";
import { isKind, type Kind } from "@/components/simulation/scenario-kinds";

/**
 * Inputs of one scenario (A–K) and the call that recomputes it on the server. Shared by the Scenario Lab and the
 * Interactive Map so both build exactly the same request. Inputs and the result are scoped to (landscape, run):
 * switching either starts from a clean slate. Results are never computed in the browser.
 */
export function useScenarioSetup(initialKind?: string | null) {
  const { sceneId, runId, runs: areaRuns, dataSource, removedPatchIds, togglePatchRemoved, clearRemoved } = useAnalysis();
  const live = dataSource.mode === "live";
  // the displayed run: some stored runs no longer have their probability raster, which the Thresholds scenario needs
  const currentRun = runId === "latest" ? areaRuns.find((r) => r.studyAreaId === sceneId && r.isLatest) : areaRuns.find((r) => r.runId === runId);
  const disabledKinds: Partial<Record<Kind, string>> = currentRun && currentRun.probabilityRaster === false
    ? { threshold: "Not available for this run: its probability raster is not on this server. Use a new analysis or a satellite (near-real-time) run." }
    : {};

  const [kind, setKindRaw] = useState<Kind>(isKind(initialKind ?? null) ? (initialKind as Kind) : "remove_patches");
  const [drawing, setDrawing] = useState(false);
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

  useEffect(() => {
    let cancelled = false;
    fetchRuns(sceneId).then((r) => { if (!cancelled) setRuns(r.filter((x) => x.resultKind !== "synthetic")); }).catch(() => { if (!cancelled) setRuns([]); });
    return () => { cancelled = true; };
  }, [sceneId]);

  const setResult = (d: ScenarioResult | null) => setRes({ scope, data: d });
  const setKind = (k: Kind) => { setKindRaw(k); setDrawing(false); setResult(null); setError(null); };
  const multi = kind === "restore_multi";
  const pickCandidate = (id: string) => { setResult(null); setCands((s) => (!multi ? [id] : s.includes(id) ? s.filter((x) => x !== id) : [...s, id])); };
  const pickPatch = (id: string) => { setResult(null); togglePatchRemoved(id); };
  const clearPicked = () => { setResult(null); clearRemoved(); };
  const clearPolygon = () => { setResult(null); setPolygon(() => []); };
  const drawPoint = (p: LatLng) => { setResult(null); if (kind === "add_patch") { setPoint(p); setDrawing(false); } else setPolygon((s) => [...s, p]); };
  /** Kinds whose inputs are picked by clicking patches on the map. */
  const picksPatches = kind === "remove_patches" || kind === "reduce_area";
  const otherRuns = runs.filter((r) => r.runId !== dataSource.provenance?.runId);

  const canRun = !disabledKinds[kind] && ((kind === "remove_patches" && removedPatchIds.length > 0) ||
    (kind === "remove_polygon" && polygon.length >= 3) ||
    ((kind === "restore" || kind === "restore_multi") && cands.length > 0) ||
    (kind === "compare_periods" && !!otherRun) ||
    (kind === "reduce_area" && removedPatchIds.length > 0) || (kind === "add_patch" && !!point) ||
    kind === "radius" || kind === "sensitivity" || kind === "tau" || kind === "threshold");

  /** Recompute the scenario on the server; resolves to the result (null when there is no live run). */
  const run = async (): Promise<ScenarioResult | null> => {
    setBusy(true); setError(null); setDrawing(false);
    try {
      if (!live) {
        // No backend run loaded: never fabricate numbers — scenarios are exact server-side recomputations only.
        setResult(null);
        setError("Needs the live analysis API — start the backend and reload.");
        return null;
      }
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
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    } finally {
      setBusy(false);
    }
  };

  return {
    live, kind, setKind, disabledKinds, drawing, setDrawing, polygon, clearPolygon, cands, multi, pickCandidate, point, drawPoint,
    otherRun, setOtherRun: (v: string) => { setResult(null); setOtherRun(v); }, otherRuns, retainPct, setRetainPct, areaHa, setAreaHa,
    tauKm, setTauKm, taus, setTaus, ks, setKs, removedPatchIds, pickPatch, clearPicked, picksPatches,
    result, setResult, busy, error, canRun, run,
  };
}

export type ScenarioSetupState = ReturnType<typeof useScenarioSetup>;
