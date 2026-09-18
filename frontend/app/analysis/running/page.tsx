"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  FileText,
  Flame,
  GitBranch,
  Layers,
  Loader2,
  Network,
  Scan,
  Sparkles,
  Terminal,
  UploadCloud,
  Waves,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Starfield } from "@/components/landing/starfield";
import { EASE } from "@/components/shared/motion";
import { useAnalysis } from "@/hooks/use-analysis";
import { PIPELINE_STAGES, TOTAL_PIPELINE_MS, getScene } from "@/lib/data";
import { postSegment } from "@/lib/api";
import { cn } from "@/lib/utils";

const ICONS: Record<string, typeof Layers> = {
  UploadCloud,
  Layers,
  Scan,
  Network,
  GitBranch,
  Flame,
  FileText,
};

function RunningPipeline() {
  const router = useRouter();
  const params = useSearchParams();
  const { sceneId, setSceneId, markRun, apiOnline, refreshBundle } = useAnalysis();
  // Live mode: a REAL run is launched on the backend; the staged narration below is illustrative.
  const liveRun = useRef<Promise<unknown> | null>(null);
  const [liveState, setLiveState] = useState<"idle" | "running" | "done" | "failed">("idle");
  const [liveMessage, setLiveMessage] = useState<string | null>(null);

  const requested = params.get("scene");
  const activeSceneId = requested ?? sceneId;
  const scene = getScene(activeSceneId);

  const [stageIndex, setStageIndex] = useState(0);
  const [stageProgress, setStageProgress] = useState(0);
  const [logs, setLogs] = useState<{ id: string; text: string; stage: string }[]>([]);
  const [done, setDone] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const cancelled = useRef(false);

  // Sync the requested scene into global state once.
  useEffect(() => {
    if (requested && requested !== sceneId) setSceneId(requested);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requested]);

  // Launch the real run once the API is known to be online.
  useEffect(() => {
    if (apiOnline !== true || liveRun.current) return;
    setLiveState("running");
    liveRun.current = postSegment(activeSceneId)
      .then((r) => {
        setLiveState("done");
        setLiveMessage(
          `Real run ${r.runId}: ${r.nPatches} patches, ${r.nEdges} links, ${r.nComponents} components, IIC ${r.iic.toExponential(3)} ` +
            `(threshold ${r.thresholdUsed ?? "0.5"}, checkpoint ${r.checkpoint?.split("/").slice(-2, -1)[0] ?? "?"}) — ${r.resultLabel}`,
        );
        return refreshBundle();
      })
      .catch((e: unknown) => {
        setLiveState("failed");
        setLiveMessage(`Backend could not run the pipeline: ${e instanceof Error ? e.message : String(e)}. Showing existing data.`);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiOnline, activeSceneId]);

  // Drive the pipeline narration: each stage advances its own progress and emits logs.
  useEffect(() => {
    cancelled.current = false;
    let stage = 0;
    let raf = 0;
    let stageStart = performance.now();
    let emitted = 0;

    const tick = (now: number) => {
      if (cancelled.current) return;
      const current = PIPELINE_STAGES[stage];
      const elapsed = now - stageStart;
      const pct = Math.min(100, (elapsed / current.durationMs) * 100);
      setStageProgress(pct);

      // Emit this stage's log lines progressively.
      const shouldHave = Math.floor((pct / 100) * current.logs.length);
      if (shouldHave > emitted) {
        const slice = current.logs.slice(emitted, shouldHave);
        setLogs((prev) => [
          ...prev,
          ...slice.map((text, i) => ({
            id: `${current.id}-${emitted + i}`,
            text,
            stage: current.label,
          })),
        ]);
        emitted = shouldHave;
      }

      if (pct >= 100) {
        if (stage < PIPELINE_STAGES.length - 1) {
          stage += 1;
          setStageIndex(stage);
          stageStart = now;
          emitted = 0;
          setStageProgress(0);
        } else {
          const finish = () => {
            setDone(true);
            markRun();
            window.setTimeout(() => {
              if (!cancelled.current) router.push("/analysis");
            }, 1400);
          };
          // hold the last stage until the real backend run (if any) has finished
          if (liveRun.current) liveRun.current.then(finish, finish);
          else finish();
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelled.current = true;
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the log tail visible.
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [logs]);

  const overall = useMemo(() => {
    const before = PIPELINE_STAGES.slice(0, stageIndex).reduce((s, x) => s + x.durationMs, 0);
    const inStage = (PIPELINE_STAGES[stageIndex].durationMs * stageProgress) / 100;
    return Math.min(100, ((before + inStage) / TOTAL_PIPELINE_MS) * 100);
  }, [stageIndex, stageProgress]);

  const eta = Math.max(0, Math.round(((100 - overall) / 100) * (TOTAL_PIPELINE_MS / 1000)));

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-aurora" />
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <Starfield className="pointer-events-none absolute inset-0" count={60} />

      <div className="relative w-full max-w-5xl">
        {/* header */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-eco">
              <Waves className="h-6 w-6 text-[#04231b]" strokeWidth={2.3} />
            </div>
            <div>
              <div className="text-[15px] font-semibold tracking-tight">
                Analysing {scene.shortName}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {scene.productId}
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              cancelled.current = true;
              router.push("/upload");
            }}
            className="text-muted-foreground"
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </Button>
        </div>

        {/* live-run status: the backend actually runs inference + graph analysis; narration below is illustrative */}
        <div
          className={
            "rounded-2xl border px-4 py-3 text-[12px] leading-relaxed " +
            (liveState === "done"
              ? "border-[#00c896]/30 bg-[#00c896]/8 text-[#00c896]"
              : liveState === "failed"
                ? "border-[#ef4444]/30 bg-[#ef4444]/8 text-[#ef4444]"
                : liveState === "running"
                  ? "border-[#38bdf8]/30 bg-[#38bdf8]/8 text-[#38bdf8]"
                  : "border-[#f59e0b]/30 bg-[#f59e0b]/8 text-[#f59e0b]")
          }
        >
          {liveState === "running" && "Real pipeline run in progress on the backend (segmentation → patches → graph → criticality → restoration). The stage narration below is illustrative; results arrive when the run finishes."}
          {liveState === "idle" && (apiOnline === false ? "Backend offline — this is the prototype's simulated pipeline; no data is processed." : "Checking backend…")}
          {(liveState === "done" || liveState === "failed") && liveMessage}
        </div>

        {/* overall progress */}
        <div className="rounded-3xl glass-strong p-6 shadow-2xl sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                {done ? "Analysis complete" : "Processing"}
              </div>
              <div className="mt-1.5 text-3xl font-bold tracking-tight tabular sm:text-4xl">
                {overall.toFixed(0)}
                <span className="text-xl text-muted-foreground">%</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-muted-foreground">
                {done ? "Redirecting to results" : `~${eta}s remaining`}
              </div>
              <div className="mt-1 text-[12px] font-medium">
                Stage {stageIndex + 1} of {PIPELINE_STAGES.length}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <Progress value={overall} height={8} striped={!done} color={done ? "#22c55e" : undefined} />
          </div>

          {/* stages */}
          <div className="mt-7 space-y-1.5">
            {PIPELINE_STAGES.map((s, i) => {
              const Icon = ICONS[s.icon] ?? Layers;
              const state = done || i < stageIndex ? "done" : i === stageIndex ? "active" : "pending";

              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.05, ease: EASE }}
                  className={cn(
                    "relative flex items-center gap-3.5 overflow-hidden rounded-xl border px-3.5 py-3 transition-colors duration-300",
                    state === "active"
                      ? "border-[#00c896]/30 bg-[#00c896]/8"
                      : state === "done"
                        ? "border-foreground/[0.08] bg-foreground/[0.03]"
                        : "border-transparent bg-transparent",
                  )}
                >
                  {state === "active" && (
                    <motion.div
                      className="absolute inset-y-0 left-0 bg-[#00c896]/8"
                      animate={{ width: `${stageProgress}%` }}
                      transition={{ duration: 0.15 }}
                    />
                  )}

                  <div
                    className={cn(
                      "relative grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors",
                      state === "done"
                        ? "bg-[#22c55e]/15 text-[#22c55e]"
                        : state === "active"
                          ? "bg-[#00c896]/18 text-[#00c896]"
                          : "bg-foreground/[0.05] text-muted-foreground/50",
                    )}
                  >
                    {state === "done" ? (
                      <motion.span
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      >
                        <CheckCircle2 className="h-[18px] w-[18px]" />
                      </motion.span>
                    ) : state === "active" ? (
                      <Loader2 className="h-[18px] w-[18px] animate-spin" />
                    ) : (
                      <Icon className="h-[18px] w-[18px]" />
                    )}

                    {state === "active" && (
                      <span className="absolute inset-0 animate-pulse-ring rounded-xl ring-2 ring-[#00c896]/40" />
                    )}
                  </div>

                  <div className="relative min-w-0 flex-1">
                    <div
                      className={cn(
                        "truncate text-[13px] font-medium transition-colors",
                        state === "pending" && "text-muted-foreground/60",
                      )}
                    >
                      {s.label}
                      {state === "active" && "…"}
                    </div>
                    <div className="truncate text-[10.5px] text-muted-foreground">{s.detail}</div>
                  </div>

                  {state === "active" && (
                    <div className="relative shrink-0 text-[11px] font-semibold tabular text-[#00c896]">
                      {stageProgress.toFixed(0)}%
                    </div>
                  )}
                  {state === "done" && (
                    <div className="relative shrink-0 text-[10px] font-medium text-[#22c55e]">
                      done
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* console */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-foreground/[0.08] bg-[#04101f]/80 backdrop-blur">
          <div className="flex items-center gap-2 border-b border-foreground/[0.08] px-4 py-2.5">
            <Terminal className="h-3.5 w-3.5 text-[#00c896]" />
            <span className="text-[11px] font-medium">Processing log</span>
            <span className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
              ingest-node-04
            </span>
          </div>
          <div ref={logRef} className="scroll-slim h-40 overflow-y-auto px-4 py-3 font-mono text-[11px] leading-relaxed">
            <AnimatePresence initial={false}>
              {logs.map((l) => (
                <motion.div
                  key={l.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25 }}
                  className="flex gap-2.5"
                >
                  <span className="shrink-0 text-[#00c896]/60">›</span>
                  <span className="text-muted-foreground">{l.text}</span>
                </motion.div>
              ))}
            </AnimatePresence>
            {!done && (
              <div className="flex gap-2.5">
                <span className="shrink-0 text-[#00c896]/60">›</span>
                <span className="inline-block h-3.5 w-2 animate-pulse bg-[#00c896]/70" />
              </div>
            )}
          </div>
        </div>

        {/* completion flash */}
        <AnimatePresence>
          {done && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 flex items-center gap-3 rounded-2xl border border-[#22c55e]/25 bg-[#22c55e]/10 px-5 py-4"
            >
              <Sparkles className="h-5 w-5 shrink-0 text-[#22c55e]" />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-[#22c55e]">
                  Analysis complete — 18 patches resolved, connectivity 74.6/100
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  Opening results dashboard…
                </div>
              </div>
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#22c55e]" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

export default function AnalysisRunningPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-[#00c896]" />
        </div>
      }
    >
      <RunningPipeline />
    </Suspense>
  );
}
