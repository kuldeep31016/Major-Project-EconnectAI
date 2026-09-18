/**
 * Typed data-access layer.
 *
 * Every page reads through these helpers. Each per-scene getter first looks in the LIVE
 * registry (a `FrontendBundle` fetched from the backend for a real pipeline run, see
 * `hooks/use-analysis.tsx`) and only then falls back to the prototype's prepared mock JSON.
 *
 *   live  -> computed by ecoconnect/ (segmentation -> patches -> graph -> criticality …),
 *            labelled by its `provenance.resultLabel`
 *   mock  -> PROTOTYPE / SYNTHETIC — deterministic generator output, never a result
 *
 * `getDataSource(sceneId)` tells the UI which one it is showing.
 */
import satelliteImages from "@/mock-data/satellite-images.json";
import habitatMask from "@/mock-data/habitat-mask.json";
import graphData from "@/mock-data/graph.json";
import heatmapData from "@/mock-data/heatmap.json";
import connectivityData from "@/mock-data/connectivity.json";
import simulationData from "@/mock-data/simulation.json";
import recommendationsData from "@/mock-data/recommendations.json";
import timelineData from "@/mock-data/timeline.json";
import reportsData from "@/mock-data/reports.json";
import assistantData from "@/mock-data/assistant.json";
import historyData from "@/mock-data/history.json";

import type {
  AnalysisHistoryEntry,
  AssistantData,
  ConnectivityMetrics,
  FrontendBundle,
  HabitatGraph,
  HabitatMask,
  HeatmapData,
  PipelineStage,
  RestorationData,
  RunProvenance,
  SatelliteScene,
  ScientificReport,
  SimulationData,
  TimelineData,
} from "@/types";

/* ------------------------------------------------------------------ */
/* scenes                                                              */
/* ------------------------------------------------------------------ */

export const SCENES = satelliteImages.scenes as unknown as SatelliteScene[];
export const DEFAULT_SCENE_ID = "kerala-coast";

export function getScenes(): SatelliteScene[] {
  return SCENES;
}

export function getScene(sceneId: string): SatelliteScene {
  return SCENES.find((s) => s.id === sceneId) ?? SCENES[0];
}

/* ------------------------------------------------------------------ */
/* per-scene payloads                                                  */
/* ------------------------------------------------------------------ */

const masks = habitatMask as unknown as Record<string, HabitatMask>;
const graphs = graphData as unknown as Record<string, HabitatGraph>;
const heatmaps = heatmapData as unknown as Record<string, HeatmapData>;
const connectivity = connectivityData as unknown as Record<string, ConnectivityMetrics>;
const simulations = simulationData as unknown as Record<string, SimulationData>;
const restorations = recommendationsData as unknown as Record<string, RestorationData>;
const timelines = timelineData as unknown as Record<string, TimelineData>;

const fallback = <T,>(map: Record<string, T>, sceneId: string): T =>
  map[sceneId] ?? map[DEFAULT_SCENE_ID];

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

export type DataMode = "live" | "mock";
export interface DataSource {
  mode: DataMode;
  /** Present for live runs. */
  provenance: RunProvenance | null;
  /** Short label for badges. */
  label: string;
}
export const MOCK_LABEL = "PROTOTYPE / SYNTHETIC DATA — not a result";

export function getDataSource(sceneId: string): DataSource {
  const b = live.get(sceneId);
  return b
    ? { mode: "live", provenance: b.provenance, label: b.provenance.resultLabel }
    : { mode: "mock", provenance: null, label: MOCK_LABEL };
}

export const getHabitatMask = (sceneId: string): HabitatMask =>
  live.get(sceneId)?.habitatMask ?? fallback(masks, sceneId);
export const getGraph = (sceneId: string): HabitatGraph =>
  live.get(sceneId)?.graph ?? fallback(graphs, sceneId);
export const getHeatmap = (sceneId: string): HeatmapData =>
  live.get(sceneId)?.heatmap ?? fallback(heatmaps, sceneId);
export const getConnectivity = (sceneId: string): ConnectivityMetrics =>
  live.get(sceneId)?.connectivity ?? fallback(connectivity, sceneId);
export const getRestoration = (sceneId: string): RestorationData =>
  live.get(sceneId)?.restoration ?? fallback(restorations, sceneId);
/** Scenario projections (cyclone, SLR …) and the 2020–25 timeline are PROTOTYPE narrative
 *  content: they are not produced by the pipeline and remain mock in every mode. */
export const getSimulation = (sceneId: string): SimulationData => fallback(simulations, sceneId);
export const getTimeline = (sceneId: string): TimelineData => fallback(timelines, sceneId);
export const getExplanation = (sceneId: string, patchId: string) =>
  live.get(sceneId)?.explanations?.[patchId] ?? null;
export const getCriticality = (sceneId: string) => live.get(sceneId)?.criticality ?? null;

export const getPatch = (sceneId: string, patchId: string) =>
  getHabitatMask(sceneId).patches.find((p) => p.id === patchId);

/* ------------------------------------------------------------------ */
/* reports, history, assistant                                         */
/* ------------------------------------------------------------------ */

export const REPORTS = reportsData.reports as unknown as ScientificReport[];
export const HISTORY = historyData.entries as unknown as AnalysisHistoryEntry[];
export const ASSISTANT = assistantData as unknown as AssistantData;

export const getReports = (): ScientificReport[] => REPORTS;
export const getReport = (id: string): ScientificReport =>
  REPORTS.find((r) => r.id === id) ?? REPORTS[0];
export const getReportForScene = (sceneId: string): ScientificReport =>
  REPORTS.find((r) => r.sceneId === sceneId) ?? REPORTS[0];
export const getHistory = (): AnalysisHistoryEntry[] => HISTORY;

/**
 * Keyword-scored intent match against the canned reply set. Deliberately simple —
 * it only needs to feel responsive, and a deterministic match is easier to demo.
 */
export function matchAssistantReply(input: string) {
  const q = input.toLowerCase().trim();
  if (!q) return null;

  let best: { score: number; reply: (typeof ASSISTANT.replies)[number] } | null = null;
  for (const reply of ASSISTANT.replies) {
    let score = 0;
    for (const kw of reply.match) if (q.includes(kw)) score += kw.length;
    if (q === reply.question.toLowerCase()) score += 100;
    if (score > 0 && (!best || score > best.score)) best = { score, reply };
  }
  return best?.reply ?? null;
}

/* ------------------------------------------------------------------ */
/* analysis pipeline                                                   */
/* ------------------------------------------------------------------ */

export const PIPELINE_STAGES: PipelineStage[] = [
  {
    id: "upload",
    label: "Uploading",
    detail: "Transferring scene to processing node",
    icon: "UploadCloud",
    durationMs: 1500,
    logs: [
      "Establishing secure channel to ingest-node-04…",
      "Validating GeoTIFF header and CRS…",
      "CRS detected: EPSG:32643 (WGS 84 / UTM zone 43N)",
      "Transfer complete — checksum verified",
    ],
  },
  {
    id: "preprocess",
    label: "Preprocessing",
    detail: "Atmospheric correction and cloud masking",
    icon: "Layers",
    durationMs: 2200,
    logs: [
      "Applying Sen2Cor atmospheric correction…",
      "Generating scene classification layer…",
      "Cloud + cirrus mask: 4.2% of scene excluded",
      "Resampling B11, B12 to 10 m…",
      "Computing NDVI, NDWI index channels…",
    ],
  },
  {
    id: "segmentation",
    label: "Habitat Segmentation",
    detail: "EcoSeg v3.2 — Swin-UNet inference",
    icon: "Scan",
    durationMs: 3400,
    logs: [
      "Loading EcoSeg-v3.2 weights (12-band input)…",
      "Tiling scene into 512×512 windows — 486 tiles",
      "Running inference on GPU cluster…",
      "Thresholding class probabilities at 0.5…",
      "Vectorising masks — 2 ha minimum mapping unit",
      "18 habitat patches resolved · mean confidence 0.91",
    ],
  },
  {
    id: "graph",
    label: "Building Habitat Graph",
    detail: "Patch topology and resistance surface",
    icon: "Network",
    durationMs: 2400,
    logs: [
      "Reducing patches to weighted centroids…",
      "Computing inter-patch dispersal distances…",
      "Deriving resistance surface from land cover…",
      "Linking patches below dispersal threshold…",
      "Graph built — 18 nodes, 31 functional links",
    ],
  },
  {
    id: "connectivity",
    label: "Connectivity Analysis",
    detail: "PC / IIC indices and betweenness centrality",
    icon: "GitBranch",
    durationMs: 2800,
    logs: [
      "Computing Probability of Connectivity (PC)…",
      "Computing Integral Index of Connectivity (IIC)…",
      "Quality-weighted betweenness centrality per patch…",
      "Identifying bridging corridors…",
      "Landscape connectivity score: 74.6 / 100",
    ],
  },
  {
    id: "sensitivity",
    label: "Generating Sensitivity Map",
    detail: "Leave-one-out marginal importance surface",
    icon: "Flame",
    durationMs: 2600,
    logs: [
      "Initialising 100 m analysis grid…",
      "Leave-one-out recomputation per cell…",
      "Classifying sensitivity into 4 bands…",
      "2 cells classified critical · 47 high",
      "Sensitivity surface rendered",
    ],
  },
  {
    id: "report",
    label: "Creating Report",
    detail: "Compiling findings and recommendations",
    icon: "FileText",
    durationMs: 1800,
    logs: [
      "Ranking restoration candidates by marginal gain…",
      "Running six scenario projections…",
      "Composing executive summary…",
      "Report ECR-2026-0142 ready",
    ],
  },
];

export const TOTAL_PIPELINE_MS = PIPELINE_STAGES.reduce((s, x) => s + x.durationMs, 0);
