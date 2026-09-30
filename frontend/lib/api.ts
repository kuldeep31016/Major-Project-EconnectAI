/**
 * Client for the EcoConnectAI FastAPI backend (backend/main.py).
 *
 * The base URL comes from NEXT_PUBLIC_API_URL (default http://localhost:8000). Every call
 * fails soft: callers decide how to present the absence of data (never invented values).
 */
import type { FrontendBundle, RunSummary, WhatIfResult, RestorationAction, TimelineData, ScientificReport } from "@/types";

export const API_URL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) || "http://localhost:8000";

const TOKEN_KEY = "ecoconnect:token";
export function getToken(): string | null {
  try {
    return typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_KEY) : null;
  } catch {
    return null;
  }
}
export function setToken(t: string | null) {
  try {
    if (t) window.localStorage.setItem(TOKEN_KEY, t);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

const REFRESH_KEY = "ecoconnect:refresh";
export function setRefreshToken(t: string | null) {
  try {
    if (t) window.localStorage.setItem(REFRESH_KEY, t);
    else window.localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* ignore */
  }
}
function getRefreshToken(): string | null {
  try { return typeof window !== "undefined" ? window.localStorage.getItem(REFRESH_KEY) : null; } catch { return null; }
}

// One refresh at a time: concurrent 401s share the same rotation (a rotated token must never be sent twice).
let refreshing: Promise<boolean> | null = null;
async function tryRefresh(): Promise<boolean> {
  const rt = getRefreshToken();
  if (!rt) return false;
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: rt }) });
      if (!res.ok) { setToken(null); setRefreshToken(null); return false; }
      const j = (await res.json()) as { token: string; refresh_token: string };
      setToken(j.token); setRefreshToken(j.refresh_token);
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => { refreshing = null; }, 0);
    }
  })();
  return refreshing;
}

async function getJson<T>(path: string, init?: RequestInit, timeoutMs = 8000, retried = false): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const token = getToken();
    const headers = new Headers(init?.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(`${API_URL}${path}`, { ...init, headers, signal: ctrl.signal, cache: "no-store" });
    // expired access token: rotate the refresh token once and retry the request
    if (res.status === 401 && token && !retried && !/^\/api\/auth\/(login|refresh|logout)/.test(path) && (await tryRefresh())) {
      return getJson<T>(path, init, timeoutMs, true);
    }
    if (!res.ok) {
      // surface the backend's own explanation (FastAPI `detail`) so the UI never shows a bare status code
      let detail = "";
      try { const j = await res.json(); detail = typeof j?.detail === "string" ? j.detail : JSON.stringify(j?.detail ?? j); } catch { /* no body */ }
      throw new Error(detail ? `${res.status}: ${detail}` : `${res.status} ${res.statusText} for ${path}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

export async function apiHealth(timeoutMs = 2500): Promise<boolean> {
  try {
    const r = await getJson<{ status: string }>("/api/health", undefined, timeoutMs);
    return r.status === "ok";
  } catch {
    return false;
  }
}

export interface StudyAreaInfo {
  id: string;
  name: string;
  short_name: string;
  state: string;
  protection: string;
  center: [number, number];
  bbox: [number, number, number, number];
  footprint_km2: number;
  primary_habitat: string;
  latestRun: RunSummary | null;
}

export const fetchStudyAreas = () => getJson<StudyAreaInfo[]>("/api/study-areas");
export const fetchRuns = (studyArea?: string) =>
  getJson<RunSummary[]>(`/api/runs${studyArea ? `?study_area=${encodeURIComponent(studyArea)}` : ""}`);
export const fetchBundle = (studyArea: string, runId = "latest") =>
  getJson<FrontendBundle>(`/api/runs/${encodeURIComponent(studyArea)}/${encodeURIComponent(runId)}/bundle`, undefined, 20000);

/** Real timeline: one entry per scene year with a pipeline run; empty when none exist. */
export const fetchTimeline = (studyArea: string, runId = "latest") =>
  getJson<TimelineData>(`/api/runs/${encodeURIComponent(studyArea)}/timeline?run_id=${encodeURIComponent(runId)}`);

/** Report composed only from a run's computed artefacts (backend ecoconnect/pipeline/report.py). */
export const fetchReport = (studyArea: string, runId = "latest") =>
  getJson<ScientificReport>(`/api/runs/${encodeURIComponent(studyArea)}/${encodeURIComponent(runId)}/report`);

export const postWhatIf = (studyArea: string, patchIds: string[], runId = "latest") =>
  getJson<WhatIfResult>(`/api/runs/${encodeURIComponent(studyArea)}/${encodeURIComponent(runId)}/what-if`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patch_ids: patchIds }),
  });

export interface RestorationResponse {
  baseline: number;
  metric: string;
  ranking_basis: "gain_per_cost" | "raw_gain";
  candidates: Array<{
    rank: number;
    candidate_id: string;
    name: string | null;
    area_ha: number;
    centroid: [number, number];
    connectivity_gain: number;
    gain_pct: number;
    new_links: number;
    linked_patch_ids: string[];
    cost: number | null;
    cost_unit: string | null;
    gain_per_cost: number | null;
    ranking_basis: string;
  }>;
}

export const postRestoration = (
  studyArea: string,
  body: { costs?: Record<string, number>; cost_unit?: string } = {},
  runId = "latest",
) =>
  getJson<RestorationResponse>(`/api/runs/${encodeURIComponent(studyArea)}/${encodeURIComponent(runId)}/restoration`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

/** Launch a real segmentation + graph run for a study area (backend auto-picks newest scene, checkpoint, threshold). */
export interface SegmentRequest { study_area: string; scene_tif?: string; checkpoint?: string; threshold?: number | null; result_kind?: "development" }
type SegmentResult = RunSummary & { scene?: string; checkpoint?: string; thresholdUsed?: number | null };

/** Background job record (backend/jobs.py): QUEUED → RUNNING → COMPLETED | FAILED | CANCELLED. */
export interface JobRecord<R = unknown> {
  id: string; type: string; status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  progress: number; stage: string | null; result: R | null; error: string | null; log: string | null;
  created_at: string; started_at: string | null; finished_at: string | null;
}
export const fetchJob = <R = unknown>(id: string) => getJson<JobRecord<R>>(`/api/jobs/${encodeURIComponent(id)}`);

/** Poll a job until it finishes; resolves with its result, rejects with its error. */
export async function waitForJob<R>(id: string, onProgress?: (j: JobRecord<R>) => void, intervalMs = 2000): Promise<R> {
  for (;;) {
    const j = await fetchJob<R>(id);
    onProgress?.(j);
    if (j.status === "COMPLETED") return j.result as R;
    if (j.status === "FAILED" || j.status === "CANCELLED") throw new Error(j.error || `job ${j.status.toLowerCase()}`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

/** Queue segmentation + graph analysis (POST /api/segment → 202 job) and wait for the new run. */
export async function postSegment(body: SegmentRequest, onProgress?: (j: JobRecord<SegmentResult>) => void): Promise<SegmentResult> {
  const job = await getJson<JobRecord<SegmentResult>>("/api/segment", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  return waitForJob<SegmentResult>(job.id, onProgress);
}

/** Downloaded scenes (data/scenes/<area>/*.json sidecars written by the acquisition module). */
export interface SceneRecord {
  studyAreaId: string;
  scene_id: string;
  bbox: [number, number, number, number];
  date_range: [string, string];
  bands: string[];
  crs: string;
  width: number;
  height: number;
  sources?: Record<string, { scenes?: { id: string; datetime: string; cloud_cover?: number; orbit?: string }[]; valid_fraction?: number; composite?: string }>;
}
export const fetchScenes = () => getJson<SceneRecord[]>("/api/scenes");

export interface ModelInfo {
  experimentId: string;
  mode?: string;
  model?: string;
  encoder?: string;
  best_epoch?: number;
  result_label?: string;
  val?: Record<string, number> | null;
  test?: Record<string, number> | null;
  bands?: number[] | null;
  inChannels?: number | null;
  calibratedThreshold?: number | null;
  checkpoint?: string | null;
  trainedAt?: string | null;
  trainingAreas?: string | null;
}
export const fetchModels = () => getJson<ModelInfo[]>("/api/models");

/** Merge a re-ranked restoration response into the UI action list. */
export function applyRestorationRanking(actions: RestorationAction[], r: RestorationResponse): RestorationAction[] {
  const byId = new Map(r.candidates.map((c) => [c.candidate_id, c]));
  return actions
    .map((a) => {
      const c = byId.get(a.id);
      return c
        ? { ...a, rank: c.rank, costLakh: c.cost, costEffectiveness: c.gain_per_cost, connectivityGain: c.gain_pct, rankingBasis: r.ranking_basis }
        : a;
    })
    .sort((a, b) => a.rank - b.rank);
}

/* ------------------------------------------------------------------ research tools */

export interface ReanalyseResult {
  parameters: { tau_km: number; k: number; metric: string };
  summary: { n_patches: number; n_edges: number; n_components: number; iic: number; pc: number; eca_ha: number; eca_pct_of_habitat: number; mean_degree: number };
  interface_score: number;
  edges: { source: string; target: string; distance_km: number; weight: number }[];
  criticality: { patch_id: string; rank: number; criticality_score: number; delta_pct: number; degree: number; is_cut_vertex: boolean; component_count_after: number; rank_by_area: number; level: "low" | "medium" | "high" | "critical" }[];
}
/** Exact re-analysis of an existing run's patches with another tau / k / metric (no re-segmentation). */
export const postReanalyse = (studyArea: string, runId: string, body: { tau_km?: number; k?: number; metric?: string }) =>
  getJson<ReanalyseResult>(`/api/runs/${encodeURIComponent(studyArea)}/${encodeURIComponent(runId)}/reanalyse`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });

export const probabilityPngUrl = (studyArea: string, runId: string) =>
  `${API_URL}/api/runs/${encodeURIComponent(studyArea)}/${encodeURIComponent(runId)}/probability.png`;

/** Fetch the overlay bounds (min_lat,min_lon,max_lat,max_lon) via a HEAD-like GET of the PNG headers. */
export async function fetchProbabilityBounds(studyArea: string, runId: string): Promise<[[number, number], [number, number]] | null> {
  try {
    const res = await fetch(probabilityPngUrl(studyArea, runId), { method: "GET", cache: "force-cache" });
    const b = res.headers.get("X-Bounds");
    if (!res.ok || !b) return null;
    const [minLat, minLon, maxLat, maxLon] = b.split(",").map(Number);
    return [[minLat, minLon], [maxLat, maxLon]];
  } catch {
    return null;
  }
}

/** Real sensor quicklook of the downloaded scene (Sentinel-1 VV dB, Sentinel-2 NDVI or true colour). */
export type QuicklookKind = "s1" | "ndvi" | "rgb";
export const sceneQuicklookUrl = (studyArea: string, kind: QuicklookKind, year?: number | null) =>
  `${API_URL}/api/scenes/${encodeURIComponent(studyArea)}/quicklook.png?kind=${kind}${year ? `&year=${year}` : ""}`;
export interface SceneQuicklook { url: string; bounds: [[number, number], [number, number]]; /** scene file actually rendered (may be another year when the requested one lacks the sensor) */ scene: string }
export async function fetchSceneQuicklook(studyArea: string, kind: QuicklookKind, year?: number | null): Promise<SceneQuicklook | null> {
  try {
    const url = sceneQuicklookUrl(studyArea, kind, year);
    const res = await fetch(url, { method: "GET", cache: "force-cache" });
    const b = res.headers.get("X-Bounds");
    if (!res.ok || !b) return null;
    const [minLat, minLon, maxLat, maxLon] = b.split(",").map(Number);
    return { url, bounds: [[minLat, minLon], [maxLat, maxLon]], scene: res.headers.get("X-Scene") ?? "" };
  } catch {
    return null;
  }
}

export interface ModelDetail {
  experimentId: string;
  metrics: { mode?: string; result_label?: string; model?: string; encoder?: string; best_epoch?: number; val?: Record<string, number>; test?: Record<string, number> | null; test_threshold?: number };
  experiment?: Record<string, unknown> & { dataset?: { n_train?: number; n_val?: number; n_test?: number; bands?: number[] | null; name?: string }; training_time_s?: number; hardware?: { device?: string }; parameters?: number; epochs_run?: number; learning_rate?: number; batch_size?: number; seed?: number };
  calibration?: { selected_threshold: number; criterion: string; scope: string; rows: { threshold: number; iou: number; f1: number; precision: number; recall: number }[] };
  history?: Record<string, string>[];
  assets: string[];
}
export const fetchModelDetail = (id: string) => getJson<ModelDetail>(`/api/models/${encodeURIComponent(id)}`);
export const modelAssetUrl = (id: string, name: string) => `${API_URL}/api/models/${encodeURIComponent(id)}/asset/${name}`;

/* ------------------------------------------------------------------ platform: auth + workflow */

export type Role = "state_admin" | "senior_officer" | "range_officer" | "field_officer" | "gis_officer" | "analyst";
export interface SessionUser { id: number; username: string; fullName: string; role: Role; roleLabel: string; capabilities: string[]; orgId: number | null }

export const login = (username: string, password: string) =>
  getJson<{ token: string; refresh_token: string; expires_in: number; user: SessionUser }>("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
export const fetchMe = () => getJson<SessionUser>("/api/auth/me");
export const fetchUsers = () => getJson<SessionUser[]>("/api/users");

export interface AlertItem { id: number; study_area_id: string; run_id: string | null; type: string; severity: "low" | "medium" | "high" | "critical"; title: string; reason: string; lat: number | null; lon: number | null; object_type: string | null; object_id: string | null; evidence: Record<string, unknown> | null; status: string; created_at: string }
export const fetchAlerts = (studyArea?: string, status?: string) => getJson<AlertItem[]>(`/api/alerts?${studyArea ? `study_area=${encodeURIComponent(studyArea)}&` : ""}${status ? `status=${status}` : ""}`);
export const generateAlerts = (studyArea: string) => getJson<{ generated: number; run_id: string }>(`/api/alerts/generate/${encodeURIComponent(studyArea)}`, { method: "POST" });
export const updateAlert = (id: number, status: string, reason?: string) => getJson<AlertItem>(`/api/alerts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, reason }) });

export interface DetectionItem { id: number; study_area_id: string; run_id: string; object_type: string; object_id: string; status: string; lat: number | null; lon: number | null; summary: string | null; updated_at: string }
export const fetchDetections = (studyArea?: string) => getJson<DetectionItem[]>(`/api/detections${studyArea ? `?study_area=${encodeURIComponent(studyArea)}` : ""}`);
export const registerDetection = (body: { study_area_id: string; run_id: string; object_type: string; object_id: string; lat?: number | null; lon?: number | null; summary?: string | null }) =>
  getJson<DetectionItem>("/api/detections", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
export const setDetectionStatus = (id: number, status: string, reason?: string) => getJson<DetectionItem>(`/api/detections/${id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, reason }) });

export interface FieldTaskItem { id: number; study_area_id: string; project_id: number | null; alert_id: number | null; detection_id: number | null; title: string; reason: string; lat: number; lon: number; object_type: string | null; object_id: string | null; run_id: string | null; evidence_required: string; assignee_id: number | null; assigneeName?: string | null; created_by: number | null; createdByName?: string | null; status: string; due_date: string | null; created_at: string; updated_at: string; evidenceCount?: number }
export const fetchTasks = (studyArea?: string, mine = false) => getJson<FieldTaskItem[]>(`/api/field-tasks?${studyArea ? `study_area=${encodeURIComponent(studyArea)}&` : ""}${mine ? "mine=true" : ""}`);
export const createTask = (body: Partial<FieldTaskItem> & { study_area_id: string; title: string; reason: string; lat: number; lon: number }) =>
  getJson<FieldTaskItem>("/api/field-tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
export const setTaskStatus = (id: number, status: string, reason?: string) => getJson<FieldTaskItem>(`/api/field-tasks/${id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, reason }) });

export interface EvidenceItem { id: number; task_id: number; user_id: number; lat: number; lon: number; observed_at: string; observation: string; notes: string | null; photo_path: string | null; verification: string; created_at: string }
export const fetchEvidence = (taskId: number) => getJson<EvidenceItem[]>(`/api/field-tasks/${taskId}/evidence`);
export const submitEvidence = (taskId: number, form: FormData) => getJson<EvidenceItem>(`/api/field-tasks/${taskId}/evidence`, { method: "POST", body: form }, 60000);
export const verifyEvidence = (id: number, verification: "ACCEPTED" | "REJECTED", reason?: string) => getJson<EvidenceItem>(`/api/evidence/${id}/verify`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ verification, reason }) });
export const evidencePhotoUrl = (name: string) => `${API_URL}/api/evidence/photo/${encodeURIComponent(name)}`;

/** Photos require the Bearer token, which an <img src> cannot send: fetch as a blob and return an object URL. */
export async function fetchEvidencePhoto(name: string): Promise<string> {
  const token = getToken();
  const r = await fetch(evidencePhotoUrl(name), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!r.ok) throw new Error(`photo ${r.status}`);
  return URL.createObjectURL(await r.blob());
}

export interface ProjectItem { id: number; name: string; study_area_id: string; objectives: string | null; status: string; owner_id: number | null; run_id: string | null; priority_patches: string[]; candidates: string[]; responsible: number[]; created_at: string; updated_at: string; taskCount?: number; verifiedTasks?: number; reportCount?: number }
export const fetchProjects = (studyArea?: string) => getJson<ProjectItem[]>(`/api/projects${studyArea ? `?study_area=${encodeURIComponent(studyArea)}` : ""}`);
export const createProject = (body: { name: string; study_area_id: string; objectives?: string; run_id?: string; priority_patches?: string[]; candidates?: string[] }) =>
  getJson<ProjectItem>("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
export const updateProject = (id: number, body: Record<string, unknown>) => getJson<ProjectItem>(`/api/projects/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export interface AuditItem { id: number; username: string; role: string; action: string; object_type: string | null; object_id: string | null; old_state: unknown; new_state: unknown; reason: string | null; ts: string }
export const fetchAudit = (limit = 200) => getJson<AuditItem[]>(`/api/audit?limit=${limit}`);
export const fetchRegistry = (studyArea: string) => getJson<Record<string, unknown>>(`/api/registry/${encodeURIComponent(studyArea)}`);
export const fetchModelCards = () => getJson<{ foundationPaper: Record<string, unknown>; prototype: Record<string, unknown>; ours: Record<string, unknown>[] }>("/api/model-cards");

/* ------------------------------------------------------------------ scenario lab + restoration planner */

export interface ScenarioSummary { n_patches: number; n_edges: number; n_components: number; habitat_area_ha: number; iic: number; pc: number; eca_ha: number; eca_pct_of_habitat: number; metric: string; c: number }
export interface ScenarioResult {
  type: string; label: string; parameters: Record<string, unknown>; baseline: ScenarioSummary; explanation: string;
  scenario?: ScenarioSummary; difference?: Record<string, number>;
  affected_patch_ids?: string[]; removed_patch_ids?: string[]; newly_isolated_patch_ids?: string[];
  severed_edges?: { source: string; target: string }[]; edges_after?: { source: string; target: string; distance_km: number; weight: number }[];
  variants?: Record<string, unknown>[]; lost_patch_ids?: string[]; gained_patch_ids?: string[];
  matched?: { patch_a: string; patch_b: string; area_a: number; area_b: number; S_a: number; S_b: number; rank_a: number; rank_b: number }[];
  // sensitivity
  reference?: { tau_km: number; k: number }; verdict?: string; min_spearman?: number | null; robust_top?: string[];
  stability?: { patch_id: string; reference_rank: number; min_rank: number; max_rank: number; in_top_n: number; of: number }[];
}
export interface SensitivityVariant { tau_km: number; k: number; n_edges: number; n_components: number; density: number; c: number; top: string[]; spearman: number; kendall: number; top_overlap: number }
export const postScenario = (studyArea: string, runId: string, body: Record<string, unknown>) =>
  getJson<ScenarioResult>(`/api/runs/${encodeURIComponent(studyArea)}/${encodeURIComponent(runId)}/scenario`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, 120000);
export const saveScenario = (body: { study_area_id: string; run_id: string; type: string; params: unknown; result: unknown }) =>
  getJson<{ id: number }>("/api/scenarios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export interface FeasibilityCandidate { candidate_id: string; rank: number; area_ha: number; centroid: [number, number]; gain_pct: number; new_links: number; linked_patch_ids: string[]; nearest_habitat_km: number | null; ndwi_mean: number | null; overlaps_existing: boolean; overlap_fraction: number; verdict: "recommended" | "conditional" | "not_recommended"; why: string[]; why_not: string[]; not_assessed: string[]; geometry: unknown }
export interface Feasibility { metric: string; baseline_c: number; ranking_basis: string; candidate_method: string; rules: Record<string, unknown>; candidates: FeasibilityCandidate[] }
export const fetchFeasibility = (studyArea: string, runId: string) => getJson<Feasibility>(`/api/runs/${encodeURIComponent(studyArea)}/${encodeURIComponent(runId)}/restoration/feasibility`, undefined, 60000);

/* ------------------------------------------------------------------ evidence, assistant, official reports */
export const fetchEvidenceChain = (studyArea: string, runId: string, objectType: string, objectId: string) =>
  getJson<Record<string, unknown>>(`/api/runs/${encodeURIComponent(studyArea)}/${encodeURIComponent(runId)}/evidence/${objectType}/${encodeURIComponent(objectId)}`);
export interface AssistantAnswer {
  intent?: string; answer: string; sources?: Record<string, unknown>[]; label: string | null; links?: string[]; objects?: string[];
  // grounded (LLM) mode — backend/assistant_llm.py
  mode?: "llm" | "template"; model?: string; insufficient_evidence?: boolean;
  citations?: { id: string; kind: string; source: string }[];
  proposed_scenario?: Record<string, unknown> | null; scenario_rejected?: string | null; llm_error?: string;
}
export const askAssistant = (question: string, studyArea: string, runId = "latest") =>
  getJson<AssistantAnswer>("/api/assistant/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, study_area: studyArea, run_id: runId }) });
export const generateOfficialReport = (studyArea: string, runId = "latest", projectId?: number) =>
  getJson<ScientificReport>("/api/reports/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ study_area: studyArea, run_id: runId, project_id: projectId }) }, 60000);
export const fetchOfficialReports = (studyArea?: string) => getJson<ScientificReport[]>(`/api/reports${studyArea ? `?study_area=${encodeURIComponent(studyArea)}` : ""}`);

/* ------------------------------------------------------------------ provenance, reproducibility, model registry */
export interface LineageStep {
  step: string; title: string; status: "recorded" | "partial" | "not_recorded" | "not_applicable";
  detail: Record<string, unknown>; artifacts: { kind: string; key: string; sha256: string | null }[]; caveat: string | null;
}
export interface Lineage { run_id: string; study_area_id: string; result_label: string; steps: LineageStep[]; limitations: string[] }
export interface ReproduceCheck { name: string; stored: unknown; recomputed: unknown; match: boolean; mismatches?: string[] }
export interface ReproduceResult { run_id: string; reproduced: boolean; level: string; checks: ReproduceCheck[]; note: string | null }

export async function reproduceRun(studyArea: string, runId: string, onProgress?: (j: JobRecord<ReproduceResult>) => void) {
  const job = await getJson<JobRecord<ReproduceResult>>(
    `/api/runs/${encodeURIComponent(studyArea)}/${encodeURIComponent(runId)}/reproduce`, { method: "POST" });
  return waitForJob<ReproduceResult>(job.id, onProgress, 1000);
}

export type ModelStatus = "DEVELOPMENT" | "EXPERIMENTAL" | "CANDIDATE" | "VALIDATED";
export interface RegistryModel {
  id: string; display_name: string | null; version: string | null; status: ModelStatus; encoder: string | null;
  mode: string | null; split: (number | null)[]; test: Record<string, number | null>; validation: Record<string, unknown> | null;
}
export const fetchRegistryModels = () => getJson<RegistryModel[]>("/api/registry-models");
export const setModelStatus = (id: string, status: ModelStatus, reason: string) =>
  getJson<RegistryModel>(`/api/models/${encodeURIComponent(id)}/status`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, reason }),
  });
export interface ExperimentRow {
  id: string; display_name: string | null; status: ModelStatus; mode: string | null; config: Record<string, unknown>;
  calibrated_threshold: number | null; val: Record<string, number | null>; test: Record<string, number | null>;
}
export const compareExperiments = (ids: string[]) =>
  getJson<{ experiments: ExperimentRow[]; note: string }>(`/api/experiments/compare?ids=${ids.map(encodeURIComponent).join(",")}`);

/* ------------------------------------------------------------------ Phase 5: field checklist, restoration workflow, HITL */
export const CHECKLIST_FIELDS: Record<string, string[]> = {
  habitat_present: ["yes", "no", "unsure"], mangrove_present: ["yes", "no", "unsure"],
  condition: ["good", "fair", "poor", "not_applicable"], water_condition: ["tidal", "permanently_flooded", "dry", "unknown"],
  human_disturbance: ["none", "low", "high"],
};
export type FeasibilityEntry = { value: string; source: string; by: string; at: string } | null;
export interface RestorationReview {
  id: number; study_area_id: string; run_id: string | null; candidate_id: string;
  stage: "GIS_REVIEW" | "FIELD_VERIFICATION" | "FEASIBILITY" | "DECIDED";
  model_recommendation: { rank: number; gain_pct: number; area_ha: number; new_links: number; linked_patch_ids: string[]; label: string };
  gis_review: { outcome: string; notes: string; by: string; at: string } | null;
  field_task: { id: number; status: string } | null;
  feasibility: Record<string, FeasibilityEntry>; not_assessed: string[];
  decision: "APPROVED" | "REJECTED" | "DEFERRED" | null; decision_reason: string | null;
}
const jsonInit = (method: string, body: unknown) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
export const fetchReviews = (studyArea: string) => getJson<RestorationReview[]>(`/api/restoration/reviews?study_area=${encodeURIComponent(studyArea)}`);
export const createReview = (studyArea: string, runId: string, candidateId: string) =>
  getJson<RestorationReview>("/api/restoration/reviews", jsonInit("POST", { study_area: studyArea, run_id: runId, candidate_id: candidateId }));
export const gisReview = (id: number, outcome: "PROCEED" | "HOLD", notes: string) => getJson<RestorationReview>(`/api/restoration/reviews/${id}/gis`, jsonInit("PATCH", { outcome, notes }));
export const reviewFieldTask = (id: number) => getJson<RestorationReview>(`/api/restoration/reviews/${id}/field-task`, jsonInit("POST", {}));
export const setFeasibility = (id: number, factor: string, value: string | null, source: string | null) =>
  getJson<RestorationReview>(`/api/restoration/reviews/${id}/feasibility`, jsonInit("PATCH", { factor, value, source }));
export const decideReview = (id: number, decision: "APPROVED" | "REJECTED" | "DEFERRED", reason: string) =>
  getJson<RestorationReview>(`/api/restoration/reviews/${id}/decision`, jsonInit("PATCH", { decision, reason }));

export interface Disagreement {
  id: number; evidence_id: number; study_area_id: string; run_id: string | null; model_id: string | null; object_type: string; object_id: string;
  lat: number; lon: number; observed_at: string; kind: "false_positive" | "false_negative"; status: "OPEN" | "INCLUDED" | "EXCLUDED";
  model_prediction: { class: string; mean_probability: number | null }; field_observation: { checklist: Record<string, string> | null; notes: string | null };
  review_note: string | null;
}
export const fetchDisagreements = (studyArea: string) => getJson<Disagreement[]>(`/api/hitl/disagreements?study_area=${encodeURIComponent(studyArea)}`);
export const reviewDisagreement = (id: number, status: "INCLUDED" | "EXCLUDED", note: string) =>
  getJson<Disagreement>(`/api/hitl/disagreements/${id}`, jsonInit("PATCH", { status, note }));
export const exportHitl = () => getJson<{ type: string; features: unknown[]; note: string }>("/api/hitl/export");

/* ------------------------------------------------------------------ guided demo (/demo): raw run artefacts */
export interface GraphNode { id: string; area_ha: number; centroid: [number, number]; confidence: number; geometry: { type: string; coordinates: number[][][] } | null; degree?: number }
export interface GraphEdge { source: string; target: string; distance_km: number; weight: number }
export interface RunGraph { parameters: Record<string, unknown>; nodes: GraphNode[]; edges: GraphEdge[]; n_components: number }
export interface CriticalityRow { patch_id: string; rank: number; rank_by_area: number; area_ha: number; area_pct: number; degree: number; criticality_score: number; delta_pct: number; is_cut_vertex: boolean; component_count_before: number; component_count_after: number; neighbour_ids: string[] }
export interface RestorationCandidateRow { candidate_id: string; rank: number; area_ha: number; centroid: [number, number]; gain_pct: number; new_links: number; linked_patch_ids: string[] }
const runPath = (sa: string, run: string, what: string) => `/api/runs/${encodeURIComponent(sa)}/${encodeURIComponent(run)}/${what}`;
export const fetchRunGraph = (sa: string, run = "latest") => getJson<RunGraph>(runPath(sa, run, "graph"), undefined, 20000);
export const fetchRunCriticality = (sa: string, run = "latest") => getJson<CriticalityRow[]>(runPath(sa, run, "criticality"), undefined, 20000);
export const fetchRunRestoration = (sa: string, run = "latest") => getJson<{ candidates: RestorationCandidateRow[]; ranking_basis: string }>(runPath(sa, run, "restoration"), undefined, 20000);
export const fetchRunManifest = (sa: string, run = "latest") => getJson<{ run_id: string; result_label: string; study_area: { name?: string; state?: string }; data_source: { scene_year?: number; threshold?: number; model?: string }; config: { graph: { k_neighbors: number; tau_km: number } } }>(runPath(sa, run, "manifest"));
export const fetchRunMetrics = (sa: string, run = "latest") => getJson<{ research_metrics: { n_patches: number; n_edges: number; n_components: number; habitat_area_ha: number; iic: number; eca_pct_of_habitat: number } }>(runPath(sa, run, "metrics"));

/** Server-rendered PDF of a stored official report (auth required; the file is hashed + audited server-side). */
export async function downloadReportPdf(reportId: number): Promise<void> {
  const token = getToken();
  const r = await fetch(`${API_URL}/api/reports/${reportId}/pdf`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!r.ok) throw new Error(r.status === 401 ? "Sign in to download official reports" : `PDF failed (${r.status})`);
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement("a");
  a.href = url; a.download = `ecoconnect-report-${reportId}.pdf`; a.click();
  URL.revokeObjectURL(url);
}

/** Revoke the refresh-token family on the server (best effort), then clear local tokens. */
export async function logout(): Promise<void> {
  const rt = getRefreshToken();
  const token = getToken();
  if (rt) {
    try {
      await fetch(`${API_URL}/api/auth/logout`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ refresh_token: rt }) });
    } catch { /* offline: tokens are still cleared locally */ }
  }
  setToken(null); setRefreshToken(null);
}

export interface SystemInfo {
  version: string; database: string; schema: { current: string; head: string; ok: boolean }; storage: string; inline_worker: boolean; assistant: string;
  jobs: { by_status: Record<string, number>; failed_24h: { id: string; type: string; error: string | null; at: string | null }[] };
  counts: Record<string, number>; config: Record<string, unknown>;
  requests: { uptime_s: number; total_requests: number; total_5xx: number; routes: { route: string; requests: number; errors_5xx: number; p50_ms: number; p95_ms: number }[]; recent_errors: { route: string; status: number; request_id: string; at: string }[] };
}
export const fetchSystem = () => getJson<SystemInfo>("/api/admin/system");
