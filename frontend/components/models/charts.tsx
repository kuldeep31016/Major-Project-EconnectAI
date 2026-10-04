"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Area, CartesianGrid, ComposedChart, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Activity, Grid2x2, LineChart as LineIcon, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { GLASS } from "./model-list";
import { fmt } from "./metrics";

export function ChartCard({ icon: Icon, title, caption, right, children, className }: {
  icon: typeof Activity; title: string; caption?: string; right?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <div className={cn(GLASS, "flex flex-col p-5", className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#dcfce7] text-[#15803d]"><Icon className="h-4 w-4" /></span>
          <div>
            <div className="text-[14px] font-semibold text-foreground">{title}</div>
            {caption && <div className="text-[11.5px] text-muted-foreground">{caption}</div>}
          </div>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

const AXIS = { fontSize: 11, fill: "#64748b" };
const GRID = "rgba(15,81,50,0.08)";
const TOOLTIP_STYLE = {
  contentStyle: { borderRadius: 12, border: "1px solid rgba(15,81,50,0.12)", boxShadow: "0 12px 28px -14px rgba(15,60,40,0.35)", fontSize: 12, padding: "8px 10px" },
  labelStyle: { fontWeight: 600, color: "#0f172a", marginBottom: 2 },
  itemStyle: { padding: 0 },
};
const LEGEND = { wrapperStyle: { fontSize: 11.5, paddingTop: 6 }, iconType: "circle" as const, iconSize: 8 };

type Row = Record<string, number>;

/** Parse the CSV-derived training history (strings) into numbers; drops unparsable cells. */
export function parseHistory(h?: Record<string, string>[]): Row[] {
  return (h ?? []).map((r) => {
    const o: Row = {};
    for (const [k, v] of Object.entries(r)) { const n = Number(v); if (v !== "" && Number.isFinite(n)) o[k] = n; }
    return o;
  }).filter((r) => r.epoch != null);
}

export function LossChart({ rows, bestEpoch }: { rows: Row[]; bestEpoch?: number }) {
  return (
    <ChartCard icon={LineIcon} title="Training loss" caption="Lower is better · both lines should fall together">
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
            <defs>
              <linearGradient id="lossFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#16a34a" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="epoch" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={14} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => v.toFixed(2)} />
            <Tooltip {...TOOLTIP_STYLE} labelFormatter={(l) => `Epoch ${l}`} formatter={(v) => (typeof v === "number" ? v.toFixed(4) : String(v))} />
            <Legend {...LEGEND} />
            {bestEpoch != null && <ReferenceLine x={bestEpoch} stroke="#15803d" strokeDasharray="4 4" label={{ value: "best", position: "insideTopRight", fill: "#15803d", fontSize: 10.5 }} />}
            <Area type="monotone" dataKey="train_loss" name="Train loss" stroke="#166534" strokeWidth={2.2} fill="url(#lossFill)" dot={false} activeDot={{ r: 4 }} />
            <Line type="monotone" dataKey="val_loss" name="Validation loss" stroke="#4ade80" strokeWidth={2.2} strokeDasharray="5 3" dot={false} activeDot={{ r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

const VAL_SERIES: [string, string, string][] = [
  ["val_iou", "IoU", "#15803d"], ["val_f1", "F1", "#22c55e"], ["val_precision", "Precision", "#0e7490"], ["val_recall", "Recall", "#ca8a04"],
];

export function ValidationChart({ rows, bestEpoch }: { rows: Row[]; bestEpoch?: number }) {
  const series = VAL_SERIES.filter(([k]) => rows.some((r) => r[k] != null));
  return (
    <ChartCard icon={Activity} title="Validation scores per epoch" caption="Higher is better · habitat class vs GMW">
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="epoch" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={14} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => v.toFixed(2)} />
            <Tooltip {...TOOLTIP_STYLE} labelFormatter={(l) => `Epoch ${l}`} formatter={(v) => (typeof v === "number" ? v.toFixed(3) : String(v))} />
            <Legend {...LEGEND} />
            {bestEpoch != null && <ReferenceLine x={bestEpoch} stroke="#15803d" strokeDasharray="4 4" label={{ value: "best", position: "insideTopRight", fill: "#15803d", fontSize: 10.5 }} />}
            {series.map(([k, name, color], i) => (
              <Line key={k} type="monotone" dataKey={k} name={name} stroke={color} strokeWidth={i === 0 ? 2.6 : 1.8} dot={false} activeDot={{ r: 4 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

type CM = number[][] | undefined;

/** 2×2 pixel confusion matrix; rows = GMW reference, columns = model prediction. */
export function ConfusionMatrix({ val, test, aside }: { val: CM; test: CM; aside?: ReactNode }) {
  const options = ([["val", "Validation", val], ["test", "Test", test]] as const).filter(([, , m]) => Array.isArray(m) && m.length === 2);
  const [which, setWhich] = useState<"val" | "test">(options[0]?.[0] ?? "val");
  const cm = (which === "test" ? test : val) ?? options[0]?.[2];
  const total = cm ? cm.flat().reduce((a, b) => a + b, 0) : 0;
  const rowTotals = cm?.map((r) => r[0] + r[1]) ?? [];

  const cells = cm ? [
    { r: 0, c: 0, label: "Correct non-habitat", short: "TN", good: true },
    { r: 0, c: 1, label: "False alarm", short: "FP", good: false },
    { r: 1, c: 0, label: "Missed habitat", short: "FN", good: false },
    { r: 1, c: 1, label: "Found habitat", short: "TP", good: true },
  ] : [];

  return (
    <ChartCard
      icon={Grid2x2}
      title="Confusion matrix (pixels)"
      caption="Rows = GMW reference · columns = model · shade = share of the row"
      className="xl:col-span-2"
      right={options.length > 1 ? (
        <div className="flex rounded-full border border-black/[0.06] bg-black/[0.03] p-0.5 text-[11px]">
          {options.map(([k, l]) => (
            <button key={k} onClick={() => setWhich(k)} className={cn("rounded-full px-2.5 py-1 font-semibold transition", which === k ? "bg-white text-[#15803d] shadow-sm" : "text-muted-foreground hover:text-foreground")}>{l}</button>
          ))}
        </div>
      ) : undefined}
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      {cm ? (
        <div className="grid grid-cols-[88px_1fr_1fr] gap-2 text-[11px]">
          <div />
          <div className="text-center font-semibold text-muted-foreground">Predicted non-habitat</div>
          <div className="text-center font-semibold text-muted-foreground">Predicted habitat</div>
          {[0, 1].map((r) => (
            <div key={r} className="contents">
              <div className="flex items-center justify-end pr-1 text-right font-semibold leading-tight text-muted-foreground">
                GMW {r === 0 ? "non-habitat" : "habitat"}
              </div>
              {cells.filter((x) => x.r === r).map((x) => {
                const v = cm[x.r][x.c];
                const share = rowTotals[x.r] ? v / rowTotals[x.r] : 0;
                const alpha = 0.08 + share * 0.8;
                return (
                  <div
                    key={x.short}
                    className="flex min-h-[92px] flex-col justify-between rounded-xl border p-3"
                    style={{
                      background: x.good ? `rgba(21,128,61,${alpha})` : `rgba(217,119,6,${alpha * 0.85})`,
                      borderColor: x.good ? "rgba(21,128,61,0.18)" : "rgba(217,119,6,0.2)",
                      color: share > 0.55 ? "#fff" : "#0f172a",
                    }}
                  >
                    <div className="flex items-center justify-between gap-2 text-[11.5px] font-semibold opacity-90">
                      <span className="truncate">{x.label}</span><span className="font-mono text-[10px] opacity-75">{x.short}</span>
                    </div>
                    <div>
                      <div className="text-[20px] font-bold tabular-nums leading-tight">{v.toLocaleString()}</div>
                      <div className="text-[10.5px] opacity-80" title={total ? `${((v / total) * 100).toFixed(2)}% of all pixels` : undefined}>{(share * 100).toFixed(1)}% of this row</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <p className="py-8 text-center text-[12px] text-muted-foreground">No confusion matrix recorded for this run.</p>
      )}
      {aside}
      </div>
    </ChartCard>
  );
}

export interface CalibrationData { selected_threshold: number; criterion: string; scope: string; rows: { threshold: number; iou: number; f1: number; precision: number; recall: number }[] }

export function CalibrationChart({ cal }: { cal: CalibrationData }) {
  const rows = useMemo(() => [...cal.rows].sort((a, b) => a.threshold - b.threshold), [cal.rows]);
  const best = rows.find((r) => r.threshold === cal.selected_threshold);
  return (
    <ChartCard
      icon={SlidersHorizontal}
      title="Probability threshold calibration"
      caption={`Picked ${cal.selected_threshold} by best ${cal.criterion.toUpperCase()} · ${cal.scope}`}
      className="xl:col-span-2"
    >
      <div className="grid items-center gap-5 xl:grid-cols-[1fr_300px]">
        <div className="h-[230px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="threshold" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} tickFormatter={(v: number) => v.toFixed(2)} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => v.toFixed(2)} />
              <Tooltip {...TOOLTIP_STYLE} labelFormatter={(l) => `Threshold ${Number(l).toFixed(2)}`} formatter={(v) => (typeof v === "number" ? v.toFixed(3) : String(v))} />
              <Legend {...LEGEND} />
              <ReferenceLine x={cal.selected_threshold} stroke="#15803d" strokeDasharray="4 4" label={{ value: "picked", position: "insideTopRight", fill: "#15803d", fontSize: 10.5 }} />
              <Line type="monotone" dataKey="f1" name="F1" stroke="#22c55e" strokeWidth={2.4} dot={{ r: 2.5 }} />
              <Line type="monotone" dataKey="iou" name="IoU" stroke="#15803d" strokeWidth={2} dot={{ r: 2.5 }} />
              <Line type="monotone" dataKey="precision" name="Precision" stroke="#0e7490" strokeWidth={1.6} dot={false} />
              <Line type="monotone" dataKey="recall" name="Recall" stroke="#ca8a04" strokeWidth={1.6} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="max-h-[230px] overflow-auto rounded-xl border border-black/[0.05]">
          <table className="w-full text-[11.5px]">
            <thead className="sticky top-0 bg-[#f6faf7] text-[9.5px] uppercase tracking-wider text-muted-foreground">
              <tr><th className="px-2.5 py-2 text-left">Thr.</th><th className="px-2 py-2 text-right">IoU</th><th className="px-2 py-2 text-right">F1</th><th className="px-2 py-2 text-right">Prec.</th><th className="px-2.5 py-2 text-right">Recall</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.threshold} className={cn("border-t border-black/[0.04] tabular-nums", r === best ? "bg-[#dcfce7]/70 font-semibold text-[#0f5132]" : "text-[#334155]")}>
                  <td className="px-2.5 py-1.5">{r.threshold.toFixed(2)}</td>
                  <td className="px-2 py-1.5 text-right">{fmt(r.iou)}</td>
                  <td className="px-2 py-1.5 text-right">{fmt(r.f1)}</td>
                  <td className="px-2 py-1.5 text-right">{fmt(r.precision)}</td>
                  <td className="px-2.5 py-1.5 text-right">{fmt(r.recall)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ChartCard>
  );
}
