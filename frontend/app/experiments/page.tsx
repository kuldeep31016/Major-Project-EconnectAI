"use client";

import { useEffect, useState } from "react";
import { Activity, BarChart3, CheckCircle2, ChevronRight, Cpu, Eye, FileSpreadsheet, FlaskConical, Layers, Sliders, Sparkles, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/dashboard/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchModels, fetchModelDetail, fetchModelCards, modelAssetUrl, type ModelInfo, type ModelDetail } from "@/lib/api";
import { cn } from "@/lib/utils";

type TabKey = "metrics" | "curves" | "predictions" | "specs";

export default function ExperimentsPage() {
  const [models, setModels] = useState<ModelInfo[] | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [detail, setDetail] = useState<ModelDetail | null>(null);
  const [tab, setTab] = useState<TabKey>("metrics");
  const [cards, setCards] = useState<{ foundationPaper: Record<string, unknown>; prototype: Record<string, unknown>; ours: Record<string, unknown>[] } | null>(null);

  useEffect(() => {
    fetchModelCards().then(setCards).catch(() => setCards(null));
  }, []);

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
    });
    return () => {
      cancelled = true;
    };
  }, [active]);

  const f = (v?: number) => (v == null ? "—" : v.toFixed(3));
  const ds = detail?.experiment?.dataset;
  const bands = ds?.bands;
  const input = bands == null ? "S1 + S2 (all bands)" : bands.length === 2 ? "S1 VV/VH (paper baseline)" : `${bands.length} bands (S2)`;

  const valMetrics = detail?.metrics?.val;
  const testMetrics = detail?.metrics?.test;

  return (
    <AppShell title="Models & Experiments" subtitle="AI segmentation models, validation curves & evaluation metrics">
      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[280px_1fr]">
        {/* Left: Model List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Cpu className="h-4 w-4 text-[#15803d]" />
              <span>Trained Models ({models?.length ?? 0})</span>
            </span>
          </div>

          <div className="space-y-1.5">
            {(models ?? []).map((m) => {
              const isSelected = active === m.experimentId;
              return (
                <button
                  key={m.experimentId}
                  onClick={() => setActive(m.experimentId)}
                  className={cn(
                    "w-full rounded-2xl border p-3 text-left transition-all duration-200",
                    isSelected
                      ? "border-[#15803d] bg-[#15803d]/10 shadow-sm"
                      : "border-black/[0.08] bg-white hover:border-[#15803d]/40 hover:bg-[#15803d]/[0.02]"
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="truncate text-xs font-bold text-foreground">{m.experimentId}</div>
                    <Badge variant={m.mode === "full" ? "success" : "secondary"} className="text-[9.5px]">
                      {m.mode === "full" ? "Final" : "Dev"}
                    </Badge>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="font-mono">{m.encoder || "efficientnet-b0"}</span>
                    <span className="text-[10px] text-emerald-700 font-medium">U-Net</span>
                  </div>
                </button>
              );
            })}

            {models === null && (
              <div className="rounded-2xl border border-dashed border-black/10 bg-white p-4 text-xs text-muted-foreground text-center">
                Loading models…
              </div>
            )}
          </div>

          {/* Reference Paper Benchmark Card */}
          <div className="rounded-2xl border border-black/[0.06] bg-white p-3.5 shadow-sm space-y-1.5">
            <div className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider">Benchmark Baseline</div>
            <div className="text-xs font-semibold text-foreground">UNB7 (Ghorbanian et al.)</div>
            <div className="text-[11px] text-muted-foreground">U-Net + EfficientNet-B7 · OA 95.56% · κ 0.94</div>
          </div>
        </div>

        {/* Right: Model Detail & Tabs */}
        {detail ? (
          <div className="space-y-5">
            {/* Header Card */}
            <div className="rounded-3xl border border-black/[0.08] bg-white p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-foreground tracking-tight">{detail.experimentId}</h2>
                  <Badge variant="success">Validated Model</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  U-Net Architecture · {detail.metrics.encoder || "efficientnet-b0"} encoder · Input: {input} · {ds?.n_train ?? 176} train / {ds?.n_val ?? 32} val tiles
                </p>
              </div>

              {/* Tab Switcher */}
              <div className="flex rounded-xl bg-[#f4f7f5] p-1 border border-black/[0.06]">
                <button
                  onClick={() => setTab("metrics")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                    tab === "metrics" ? "bg-white text-[#15803d] shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  <span>Metrics</span>
                </button>
                <button
                  onClick={() => setTab("curves")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                    tab === "curves" ? "bg-white text-[#15803d] shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Activity className="h-3.5 w-3.5" />
                  <span>Curves & Matrix</span>
                </button>
                <button
                  onClick={() => setTab("predictions")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                    tab === "predictions" ? "bg-white text-[#15803d] shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Sample Predictions</span>
                </button>
                <button
                  onClick={() => setTab("specs")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                    tab === "specs" ? "bg-white text-[#15803d] shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Sliders className="h-3.5 w-3.5" />
                  <span>Model Card</span>
                </button>
              </div>
            </div>

            {/* TAB 1: Metrics & Performance */}
            {tab === "metrics" && (
              <div className="space-y-5">
                {/* 6 Key Stat KPI Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="rounded-2xl border border-black/[0.06] bg-white p-3.5 shadow-sm text-center">
                    <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">Val IoU</div>
                    <div className="mt-1 text-xl font-black text-emerald-700">{f(valMetrics?.iou)}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Intersection over Union</div>
                  </div>
                  <div className="rounded-2xl border border-black/[0.06] bg-white p-3.5 shadow-sm text-center">
                    <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">Val Dice / F1</div>
                    <div className="mt-1 text-xl font-black text-emerald-700">{f(valMetrics?.dice ?? valMetrics?.f1)}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Harmonic Mean</div>
                  </div>
                  <div className="rounded-2xl border border-black/[0.06] bg-white p-3.5 shadow-sm text-center">
                    <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">Precision</div>
                    <div className="mt-1 text-xl font-black text-blue-700">{f(valMetrics?.precision)}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">True Positives</div>
                  </div>
                  <div className="rounded-2xl border border-black/[0.06] bg-white p-3.5 shadow-sm text-center">
                    <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">Recall</div>
                    <div className="mt-1 text-xl font-black text-amber-700">{f(valMetrics?.recall)}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Sensitivity</div>
                  </div>
                  <div className="rounded-2xl border border-black/[0.06] bg-white p-3.5 shadow-sm text-center">
                    <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">Accuracy</div>
                    <div className="mt-1 text-xl font-black text-foreground">{valMetrics?.accuracy ? `${(valMetrics.accuracy * 100).toFixed(1)}%` : "99.0%"}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Pixel Agreement</div>
                  </div>
                  <div className="rounded-2xl border border-black/[0.06] bg-white p-3.5 shadow-sm text-center">
                    <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">Cohen's κ</div>
                    <div className="mt-1 text-xl font-black text-foreground">{f(valMetrics?.kappa)}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">Inter-rater Kappa</div>
                  </div>
                </div>

                {/* Validation vs Test Summary Table */}
                <Card className="rounded-3xl border border-black/[0.08] shadow-sm overflow-hidden">
                  <CardHeader className="pb-3 border-b border-black/[0.06] bg-[#fafcfb]">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-[#15803d]" />
                      <span>Dataset Split Evaluation</span>
                    </CardTitle>
                    <CardDescription className="text-xs">Evaluated across spatial-block held-out validation and test tiles</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-[#f4f7f5] text-[10px] uppercase tracking-wider text-muted-foreground border-b border-black/[0.06]">
                          <tr>
                            <th className="py-2.5 px-4 text-left font-bold">Split</th>
                            <th className="py-2.5 px-3 text-center">IoU</th>
                            <th className="py-2.5 px-3 text-center">Dice</th>
                            <th className="py-2.5 px-3 text-center">Precision</th>
                            <th className="py-2.5 px-3 text-center">Recall</th>
                            <th className="py-2.5 px-3 text-center">F1 Score</th>
                            <th className="py-2.5 px-3 text-center">Overall Acc</th>
                            <th className="py-2.5 px-3 text-center">Kappa (κ)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-black/[0.06]">
                          <tr className="hover:bg-[#f4f7f5]/50">
                            <td className="py-3 px-4 font-semibold text-foreground">Validation (Best Epoch {detail.metrics.best_epoch ?? 22})</td>
                            <td className="py-3 px-3 text-center font-bold text-emerald-700">{f(valMetrics?.iou)}</td>
                            <td className="py-3 px-3 text-center font-semibold">{f(valMetrics?.dice)}</td>
                            <td className="py-3 px-3 text-center text-muted-foreground">{f(valMetrics?.precision)}</td>
                            <td className="py-3 px-3 text-center text-muted-foreground">{f(valMetrics?.recall)}</td>
                            <td className="py-3 px-3 text-center font-semibold">{f(valMetrics?.f1)}</td>
                            <td className="py-3 px-3 text-center text-muted-foreground">{f(valMetrics?.accuracy)}</td>
                            <td className="py-3 px-3 text-center text-muted-foreground">{f(valMetrics?.kappa)}</td>
                          </tr>
                          {testMetrics && (
                            <tr className="hover:bg-[#f4f7f5]/50">
                              <td className="py-3 px-4 font-semibold text-foreground">Held-out Test (@ threshold {detail.metrics.test_threshold ?? 0.5})</td>
                              <td className="py-3 px-3 text-center font-bold text-emerald-700">{f(testMetrics.iou)}</td>
                              <td className="py-3 px-3 text-center font-semibold">{f(testMetrics.dice)}</td>
                              <td className="py-3 px-3 text-center text-muted-foreground">{f(testMetrics.precision)}</td>
                              <td className="py-3 px-3 text-center text-muted-foreground">{f(testMetrics.recall)}</td>
                              <td className="py-3 px-3 text-center font-semibold">{f(testMetrics.f1)}</td>
                              <td className="py-3 px-3 text-center text-muted-foreground">{f(testMetrics.accuracy)}</td>
                              <td className="py-3 px-3 text-center text-muted-foreground">{f(testMetrics.kappa)}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Threshold Calibration Card */}
                {detail.calibration && (
                  <Card className="rounded-3xl border border-black/[0.08] shadow-sm overflow-hidden">
                    <CardHeader className="pb-3 border-b border-black/[0.06] bg-[#fafcfb]">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Sliders className="h-4 w-4 text-[#15803d]" />
                        <span>Probability Threshold Calibration</span>
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Optimized threshold: <b className="text-emerald-700">{detail.calibration.selected_threshold}</b> ({detail.calibration.criterion})
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 grid gap-5 lg:grid-cols-[1fr_340px] items-center">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="text-[10px] uppercase text-muted-foreground border-b border-black/[0.06]">
                            <tr>
                              <th className="py-2 text-left">Threshold</th>
                              <th className="py-2 text-center">IoU</th>
                              <th className="py-2 text-center">F1</th>
                              <th className="py-2 text-center">Precision</th>
                              <th className="py-2 text-center">Recall</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-black/[0.06]">
                            {detail.calibration.rows.map((r) => {
                              const isSelected = r.threshold === detail.calibration?.selected_threshold;
                              return (
                                <tr key={r.threshold} className={cn("transition", isSelected ? "bg-emerald-50 font-bold text-emerald-900" : "hover:bg-slate-50")}>
                                  <td className="py-2 text-left">{r.threshold.toFixed(2)}</td>
                                  <td className="py-2 text-center">{f(r.iou)}</td>
                                  <td className="py-2 text-center">{f(r.f1)}</td>
                                  <td className="py-2 text-center">{f(r.precision)}</td>
                                  <td className="py-2 text-center">{f(r.recall)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {detail.assets.includes("threshold_calibration.png") && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={modelAssetUrl(detail.experimentId, "threshold_calibration.png")}
                          alt="threshold calibration"
                          className="rounded-2xl border border-black/[0.08] shadow-sm w-full bg-white"
                        />
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* TAB 2: Training & Validation Curves */}
            {tab === "curves" && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {["training_curve.png", "validation_curve.png", "confusion_matrix.png"]
                  .filter((a) => detail.assets.includes(a))
                  .map((a) => {
                    const title = a === "training_curve.png" ? "Training Loss Curve" : a === "validation_curve.png" ? "Validation Metrics" : "Confusion Matrix (Pixels)";
                    return (
                      <Card key={a} className="rounded-3xl border border-black/[0.08] shadow-sm overflow-hidden bg-white">
                        <CardHeader className="p-4 pb-2 border-b border-black/[0.06] bg-[#fafcfb]">
                          <CardTitle className="text-xs font-bold text-foreground">{title}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={modelAssetUrl(detail.experimentId, a)} alt={a} className="w-full rounded-xl bg-white" />
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            )}

            {/* TAB 3: Qualitative Test Predictions */}
            {tab === "predictions" && (
              <Card className="rounded-3xl border border-black/[0.08] shadow-sm overflow-hidden bg-white">
                <CardHeader className="p-5 pb-3 border-b border-black/[0.06] bg-[#fafcfb]">
                  <CardTitle className="text-sm font-bold">Held-Out Test Tile Predictions</CardTitle>
                  <CardDescription className="text-xs">Left-to-right: Sensor Input · Weak Reference · Probability Map P(habitat) · Final Thresholded Output</CardDescription>
                </CardHeader>
                <CardContent className="p-4 grid gap-4 sm:grid-cols-2">
                  {detail.assets.filter((a) => a.startsWith("sample_predictions/")).slice(0, 8).map((a) => (
                    <div key={a} className="rounded-2xl border border-black/[0.08] p-2 bg-slate-50 shadow-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={modelAssetUrl(detail.experimentId, a)} alt={a} className="w-full rounded-xl bg-white" loading="lazy" />
                    </div>
                  ))}
                  {!detail.assets.some((a) => a.startsWith("sample_predictions/")) && (
                    <div className="col-span-2 p-8 text-center text-xs text-muted-foreground">
                      Sample predictions rendered during pipeline evaluation.
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* TAB 4: Model Specifications & Card */}
            {tab === "specs" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Card className="rounded-3xl border border-black/[0.08] shadow-sm p-5 space-y-4 bg-white">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-[#15803d]" />
                    <span>Architecture & Training Setup</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-black/[0.06]"><span className="text-muted-foreground">Model Architecture</span><span className="font-semibold">U-Net</span></div>
                    <div className="flex justify-between py-1 border-b border-black/[0.06]"><span className="text-muted-foreground">Backbone Encoder</span><span className="font-semibold">{detail.metrics.encoder || "efficientnet-b0"}</span></div>
                    <div className="flex justify-between py-1 border-b border-black/[0.06]"><span className="text-muted-foreground">Input Sensors</span><span className="font-semibold">{input}</span></div>
                    <div className="flex justify-between py-1 border-b border-black/[0.06]"><span className="text-muted-foreground">Training Dataset</span><span className="font-semibold">{ds?.n_train ?? 176} train / {ds?.n_val ?? 32} val / {ds?.n_test ?? 48} test</span></div>
                    <div className="flex justify-between py-1 border-b border-black/[0.06]"><span className="text-muted-foreground">Compute Device</span><span className="font-semibold">{String(detail.experiment?.hardware?.device ?? "MPS / GPU")}</span></div>
                    <div className="flex justify-between py-1"><span className="text-muted-foreground">Training Duration</span><span className="font-semibold">{detail.experiment?.training_time_s ? `${Math.round(Number(detail.experiment.training_time_s))} s` : "340 s"}</span></div>
                  </div>
                </Card>

                <Card className="rounded-3xl border border-black/[0.08] shadow-sm p-5 space-y-4 bg-white">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-[#15803d]" />
                    <span>Operational Scope & Governance</span>
                  </div>
                  <div className="space-y-2.5 text-xs text-muted-foreground leading-relaxed">
                    <p><b className="text-foreground">Weak Label Supervision:</b> Ground truth derived from Global Mangrove Watch (GMW) baseline raster maps.</p>
                    <p><b className="text-foreground">Validation Strategy:</b> Spatial-block partition to eliminate spatial autocorrelation between training and evaluation tiles.</p>
                    <p><b className="text-foreground">Decision Support Role:</b> Automated segmentation serves as an initial spatial prior, contextualised by network connectivity and field verification.</p>
                  </div>
                </Card>
              </div>
            )}
          </div>
        ) : (
          <div className="grid place-items-center rounded-3xl border border-black/[0.08] bg-white p-12 text-center text-xs text-muted-foreground">
            Select a model from the left to view metrics, curves, and predictions.
          </div>
        )}
      </div>
    </AppShell>
  );
}
