"use client";

import { useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { ChevronDown, FlaskConical, Info, RotateCcw, Save, TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { ScenarioResult, ScenarioSummary, SensitivityVariant } from "@/lib/api";
import { AnimatedNumber } from "@/components/shared/animated-number";
import { Term } from "@/components/shared/term";
import { Button } from "@/components/ui/button";
import { ParamChips } from "@/components/simulation/scenario-params";
import { kindInfo } from "@/components/simulation/scenario-kinds";
import { cn } from "@/lib/utils";
import { sci } from "@/components/simulation/sci";

export { sci };

const pct = (b: number, s: number) => (b ? (100 * (s - b)) / b : 0);
const signed = (n: number, d = 1) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(d)}`;
const tone = (d: number, higherIsBetter = true) => (d === 0 ? "#64748b" : (d > 0) === higherIsBetter ? "#15803d" : "#dc2626");

/** Splits the server's explanation into the first sentence (headline) and the rest (detail). Text is shown verbatim. */
function splitExplanation(t: string): [string, string] {
  const m = t.match(/^([\s\S]+?[.!?])\s+(?=[A-Zτ"(])([\s\S]*)$/);
  return m ? [m[1], m[2]] : [t, ""];
}

function Disclosure({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-black/[0.06] bg-white">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between px-3 py-2 text-[12px] font-semibold text-[#334155]">
        {title}<ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="border-t border-black/[0.05] px-3 py-2.5">{children}</div>}
    </div>
  );
}

function Stat({ label, b, s, fmt, higherIsBetter = true, delay = 0 }: { label: string; b: number; s: number; fmt: (v: number) => string; higherIsBetter?: boolean; delay?: number }) {
  const d = s - b;
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.35 }} className="rounded-xl border border-black/[0.06] bg-white px-3 py-2.5">
      <div className="text-[11px] font-medium text-muted-foreground"><Term>{label}</Term></div>
      <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5">
        <span className="whitespace-nowrap text-[20px] font-bold leading-tight tabular text-[#0f172a]"><AnimatedNumber value={s} format={fmt} duration={1100} /></span>
        <span className="whitespace-nowrap text-[11px] font-semibold tabular" style={{ color: tone(d, higherIsBetter) }}>{d === 0 ? "no change" : signed(d, Number.isInteger(d) ? 0 : 1)}</span>
      </div>
      <div className="mt-0.5 text-[10.5px] tabular text-muted-foreground">was {fmt(b)}</div>
    </motion.div>
  );
}

const METRICS: { key: keyof ScenarioSummary; label: string; fmt: (v: number) => string }[] = [
  { key: "iic", label: "Connectivity (IIC)", fmt: sci },
  { key: "pc", label: "Reachability (PC)", fmt: sci },
  { key: "eca_ha", label: "Connected area (ECA)", fmt: (v) => `${v.toFixed(1)} ha` },
  { key: "habitat_area_ha", label: "Habitat area", fmt: (v) => `${v.toFixed(1)} ha` },
  { key: "n_edges", label: "Links", fmt: (v) => String(v) },
];

function ChangeChart({ b, s }: { b: ScenarioSummary; s: ScenarioSummary }) {
  const data = METRICS.map((m) => ({ name: m.label.replace(/ \(.*\)/, ""), full: m.label, d: +pct(b[m.key] as number, s[m.key] as number).toFixed(1), before: m.fmt(b[m.key] as number), after: m.fmt(s[m.key] as number) }));
  const lim = Math.max(1, ...data.map((x) => Math.abs(x.d))) * 1.15;
  const hasNeg = data.some((x) => x.d < 0);
  const hasPos = data.some((x) => x.d > 0);
  const domain: [number, number] = hasNeg && hasPos ? [-lim, lim] : hasNeg ? [-lim, 0] : [0, lim];
  const color = (d: number) => (d === 0 ? "#94a3b8" : d > 0 ? "#16a34a" : "#dc2626");
  return (
    <div className="h-[176px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 2, right: 52, bottom: 2, left: 0 }} barCategoryGap={8}>
          <XAxis type="number" domain={domain} hide />
          <YAxis type="category" dataKey="name" width={122} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#334155" }} />
          <ReferenceLine x={0} stroke="#cbd5e1" />
          <RTooltip
            cursor={{ fill: "rgba(15,81,50,0.05)" }}
            content={({ active, payload }) => {
              const p = active && payload?.[0]?.payload as (typeof data)[number] | undefined;
              if (!p) return null;
              return <div className="rounded-lg border border-black/[0.08] bg-white px-2.5 py-1.5 text-[11.5px] shadow-lg"><div className="font-semibold">{p.full}</div><div className="tabular text-muted-foreground">{p.before} → <b className="text-foreground">{p.after}</b></div></div>;
            }}
          />
          <Bar dataKey="d" radius={4} isAnimationActive animationDuration={900} minPointSize={2}
            label={(props: unknown) => {
              const { x, y, width, height, value } = props as { x: number; y: number; width: number; height: number; value: number };
              const right = Math.max(x, x + width);
              const left = Math.min(x, x + width);
              const atLeft = value < 0 && hasPos;
              return <text x={atLeft ? left - 5 : right + 6} y={y + height / 2} dy={4} textAnchor={atLeft ? "end" : "start"} fontSize={11.5} fontWeight={700} fill={color(value)}>{`${signed(value)}%`}</text>;
            }}>
            {data.map((x) => <Cell key={x.name} fill={color(x.d)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Short plain-language summary built only from the computed values (the server's full explanation stays under "More detail"). */
function plainSummary(r: ScenarioResult): string | null {
  const b = r.baseline, s = r.scenario;
  if (!s) return null;
  const dLinks = s.n_edges - b.n_edges;
  const groups = s.n_components === b.n_components ? "" : s.n_components > b.n_components ? `, and the network splits into ${s.n_components} groups (was ${b.n_components})` : `, and separate groups merge (${b.n_components} → ${s.n_components})`;
  const ids = (xs: string[]) => (xs.length > 3 ? `${xs.slice(0, 3).join(", ")} +${xs.length - 3}` : xs.join(", "));
  const links = (n: number) => `${n} link${n === 1 ? "" : "s"}`;
  const ha = (v: number) => `${Math.abs(v).toFixed(1)} ha`;
  const p = r.parameters;
  switch (r.type) {
    case "remove_patches": case "remove_polygon":
      return `Losing ${ids(r.removed_patch_ids ?? [])} (${ha(b.habitat_area_ha - s.habitat_area_ha)}) cuts ${links(r.severed_edges?.length ?? Math.max(0, -dLinks))}${groups}.`;
    case "restore": case "restore_multi": case "add_patch": {
      const added = ((r as { added?: { id: string }[] }).added ?? []).map((a) => a.id);
      return `Adding ${ids(added)} (${ha(s.habitat_area_ha - b.habitat_area_ha)}) creates ${links(Math.max(0, dLinks))}${groups}.`;
    }
    case "reduce_area":
      return `Shrinking ${ids(r.affected_patch_ids ?? [])} loses ${ha(b.habitat_area_ha - s.habitat_area_ha)} of habitat; ${dLinks === 0 ? "the links stay the same" : `links change by ${dLinks}`}${groups}.`;
    case "radius":
      return `With a ${String(p.tau_km)} km travel distance the network has ${links(s.n_edges)} (was ${b.n_edges})${groups}.`;
    default:
      return null;
  }
}

export interface PlaybackStep { label: string }

/** The right-hand result panel of the Scenario Lab. Every number comes from the server's exact recomputation. */
export function ScenarioResults({ result, playing, steps, step, onReplay, onSave, saved, empty }: {
  result: ScenarioResult | null;
  playing: boolean;
  steps: PlaybackStep[];
  step: number;
  onReplay?: () => void;
  onSave?: () => void;
  saved?: string | null;
  empty?: ReactNode;
}) {
  if (!result) return <>{empty}</>;
  const info = kindInfo(result.type);
  const sim = result.label.startsWith("SIM");
  const b = result.baseline;
  const s = result.scenario;
  const summary = plainSummary(result);
  const [lead, rest] = summary ? [summary, result.explanation] : splitExplanation(result.explanation);

  if (playing) {
    return (
      <div className="rounded-2xl border border-black/[0.06] bg-white p-4">
        <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#15803d]">Watch the map</div>
        <ol className="mt-3 space-y-2.5">
          {steps.map((st, i) => (
            <li key={st.label} className="flex items-center gap-2.5 text-[13px]">
              <span className={cn("grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold transition-colors", i < step ? "bg-[#15803d] text-white" : i === step ? "bg-[#00e599] text-[#053321] ring-4 ring-[#00e599]/25" : "bg-black/[0.05] text-muted-foreground")}>{i + 1}</span>
              <span className={cn(i <= step ? "font-semibold text-[#0f172a]" : "text-muted-foreground")}>{st.label}</span>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  const metric = String(result.parameters.metric ?? "iic").toLowerCase() === "pc" ? "pc" : "iic";
  const head = s ? pct(b[metric], s[metric]) : 0;
  const individual = (result as { individual?: { candidate_id: string; gain_pct: number; new_links: number; area_ha: number }[] }).individual;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-black/[0.06] bg-white p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{info ? `${info.letter} · ${info.short}` : result.type}</div>
            <div className="mt-0.5 text-[15px] font-bold leading-snug text-[#0f172a]">{info?.desc ?? "Scenario result"}</div>
          </div>
          <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold tracking-wide", sim ? "bg-[#fff7ed] text-[#c2410c] ring-1 ring-[#fdba74]/60" : "bg-[#e0f2fe] text-[#1e5f8a] ring-1 ring-[#7dd3fc]/60")}>{result.label}</span>
        </div>
        <div className="mt-2.5"><ParamChips params={result.parameters} /></div>

        {s && (
          <div className="mt-4 flex items-center gap-3 rounded-xl px-3.5 py-3" style={{ background: head > 0 ? "linear-gradient(135deg,#ecfdf5,#f0fdf4)" : head < 0 ? "linear-gradient(135deg,#fef2f2,#fff1f2)" : "#f8fafc" }}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: tone(head) }}>
              {head > 0 ? <TrendingUp className="h-5 w-5" /> : head < 0 ? <TrendingDown className="h-5 w-5" /> : <Minus className="h-5 w-5" />}
            </span>
            <div className="min-w-0">
              <div className="text-[32px] font-black leading-none tracking-tight tabular" style={{ color: tone(head) }}>
                <AnimatedNumber value={+head.toFixed(1)} format={(n) => `${signed(n)}%`} duration={1200} />
              </div>
              <div className="mt-1 text-[12px] font-medium text-[#334155]">
                <Term>{`connectivity (${metric.toUpperCase()})`}</Term> {head > 0 ? "goes up" : head < 0 ? "goes down" : "does not change"}
              </div>
            </div>
          </div>
        )}
        <p className="mt-3 text-[13px] leading-relaxed text-[#1f2937]">{lead}</p>
      </div>

      {s && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Links" b={b.n_edges} s={s.n_edges} fmt={(v) => String(Math.round(v))} delay={0.05} />
            <Stat label="Groups (components)" b={b.n_components} s={s.n_components} fmt={(v) => String(Math.round(v))} higherIsBetter={false} delay={0.1} />
            <Stat label="Habitat area" b={b.habitat_area_ha} s={s.habitat_area_ha} fmt={(v) => `${v.toFixed(1)} ha`} delay={0.15} />
            <Stat label="Connected area (ECA)" b={b.eca_ha} s={s.eca_ha} fmt={(v) => `${v.toFixed(1)} ha`} delay={0.2} />
          </div>
          <div className="rounded-2xl border border-black/[0.06] bg-white p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[12.5px] font-bold text-[#0f172a]">Change in each measure</span>
              <span className="text-[10.5px] text-muted-foreground">hover for before → after</span>
            </div>
            <ChangeChart b={b} s={s} />
          </div>
        </>
      )}

      {individual && individual.length > 1 && (
        <div className="rounded-2xl border border-black/[0.06] bg-white p-3">
          <div className="mb-2 text-[12.5px] font-bold text-[#0f172a]">Each site on its own</div>
          {(() => { const mx = Math.max(1e-9, ...individual.map((x) => Math.abs(x.gain_pct))); return individual.map((x) => (
            <div key={x.candidate_id} className="mb-1.5 flex items-center gap-2 text-[12px]">
              <span className="w-10 font-bold">{x.candidate_id}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/[0.05]"><div className="h-full rounded-full bg-[#16a34a]" style={{ width: `${Math.max(2, (100 * Math.abs(x.gain_pct)) / mx)}%` }} /></div>
              <span className="w-14 text-right font-semibold tabular text-[#15803d]">{signed(x.gain_pct, 2)}%</span>
            </div>
          )); })()}
          <p className="mt-1 text-[11px] text-muted-foreground">Gains overlap when sites share neighbours, so they do not add up.</p>
        </div>
      )}

      {result.affected_patch_ids && result.affected_patch_ids.length > 0 && (
        <div className="rounded-2xl border border-black/[0.06] bg-white p-3">
          <div className="mb-1.5 text-[12.5px] font-bold text-[#0f172a]">Patches affected</div>
          <div className="flex flex-wrap gap-1">
            {result.affected_patch_ids.map((id) => <span key={id} className="rounded-md bg-[#f1f5f9] px-1.5 py-0.5 text-[11.5px] font-semibold text-[#334155]">{id}</span>)}
          </div>
          {result.newly_isolated_patch_ids?.length ? (
            <div className="mt-2 flex flex-wrap items-center gap-1 text-[11.5px] text-[#b91c1c]"><span className="font-semibold">Now cut off:</span>{result.newly_isolated_patch_ids.map((id) => <span key={id} className="rounded-md bg-[#fee2e2] px-1.5 py-0.5 font-semibold">{id}</span>)}</div>
          ) : null}
        </div>
      )}

      {result.type === "sensitivity" && result.stability && (
        <div className="rounded-2xl border border-black/[0.06] bg-white p-3 text-[12px]">
          <div className="mb-2 rounded-lg bg-[#f0fdf4] px-2.5 py-2 text-[13px] font-semibold text-[#14532d]">{result.verdict}</div>
          <table className="w-full"><thead className="text-[10.5px] text-muted-foreground"><tr><th className="py-1 text-left"><Term side="bottom">τ</Term> km</th><th>k</th><th>links</th><th><Term side="bottom">comp.</Term></th><th><Term side="bottom">ρ</Term></th><th>top-5 same</th></tr></thead>
            <tbody className="tabular text-center">{(result.variants as unknown as SensitivityVariant[]).map((v, i) => <tr key={i} className={cn("border-t border-black/[0.05]", v.tau_km === result.reference?.tau_km && v.k === result.reference?.k && "bg-[#f0fdf4] font-semibold")}><td className="py-1 text-left">{v.tau_km}</td><td>{v.k}</td><td>{v.n_edges}</td><td>{v.n_components}</td><td>{Number.isFinite(v.spearman) ? v.spearman.toFixed(2) : "—"}</td><td>{(100 * v.top_overlap).toFixed(0)}%</td></tr>)}</tbody></table>
          <div className="mt-3 mb-1 text-[12px] font-bold">Top patches across settings</div>
          <table className="w-full"><thead className="text-[10.5px] text-muted-foreground"><tr><th className="py-1 text-left">patch</th><th>rank</th><th>range</th><th>in top 5</th></tr></thead>
            <tbody className="tabular text-center">{result.stability.map((x) => <tr key={x.patch_id} className="border-t border-black/[0.05]"><td className="py-1 text-left font-semibold">{x.patch_id}</td><td>#{x.reference_rank}</td><td>#{x.min_rank}–#{x.max_rank}</td><td className={x.in_top_n === x.of ? "text-[#15803d]" : "text-[#b45309]"}>{x.in_top_n}/{x.of}</td></tr>)}</tbody></table>
        </div>
      )}

      {result.variants && result.type !== "sensitivity" && (
        <div className="rounded-2xl border border-black/[0.06] bg-white p-3 text-[12px]">
          <table className="w-full"><thead className="text-[10.5px] text-muted-foreground"><tr><th className="py-1 text-left">{result.type === "tau" ? <Term side="bottom">τ km</Term> : "cut-off"}</th><th>links</th><th><Term side="bottom">comp.</Term></th><th><Term side="bottom">IIC</Term></th><th><Term side="bottom">ECA %</Term></th><th>{result.type === "tau" ? <Term side="bottom">ρ</Term> : "patches"}</th></tr></thead>
            <tbody className="tabular text-center">{result.variants.map((v, i) => <tr key={i} className="border-t border-black/[0.05]"><td className="py-1.5 text-left font-semibold">{String(v.tau_km ?? v.threshold)}</td><td>{String(v.n_edges ?? "—")}</td><td>{String(v.n_components ?? "—")}</td><td>{typeof v.iic === "number" ? sci(v.iic) : "—"}</td><td>{typeof v.eca_pct_of_habitat === "number" ? v.eca_pct_of_habitat.toFixed(1) : "—"}</td><td>{result.type === "tau" ? (typeof v.spearman_vs_reference === "number" ? v.spearman_vs_reference.toFixed(2) : "—") : String(v.n_patches ?? "—")}</td></tr>)}</tbody></table>
        </div>
      )}

      {"lost_patch_ids" in result && (
        <div className="rounded-2xl border border-black/[0.06] bg-white p-3 text-[12px] space-y-2">
          <div className="text-[12.5px] font-bold">Patch-level change</div>
          {result.comparability && !result.comparability.comparable && <div className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11.5px] text-amber-900">{result.comparability.note}</div>}
          {result.tracking && (
            <div className="flex flex-wrap gap-1.5">
              {["stable", "grown", "shrunk", "split", "merged", "reorganised", "disappeared", "new"].filter((k) => result.tracking!.counts[k]).map((k) => (
                <span key={k} className="rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[11.5px]"><b>{result.tracking!.counts[k]}</b> {k}</span>
              ))}
            </div>
          )}
          {result.tracking && (
            <table className="w-full text-[11.5px]"><thead className="text-[10.5px] text-muted-foreground"><tr><th className="text-left">change</th><th className="text-left">earlier → later</th><th>ha</th></tr></thead>
              <tbody className="tabular">{result.tracking.events.filter((e) => e.type !== "stable").slice(0, 14).map((e, i) => (
                <tr key={i} className="border-t border-black/[0.05]"><td className="py-1">{e.type}</td><td>{e.patches_a.join(" + ") || "—"} → {e.patches_b.join(" + ") || "—"}</td><td className="text-center">{e.area_a_ha.toFixed(1)} → {e.area_b_ha.toFixed(1)}</td></tr>
              ))}</tbody></table>
          )}
          <p className="text-[11px] text-muted-foreground">Matched by overlap (≥ 10 % of the smaller patch). No cause is attributed; &ldquo;disappeared&rdquo; may mean it shrank below the minimum size.</p>
          {result.matched && result.matched.length > 0 && (
            <Disclosure title="Matched patches (A → B)">
              <table className="w-full text-[11.5px]"><thead className="text-[10.5px] text-muted-foreground"><tr><th className="text-left">A → B</th><th>area</th><th>score</th><th>rank</th></tr></thead><tbody className="tabular text-center">{result.matched.slice(0, 12).map((x, i) => <tr key={i} className="border-t border-black/[0.05]"><td className="py-1 text-left">{x.patch_a} → {x.patch_b}</td><td>{x.area_a.toFixed(0)} → {x.area_b.toFixed(0)}</td><td>{x.S_a.toFixed(3)} → {x.S_b.toFixed(3)}</td><td>{x.rank_a} → {x.rank_b}</td></tr>)}</tbody></table>
            </Disclosure>
          )}
        </div>
      )}

      {(rest || s) && (
        <Disclosure title={summary ? "Full explanation & exact values" : "More detail"}>
          {rest && <p className="text-[12px] leading-relaxed text-[#334155]">{rest}</p>}
          {s && (
            <table className={cn("w-full text-[11.5px]", rest && "mt-2.5")}>
              <thead className="text-[10.5px] text-muted-foreground"><tr><th className="py-1 text-left">measure</th><th className="text-right">before</th><th className="text-right">after</th></tr></thead>
              <tbody className="tabular">{[...METRICS, { key: "n_components" as const, label: "Groups (components)", fmt: (v: number) => String(v) }].map((m) => (
                <tr key={m.key} className="border-t border-black/[0.05]"><td className="py-1"><Term>{m.label}</Term></td><td className="text-right">{m.fmt(b[m.key] as number)}</td><td className="text-right font-semibold">{m.fmt(s[m.key] as number)}</td></tr>
              ))}</tbody>
            </table>
          )}
        </Disclosure>
      )}

      <div className="flex items-start gap-2 rounded-xl bg-[#f8fafc] px-3 py-2 text-[11.5px] leading-snug text-[#475569]">
        <Info className="mt-px h-3.5 w-3.5 shrink-0 text-[#1e5f8a]" />
        {sim ? "A what-if under today's settings — a simulation, not a forecast." : "Observed difference between two model runs (not field-checked)."}
      </div>
      <div className="flex flex-wrap gap-2">
        {onReplay && <Button size="sm" variant="outline" onClick={onReplay}><RotateCcw className="h-3.5 w-3.5" /> Replay on map</Button>}
        {onSave && <Button size="sm" variant="outline" onClick={onSave}><Save className="h-3.5 w-3.5" /> Save to record</Button>}
      </div>
      {saved && <div className="text-[11.5px] text-[#0f5132]">{saved}</div>}
    </div>
  );
}

/** Empty state shown before the first run. */
export function ScenarioEmpty() {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-5">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#ecfdf5] text-[#15803d]"><FlaskConical className="h-5 w-5" /></span>
      <div className="mt-3 text-[15px] font-bold text-[#0f172a]">Try a what-if</div>
      <ol className="mt-2 space-y-1.5 text-[12.5px] text-[#475569]">
        <li><b className="text-[#0f172a]">1.</b> Pick a change on the left.</li>
        <li><b className="text-[#0f172a]">2.</b> Set it up on the map or in the list.</li>
        <li><b className="text-[#0f172a]">3.</b> Press <b className="text-[#0f172a]">Run</b> and watch the network react.</li>
      </ol>
      <p className="mt-3 text-[11.5px] text-muted-foreground">Results are exact recomputations on the server, labelled SIMULATED.</p>
    </div>
  );
}
