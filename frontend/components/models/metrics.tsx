"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ChevronDown, FileSpreadsheet, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { GLASS } from "./model-list";

type M = Record<string, unknown> | null | undefined;

const num = (m: M, k: string): number | undefined => {
  const v = m?.[k];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
};
export const fmt = (v?: number | null, d = 3) => (v == null ? "—" : v.toFixed(d));
const pct = (v?: number) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);

/** Share of pixels that GMW marks as habitat, from the real confusion matrix ([[TN,FP],[FN,TP]], rows = reference). */
export function habitatShare(m: M): number | undefined {
  const cm = m?.confusion_matrix as number[][] | undefined;
  if (!Array.isArray(cm) || cm.length !== 2) return undefined;
  const total = cm[0][0] + cm[0][1] + cm[1][0] + cm[1][1];
  return total ? (cm[1][0] + cm[1][1]) / total : undefined;
}

interface Tile { key: string; label: string; value?: number; display: string; caption: string; tone: string; bar: string }

export function MetricTiles({ val, bestEpoch }: { val: M; bestEpoch?: number }) {
  const reduce = useReducedMotion();
  const share = habitatShare(val);
  const tiles: Tile[] = [
    { key: "iou", label: "Val IoU", value: num(val, "iou"), display: fmt(num(val, "iou")), caption: "Overlap with GMW habitat", tone: "text-[#15803d]", bar: "bg-[#15803d]" },
    { key: "dice", label: "Val Dice / F1", value: num(val, "dice") ?? num(val, "f1"), display: fmt(num(val, "dice") ?? num(val, "f1")), caption: "Balance of precision & recall", tone: "text-[#0f766e]", bar: "bg-[#14b8a6]" },
    { key: "precision", label: "Precision", value: num(val, "precision"), display: fmt(num(val, "precision")), caption: "Predicted habitat GMW agrees with", tone: "text-[#1e5f8a]", bar: "bg-[#3b82f6]" },
    { key: "recall", label: "Recall", value: num(val, "recall"), display: fmt(num(val, "recall")), caption: "GMW habitat the model found", tone: "text-[#b45309]", bar: "bg-[#f59e0b]" },
    {
      key: "accuracy", label: "Accuracy", value: num(val, "accuracy"), display: pct(num(val, "accuracy")),
      caption: share != null ? `Inflated: only ${(share * 100).toFixed(1)}% of pixels are habitat` : "All pixels, incl. easy non-habitat",
      tone: "text-[#334155]", bar: "bg-[#64748b]",
    },
    { key: "kappa", label: "Cohen's κ", value: num(val, "kappa"), display: fmt(num(val, "kappa")), caption: "Agreement beyond chance", tone: "text-[#6d28d9]", bar: "bg-[#8b5cf6]" },
  ];

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between px-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#3f5b4c]">Validation · best epoch {bestEpoch ?? "—"}</span>
        <span className="text-[10.5px] text-muted-foreground">vs GMW weak labels, not field truth</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {tiles.map((t, i) => (
          <motion.div
            key={t.key}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
            className={cn(GLASS, "flex flex-col p-4")}
          >
            <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{t.label}</div>
            <div className={cn("mt-1.5 text-[26px] font-bold leading-none tracking-tight tabular-nums", t.value == null ? "text-muted-foreground/60" : t.tone)}>{t.display}</div>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-black/[0.06]">
              {t.value != null && (
                <motion.div
                  className={cn("h-full rounded-full", t.bar)}
                  initial={reduce ? false : { width: 0 }}
                  animate={{ width: `${Math.max(2, Math.min(100, t.value * 100))}%` }}
                  transition={{ delay: 0.15 + i * 0.05, duration: 0.6, ease: "easeOut" }}
                />
              )}
            </div>
            <div className="mt-2 text-[10.5px] leading-snug text-muted-foreground">{t.value == null ? "Not recorded for this run" : t.caption}</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

const DEFS: [string, string][] = [
  ["Weak labels", "The \"answer key\" is the Global Mangrove Watch map, itself a model output. Scores show agreement with GMW, not with what is on the ground."],
  ["IoU", "Of all pixels that either the model or GMW call habitat, the share both agree on. 1 = perfect overlap."],
  ["Dice / F1", "A single score that is high only when precision and recall are both high."],
  ["Precision", "Of the pixels the model calls habitat, the share GMW also calls habitat (few false alarms = high)."],
  ["Recall", "Of the pixels GMW calls habitat, the share the model found (few misses = high)."],
  ["Accuracy", "Share of all pixels classified the same as GMW. Because almost every pixel is non-habitat, this looks high even for a weak model — read IoU and κ instead."],
  ["Cohen's κ", "Agreement after removing what random guessing would get. 0 = no better than chance, 1 = perfect."],
  ["Splits", "Tiles are split into spatial blocks, so validation and test tiles come from different places than training tiles. The best epoch is picked on validation; test is touched once at the end."],
];

export function HowMeasured() {
  return (
    <details className={cn(GLASS, "group px-4 py-3 [&_summary::-webkit-details-marker]:hidden")}>
      <summary className="flex cursor-pointer list-none items-center gap-2 text-[12.5px] font-semibold text-[#0f5132]">
        <Info className="h-4 w-4" /> How are these measured?
        <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <dl className="mt-3 grid gap-x-6 gap-y-2.5 text-[12px] sm:grid-cols-2">
        {DEFS.map(([k, v]) => (
          <div key={k}>
            <dt className="font-semibold text-foreground">{k}</dt>
            <dd className="leading-relaxed text-muted-foreground">{v}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

const COLS: [string, string][] = [["iou", "IoU"], ["dice", "Dice"], ["precision", "Precision"], ["recall", "Recall"], ["f1", "F1"], ["accuracy", "Overall Acc"], ["kappa", "Kappa"]];

export function SplitTable({ val, test, bestEpoch, testThreshold, nTestTiles }: { val: M; test: M; bestEpoch?: number; testThreshold?: number; nTestTiles?: number }) {
  const rows: { name: string; sub: string; m: M }[] = [
    { name: "Validation", sub: `best epoch ${bestEpoch ?? "—"}`, m: val },
    { name: "Held-out test", sub: test ? `threshold ${testThreshold ?? num(test, "threshold") ?? 0.5}${nTestTiles ? ` · ${nTestTiles} tiles` : ""}` : "not evaluated yet", m: test },
  ];
  return (
    <div className={cn(GLASS, "overflow-hidden")}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.05] px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#dcfce7] text-[#15803d]"><FileSpreadsheet className="h-4 w-4" /></span>
          <div>
            <div className="text-[14px] font-semibold text-foreground">Dataset split evaluation</div>
            <div className="text-[11.5px] text-muted-foreground">Habitat class, scored against GMW weak labels on spatially separate tiles</div>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[12.5px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              <th className="px-5 py-2.5 text-left font-bold">Split</th>
              {COLS.map(([, l]) => <th key={l} className="px-3 py-2.5 text-right font-bold">{l}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className="border-t border-black/[0.05] transition-colors hover:bg-[#f0fdf4]/60">
                <td className="px-5 py-3">
                  <div className="font-semibold text-foreground">{r.name}</div>
                  <div className="text-[10.5px] text-muted-foreground">{r.sub}</div>
                </td>
                {COLS.map(([k]) => {
                  const v = num(r.m, k);
                  return (
                    <td key={k} className={cn("px-3 py-3 text-right tabular-nums", v == null ? "text-muted-foreground/60" : k === "iou" ? "font-bold text-[#15803d]" : "text-[#334155]")}>
                      {k === "accuracy" ? pct(v) : fmt(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
