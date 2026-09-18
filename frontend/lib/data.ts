/**
 * Typed data-access layer — LIVE ONLY.
 *
 * Every page reads through these helpers. Each per-scene getter returns the `FrontendBundle` of the
 * real pipeline run fetched from the backend (see `hooks/use-analysis.tsx`). When no run exists for a
 * landscape (or the backend is offline) the getters return EMPTY structures — never prototype or
 * synthetic content — and `getDataSource(sceneId).mode === "none"` so the UI can say so.
 *
 * Study-area metadata (names, extent, protection) is configuration mirrored from
 * configs/study_areas.yaml; it is not a measurement.
 */
import studyAreas from "@/config-data/study-areas.json";

import type {
  ConnectivityMetrics,
  FrontendBundle,
  HabitatGraph,
  HabitatMask,
  HeatmapData,
  RestorationData,
  RunProvenance,
  SatelliteScene,
  TimelineData,
} from "@/types";

/* ------------------------------------------------------------------ */
/* study areas (configuration)                                         */
/* ------------------------------------------------------------------ */

export const SCENES = studyAreas.scenes as unknown as SatelliteScene[];
export const DEFAULT_SCENE_ID = "kerala-coast";

export function getScenes(): SatelliteScene[] {
  return SCENES;
}

export function getScene(sceneId: string): SatelliteScene {
  return SCENES.find((s) => s.id === sceneId) ?? SCENES[0];
}

/* ------------------------------------------------------------------ */
/* empty payloads (no run yet)                                         */
/* ------------------------------------------------------------------ */

const emptyMask = (sceneId: string): HabitatMask => ({
  sceneId, generatedAt: "", modelVersion: "", classes: [], patches: [],
  totals: { habitatAreaHa: 0, patchCount: 0, meanPatchSizeHa: 0, largestPatchIndex: 0, edgeDensity: 0, meanConfidence: 0 },
});
const emptyGraph = (sceneId: string): HabitatGraph => ({ sceneId, nodes: [], edges: [], clusters: [] });
const emptyHeatmap = (sceneId: string): HeatmapData => ({ sceneId, resolutionM: 0, generatedAt: "", cells: [], legend: [] } as unknown as HeatmapData);
const emptyConnectivity = (sceneId: string): ConnectivityMetrics => ({
  sceneId, score: 0, previousScore: null, pcIndex: 0, iicIndex: 0, equivalentConnectedArea: 0, ecaPctOfHabitat: undefined,
  meanPatchIsolationM: null, linkDensity: 0, networkDiameterKm: 0, fragmentationIndex: 0, resilienceIndex: 0, confidence: 0,
  grade: null, interpretation: null, components: [], composition: [], health: [], trend: [],
} as unknown as ConnectivityMetrics);
const emptyRestoration = (sceneId: string): RestorationData => ({ sceneId, currency: null, baselineScore: 0, rankingBasis: "raw_gain", budgetBands: [], actions: [] });
const emptyTimeline = (sceneId: string): TimelineData => ({ sceneId, years: [] });

/* ------------------------------------------------------------------ */
/* live registry (real pipeline runs served by the backend)            */
/* ------------------------------------------------------------------ */

const live = new Map<string, FrontendBundle>();

/** Register (or clear with `null`) the real-run bundle for a scene. */
export function registerLiveBundle(sceneId: string, bundle: FrontendBundle | null) {
  if (bundle) live.set(sceneId, bundle);
  else live.delete(sceneId);
}
export const getLiveBundle = (sceneId: string) => live.get(sceneId) ?? null;

/** Apply an exact re-analysis (other tau / k / metric) to the live bundle of a scene, in place. */
export function applyReanalysis(sceneId: string, r: import("@/lib/api").ReanalyseResult) {
  const b = live.get(sceneId);
  if (!b) return;
  const byId = new Map(r.criticality.map((c) => [c.patch_id, c]));
  const maxS = Math.max(...r.criticality.map((c) => c.criticality_score), 1e-9);
  b.habitatMask.patches.forEach((p) => {
    const c = byId.get(p.id);
    if (!c) return;
    p.sensitivity = c.level;
    p.connectivityContribution = c.criticality_score;
    p.criticalityRank = c.rank;
    p.criticalityScore = c.criticality_score;
    p.deltaPct = c.delta_pct;
    p.degree = c.degree;
    p.isCutVertex = c.is_cut_vertex;
    p.componentCountAfter = c.component_count_after;
  });
  b.graph.nodes.forEach((n) => {
    const c = byId.get(n.patchId);
    if (!c) return;
    n.sensitivity = c.level;
    n.importance = c.criticality_score;
    n.connectivity = c.criticality_score / maxS;
    n.degree = c.degree;
    n.criticalityRank = c.rank;
    n.isCutVertex = c.is_cut_vertex;
  });
  b.graph.edges = r.edges.map((e, i) => ({
    id: `${sceneId}-re${i + 1}`, source: e.source, target: e.target, strength: e.weight,
    distanceKm: e.distance_km, resistance: 1 - e.weight, critical: false, speciesFlow: [],
  }));
  b.connectivity.iicIndex = r.summary.iic;
  b.connectivity.pcIndex = r.summary.pc;
  b.connectivity.equivalentConnectedArea = r.summary.eca_ha;
  b.connectivity.ecaPctOfHabitat = r.summary.eca_pct_of_habitat;
  b.connectivity.score = r.interface_score;
  b.connectivity.fragmentationIndex = r.summary.n_components / Math.max(r.summary.n_patches, 1);
  if (b.connectivity.research) {
    b.connectivity.research.iic = r.summary.iic;
    b.connectivity.research.pc = r.summary.pc;
    b.connectivity.research.ecaHa = r.summary.eca_ha;
    b.connectivity.research.nEdges = r.summary.n_edges;
    b.connectivity.research.nComponents = r.summary.n_components;
    b.connectivity.research.tauKm = r.parameters.tau_km;
    b.connectivity.research.k = r.parameters.k;
  }
  b.provenance.parameters = { ...b.provenance.parameters, tauKm: r.parameters.tau_km, k: r.parameters.k, metric: r.parameters.metric };
}

/** Replace the restoration ranking of a live bundle (e.g. after a user cost upload). */
export function applyRestorationActions(sceneId: string, actions: import("@/types").RestorationAction[], basis: "gain_per_cost" | "raw_gain") {
  const b = live.get(sceneId);
  if (!b) return;
  b.restoration.actions = actions;
  b.restoration.rankingBasis = basis;
}

const liveTimelines = new Map<string, TimelineData>();
/** Register a REAL timeline (>= 1 year with an actual pipeline run); `null` clears it. */
export function registerLiveTimeline(sceneId: string, t: TimelineData | null) {
  if (t && t.years.length) liveTimelines.set(sceneId, t);
  else liveTimelines.delete(sceneId);
}
export const hasLiveTimeline = (sceneId: string) => liveTimelines.has(sceneId);

export type DataMode = "live" | "none";
export interface DataSource {
  mode: DataMode;
  /** Present for live runs. */
  provenance: RunProvenance | null;
  /** Short label for badges. */
  label: string;
}
export const NO_RUN_LABEL = "NO ANALYSIS YET — run the pipeline for this landscape";

export function getDataSource(sceneId: string): DataSource {
  const b = live.get(sceneId);
  return b
    ? { mode: "live", provenance: b.provenance, label: b.provenance.resultLabel }
    : { mode: "none", provenance: null, label: NO_RUN_LABEL };
}

export const getHabitatMask = (sceneId: string): HabitatMask => live.get(sceneId)?.habitatMask ?? emptyMask(sceneId);
export const getGraph = (sceneId: string): HabitatGraph => live.get(sceneId)?.graph ?? emptyGraph(sceneId);
export const getHeatmap = (sceneId: string): HeatmapData => live.get(sceneId)?.heatmap ?? emptyHeatmap(sceneId);
export const getConnectivity = (sceneId: string): ConnectivityMetrics => live.get(sceneId)?.connectivity ?? emptyConnectivity(sceneId);
export const getRestoration = (sceneId: string): RestorationData => live.get(sceneId)?.restoration ?? emptyRestoration(sceneId);
/** Timeline: one entry per year that has a real pipeline run (backend /timeline); empty otherwise. */
export const getTimeline = (sceneId: string): TimelineData => liveTimelines.get(sceneId) ?? emptyTimeline(sceneId);
export const getExplanation = (sceneId: string, patchId: string) =>
  live.get(sceneId)?.explanations?.[patchId] ?? null;
export const getCriticality = (sceneId: string) => live.get(sceneId)?.criticality ?? null;

export const getPatch = (sceneId: string, patchId: string) =>
  getHabitatMask(sceneId).patches.find((p) => p.id === patchId);
