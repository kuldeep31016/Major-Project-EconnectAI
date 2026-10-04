"use client";

import { useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ChevronDown, Code2, Link2, Info } from "lucide-react";
import { Term } from "@/components/shared/term";
import type { AlertItem } from "@/lib/api";
import { cn } from "@/lib/utils";
import { fmt, fmtHa, fmtPct, humanise, num, sci } from "./alert-meta";

type Tone = "red" | "green" | "amber" | "blue" | "slate";
interface Tile { label: string; value: ReactNode; sub?: string; tone?: Tone; wide?: boolean }
interface Chip { id: string; extra?: string }
export interface EvidenceView {
  hero?: Tile;
  tiles: Tile[];
  chips?: { title: string; items: Chip[] };
  flags: { text: string; tone: Tone }[];
  rest: [string, string][];
  runs: { label: string; id: string }[];
}

const TONE_TEXT: Record<Tone, string> = { red: "text-[#b91c1c]", green: "text-[#15803d]", amber: "text-[#b45309]", blue: "text-[#1e5f8a]", slate: "text-[#0f172a]" };
const TONE_BG: Record<Tone, string> = {
  red: "from-[#fef2f2] to-white border-[#fecaca]", green: "from-[#f0fdf4] to-white border-[#bbf7d0]",
  amber: "from-[#fffbeb] to-white border-[#fde68a]", blue: "from-[#eff6ff] to-white border-[#bfdbfe]", slate: "from-[#f8fafc] to-white border-black/[0.06]",
};

const asObj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const strList = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);

function show(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "number") return Math.abs(v) > 0 && Math.abs(v) < 0.01 ? sci(v) : fmt(v, Number.isInteger(v) ? 0 : 3);
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.length ? v.map((x) => show(x)).join(", ") : "none";
  if (typeof v === "object") return Object.entries(v as Record<string, unknown>).map(([k, x]) => `${humanise(k)}: ${show(x)}`).join(" · ");
  return String(v);
}

function beforeAfter(a: number, b: number, f: (x: number) => string = (x) => String(x)) {
  return <span className="inline-flex items-center gap-1.5">{f(a)}<ArrowRight className="h-3.5 w-3.5 text-[#94a3b8]" />{f(b)}</span>;
}

/** Turn an alert's evidence into labelled tiles. Every figure comes from the stored record. */
export function buildEvidence(alert: AlertItem): EvidenceView {
  const ev = { ...(alert.evidence ?? {}) };
  const used = new Set<string>(["rules_version"]);
  const view: EvidenceView = { tiles: [], flags: [], rest: [], runs: [] };
  const take = (o: Record<string, unknown>, k: string) => { const v = o[k]; delete o[k]; return v; };

  if (typeof ev.run_id === "string") { view.runs.push({ label: "Analysis run", id: ev.run_id }); used.add("run_id"); }
  if (typeof ev.previous_run === "string" && typeof ev.current_run === "string") {
    view.runs.push({ label: "Previous run", id: ev.previous_run }, { label: "Current run", id: ev.current_run });
    used.add("previous_run"); used.add("current_run");
  }
  if (typeof ev.result_label === "string") { const t = ev.result_label; view.flags.push({ text: t === t.toUpperCase() ? (t.charAt(0) + t.slice(1).toLowerCase()).replace(/ - /g, ": ") : t, tone: "amber" }); used.add("result_label"); }

  const crit = asObj(ev.criticality);
  const cand = asObj(ev.restoration) ?? asObj(ev.candidate);
  let leftovers: Record<string, unknown> = {};

  if (crit) {
    used.add("criticality");
    const c = { ...crit };
    const d = num(take(c, "delta_pct")), s = num(take(c, "criticality_score")), area = num(take(c, "area_ha")), share = num(take(c, "area_pct"));
    const deg = num(take(c, "degree")), conf = num(take(c, "confidence")), q = num(take(c, "quality"));
    const cb = num(take(c, "c_before")), ca = num(take(c, "c_after")), dc = num(take(c, "delta_connectivity"));
    const gb = num(take(c, "component_count_before")), ga = num(take(c, "component_count_after"));
    const rank = num(take(c, "rank")), rankArea = num(take(c, "rank_by_area"));
    const cut = take(c, "is_cut_vertex"), cls = take(c, "habitat_class");
    const nIds = strList(take(c, "neighbour_ids")), nKm = (take(c, "neighbour_distances_km") as unknown[]) ?? [];
    take(c, "patch_id"); take(c, "name");
    if (d != null) view.hero = { label: "Connectivity lost if this patch disappears", value: `−${fmt(d, 1)} %`, sub: "IIC, recomputed with the patch removed", tone: "red" };
    if (s != null) view.tiles.push({ label: "Criticality score", value: fmt(s, 3), sub: "0 = no effect · 1 = everything", tone: "red" });
    if (area != null) view.tiles.push({ label: "Patch area", value: fmtHa(area), sub: share != null ? `${fmt(share, 1)} % of mapped habitat` : undefined });
    if (deg != null) view.tiles.push({ label: "Direct links", value: String(deg), sub: deg === 0 ? "isolated from other patches" : deg === 1 ? "link to another patch" : "links to other patches" });
    if (conf != null) view.tiles.push({ label: "Map confidence", value: `${fmt(conf * 100, 1)} %`, sub: "mean model probability", tone: "blue" });
    if (rank != null) view.tiles.push({ label: "Criticality rank", value: `#${rank}`, sub: rankArea != null ? `#${rankArea} by area` : undefined });
    if (gb != null && ga != null) view.tiles.push({ label: "Separate groups", value: beforeAfter(gb, ga), sub: "today → without this patch" });
    if (cb != null && ca != null) view.tiles.push({ label: "IIC today → without it", value: beforeAfter(cb, ca, sci), sub: dc != null ? `drop of ${sci(dc)}` : undefined, wide: true });
    if (q != null && q !== conf) view.tiles.push({ label: "Quality", value: fmt(q, 3) });
    if (cut === true) view.flags.push({ text: "Cut vertex: this patch alone joins groups of patches", tone: "red" });
    if (typeof cls === "string") view.flags.push({ text: `Habitat class: ${cls}`, tone: "green" });
    if (nIds.length) view.chips = { title: "Neighbouring patches", items: nIds.map((id, i) => ({ id, extra: num(nKm[i]) != null ? `${fmt(num(nKm[i])!, 1)} km` : undefined })) };
    leftovers = c;
  } else if (cand) {
    used.add("restoration"); used.add("candidate");
    const c = { ...cand };
    const uncertain = alert.type === "uncertain_habitat";
    const gain = num(take(c, "gain_pct")), area = num(take(c, "area_ha")), links = num(take(c, "new_links")), rank = num(take(c, "rank"));
    const cb = num(take(c, "c_before")), ca = num(take(c, "c_after")), cg = num(take(c, "connectivity_gain"));
    const gb = num(take(c, "components_before")), ga = num(take(c, "components_after"));
    const linked = strList(take(c, "linked_patch_ids"));
    const cost = take(c, "cost"), unit = take(c, "cost_unit"), gpc = take(c, "gain_per_cost"), basis = take(c, "ranking_basis");
    take(c, "candidate_id"); take(c, "name"); take(c, "centroid");
    const mapped = num(ev.mapped_habitat_ha); if (mapped != null) used.add("mapped_habitat_ha");
    if (uncertain && area != null) view.hero = { label: "Area the model is unsure about", value: fmtHa(area), sub: mapped != null ? `${fmt((100 * area) / mapped, 1)} % of the ${fmtHa(mapped)} mapped as habitat` : undefined, tone: "amber" };
    else if (gain != null) view.hero = { label: "Connectivity gain if restored", value: fmtPct(gain, 1, true), sub: "IIC, recomputed with the site added", tone: "green" };
    if (uncertain && gain != null) view.tiles.push({ label: "Gain if restored", value: fmtPct(gain, 1, true), tone: "green" });
    if (!uncertain && area != null) view.tiles.push({ label: "Site area", value: fmtHa(area) });
    if (uncertain && mapped != null) view.tiles.push({ label: "Mapped habitat", value: fmtHa(mapped) });
    if (links != null) view.tiles.push({ label: "New links", value: String(links), sub: "to existing patches", tone: "blue" });
    if (rank != null) view.tiles.push({ label: "Candidate rank", value: `#${rank}`, sub: basis === "raw_gain" ? "by connectivity gain" : typeof basis === "string" ? `by ${humanise(basis).toLowerCase()}` : undefined });
    if (gb != null && ga != null) view.tiles.push({ label: "Separate groups", value: beforeAfter(gb, ga), sub: ga < gb ? "joins groups that are apart today" : "today → with the site" });
    if (cb != null && ca != null) view.tiles.push({ label: "IIC today → with the site", value: beforeAfter(cb, ca, sci), sub: cg != null ? `gain of ${sci(cg)}` : undefined, wide: true });
    view.tiles.push({ label: "Cost", value: cost == null ? "Not assessed" : `${show(cost)}${unit ? ` ${unit}` : ""}`, sub: cost == null ? "no cost data; feasibility unknown" : gpc != null ? `gain per cost ${show(gpc)}` : undefined, tone: "slate" });
    if (linked.length) view.chips = { title: "Would link these patches", items: linked.map((id) => ({ id })) };
    leftovers = c;
  } else {
    const conf = num(ev.confidence), d = num(ev.delta_pct), pend = num(ev.pending);
    if (conf != null) { used.add("confidence"); view.hero = { label: "Map confidence for this patch", value: `${fmt(conf * 100, 1)} %`, sub: "mean model probability that it is habitat", tone: "amber" }; }
    if (d != null) {
      used.add("delta_pct");
      const what = alert.type === "habitat_change" ? "Predicted habitat area" : "Connectivity (IIC)";
      view.hero = { label: `${what} change between runs`, value: fmtPct(d, 1, true), sub: "same model and threshold; cause not established", tone: d < 0 ? "red" : "green" };
    }
    if (pend != null) { used.add("pending"); view.hero = { label: "Detections awaiting a field check", value: String(pend), sub: "not confirmed observations", tone: "amber" }; }
  }

  // anything we did not recognise: clean key/value rows, never raw JSON
  for (const [k, v] of Object.entries(leftovers)) if (v != null && !(Array.isArray(v) && !v.length)) view.rest.push([humanise(k), show(v)]);
  for (const [k, v] of Object.entries(ev)) {
    if (used.has(k)) continue;
    if (typeof v === "number" && !view.tiles.some((t) => t.label === humanise(k))) view.tiles.push({ label: humanise(k), value: show(v) });
    else view.rest.push([humanise(k), show(v)]);
  }
  return view;
}

function StatTile({ t, i }: { t: Tile; i: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i, duration: 0.3 }}
      className={cn("rounded-xl border border-black/[0.06] bg-white px-3.5 py-3", t.wide && "sm:col-span-2")}>
      <div className="text-[11px] font-medium text-[#64748b]"><Term>{t.label}</Term></div>
      <div className={cn("tabular mt-1 text-[19px] font-bold leading-tight tracking-tight", TONE_TEXT[t.tone ?? "slate"])}>{t.value}</div>
      {t.sub && <div className="mt-0.5 text-[11px] leading-snug text-[#94a3b8]">{t.sub}</div>}
    </motion.div>
  );
}

export function EvidencePanel({ view, raw }: { view: EvidenceView; raw: unknown }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-3">
      {view.hero && (
        <div className={cn("rounded-2xl border bg-gradient-to-br px-4 py-3.5", TONE_BG[view.hero.tone ?? "slate"])}>
          <div className="text-[12px] font-semibold text-[#475569]">{view.hero.label}</div>
          <div className={cn("tabular mt-0.5 text-[34px] font-bold leading-none tracking-tight", TONE_TEXT[view.hero.tone ?? "slate"])}>{view.hero.value}</div>
          {view.hero.sub && <div className="mt-1.5 text-[12px] text-[#64748b]">{view.hero.sub}</div>}
        </div>
      )}
      {view.tiles.length > 0 && <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">{view.tiles.map((t, i) => <StatTile key={t.label} t={t} i={i} />)}</div>}
      {view.chips && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#475569]"><Link2 className="h-3.5 w-3.5" />{view.chips.title}</span>
          {view.chips.items.map((c) => (
            <span key={c.id} className="tabular inline-flex items-center gap-1 rounded-full bg-[#0f5132]/[0.07] px-2.5 py-1 text-[11.5px] font-semibold text-[#0f5132] ring-1 ring-[#0f5132]/15">
              {c.id}{c.extra && <span className="font-normal text-[#0f5132]/70">· {c.extra}</span>}
            </span>
          ))}
        </div>
      )}
      {view.flags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {view.flags.map((f) => (
            <span key={f.text} className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1",
              f.tone === "red" ? "bg-[#fef2f2] text-[#b91c1c] ring-[#fecaca]" : f.tone === "green" ? "bg-[#f0fdf4] text-[#15803d] ring-[#bbf7d0]" : "bg-[#fffbeb] text-[#b45309] ring-[#fde68a]")}>
              <Info className="h-3 w-3" />{f.text}
            </span>
          ))}
        </div>
      )}
      {view.rest.length > 0 && (
        <dl className="divide-y divide-black/[0.05] rounded-xl border border-black/[0.06] bg-white">
          {view.rest.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-4 px-3.5 py-2 text-[12px]"><dt className="text-[#64748b]">{k}</dt><dd className="tabular text-right font-medium text-[#0f172a]">{v}</dd></div>
          ))}
        </dl>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-[10.5px] text-[#94a3b8]">
          {view.runs.map((r) => <span key={r.label} className="min-w-0 truncate">{r.label}: <span className="font-mono text-[#64748b]">{r.id}</span></span>)}
        </div>
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-[#64748b] hover:bg-black/[0.04] hover:text-[#0f172a]">
          <Code2 className="h-3.5 w-3.5" />{open ? "Hide raw data" : "View raw data"}<ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
        </button>
      </div>
      {open && <pre className="max-h-64 overflow-auto rounded-xl bg-[#0f172a] p-3 text-[10.5px] leading-relaxed text-[#cbd5e1]">{JSON.stringify(raw, null, 2)}</pre>}
    </div>
  );
}
