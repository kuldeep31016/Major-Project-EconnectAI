"use client";

import { useEffect, useState } from "react";
import { Cpu } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchModels, type ModelInfo } from "@/lib/api";

/**
 * Segmentation experiments found under outputs/segmentation/ (backend /api/models).
 * Shows each run's own label; never shows a number that was not measured.
 */
export function ModelsPanel() {
  const [models, setModels] = useState<ModelInfo[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchModels()
      .then((m) => {
        if (!cancelled) setModels(m);
      })
      .catch(() => {
        if (!cancelled) setModels(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const fmt = (v?: number) => (v == null ? "—" : v.toFixed(3));
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-[#38bdf8]" />
          Segmentation models
        </CardTitle>
        <CardDescription>
          {models === null
            ? "Backend offline — no trained model information available"
            : models.length === 0
              ? "No segmentation experiment has been run yet (EcoConnectAI accuracy: NOT AVAILABLE)"
              : "Agreement with the GMW weak label on held-out test tiles — not field-truth accuracy"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {models === null || models.length === 0 ? (
          <div className="rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-3 text-[11px] leading-relaxed text-muted-foreground">
            Published baseline (Ghorbanian et al. 2025, their data, their model): UNB7 OA 95.56 %, κ 0.94 — <b>NOT OUR RESULT</b>.
          </div>
        ) : (
          models.map((m) => (
            <div key={m.experimentId} className="rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-semibold">{m.experimentId}</div>
                  <div className="truncate text-[10.5px] text-muted-foreground">
                    {m.model ?? "U-Net"} · {m.encoder ?? "?"} · best epoch {m.best_epoch ?? "—"}
                  </div>
                </div>
                <Badge variant={m.mode === "full" ? "success" : "secondary"}>
                  {m.mode === "full" ? "our experimental result" : "dev · not final"}
                </Badge>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2 text-center">
                {(["iou", "dice", "precision", "recall"] as const).map((k) => (
                  <div key={k} className="rounded-lg bg-foreground/[0.04] px-1.5 py-1.5">
                    <div className="text-[8.5px] uppercase tracking-wider text-muted-foreground">
                      test {k}
                    </div>
                    <div className="text-[12px] font-semibold tabular">{fmt(m.test?.[k])}</div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
