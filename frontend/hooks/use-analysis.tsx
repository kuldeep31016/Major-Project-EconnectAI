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
import { DEFAULT_SCENE_ID, getScene } from "@/lib/data";
import type { SatelliteScene } from "@/types";

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

  // Restore the last-viewed scene so navigating back feels continuous.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setSceneIdState(saved);
      if (window.sessionStorage.getItem("ecoconnect:hasRun") === "1") setHasRun(true);
    } catch {
      /* storage unavailable — fall back to defaults */
    }
  }, []);

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
    }),
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
    ],
  );

  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>;
}

export function useAnalysis() {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error("useAnalysis must be used within <AnalysisProvider>");
  return ctx;
}
