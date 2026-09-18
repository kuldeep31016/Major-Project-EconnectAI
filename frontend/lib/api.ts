/**
 * Client for the EcoConnectAI FastAPI backend (backend/main.py).
 *
 * The base URL comes from NEXT_PUBLIC_API_URL (default http://localhost:8000). Every call
 * fails soft: callers decide whether to fall back to the prototype's mock data.
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

async function getJson<T>(path: string, init?: RequestInit, timeoutMs = 8000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const token = getToken();
    const headers = new Headers(init?.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(`${API_URL}${path}`, { ...init, headers, signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${path}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

export async function apiHealth(): Promise<boolean> {
  try {
    const r = await getJson<{ status: string }>("/api/health", undefined, 2500);
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
export const fetchTimeline = (studyArea: string) =>
  getJson<TimelineData>(`/api/runs/${encodeURIComponent(studyArea)}/timeline`);

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
export const postSegment = (studyArea: string) =>
  getJson<RunSummary & { scene?: string; checkpoint?: string; thresholdUsed?: number | null }>(
    "/api/segment",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ study_area: studyArea }) },
    600000,
  );

export interface ModelInfo {
  experimentId: string;
  mode?: string;
  model?: string;
  encoder?: string;
  best_epoch?: number;
  result_label?: string;
  val?: Record<string, number> | null;
  test?: Record<string, number> | null;
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
  getJson<{ token: string; user: SessionUser }>("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
export const fetchMe = () => getJson<SessionUser>("/api/auth/me");
export const fetchUsers = () => getJson<SessionUser[]>("/api/users");

export interface AlertItem { id: number; study_area_id: string; run_id: string | null; type: string; severity: "low" | "medium" | "high" | "critical"; title: string; reason: string; lat: number | null; lon: number | null; object_type: string | null; object_id: string | null; evidence: Record<string, unknown> | null; status: string; created_at: string }
export const fetchAlerts = (studyArea?: string, status?: string) => getJson<AlertItem[]>(`/api/alerts?${studyArea ? `study_area=${encodeURIComponent(studyArea)}&` : ""}${status ? `status=${status}` : ""}`);
export const generateAlerts = (studyArea: string) => getJson<{ generated: number; run_id: string }>(`/api/alerts/generate/${encodeURIComponent(studyArea)}`, { method: "POST" });
export const updateAlert = (id: number, status: string, reason?: string) => getJson<AlertItem>(`/api/alerts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, reason }) });

export interface DetectionItem { id: number; study_area_id: string; run_id: string; object_type: string; object_id: string; status: string; lat: number | null; lon: number | null; summary: string | null; updated_at: string }
export const fetchDetections = (studyArea?: string) => getJson<DetectionItem[]>(`/api/detections${studyArea ? `?study_area=${encodeURIComponent(studyArea)}` : ""}`);
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

export interface ProjectItem { id: number; name: string; study_area_id: string; objectives: string | null; status: string; owner_id: number | null; run_id: string | null; priority_patches: string[]; candidates: string[]; responsible: number[]; created_at: string; updated_at: string; taskCount?: number; verifiedTasks?: number; reportCount?: number }
export const fetchProjects = (studyArea?: string) => getJson<ProjectItem[]>(`/api/projects${studyArea ? `?study_area=${encodeURIComponent(studyArea)}` : ""}`);
export const createProject = (body: { name: string; study_area_id: string; objectives?: string; run_id?: string; priority_patches?: string[]; candidates?: string[] }) =>
  getJson<ProjectItem>("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
export const updateProject = (id: number, body: Record<string, unknown>) => getJson<ProjectItem>(`/api/projects/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export interface AuditItem { id: number; username: string; role: string; action: string; object_type: string | null; object_id: string | null; old_state: unknown; new_state: unknown; reason: string | null; ts: string }
export const fetchAudit = (limit = 200) => getJson<AuditItem[]>(`/api/audit?limit=${limit}`);
export const fetchRegistry = (studyArea: string) => getJson<Record<string, unknown>>(`/api/registry/${encodeURIComponent(studyArea)}`);
export const fetchModelCards = () => getJson<{ foundationPaper: Record<string, unknown>; prototype: Record<string, unknown>; ours: Record<string, unknown>[] }>("/api/model-cards");
