"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_SCENE_ID,
  getDataSource,
  getScene,
  registerLiveBundle,
  registerLiveTimeline,
  type DataSource,
} from "@/lib/data";
import { apiHealth, fetchBundle, fetchTimeline, postWhatIf } from "@/lib/api";
import type { SatelliteScene, WhatIfResult } from "@/types";

interface AnalysisState {
  sceneId: string;
  scene: SatelliteScene;
  setSceneId: (id: string) => void;
  /** True once the pipeline has been run at least once this session. */
  hasRun: boolean;
  markRun: () => void;
  /** Patch currently selected across map / graph / explainability panels. */
  selectedPatchId: string | null;
  setSelectedPatchId: (id: string | null) => void;
  /** Patches the user has removed in the what-if simulator. */
  removedPatchIds: string[];
  togglePatchRemoved: (id: string) => void;
  clearRemoved: () => void;
  /** Active scenario on the scenario simulator, if any. */
  activeScenarioId: string | null;
  setActiveScenarioId: (id: string | null) => void;
  /** Year selected on the timeline. */
  year: number;
  setYear: (y: number) => void;
  /* ---------------- real pipeline integration ---------------- */
  /** Whether the FastAPI backend answered /api/health. */
  apiOnline: boolean | null;
  /** live = real pipeline run from the backend; mock = prototype synthetic JSON. */
  dataSource: DataSource;
  /** True while the run bundle for the current scene is loading. */
  bundleLoading: boolean;
  /** Exact what-if result (Eq. 10) for `removedPatchIds`, recomputed by the backend. */
  whatIf: WhatIfResult | null;
  whatIfLoading: boolean;
  whatIfError: string | null;
  /** Re-fetch the latest run for the current scene (e.g. after POST /segment). */
  refreshBundle: () => Promise<void>;
}

const AnalysisContext = createContext<AnalysisState | null>(null);

const STORAGE_KEY = "ecoconnect:scene";

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [sceneId, setSceneIdState] = useState(DEFAULT_SCENE_ID);
  const [hasRun, setHasRun] = useState(false);
  const [selectedPatchId, setSelectedPatchId] = useState<string | null>(null);
  const [removedPatchIds, setRemovedPatchIds] = useState<string[]>([]);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [year, setYear] = useState(2025);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [bundleLoading, setBundleLoading] = useState(false);
  const [bundleVersion, setBundleVersion] = useState(0);
  const [whatIfRaw, setWhatIf] = useState<WhatIfResult | null>(null);
  const [whatIfError, setWhatIfError] = useState<string | null>(null);
  // Only expose a result that matches the current selection (and the live scene).
  const whatIf =
    whatIfRaw &&
    removedPatchIds.length > 0 &&
    whatIfRaw.removed_patch_ids.every((id) => removedPatchIds.includes(id))
      ? whatIfRaw
      : null;
  const whatIfLoading = removedPatchIds.length > 0 && whatIf === null && getDataSource(sceneId).mode === "live";

  // Load the latest real run for the scene. Falls back silently to mock when the API is
  // offline or no run exists; the UI shows which through `dataSource`.
  const loadBundle = useCallback(async (id: string) => {
    setBundleLoading(true);
    try {
      const ok = await apiHealth();
      setApiOnline(ok);
      if (!ok) {
        registerLiveBundle(id, null);
        return;
      }
      const bundle = await fetchBundle(id);
      registerLiveBundle(id, bundle);
      try {
        registerLiveTimeline(id, await fetchTimeline(id));
      } catch {
        registerLiveTimeline(id, null);
      }
    } catch {
      registerLiveBundle(id, null);
      registerLiveTimeline(id, null);
    } finally {
      setBundleVersion((v) => v + 1);
      setBundleLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBundle(sceneId);
  }, [sceneId, loadBundle]);

  const refreshBundle = useCallback(() => loadBundle(sceneId), [loadBundle, sceneId]);

  // Exact what-if: every change of the removed set is recomputed on the actual graph. The
  // effect only launches the request; consumers compare `whatIf.removed_patch_ids` with the
  // current selection, so a stale result is never shown and no synchronous setState is needed.
  useEffect(() => {
    if (getDataSource(sceneId).mode !== "live" || removedPatchIds.length === 0) return;
    let cancelled = false;
    postWhatIf(sceneId, removedPatchIds)
      .then((r) => {
        if (cancelled) return;
        setWhatIf(r);
        setWhatIfError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setWhatIfError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
    // bundleVersion: re-run once the bundle for this scene has arrived
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneId, removedPatchIds, bundleVersion]);

  const setSceneId = useCallback((id: string) => {
    setSceneIdState(id);
    setSelectedPatchId(null);
    setRemovedPatchIds([]);
    setActiveScenarioId(null);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  const markRun = useCallback(() => {
    setHasRun(true);
    try {
      window.sessionStorage.setItem("ecoconnect:hasRun", "1");
    } catch {
      /* ignore */
    }
  }, []);

  const togglePatchRemoved = useCallback((id: string) => {
    setRemovedPatchIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }, []);

  const clearRemoved = useCallback(() => setRemovedPatchIds([]), []);

  const value = useMemo<AnalysisState>(
    () => ({
      sceneId,
      scene: getScene(sceneId),
      setSceneId,
      hasRun,
      markRun,
      selectedPatchId,
      setSelectedPatchId,
      removedPatchIds,
      togglePatchRemoved,
      clearRemoved,
      activeScenarioId,
      setActiveScenarioId,
      year,
      setYear,
      apiOnline,
      dataSource: getDataSource(sceneId),
      bundleLoading,
      whatIf,
      whatIfLoading,
      whatIfError,
      refreshBundle,
    }),
    // bundleVersion forces a refresh of dataSource when a bundle lands
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      sceneId,
      setSceneId,
      hasRun,
      markRun,
      selectedPatchId,
      removedPatchIds,
      togglePatchRemoved,
      clearRemoved,
      activeScenarioId,
      year,
      apiOnline,
      bundleLoading,
      bundleVersion,
      whatIf,
      whatIfLoading,
      whatIfError,
      refreshBundle,
    ],
  );

  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>;
}

export function useAnalysis() {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error("useAnalysis must be used within <AnalysisProvider>");
  return ctx;
}
