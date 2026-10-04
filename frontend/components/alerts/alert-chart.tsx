"use client";

import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AlertItem } from "@/lib/api";
import { fmt, fmtHa, num, sci } from "./alert-meta";

type Row = { name: string; value: number; label: string; detail: string; color: string };
export type AlertChart =
  | { kind: "bars"; title: string; caption: string; rows: Row[]; max?: number }
  | { kind: "share"; title: string; caption: string; part: number; partLabel: string; restLabel: string; color: string; center: string };

const asObj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

/** Charts built ONLY from the alert's own stored numbers. Empty list = nothing chartable (button hidden). */
export function chartsFor(a: AlertItem): AlertChart[] {
  const ev = a.evidence ?? {};
  const out: AlertChart[] = [];
  const crit = asObj(ev.criticality);
  const cand = asObj(ev.restoration) ?? asObj(ev.candidate);
  const src = crit ?? cand;
  const cb = num(src?.c_before), ca = num(src?.c_after);
  if (cb != null && ca != null && cb > 0) {
    const after = (100 * ca) / cb;
    const id = String(crit?.patch_id ?? cand?.candidate_id ?? a.object_id ?? "");
    out.push({
      kind: "bars",
      title: crit ? `Network connectivity without ${id}` : `Network connectivity with ${id} restored`,
      caption: "IIC indexed to today = 100. Hover a bar for the stored value.",
      rows: [
        { name: "Today", value: 100, label: "100", detail: `IIC ${sci(cb)}`, color: "#94a3b8" },
        { name: crit ? `Without ${id}` : `With ${id}`, value: after, label: fmt(after, 1), detail: `IIC ${sci(ca)} (${after >= 100 ? "+" : "−"}${fmt(Math.abs(after - 100), 1)} %)`, color: crit ? "#dc2626" : "#16a34a" },
      ],
    });
  }
  const share = num(crit?.area_pct);
  if (crit && share != null) {
    out.push({ kind: "share", title: "Share of all mapped habitat", caption: `${String(crit.patch_id ?? "This patch")} vs the rest of the mapped habitat in the study area.`,
      part: share, partLabel: String(crit.patch_id ?? "This patch"), restLabel: "Other patches", color: "#0f5132", center: `${fmt(share, 1)} %` });
  }
  const mapped = num(ev.mapped_habitat_ha), area = num(cand?.area_ha);
  if (a.type === "uncertain_habitat" && mapped != null && area != null) {
    out.push({ kind: "bars", title: "Unsure area vs mapped habitat", caption: "Hectares, from the alert record.",
      rows: [
        { name: "Mapped habitat", value: mapped, label: fmtHa(mapped), detail: "area mapped as habitat in the study area", color: "#0f5132" },
        { name: `${String(cand?.candidate_id ?? "Area")} (unsure)`, value: area, label: fmtHa(area), detail: "area with a marginal model signal", color: "#b45309" },
      ] });
  }
  const conf = num(ev.confidence);
  if (conf != null) {
    out.push({ kind: "share", title: "Map confidence", caption: "Mean model probability that this patch is habitat.", part: conf * 100, partLabel: "Confident", restLabel: "Uncertain", color: "#b45309", center: `${fmt(conf * 100, 0)} %` });
  }
  const d = num(ev.delta_pct);
  if (d != null && (a.type === "habitat_change" || a.type === "connectivity_degradation")) {
    const what = a.type === "habitat_change" ? "Habitat area" : "Connectivity (IIC)";
    out.push({ kind: "bars", title: `${what}: previous run vs this run`, caption: "Indexed to the previous run = 100.",
      rows: [
        { name: "Previous run", value: 100, label: "100", detail: String(ev.previous_run ?? ""), color: "#94a3b8" },
        { name: "This run", value: 100 + d, label: fmt(100 + d, 1), detail: String(ev.current_run ?? ""), color: d < 0 ? "#dc2626" : "#16a34a" },
      ] });
  }
  return out;
}

function Tip({ active, payload }: { active?: boolean; payload?: { payload?: Row | { name: string; value: number } }[] }) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className="rounded-lg border border-black/[0.08] bg-white px-2.5 py-1.5 text-[11.5px] shadow-lg">
      <div className="font-semibold text-[#0f172a]">{p.name}</div>
      <div className="tabular text-[#64748b]">{"detail" in p ? p.detail : `${fmt(p.value, 1)} %`}</div>
    </div>
  );
}

export function AlertChartCard({ chart }: { chart: AlertChart }) {
  return (
    <div className="rounded-xl border border-black/[0.06] bg-white p-3.5">
      <div className="text-[13px] font-bold tracking-tight text-[#0f172a]">{chart.title}</div>
      <div className="mb-2 text-[11px] text-[#94a3b8]">{chart.caption}</div>
      {chart.kind === "bars" ? (
        <div className="h-[118px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart.rows} layout="vertical" margin={{ top: 4, right: 56, bottom: 0, left: 0 }} barCategoryGap="28%">
              <XAxis type="number" hide domain={[0, chart.max ?? "dataMax"]} />
              <YAxis type="category" dataKey="name" width={118} tickLine={false} axisLine={false} tick={{ fontSize: 11.5, fill: "#475569", fontWeight: 600 }} />
              <Tooltip content={<Tip />} cursor={{ fill: "rgba(15,81,50,0.04)" }} />
              <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={24} animationDuration={900} isAnimationActive
                label={(p: { x?: number | string; y?: number | string; width?: number | string; height?: number | string; index?: number }) => (
                  <text x={Number(p.x) + Number(p.width) + 8} y={Number(p.y) + Number(p.height) / 2} dy="0.35em" fontSize={12.5} fontWeight={700} fill="#0f172a">
                    {chart.rows[p.index ?? 0]?.label}
                  </text>
                )}>
                {chart.rows.map((r) => <Cell key={r.name} fill={r.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <div className="relative h-[124px] w-[124px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={[{ name: chart.partLabel, value: chart.part }, { name: chart.restLabel, value: Math.max(0, 100 - chart.part) }]} dataKey="value"
                  innerRadius={42} outerRadius={58} startAngle={90} endAngle={-270} stroke="none" animationDuration={900}>
                  <Cell fill={chart.color} /><Cell fill="#e2e8f0" />
                </Pie>
                <Tooltip content={<Tip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center"><span className="tabular text-[17px] font-bold tracking-tight text-[#0f172a]">{chart.center}</span></div>
          </div>
          <div className="min-w-0 space-y-2.5 text-[12px]">
            {[[chart.partLabel, chart.part, chart.color], [chart.restLabel, 100 - chart.part, "#e2e8f0"]].map(([l, v, c]) => (
              <div key={String(l)} className="flex items-start gap-2">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: String(c) }} />
                <div><div className="font-semibold leading-tight text-[#0f172a]">{l}</div><div className="tabular text-[#64748b]">{fmt(Number(v), 1)} %</div></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
