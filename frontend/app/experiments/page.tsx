"use client";

import { useEffect, useState } from "react";
import { Cpu, FlaskConical } from "lucide-react";
import { AppShell } from "@/components/dashboard/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchModels, fetchModelDetail, fetchModelCards, modelAssetUrl, type ModelInfo, type ModelDetail } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Real segmentation experiments (outputs/segmentation): metrics, calibration, curves, qualitative panels. */
export default function ExperimentsPage() {
  const [models, setModels] = useState<ModelInfo[] | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [detail, setDetail] = useState<ModelDetail | null>(null);
  const [cards, setCards] = useState<{ foundationPaper: Record<string, unknown>; prototype: Record<string, unknown>; ours: Record<string, unknown>[] } | null>(null);
  useEffect(() => { fetchModelCards().then(setCards).catch(() => setCards(null)); }, []);

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

  return (
    <AppShell title="Experiments" subtitle="Segmentation models — agreement with the GMW weak label, never field-truth accuracy">
      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[300px_1fr]">
        <Card className="h-fit">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2"><Cpu className="h-4 w-4 text-[#1e5f8a]" />Trained models</CardTitle>
            <CardDescription>
              {models === null ? "Backend offline" : models.length === 0 ? "No experiment has been run (NOT AVAILABLE)" : `${models.length} experiment${models.length === 1 ? "" : "s"} in outputs/segmentation`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {(models ?? []).map((m) => (
              <button
                key={m.experimentId}
                onClick={() => setActive(m.experimentId)}
                className={cn(
                  "w-full rounded-xl border px-3 py-2 text-left text-[12px] transition",
                  active === m.experimentId ? "border-[#1e5f8a]/50 bg-[#1e5f8a]/10" : "border-foreground/[0.08] hover:bg-foreground/[0.04]",
                )}
              >
                <div className="truncate font-semibold">{m.experimentId}</div>
                <div className="mt-0.5 flex items-center justify-between text-[10.5px] text-muted-foreground">
                  <span>{m.encoder}</span>
                  <Badge variant={m.mode === "full" ? "success" : "secondary"}>{m.mode === "full" ? "final" : "dev · not final"}</Badge>
                </div>
              </button>
            ))}
            <div className="rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2 text-[10.5px] leading-relaxed text-muted-foreground">
              Published baseline (foundation study, their data): UNB7 OA 95.56 %, κ 0.94 — <b>NOT OUR RESULT</b>.
            </div>
          </CardContent>
        </Card>

        {detail && (
          <div className="space-y-4">
            {cards && (() => {
              const ours = cards.ours.find((c) => c.id === detail.experimentId) as Record<string, unknown> | undefined;
              const card = (ours?.card ?? {}) as Record<string, unknown>;
              return (
                <Card>
                  <CardHeader className="pb-2"><CardTitle>AI model card</CardTitle><CardDescription>Categories are never mixed: foundation-paper result · prototype · our experimental/development result</CardDescription></CardHeader>
                  <CardContent className="grid gap-3 text-[12px] md:grid-cols-3">
                    <div className="rounded-xl border border-foreground/[0.08] p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Foundation paper result — NOT OURS</div><div className="mt-1 font-semibold">{String(cards.foundationPaper.name)}</div><div className="text-muted-foreground">{String(cards.foundationPaper.architecture)} · {String(cards.foundationPaper.input)}</div><div className="mt-1">OA 95.56 % · κ 0.94 · F1 0.95 (their data)</div></div>
                    <div className="rounded-xl border border-foreground/[0.08] p-3"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Prototype / demonstration</div><div className="mt-1 font-semibold">{String(cards.prototype.name)}</div><div className="text-muted-foreground">{String(cards.prototype.note)}</div></div>
                    <div className="rounded-xl border border-[#0f5132]/30 bg-[#0f5132]/[0.04] p-3"><div className="text-[10px] uppercase tracking-wider text-[#0f5132]">This model — {String(ours?.result_label ?? "")}</div>
                      <div className="mt-1">{String(ours?.architecture ?? "U-Net")} · {String(ours?.encoder ?? "")} · bands {JSON.stringify(ours?.input_bands ?? null)}</div>
                      <div className="text-muted-foreground">label source: {String(card.label_source ?? "")}</div><div className="text-muted-foreground">validation: {String(card.validation ?? "")}</div>
                      <div className="text-muted-foreground">trained {String(ours?.trained_at ?? "").slice(0, 19)} on {String((ours?.hardware as Record<string, unknown> | undefined)?.device ?? "")}</div>
                      <div className="mt-1">limitations: {((card.known_limitations as string[]) ?? []).join("; ")}</div></div>
                  </CardContent>
                </Card>
              );
            })()}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2"><FlaskConical className="h-4 w-4 text-[#6d5bd0]" />{detail.experimentId}</CardTitle>
                <CardDescription>
                  {detail.metrics.result_label} · {detail.metrics.model} · input: {input} · train/val/test {ds?.n_train ?? "—"}/{ds?.n_val ?? "—"}/{ds?.n_test ?? "—"} tiles ·{" "}
                  {String(detail.experiment?.hardware?.device ?? "")}
                  {detail.experiment?.training_time_s != null ? ` · ${Math.round(Number(detail.experiment.training_time_s))} s` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <table className="w-full text-[12px]">
                  <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr><th className="py-1 text-left">split</th><th>IoU</th><th>Dice</th><th>Precision</th><th>Recall</th><th>F1</th><th>OA</th><th>κ</th></tr>
                  </thead>
                  <tbody className="tabular">
                    {(["val", "test"] as const).map((sp) => {
                      const m = detail.metrics[sp] ?? undefined;
                      return (
                        <tr key={sp} className="border-t border-foreground/[0.06] text-center">
                          <td className="py-1.5 text-left">
                            {sp === "val" ? `validation (best epoch ${detail.metrics.best_epoch ?? "—"})` : `test${detail.metrics.test_threshold != null ? ` @ ${detail.metrics.test_threshold}` : ""}`}
                          </td>
                          <td>{f(m?.iou)}</td><td>{f(m?.dice)}</td><td>{f(m?.precision)}</td><td>{f(m?.recall)}</td><td>{f(m?.f1)}</td><td>{f(m?.accuracy)}</td><td>{f(m?.kappa)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="mt-2 text-[10.5px] text-muted-foreground">
                  Overall accuracy is inflated by the rare-class imbalance (≈ 0.2 % mangrove pixels in Vembanad); read IoU / Dice / precision / recall.
                </p>
              </CardContent>
            </Card>

            {detail.calibration && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>Threshold calibration</CardTitle>
                  <CardDescription>{detail.calibration.scope} · criterion {detail.calibration.criterion} · selected <b>{detail.calibration.selected_threshold}</b></CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-[1fr_320px]">
                  <table className="w-full text-[11.5px]">
                    <thead className="text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="text-left">thr</th><th>IoU</th><th>F1</th><th>P</th><th>R</th></tr></thead>
                    <tbody className="tabular">
                      {detail.calibration.rows.map((r) => (
                        <tr key={r.threshold} className={cn("border-t border-foreground/[0.06] text-center", r.threshold === detail.calibration!.selected_threshold && "bg-[#15803d]/10")}>
                          <td className="py-1 text-left">{r.threshold.toFixed(2)}</td><td>{f(r.iou)}</td><td>{f(r.f1)}</td><td>{f(r.precision)}</td><td>{f(r.recall)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {detail.assets.includes("threshold_calibration.png") && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={modelAssetUrl(detail.experimentId, "threshold_calibration.png")} alt="threshold calibration" className="rounded-xl border border-foreground/[0.08] bg-white" />
                  )}
                </CardContent>
              </Card>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              {["training_curve.png", "validation_curve.png", "confusion_matrix.png"].filter((a) => detail.assets.includes(a)).map((a) => (
                <Card key={a}>
                  <CardContent className="p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={modelAssetUrl(detail.experimentId, a)} alt={a} className="w-full rounded-lg bg-white" />
                    <div className="mt-1 text-center text-[10.5px] text-muted-foreground">{a.replace(".png", "").replace(/_/g, " ")}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Qualitative predictions</CardTitle>
                <CardDescription>input · ground truth (weak label) · P(habitat) · prediction ≥ threshold — held-out test tiles</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {detail.assets.filter((a) => a.startsWith("sample_predictions/")).slice(0, 8).map((a) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={a} src={modelAssetUrl(detail.experimentId, a)} alt={a} className="w-full rounded-lg bg-white" loading="lazy" />
                ))}
                {!detail.assets.some((a) => a.startsWith("sample_predictions/")) && (
                  <div className="text-[12px] text-muted-foreground">Run scripts/evaluate.py to generate panels.</div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}
