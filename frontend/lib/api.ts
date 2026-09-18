/**
 * Client for the EcoConnectAI FastAPI backend (backend/main.py).
 *
 * The base URL comes from NEXT_PUBLIC_API_URL (default http://localhost:8000). Every call
 * fails soft: callers decide whether to fall back to the prototype's mock data.
 */
import type { FrontendBundle, RunSummary, WhatIfResult, RestorationAction, TimelineData } from "@/types";

export const API_URL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL) || "http://localhost:8000";

async function getJson<T>(path: string, init?: RequestInit, timeoutMs = 8000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_URL}${path}`, { ...init, signal: ctrl.signal, cache: "no-store" });
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
