/**
 * Typed access layer over the mock JSON.
 *
 * Every page reads through these helpers rather than importing JSON directly,
 * so swapping in a real API later means changing this file only.
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
  HabitatGraph,
  HabitatMask,
  HeatmapData,
  PipelineStage,
  RestorationData,
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

export const getHabitatMask = (sceneId: string): HabitatMask => fallback(masks, sceneId);
export const getGraph = (sceneId: string): HabitatGraph => fallback(graphs, sceneId);
export const getHeatmap = (sceneId: string): HeatmapData => fallback(heatmaps, sceneId);
export const getConnectivity = (sceneId: string): ConnectivityMetrics =>
  fallback(connectivity, sceneId);
export const getSimulation = (sceneId: string): SimulationData => fallback(simulations, sceneId);
export const getRestoration = (sceneId: string): RestorationData => fallback(restorations, sceneId);
export const getTimeline = (sceneId: string): TimelineData => fallback(timelines, sceneId);

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
