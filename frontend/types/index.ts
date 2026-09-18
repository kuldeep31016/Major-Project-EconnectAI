/**
 * EcoConnectAI — shared domain types.
 *
 * These mirror the shape of the payloads a real segmentation + graph-analysis
 * backend would return, so swapping mock JSON for a live API later is a
 * drop-in change rather than a rewrite.
 */

export type LatLng = [number, number];

export type SensitivityBand = "low" | "medium" | "high" | "critical";

export type HabitatClass =
  | "mangrove"
  | "seagrass"
  | "coral"
  | "saltmarsh"
  | "mudflat"
  | "estuary"
  | "dune"
  | "water"
  | "urban";

/* ------------------------------------------------------------------ */
/* Datasets                                                            */
/* ------------------------------------------------------------------ */

export interface SatelliteScene {
  id: string;
  name: string;
  shortName: string;
  region: string;
  state: string;
  sensor: string;
  productId: string;
  acquisitionDate: string;
  cloudCover: number;
  resolutionM: number;
  bands: string[];
  epsg: string;
  sizeMb: number;
  center: LatLng;
  bounds: [LatLng, LatLng];
  zoom: number;
  areaKm2: number;
  thumbnailGradient: [string, string];
  description: string;
  tags: string[];
  protectedAreas?: string[];
}

/* ------------------------------------------------------------------ */
/* Habitat segmentation                                                */
/* ------------------------------------------------------------------ */

export interface HabitatPatch {
  id: string;
  name: string;
  habitatClass: HabitatClass;
  areaHa: number;
  center: LatLng;
  polygon: LatLng[];
  /** Model confidence for the segmentation of this patch (0–1). */
  confidence: number;
  /** Composite ecological quality index (0–1). */
  quality: number;
  /** Share of landscape connectivity this patch carries (0–1). */
  connectivityContribution: number;
  /** Betweenness-derived bridging importance (0–1). */
  bridgeScore: number;
  sensitivity: SensitivityBand;
  protected: boolean;
  protectedAreaName?: string | null;
  /** Prototype-only descriptive fields. null when the payload comes from a real pipeline run. */
  carbonStockTonnes: number | null;
  speciesSupported: number | null;
  degradationRisk: number | null;
  notes: string;
  /* ---- research fields (present only on real pipeline runs; paper Eqs. 8-9) ---- */
  criticalityRank?: number;
  /** S_i = ΔC_i / C(G) */
  criticalityScore?: number;
  deltaConnectivity?: number;
  deltaPct?: number;
  degree?: number;
  isCutVertex?: boolean;
  componentCountAfter?: number;
  rankByArea?: number;
  perimeterKm?: number | null;
  neighbourIds?: string[];
  neighbourDistancesKm?: number[];
}

export interface HabitatMask {
  sceneId: string;
  generatedAt: string;
  modelVersion: string;
  classes: {
    habitatClass: HabitatClass;
    label: string;
    color: string;
    areaHa: number;
    coveragePct: number;
    meanConfidence: number;
  }[];
  patches: HabitatPatch[];
  totals: {
    habitatAreaHa: number;
    patchCount: number;
    meanPatchSizeHa: number;
    largestPatchIndex: number;
    edgeDensity: number;
    meanConfidence: number;
  };
}

/* ------------------------------------------------------------------ */
/* Connectivity                                                        */
/* ------------------------------------------------------------------ */

export interface ConnectivityMetrics {
  sceneId: string;
  /** Headline 0–100 landscape connectivity score. */
  score: number;
  previousScore: number | null;
  /** Probability of Connectivity index. */
  pcIndex: number;
  /** Integral Index of Connectivity. */
  iicIndex: number;
  equivalentConnectedArea: number;
  ecaPctOfHabitat?: number;
  meanPatchIsolationM: number | null;
  linkDensity: number;
  networkDiameterKm: number;
  fragmentationIndex: number;
  resilienceIndex: number;
  confidence: number;
  grade: string | null;
  interpretation: string | null;
  components: { label: string; value: number; weight: number; delta: number | null }[];
  /** Present only on real pipeline runs — the paper's research metrics with provenance labels. */
  research?: {
    iic: number;
    pc: number;
    ecaHa: number;
    nPatches: number;
    nEdges: number;
    nComponents: number;
    meanDegree: number;
    tauKm: number;
    k: number;
    spearmanAreaVsCriticality: number;
    labels: Record<string, string>;
    interfaceScoreLabel: string;
  };
  composition: { name: string; value: number; color: string }[];
  health: { metric: string; score: number; benchmark: number }[];
  trend: {
    month: string;
    connectivity: number;
    habitatArea: number;
    fragmentation: number;
  }[];
}

/* ------------------------------------------------------------------ */
/* Graph                                                               */
/* ------------------------------------------------------------------ */

export interface GraphNode {
  id: string;
  patchId: string;
  label: string;
  habitatClass: HabitatClass;
  position: { x: number; y: number };
  areaHa: number;
  quality: number;
  connectivity: number;
  sensitivity: SensitivityBand;
  bridgeScore: number;
  importance: number;
  degree: number;
  isHub: boolean;
  explanation: string;
  criticalityRank?: number;
  isCutVertex?: boolean;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  /** Ecological flow strength (0–1). */
  strength: number;
  distanceKm: number;
  resistance: number;
  /** True when removing this link disconnects part of the network. */
  critical: boolean;
  speciesFlow: string[];
}

export interface HabitatGraph {
  sceneId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: { id: string; label: string; nodeIds: string[]; color: string }[];
}

/* ------------------------------------------------------------------ */
/* Heatmap                                                             */
/* ------------------------------------------------------------------ */

export interface HeatCell {
  id: string;
  bounds: [LatLng, LatLng];
  /** Connectivity sensitivity 0–1. */
  sensitivity: number;
  band: SensitivityBand;
  habitatProbability: number;
  connectivityContribution: number;
  confidence: number;
  patchId?: string;
  /** Present only for high-signal cells; otherwise composed in the UI. */
  explanation?: string;
}

export interface HeatmapData {
  sceneId: string;
  resolutionM: number;
  generatedAt: string;
  cells: HeatCell[];
  legend: {
    band: SensitivityBand;
    label: string;
    color: string;
    range: [number, number];
    description: string;
  }[];
}

/* ------------------------------------------------------------------ */
/* Simulation                                                          */
/* ------------------------------------------------------------------ */

export type ScenarioId =
  | "cyclone"
  | "urban-expansion"
  | "sea-level-rise"
  | "aquaculture"
  | "road-construction"
  | "encroachment";

export interface Scenario {
  id: ScenarioId;
  name: string;
  icon: string;
  severity: "low" | "moderate" | "severe" | "extreme";
  description: string;
  narrative: string;
  affectedPatchIds: string[];
  removedEdgeIds: string[];
  scoreAfter: number;
  habitatLossHa: number;
  habitatLossPct: number;
  fragmentationDelta: number;
  isolatedPatches: number;
  speciesAtRisk: number;
  carbonLossTonnes: number;
  recoveryYears: number;
  confidence: number;
  timeline: { year: string; baseline: number; scenario: number }[];
  impacts: { label: string; before: number; after: number; unit: string }[];
}

export interface SimulationData {
  sceneId: string;
  baselineScore: number;
  scenarios: Scenario[];
}

/* ------------------------------------------------------------------ */
/* Restoration                                                         */
/* ------------------------------------------------------------------ */

export interface RestorationAction {
  id: string;
  rank: number;
  name: string;
  location: string;
  center: LatLng;
  interventionType: string;
  areaHa: number;
  /** null when no cost data was supplied — ranking is then by raw gain R_i. */
  costLakh: number | null;
  /** Connectivity gain. Prototype: score points. Real runs: % of baseline C(G) (Eq. 11). */
  connectivityGain: number;
  connectivityGainAbs?: number;
  scoreAfter: number | null;
  confidence: number | null;
  timeToImpactMonths: number | null;
  carbonSequestrationTonnes: number | null;
  speciesBenefited: number | null;
  costEffectiveness: number | null;
  rationale: string;
  risks: string | null;
  patchId: string | null;
  polygon?: LatLng[] | null;
  newLinks?: number;
  linkedPatchIds?: string[];
  componentsBefore?: number;
  componentsAfter?: number;
  rankingBasis?: "gain_per_cost" | "raw_gain";
}

export interface RestorationData {
  sceneId: string;
  currency: string | null;
  baselineScore: number;
  rankingBasis?: "gain_per_cost" | "raw_gain";
  budgetBands: {
    minLakh: number;
    maxLakh: number;
    label: string;
    actionIds: string[];
    totalGain: number;
    totalCostLakh: number;
    confidence: number;
    summary: string;
  }[];
  actions: RestorationAction[];
}

/* ------------------------------------------------------------------ */
/* Timeline                                                            */
/* ------------------------------------------------------------------ */

export interface TimelineYear {
  year: number;
  connectivityScore: number;
  habitatAreaHa: number;
  patchCount: number;
  fragmentationIndex: number;
  /** null for the first real year (no earlier run to compare against). */
  lostHa: number | null;
  gainedHa: number | null;
  criticalPatches: number;
  meanConfidence: number;
  event: string;
  eventType: "natural" | "anthropogenic" | "conservation" | "stable";
  /** Present on real timelines (one pipeline run per year). */
  runId?: string;
  resultKind?: ResultKind;
  resultLabel?: string;
  iic?: number;
  ecaHa?: number;
  narrative: string;
  /** Patch ids that are degraded/absent in this year. */
  degradedPatchIds: string[];
  composition: { name: string; value: number; color: string }[];
}

export interface TimelineData {
  sceneId: string;
  years: TimelineYear[];
  /** Set on real timelines returned by the backend. */
  note?: string;
}

/* ------------------------------------------------------------------ */
/* Reports                                                             */
/* ------------------------------------------------------------------ */

export interface ReportSection {
  id: string;
  heading: string;
  body: string[];
  bullets?: string[];
  table?: { columns: string[]; rows: (string | number)[][] };
}

export interface ScientificReport {
  id: string;
  title: string;
  sceneId: string;
  region: string;
  author: string;
  organisation: string;
  generatedAt: string;
  status: "final" | "draft" | "under-review";
  doi: string;
  version: string;
  pages: number;
  keywords: string[];
  abstract: string;
  sections: ReportSection[];
}

export interface AnalysisHistoryEntry {
  id: string;
  sceneId: string;
  name: string;
  region: string;
  state: string;
  runAt: string;
  durationSec: number;
  connectivityScore: number;
  scoreDelta: number;
  habitatAreaHa: number;
  criticalPatches: number;
  status: "completed" | "failed" | "processing" | "archived";
  analyst: string;
  sensor: string;
  reportId?: string;
  tags: string[];
}

/* ------------------------------------------------------------------ */
/* Assistant                                                           */
/* ------------------------------------------------------------------ */

export interface AssistantReply {
  id: string;
  /** Lower-cased keywords used for intent matching. */
  match: string[];
  question: string;
  answer: string;
  citations?: string[];
  metrics?: { label: string; value: string; tone?: "eco" | "sky" | "warn" | "danger" }[];
  followUps?: string[];
}

export interface AssistantData {
  greeting: string;
  suggestions: string[];
  fallback: string;
  replies: AssistantReply[];
}

/* ------------------------------------------------------------------ */
/* Pipeline                                                            */
/* ------------------------------------------------------------------ */

export interface PipelineStage {
  id: string;
  label: string;
  detail: string;
  icon: string;
  durationMs: number;
  logs: string[];
}

/* ------------------------------------------------------------------ */
/* Real pipeline runs (backend)                                        */
/* ------------------------------------------------------------------ */

export type ResultKind = "synthetic" | "development" | "experiment" | "external";

export interface RunProvenance {
  runId: string;
  studyAreaId: string;
  resultKind: ResultKind;
  /** e.g. "PROTOTYPE / SYNTHETIC RESULT …", "DEVELOPMENT-SUBSET RESULT - NOT FINAL", "OUR EXPERIMENTAL RESULT" */
  resultLabel: string;
  dataSource: Record<string, unknown> & { type?: string; model?: string };
  timestamp: string;
  landscapeAreaHa: number;
  parameters: { k: number; tauKm: number; metric: string; threshold?: number | null; mmuHa?: number | null };
}

export interface CriticalityRow {
  rank: number;
  patch_id: string;
  name: string | null;
  area_ha: number;
  area_pct: number;
  degree: number;
  confidence: number;
  c_before: number;
  c_after: number;
  delta_connectivity: number;
  criticality_score: number;
  delta_pct: number;
  component_count_before: number;
  component_count_after: number;
  is_cut_vertex: boolean;
  rank_by_area: number;
  neighbour_ids: string[];
  neighbour_distances_km: number[];
}

export interface PatchExplanation {
  patch_id: string;
  text: string;
  level: SensitivityBand;
  evidence: Record<string, unknown>;
}

/** Exact what-if recomputation (paper Eq. 10) returned by POST /what-if. */
export interface WhatIfResult {
  removed_patch_ids: string[];
  metric: string;
  c_before: number;
  c_after: number;
  delta_connectivity: number;
  loss_fraction: number;
  loss_pct: number;
  habitat_area_before_ha: number;
  habitat_area_removed_ha: number;
  habitat_area_removed_pct: number;
  components_before: number;
  components_after: number;
  edges_before: number;
  edges_after: number;
  severed_edges: { source: string; target: string; distance_km: number; weight: number }[];
  newly_isolated_patch_ids: string[];
  affected_patch_ids: string[];
  interface_score_before: number | null;
  interface_score_after: number | null;
  notes: string[];
}

export interface FrontendBundle {
  provenance: RunProvenance;
  habitatMask: HabitatMask;
  graph: HabitatGraph;
  connectivity: ConnectivityMetrics;
  heatmap: HeatmapData;
  restoration: RestorationData;
  criticality: CriticalityRow[];
  explanations: Record<string, PatchExplanation>;
  whatIfExample: WhatIfResult;
}

export interface RunSummary {
  runId: string;
  studyAreaId: string;
  timestamp: string;
  resultKind: ResultKind;
  resultLabel: string;
  dataSourceType?: string;
  nPatches: number;
  nEdges: number;
  nComponents: number;
  iic: number;
  pc: number;
  ecaHa: number;
  ecaPctOfHabitat?: number;
  habitatAreaHa?: number;
  interfaceScore: number;
  elapsedS?: number | null;
  sceneYear?: number | null;
  model?: string | null;
  threshold?: number | null;
  criticalPatches?: number | null;
}
