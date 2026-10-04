"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, AlertTriangle, ArrowUpRight, BarChart3, CheckCircle2, Eye, GitCompareArrows, ScrollText, ShieldCheck, Sparkles, X } from "lucide-react";
import { AppShell } from "@/components/dashboard/app-shell";
import { CalibrationChart, ChartCard, ConfusionMatrix, LossChart, ValidationChart, parseHistory } from "@/components/models/charts";
import { HowMeasured, MetricTiles, SplitTable, fmt } from "@/components/models/metrics";
import { GLASS, ModelList, StatusChip } from "@/components/models/model-list";
import { compareExperiments, fetchModels, fetchModelDetail, fetchRegistryModels, modelAssetUrl, setModelStatus, type ExperimentRow, type ModelInfo, type ModelDetail, type ModelStatus, type RegistryModel } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

type TabKey = "metrics" | "curves" | "predictions" | "specs";
const TABS: { key: TabKey; label: string; icon: typeof BarChart3 }[] = [
  { key: "metrics", label: "Metrics", icon: BarChart3 },
  { key: "curves", label: "Curves & Matrix", icon: Activity },
  { key: "predictions", label: "Sample Predictions", icon: Eye },
  { key: "specs", label: "Model Card", icon: ScrollText },
];
const LADDER: ModelStatus[] = ["DEVELOPMENT", "EXPERIMENTAL", "CANDIDATE", "VALIDATED"];

export default function ExperimentsPage() {
  const [models, setModels] = useState<ModelInfo[] | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [detail, setDetail] = useState<ModelDetail | null>(null);
  const [tab, setTab] = useState<TabKey>("metrics");
  const { can } = useAuth();
  const [registry, setRegistry] = useState<Record<string, RegistryModel>>({});
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [comparison, setComparison] = useState<{ experiments: ExperimentRow[]; note: string } | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const loadRegistry = () => fetchRegistryModels().then((r) => setRegistry(Object.fromEntries(r.map((m) => [m.id, m])))).catch(() => setRegistry({}));

  useEffect(() => {
    loadRegistry();
  }, []);

  const toggleCompare = (id: string) => setCompareIds((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id].slice(-4)));
  const runCompare = () => compareExperiments(compareIds).then(setComparison).catch((e) => setStatusMsg(String(e)));
  const promote = async (id: string, to: ModelStatus) => {
    const reason = window.prompt(`Reason for moving ${id} to ${to}?`);
    if (!reason) return;
    try { await setModelStatus(id, to, reason); setStatusMsg(`${id} → ${to} (audited)`); loadRegistry(); }
    catch (e) { setStatusMsg(e instanceof Error ? e.message : String(e)); }
  };

  useEffect(() => {
    let cancelled = false;
    fetchModels()
      .then((m) => {
        if (cancelled) return;
        setModels(m);
        setActive((a) => a ?? (m.length ? m[0].experimentId : null));
      })
      .catch(() => {
        if (!cancelled) setModels(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    fetchModelDetail(active).then((d) => {
      if (!cancelled) setDetail(d);
    }).catch(() => { if (!cancelled) setDetail(null); });
    return () => {
      cancelled = true;
    };
  }, [active]);

  const ds = detail?.experiment?.dataset;
  const bands = ds?.bands;
  const input = bands == null ? "S1 + S2 (all bands)" : bands.length === 2 ? "S1 VV/VH (paper baseline)" : `${bands.length} bands (S2)`;
  const valMetrics = detail?.metrics?.val;
  const testMetrics = detail?.metrics?.test;
  const history = useMemo(() => parseHistory(detail?.history), [detail?.history]);
  const reg = active ? registry[active] : undefined;
  const isFull = detail?.metrics.mode === "full";
  const next = reg ? LADDER[LADDER.indexOf(reg.status) + 1] : undefined;
  const samples = detail?.assets.filter((a) => a.startsWith("sample_predictions/")).slice(0, 8) ?? [];

  return (
    <AppShell title="Data & Models" subtitle="Trained habitat-segmentation models and how well they agree with GMW reference maps">
      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[244px_minmax(0,1fr)] xl:grid-cols-[288px_minmax(0,1fr)]">
        <div className="lg:sticky lg:top-4 lg:self-start">
          <ModelList
            models={models}
            active={active}
            onSelect={setActive}
            registry={registry}
            compareIds={compareIds}
            onToggleCompare={toggleCompare}
            onCompare={runCompare}
          />
        </div>

        {detail ? (
          <div className="min-w-0 space-y-5">
            {/* Comparison (opened from the left column) */}
            <AnimatePresence>
              {comparison && (
                <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className={cn(GLASS, "overflow-hidden")}>
                  <div className="flex items-start justify-between gap-3 border-b border-black/[0.05] px-5 py-4">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#dcfce7] text-[#15803d]"><GitCompareArrows className="h-4 w-4" /></span>
                      <div>
                        <div className="text-[14px] font-semibold">Experiment comparison</div>
                        <div className="text-[11.5px] text-muted-foreground">{comparison.note}</div>
                      </div>
                    </div>
                    <button onClick={() => setComparison(null)} aria-label="Close comparison" className="rounded-lg p-1.5 text-muted-foreground hover:bg-black/[0.04] hover:text-foreground"><X className="h-4 w-4" /></button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[12px]">
                      <thead className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                        <tr><th className="px-5 py-2.5 text-left">Field</th>{comparison.experiments.map((e) => <th key={e.id} className="px-3 py-2.5 text-left font-mono normal-case tracking-normal text-[#0f5132]">{e.id}</th>)}</tr>
                      </thead>
                      <tbody>
                        {([
                          ["status", (e: ExperimentRow) => e.status], ["input bands", (e: ExperimentRow) => String(e.config.input_bands)], ["encoder", (e: ExperimentRow) => String(e.config.encoder)],
                          ["train / val / test tiles", (e: ExperimentRow) => `${e.config.n_train} / ${e.config.n_val} / ${e.config.n_test}`], ["epochs (best)", (e: ExperimentRow) => `${e.config.epochs_run ?? "—"} (${e.config.best_epoch ?? "—"})`],
                          ["calibrated threshold", (e: ExperimentRow) => String(e.calibrated_threshold ?? "—")], ["test IoU", (e: ExperimentRow) => e.test.iou?.toFixed(3) ?? "—"], ["test F1", (e: ExperimentRow) => e.test.f1?.toFixed(3) ?? "—"],
                          ["test precision / recall", (e: ExperimentRow) => `${e.test.precision?.toFixed(3) ?? "—"} / ${e.test.recall?.toFixed(3) ?? "—"}`], ["code commit", (e: ExperimentRow) => String(e.config.code_commit ?? "not recorded").slice(0, 12)],
                        ] as [string, (e: ExperimentRow) => string][]).map(([label, get]) => (
                          <tr key={label} className="border-t border-black/[0.05] hover:bg-[#f0fdf4]/60">
                            <td className="px-5 py-2 font-semibold text-[#334155]">{label}</td>
                            {comparison.experiments.map((e) => <td key={e.id} className="px-3 py-2 tabular-nums">{get(e)}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Registry status + promote workflow */}
            <div className={cn(GLASS, "p-4 sm:p-5")}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#16a34a] to-[#0f5132] text-white shadow-sm"><ShieldCheck className="h-5 w-5" /></span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[14px] font-semibold text-foreground">{reg?.display_name ?? detail.experimentId}</span>
                      <StatusChip status={reg?.status} />
                    </div>
                    <div className="truncate font-mono text-[10.5px] text-muted-foreground">{detail.experimentId}{reg?.version ? ` · v${reg.version}` : ""}</div>
                  </div>
                </div>
                {reg && can("manage_models") && next && next !== "VALIDATED" && (
                  <button
                    onClick={() => promote(detail.experimentId, next)}
                    className="ml-auto flex items-center gap-1.5 rounded-xl border border-[#15803d]/30 bg-white px-3.5 py-2 text-[12px] font-semibold text-[#15803d] shadow-sm transition hover:bg-[#f0fdf4]"
                  >
                    Promote to {next} <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {reg && (
                <ol className="mt-4 flex items-center gap-1.5" aria-label="Model status ladder">
                  {LADDER.map((s, i) => {
                    const at = LADDER.indexOf(reg.status);
                    const done = i <= at;
                    return (
                      <li key={s} className="flex flex-1 items-center gap-1.5">
                        <span className={cn("flex min-w-0 items-center gap-1 text-[10px] font-bold uppercase tracking-wider", i === at ? "text-[#0f5132]" : done ? "text-[#15803d]/70" : "text-muted-foreground/60")}>
                          <span className={cn("grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[8px]", i === at ? "border-[#15803d] bg-[#15803d] text-white" : done ? "border-[#15803d]/50 bg-[#dcfce7] text-[#15803d]" : "border-black/15 bg-white")}>
                            {done && <CheckCircle2 className="h-3 w-3" />}
                          </span>
                          <span className="hidden truncate sm:inline">{s.toLowerCase()}</span>
                        </span>
                        {i < LADDER.length - 1 && <span className={cn("h-[2px] flex-1 rounded-full", i < at ? "bg-[#15803d]/50" : "bg-black/[0.08]")} />}
                      </li>
                    );
                  })}
                </ol>
              )}
              <p className="mt-3 text-[11.5px] text-muted-foreground">
                {reg ? "Validated only through an explicit review with independent (non-GMW) evidence." : "This run is not in the model registry, so it has no status."}
              </p>
              {statusMsg && <p className="mt-1.5 rounded-lg bg-[#f0fdf4] px-2.5 py-1.5 text-[11.5px] text-[#0f5132]">{statusMsg}</p>}
            </div>

            {/* Model header + tabs */}
            <div className={cn(GLASS, "p-5")}>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[19px] font-bold tracking-tight text-foreground">{detail.experimentId}</h2>
                <span className={cn("rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold", isFull ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800")}>
                  {isFull ? "Final model" : "Development model — not final"}
                </span>
              </div>
              <p className="mt-1 text-[12px] text-muted-foreground">
                U-Net · <span className="font-mono">{detail.metrics.encoder || "—"}</span> encoder · Input: {input} · {ds?.n_train ?? "—"} train / {ds?.n_val ?? "—"} val tiles · metrics vs GMW weak labels
              </p>
              <div role="tablist" className="mt-4 flex gap-1 overflow-x-auto rounded-2xl border border-black/[0.05] bg-[#f3f7f4] p-1">
                {TABS.map((t) => {
                  const on = tab === t.key;
                  return (
                    <button
                      key={t.key}
                      role="tab"
                      aria-selected={on}
                      onClick={() => setTab(t.key)}
                      className={cn("relative flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12.5px] font-semibold transition-colors", on ? "text-white" : "text-[#475569] hover:text-foreground")}
                    >
                      {on && <motion.span layoutId="models-tab" className="absolute inset-0 rounded-xl bg-[#15803d] shadow-[0_6px_16px_-8px_rgba(21,128,61,0.7)]" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
                      <t.icon className="relative h-3.5 w-3.5" />
                      <span className="relative">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18 }} className="space-y-5">
                {tab === "metrics" && (
                  <>
                    <MetricTiles val={valMetrics} bestEpoch={detail.metrics.best_epoch} />
                    <SplitTable
                      val={valMetrics}
                      test={testMetrics}
                      bestEpoch={detail.metrics.best_epoch}
                      testThreshold={detail.metrics.test_threshold}
                      nTestTiles={(detail.metrics as { n_test_tiles?: number }).n_test_tiles}
                    />
                    <HowMeasured />
                  </>
                )}

                {tab === "curves" && (
                  <div className="grid gap-5 xl:grid-cols-2">
                    {history.length > 0 ? (
                      <>
                        <LossChart rows={history} bestEpoch={detail.metrics.best_epoch} />
                        <ValidationChart rows={history} bestEpoch={detail.metrics.best_epoch} />
                      </>
                    ) : (
                      ["training_curve.png", "validation_curve.png"].filter((a) => detail.assets.includes(a)).map((a) => (
                        <ChartCard key={a} icon={Activity} title={a === "training_curve.png" ? "Training loss" : "Validation scores"} caption="Saved plot (per-epoch log not available)">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={modelAssetUrl(detail.experimentId, a)} alt={a} className="w-full rounded-xl bg-white" />
                        </ChartCard>
                      ))
                    )}
                    <ConfusionMatrix
                      key={detail.experimentId}
                      val={valMetrics?.confusion_matrix as unknown as number[][] | undefined}
                      test={testMetrics?.confusion_matrix as unknown as number[][] | undefined}
                      aside={
                        <div className="space-y-3 rounded-xl bg-[#f6faf7] p-4 text-[12px] leading-relaxed text-muted-foreground">
                          <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground"><AlertTriangle className="h-4 w-4 text-amber-600" /> Reading these charts</div>
                          <p><span className="font-semibold text-[#15803d]">Green</span> cells agree with GMW, <span className="font-semibold text-amber-700">amber</span> cells disagree. Habitat is a tiny share of pixels, so the bottom row matters most.</p>
                          <p>The dashed <span className="font-semibold text-[#15803d]">best</span> line on the curves marks the epoch kept (best validation score). Test scores are computed once, after training.</p>
                          {history.length === 0 && <p>No per-epoch log for this run.</p>}
                        </div>
                      }
                    />
                    {detail.calibration ? (
                      <CalibrationChart cal={detail.calibration} />
                    ) : (
                      <p className="px-1 text-[11.5px] text-muted-foreground xl:col-span-2">No threshold calibration recorded for this run — test scores use threshold {detail.metrics.test_threshold ?? 0.5}.</p>
                    )}
                  </div>
                )}

                {tab === "predictions" && (
                  <div className={cn(GLASS, "p-5")}>
                    <div className="mb-1 text-[14px] font-semibold">Held-out test tiles</div>
                    <div className="mb-4 flex flex-wrap gap-1.5 text-[11px]">
                      {["Sensor input", "GMW weak reference", "Probability P(habitat)", "Final mask"].map((l, i) => (
                        <span key={l} className="flex items-center gap-1 rounded-full border border-black/[0.06] bg-[#f6faf7] px-2.5 py-1 text-[#334155]">
                          <span className="grid h-4 w-4 place-items-center rounded-full bg-[#15803d] text-[9px] font-bold text-white">{i + 1}</span>{l}
                        </span>
                      ))}
                    </div>
                    {samples.length ? (
                      <div className="grid gap-4">
                        {samples.map((a) => (
                          <figure key={a} className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white p-2 shadow-sm">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={modelAssetUrl(detail.experimentId, a)} alt={`Prediction for ${a.split("/").pop()}`} className="w-full rounded-xl bg-white" loading="lazy" />
                            <figcaption className="mt-1.5 truncate px-1 font-mono text-[10px] text-muted-foreground">{a.split("/").pop()}</figcaption>
                          </figure>
                        ))}
                      </div>
                    ) : (
                      <p className="py-10 text-center text-[12px] text-muted-foreground">No sample predictions were saved for this run.</p>
                    )}
                  </div>
                )}

                {tab === "specs" && (
                  <div className="grid gap-5 xl:grid-cols-2">
                    <div className={cn(GLASS, "p-5")}>
                      <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold"><Sparkles className="h-4 w-4 text-[#15803d]" /> Architecture & training</div>
                      <dl className="text-[12.5px]">
                        {([
                          ["Architecture", "U-Net"],
                          ["Encoder", detail.metrics.encoder || "—"],
                          ["Input", input],
                          ["Tiles (train / val / test)", `${ds?.n_train ?? "—"} / ${ds?.n_val ?? "—"} / ${ds?.n_test ?? "—"}`],
                          ["Parameters", detail.experiment?.parameters ? Number(detail.experiment.parameters).toLocaleString() : "—"],
                          ["Epochs run (best)", `${detail.experiment?.epochs_run ?? "—"} (${detail.metrics.best_epoch ?? "—"})`],
                          ["Batch size · learning rate", `${detail.experiment?.batch_size ?? "—"} · ${detail.experiment?.learning_rate ?? "—"}`],
                          ["Compute device", String(detail.experiment?.hardware?.device ?? "—")],
                          ["Training time", detail.experiment?.training_time_s ? `${Math.round(Number(detail.experiment.training_time_s))} s` : "—"],
                          ["Test threshold", fmt(detail.metrics.test_threshold ?? undefined, 2)],
                        ] as [string, string][]).map(([k, v]) => (
                          <div key={k} className="flex items-center justify-between gap-4 border-b border-black/[0.05] py-2 last:border-0">
                            <dt className="text-muted-foreground">{k}</dt>
                            <dd className="text-right font-semibold text-foreground">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                    <div className="space-y-5">
                      <div className={cn(GLASS, "space-y-2.5 p-5 text-[12.5px] leading-relaxed text-muted-foreground")}>
                        <div className="mb-1 flex items-center gap-2 text-[13px] font-semibold text-foreground"><CheckCircle2 className="h-4 w-4 text-[#15803d]" /> Scope & governance</div>
                        <p><b className="text-foreground">Labels:</b> trained and scored against Global Mangrove Watch (GMW) maps — weak labels, not field surveys.</p>
                        <p><b className="text-foreground">Splits:</b> spatial blocks, so test tiles come from different places than training tiles.</p>
                        <p><b className="text-foreground">Use:</b> a first-pass habitat map, to be checked with connectivity analysis and field verification.</p>
                      </div>
                      {(() => {
                        const lim = (reg as (RegistryModel & { limitations?: string[] }) | undefined)?.limitations;
                        return lim?.length ? (
                          <div className={cn(GLASS, "p-5")}>
                            <div className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold"><AlertTriangle className="h-4 w-4 text-amber-600" /> Known limitations</div>
                            <ul className="flex flex-wrap gap-1.5">
                              {lim.map((l) => <li key={l} className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11.5px] text-amber-900">{l}</li>)}
                            </ul>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        ) : (
          <div className={cn(GLASS, "grid place-items-center p-12 text-center text-[12.5px] text-muted-foreground")}>
            {models?.length === 0 ? "No trained models yet." : "Select a model on the left to see its metrics, curves and predictions."}
          </div>
        )}
      </div>
    </AppShell>
  );
}
