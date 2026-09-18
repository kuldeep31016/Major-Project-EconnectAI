"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Cpu, Loader2, Play, Satellite, Terminal } from "lucide-react";

import { AppShell } from "@/components/dashboard/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAnalysis } from "@/hooks/use-analysis";
import { useAuth } from "@/hooks/use-auth";
import { fetchModels, fetchScenes, postSegment, type ModelInfo, type SceneRecord } from "@/lib/api";
import { getScenes } from "@/lib/data";
import { cn } from "@/lib/utils";

/**
 * New Analysis — runs the real pipeline on a downloaded scene:
 *   scene GeoTIFF ─▶ segmentation checkpoint (UNet) ─▶ probability raster ─▶ patches (MMU 2 ha)
 *   ─▶ graph (k, τ) ─▶ IIC / PC / ECA ─▶ exact leave-one-out criticality ─▶ restoration ranking.
 * Nothing is uploaded from the browser: scenes are acquired by scripts/acquire_study_area.py and the
 * backend runs scripts/predict.py + scripts/run_graph_analysis.py synchronously.
 */
export default function NewAnalysisPage() {
  const router = useRouter();
  const { sceneId, setSceneId, apiOnline, refreshBundle, markRun } = useAnalysis();
  const { user } = useAuth();
  const areas = getScenes();
  const [scenes, setScenes] = useState<SceneRecord[] | null>(null);
  const [models, setModels] = useState<ModelInfo[] | null>(null);
  const [sceneFile, setSceneFile] = useState<string>("");
  const [modelId, setModelId] = useState<string>("");
  const [threshold, setThreshold] = useState<string>("");
  const [resultKind, setResultKind] = useState<"development" | "experiment">("development");
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Awaited<ReturnType<typeof postSegment>> | null>(null);

  useEffect(() => {
    if (apiOnline !== true) return;
    let cancelled = false;
    fetchScenes().then((s) => { if (!cancelled) setScenes(s); }).catch(() => { if (!cancelled) setScenes([]); });
    fetchModels().then((m) => { if (!cancelled) setModels(m); }).catch(() => { if (!cancelled) setModels([]); });
    return () => { cancelled = true; };
  }, [apiOnline]);

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(t);
  }, [running]);

  const areaScenes = useMemo(() => (scenes ?? []).filter((s) => s.studyAreaId === sceneId).sort((a, b) => b.scene_id.localeCompare(a.scene_id)), [scenes, sceneId]);
  const scene = areaScenes.find((s) => s.scene_id === sceneFile) ?? areaScenes[0] ?? null;
  // A checkpoint is usable only if the scene carries every band index it was trained on.
  const usable = (m: ModelInfo) => !scene || !m.bands || m.bands.every((b) => b < scene.bands.length);
  const modelList = (models ?? []).filter((m) => m.checkpoint);
  const model = modelList.find((m) => m.experimentId === modelId && usable(m)) ?? modelList.filter(usable).sort((a, b) => Number(b.mode === "full") - Number(a.mode === "full") || Number((b.bands ?? []).join() === "0,1") - Number((a.bands ?? []).join() === "0,1"))[0] ?? null;
  const thr = threshold !== "" ? Number(threshold) : model?.calibratedThreshold ?? null;
  const canRun = !!user?.capabilities.includes("run_analysis");

  const run = async () => {
    if (!scene || !model) return;
    setRunning(true); setError(null); setDone(null); setElapsed(0);
    try {
      const r = await postSegment({ study_area: sceneId, scene_tif: `data/scenes/${sceneId}/${scene.scene_id}.tif`, checkpoint: model.checkpoint ?? undefined, threshold: thr, result_kind: resultKind });
      setDone(r);
      markRun();
      await refreshBundle();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };


  return (
    <AppShell title="New Analysis" subtitle="Run the segmentation → patches → connectivity → criticality pipeline on a downloaded scene">
      <div className="mx-auto grid max-w-[1200px] gap-5 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          {/* 1 landscape */}
          <Card>
            <CardHeader className="pb-2"><CardTitle>1 · Landscape</CardTitle><CardDescription>Four paper study areas (configs/study_areas.yaml)</CardDescription></CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {areas.map((a) => {
                const n = (scenes ?? []).filter((s) => s.studyAreaId === a.id).length;
                return (
                  <button key={a.id} onClick={() => { setSceneId(a.id); setSceneFile(""); setDone(null); }} className={cn("rounded-xl border p-3 text-left transition", sceneId === a.id ? "border-[#0f5132]/50 bg-[#0f5132]/[0.06]" : "border-black/[0.08] hover:bg-black/[0.02]")}>
                    <div className="text-[13px] font-semibold">{a.name}</div>
                    <div className="text-[11px] text-muted-foreground">{a.state} · {a.protection} · {a.areaKm2} km²</div>
                    <div className="mt-1 text-[11px]">{scenes === null ? "…" : n ? `${n} downloaded scene${n === 1 ? "" : "s"}` : <span className="text-[#b45309]">no scene downloaded</span>}</div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* 2 scene */}
          <Card>
            <CardHeader className="pb-2"><CardTitle>2 · Scene</CardTitle><CardDescription>Preprocessed composites written by scripts/acquire_study_area.py (temporal median, 10 m, UTM)</CardDescription></CardHeader>
            <CardContent>
              {apiOnline === false && <div className="text-[12px] text-[#b91c1c]">Backend offline.</div>}
              {areaScenes.length === 0 && apiOnline && (
                <div className="rounded-xl border border-dashed border-black/15 p-3 text-[12px] text-muted-foreground">
                  No scene for this landscape yet. Acquire one in a terminal:
                  <pre className="mt-2 rounded-lg bg-[#0b1120] p-3 text-[11px] text-[#d1fae5]">{`.venv/bin/python -u scripts/acquire_study_area.py --study-area ${sceneId}`}</pre>
                </div>
              )}
              <div className="space-y-2">
                {areaScenes.map((s) => (
                  <label key={s.scene_id} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-3", scene?.scene_id === s.scene_id ? "border-[#0f5132]/50 bg-[#0f5132]/[0.06]" : "border-black/[0.08]")}>
                    <input type="radio" name="scene" checked={scene?.scene_id === s.scene_id} onChange={() => setSceneFile(s.scene_id)} className="mt-1 accent-[#16a34a]" />
                    <div className="min-w-0 flex-1 text-[12px]">
                      <div className="flex items-center gap-2 font-semibold"><Satellite className="h-3.5 w-3.5 text-[#1e5f8a]" />{s.scene_id}</div>
                      <div className="text-muted-foreground">{s.date_range[0]} → {s.date_range[1]} · {s.width}×{s.height} px · {s.crs} · bands: {s.bands.join(", ")}</div>
                      {s.sources?.sentinel1 && <div className="text-muted-foreground">Sentinel-1: {s.sources.sentinel1.scenes?.length ?? 0} RTC scenes · {s.sources.sentinel1.composite} · valid {Math.round((s.sources.sentinel1.valid_fraction ?? 0) * 100)} %</div>}
                      {s.sources?.sentinel2 && <div className="text-muted-foreground">Sentinel-2: {s.sources.sentinel2.scenes?.length ?? 0} L2A granules · valid {Math.round((s.sources.sentinel2.valid_fraction ?? 0) * 100)} %</div>}
                    </div>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 3 model */}
          <Card>
            <CardHeader className="pb-2"><CardTitle>3 · Segmentation model</CardTitle><CardDescription>Trained checkpoints under outputs/segmentation — metrics are agreement with the GMW reference map on held-out tiles</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {modelList.length === 0 && apiOnline && <div className="text-[12px] text-muted-foreground">No checkpoint yet — train one: <code>scripts/train.py</code> (see docs/TRAINING.md) or the Colab/Kaggle notebook for UNB7.</div>}
              {modelList.map((m) => {
                const ok = usable(m);
                return (
                  <label key={m.experimentId} className={cn("flex items-start gap-3 rounded-xl border p-3", !ok && "opacity-50", model?.experimentId === m.experimentId ? "border-[#0f5132]/50 bg-[#0f5132]/[0.06]" : "border-black/[0.08]")}>
                    <input type="radio" name="model" disabled={!ok} checked={model?.experimentId === m.experimentId} onChange={() => { setModelId(m.experimentId); setThreshold(""); }} className="mt-1 accent-[#16a34a]" />
                    <div className="min-w-0 flex-1 text-[12px]">
                      <div className="flex flex-wrap items-center gap-2 font-semibold"><Cpu className="h-3.5 w-3.5 text-[#6d28d9]" />{m.experimentId}<span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", m.mode === "full" ? "bg-[#dcfce7] text-[#15803d]" : "bg-[#fef3c7] text-[#b45309]")}>{m.mode === "full" ? "UNB7 · final" : "B0 · development — not final"}</span></div>
                      <div className="text-muted-foreground">{m.model} · {m.encoder} · bands {m.bands?.join(",") ?? "all"} ({m.bands?.join() === "0,1" ? "Sentinel-1 only — reported configuration" : m.bands?.every((b) => b >= 2) ? "Sentinel-2 only — ablation" : "S1 + S2 — ablation"})</div>
                      <div className="text-muted-foreground">test IoU {m.test?.iou?.toFixed(3) ?? "—"} · F1 {m.test?.f1?.toFixed(3) ?? "—"} · calibrated threshold {m.calibratedThreshold ?? "none (0.5)"}</div>
                      {!ok && <div className="text-[#b91c1c]">scene lacks the bands this model needs</div>}
                    </div>
                  </label>
                );
              })}
              <div className="flex flex-wrap items-center gap-3 pt-2 text-[12px]">
                <label className="flex items-center gap-2">Threshold <input value={threshold} placeholder={model?.calibratedThreshold != null ? String(model.calibratedThreshold) : "0.5"} onChange={(e) => setThreshold(e.target.value)} className="w-20 rounded-lg border border-black/[0.12] px-2 py-1" /></label>
                <label className="flex items-center gap-2">Result label
                  <select value={resultKind} onChange={(e) => setResultKind(e.target.value as typeof resultKind)} className="rounded-lg border border-black/[0.12] px-2 py-1">
                    <option value="development">DEVELOPMENT — not final</option>
                    <option value="experiment" disabled={model?.mode !== "full"}>OUR EXPERIMENTAL RESULT (full model only)</option>
                  </select>
                </label>
                <span className="text-muted-foreground">MMU 2 ha · k = 3 · τ = 5 km (configs/graph.yaml)</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* run */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle>Run</CardTitle><CardDescription>Synchronous on the backend — the page waits for the real result</CardDescription></CardHeader>
            <CardContent className="space-y-3 text-[12.5px]">
              <div className="rounded-xl bg-[#f4f7f5] p-3">
                <div><span className="text-muted-foreground">Landscape</span> · {areas.find((a) => a.id === sceneId)?.shortName}</div>
                <div><span className="text-muted-foreground">Scene</span> · {scene?.scene_id ?? "—"}</div>
                <div><span className="text-muted-foreground">Model</span> · {model?.experimentId ?? "—"}</div>
                <div><span className="text-muted-foreground">Threshold</span> · {thr ?? 0.5}</div>
              </div>
              {!user && <div className="text-[#b45309]">Sign in to run analyses (GIS officer, analyst or admin).</div>}
              <Button onClick={run} disabled={!scene || !model || running || !user || !canRun} className="w-full bg-[#0f5132] text-white hover:bg-[#0b3d26]">
                {running ? <><Loader2 className="h-4 w-4 animate-spin" /> Running… {elapsed}s</> : <><Play className="h-4 w-4" /> Run pipeline</>}
              </Button>
              {running && (
                <ol className="space-y-1 text-[11.5px] text-muted-foreground">
                  {["Sliding-window inference (scripts/predict.py)", "Threshold + MMU 2 ha → patches", "k-NN graph, w = √(q_i q_j)·e^(−d/τ)", "IIC / PC / ECA", "Exact leave-one-out criticality", "Restoration candidate ranking", "Registry + provenance"].map((t) => <li key={t} className="flex items-center gap-2"><Terminal className="h-3 w-3" />{t}</li>)}
                </ol>
              )}
              {error && <div className="rounded-lg border border-[#fecaca] bg-[#fff5f5] p-3 text-[11.5px] text-[#b91c1c]"><AlertTriangle className="mr-1 inline h-3.5 w-3.5" />{error}</div>}
              {done && (
                <div className="rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] p-3">
                  <div className="flex items-center gap-2 font-semibold text-[#15803d]"><CheckCircle2 className="h-4 w-4" /> Run complete · {done.runId}</div>
                  <div className="mt-1 text-[11.5px]">{done.nPatches} patches · {done.nEdges} links · {done.nComponents} components · habitat {done.habitatAreaHa?.toFixed(1)} ha · ECA {done.ecaPctOfHabitat?.toFixed(1)} % · threshold {done.thresholdUsed ?? "—"} · {done.elapsedS ? `${done.elapsedS.toFixed(0)} s` : ""}</div>
                  <div className="mt-1 text-[10.5px] text-muted-foreground">{done.resultLabel}</div>
                  <div className="mt-2 flex gap-2"><Button size="sm" onClick={() => router.push("/command")}>Open dashboard</Button><Button size="sm" variant="outline" asChild><Link href="/analysis">Inspect patches</Link></Button></div>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle>What is real here</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-[11.5px] text-muted-foreground">
              <div>• Scenes: Copernicus Sentinel-1 RTC (Planetary Computer) and Sentinel-2 L2A (Earth Search), temporal medians for the year.</div>
              <div>• Labels used for training: Global Mangrove Watch v3 2020 (weak labels) — the model learns a reference map, not field truth.</div>
              <div>• Development checkpoints (B0) were trained on the Kerala subset; applying them elsewhere is transfer without retraining and is labelled as such.</div>
              <div>• Graph, indices and criticality follow the paper exactly (Eqs. 3–11); costs are never invented, so restoration is ranked by connectivity gain unless you upload costs.</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
