"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  fetchRegistryModels, fetchRunCriticality, fetchRunManifest, fetchRunMetrics, fetchRunRestoration,
  type CriticalityRow, type RestorationCandidateRow,
} from "@/lib/api";

/**
 * One source for every figure on the landing page: the study area's current (LATEST) stored run, read from the API.
 * The worked example is chosen by the same rule as /demo (the cut vertex whose criticality rank most exceeds its size
 * rank); the restoration example is the first restoration-sized candidate. Until data arrives, values are null and the
 * UI shows "—" - no figure is ever typed into the page.
 */
export interface LandingStory {
  ready: boolean;
  runId: string | null;
  sceneYear: number | null;
  sensor: string;                 // what the model actually used
  modelStatus: string | null;
  nPatches: number | null;
  nEdges: number | null;
  nComponents: number | null;
  habitatHa: number | null;
  focus: CriticalityRow | null;   // worked example
  top: CriticalityRow | null;     // largest patch
  candidate: RestorationCandidateRow | null;
  candidates: RestorationCandidateRow[];   // all, in rank order
  uncertain: RestorationCandidateRow[];
}

const EMPTY: LandingStory = {
  ready: false, runId: null, sceneYear: null, sensor: "Sentinel-1 radar", modelStatus: null, nPatches: null, nEdges: null,
  nComponents: null, habitatHa: null, focus: null, top: null, candidate: null, candidates: [], uncertain: [],
};

const Ctx = createContext<LandingStory>(EMPTY);

export function LandingStoryProvider({ studyArea = "kerala-coast", children }: { studyArea?: string; children: React.ReactNode }) {
  const [story, setStory] = useState<LandingStory>(EMPTY);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [manifest, metrics, crit, rest, models] = await Promise.all([
          fetchRunManifest(studyArea), fetchRunMetrics(studyArea), fetchRunCriticality(studyArea), fetchRunRestoration(studyArea),
          fetchRegistryModels().catch(() => []),
        ]);
        const rm = metrics.research_metrics;
        const cuts = crit.filter((r) => r.is_cut_vertex);
        const pool = cuts.length ? cuts : crit;
        const focus = pool.length ? pool.reduce((a, b) => (b.rank_by_area - b.rank > a.rank_by_area - a.rank ? b : a)) : null;
        const top = [...crit].sort((a, b) => a.rank_by_area - b.rank_by_area)[0] ?? null;
        const modelId = (manifest.data_source.model ?? "").split("/").slice(-2, -1)[0];
        if (!cancelled) setStory({
          ready: true, runId: manifest.run_id, sceneYear: manifest.data_source.scene_year ?? null, sensor: "Sentinel-1 radar",
          modelStatus: models.find((m) => m.id === modelId)?.status ?? null,
          nPatches: rm.n_patches, nEdges: rm.n_edges, nComponents: rm.n_components, habitatHa: rm.habitat_area_ha,
          focus, top: top && focus && top.patch_id === focus.patch_id ? crit.find((r) => r.patch_id !== focus.patch_id) ?? null : top,
          candidate: rest.candidates.find((c) => c.category !== "uncertain_habitat") ?? null,
          candidates: rest.candidates,
          uncertain: rest.candidates.filter((c) => c.category === "uncertain_habitat"),
        });
      } catch {
        /* API unreachable: keep "—" placeholders rather than showing stale numbers */
      }
    })();
    return () => { cancelled = true; };
  }, [studyArea]);
  return <Ctx.Provider value={story}>{children}</Ctx.Provider>;
}

export const useLandingStory = () => useContext(Ctx);

/** Format helpers that never invent a value. */
export const num = (v: number | null | undefined, d = 1) => (v == null || !Number.isFinite(v) ? "—" : v.toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: d }));
export const int = (v: number | null | undefined) => (v == null ? "—" : String(v));
