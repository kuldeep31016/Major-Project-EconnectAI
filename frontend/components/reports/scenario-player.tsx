"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Loader2, Pause, Play, RotateCcw } from "lucide-react";
import type { HabitatGraph, WhatIfResult } from "@/types";
import type { ReportDigest } from "./report-data";
import { fmtHa, fmtInt } from "./report-data";
import { cn } from "@/lib/utils";

type Phase = "before" | "focus" | "remove" | "after";
const ORDER: Phase[] = ["before", "focus", "remove", "after"];
const PALETTE = ["#15803d", "#1e5f8a", "#0891b2", "#65a30d", "#7c3aed", "#0d9488", "#b45309", "#2563eb", "#be185d", "#4d7c0f"];
const LONE = "#a3b1ad";

/** Union-find over the graph's links, skipping removed patches. Returns patch → group root. */
function groups(ids: string[], edges: { source: string; target: string }[], skip: Set<string>) {
  const parent = new Map(ids.filter((i) => !skip.has(i)).map((i) => [i, i]));
  const find = (x: string): string => { let r = x; while (parent.get(r) !== r) r = parent.get(r)!; parent.set(x, r); return r; };
  for (const e of edges) {
    if (!parent.has(e.source) || !parent.has(e.target)) continue;
    const a = find(e.source), b = find(e.target);
    if (a !== b) parent.set(a, b);
  }
  const out = new Map<string, string>();
  for (const i of parent.keys()) out.set(i, find(i));
  return out;
}

/** Colour each group; after removal, a group keeps the colour of the old group its largest patch came from,
 *  pieces that split off get a fresh colour, and patches left alone turn grey. */
function colourGroups(graph: HabitatGraph, removed: Set<string>) {
  const ids = graph.nodes.map((n) => n.id);
  const area = new Map(graph.nodes.map((n) => [n.id, n.areaHa]));
  const assign = (g: Map<string, string>, inherit?: Map<string, string>) => {
    const members = new Map<string, string[]>();
    for (const [id, root] of g) members.set(root, [...(members.get(root) ?? []), id]);
    const sorted = [...members.values()].sort((a, b) => b.reduce((s, i) => s + area.get(i)!, 0) - a.reduce((s, i) => s + area.get(i)!, 0));
    const colour = new Map<string, string>();
    const used = new Set<string>();
    let next = 0;
    for (const m of sorted) {
      let c = LONE;
      if (m.length > 1) {
        const lead = [...m].sort((a, b) => area.get(b)! - area.get(a)!)[0];
        const inh = inherit?.get(lead);
        if (inh && inh !== LONE && !used.has(inh)) c = inh;
        else { while (used.has(PALETTE[next % PALETTE.length]) && next < PALETTE.length * 2) next++; c = PALETTE[next % PALETTE.length]; next++; }
        used.add(c);
      }
      for (const id of m) colour.set(id, c);
    }
    return { colour, count: members.size };
  };
  const before = assign(groups(ids, graph.edges, new Set()));
  const after = assign(groups(ids, graph.edges, removed), before.colour);
  return { before, after };
}

export function ScenarioPlayer({ graph, graphState, whatIf, digest }: {
  graph: HabitatGraph | null; graphState: "loading" | "ready" | "missing"; whatIf: WhatIfResult | null; digest: ReportDigest;
}) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("before");
  const [playing, setPlaying] = useState(false);
  const timers = useRef<number[]>([]);

  const removedIds = useMemo(
    () => whatIf?.removed_patch_ids ?? (digest.whatIf.removed ? digest.whatIf.removed.split(/,\s*/) : digest.crit.rows[0] ? [digest.crit.rows[0].patch] : []),
    [whatIf, digest],
  );
  const removed = useMemo(() => new Set(removedIds), [removedIds]);
  const label = removedIds.join(", ") || "the top patch";

  // Real before/after numbers: the run's what-if artefact first, otherwise the report's own sentence.
  const nums = {
    lossPct: whatIf?.loss_pct ?? digest.whatIf.lossPct,
    cBefore: whatIf?.c_before, cAfter: whatIf?.c_after,
    areaBefore: whatIf?.habitat_area_before_ha ?? digest.graph.habitatHa,
    areaRemoved: whatIf?.habitat_area_removed_ha ?? digest.whatIf.removedHa,
    compBefore: whatIf?.components_before ?? digest.whatIf.compBefore,
    compAfter: whatIf?.components_after ?? digest.whatIf.compAfter,
    edgesBefore: whatIf?.edges_before ?? digest.graph.links,
    edgesAfter: whatIf?.edges_after ?? (digest.graph.links !== undefined && digest.whatIf.severed !== undefined ? digest.graph.links - digest.whatIf.severed : undefined),
    isolated: whatIf?.newly_isolated_patch_ids.length ?? digest.whatIf.isolated,
  };
  const hasNums = nums.lossPct !== undefined;

  const layout = useMemo(() => {
    if (!graph || graph.nodes.length === 0) return null;
    const xs = graph.nodes.map((n) => n.position.x), ys = graph.nodes.map((n) => n.position.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const pad = 30;
    const w = Math.max(maxX - minX, 1), h = Math.max(maxY - minY, 1);
    const maxA = Math.max(...graph.nodes.map((n) => n.areaHa), 1);
    const u = Math.max(w, h) / 360; // one screen-ish pixel in viewBox units
    const pos = new Map(graph.nodes.map((n) => [n.id, { x: n.position.x - minX + pad * u, y: n.position.y - minY + pad * u, r: u * (4 + 16 * Math.sqrt(n.areaHa / maxA)) }]));
    return { pos, u, vb: `0 0 ${w + pad * 2 * u} ${h + pad * 2 * u}`, ...colourGroups(graph, removed) };
  }, [graph, removed]);

  const clear = () => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = []; };
  useEffect(() => clear, []);

  const play = () => {
    clear();
    setPlaying(true);
    setPhase("before");
    const step = reduce ? 700 : 1500;
    ORDER.slice(1).forEach((p, i) => {
      timers.current.push(window.setTimeout(() => {
        setPhase(p);
        if (p === "after") setPlaying(false);
      }, 400 + step * i));
    });
  };
  const stop = () => { clear(); setPlaying(false); };

  const gone = phase === "remove" || phase === "after";
  const regrouped = phase === "after";
  const caption: Record<Phase, string> = {
    before: `Today: ${fmtInt(digest.graph.nodes ?? graph?.nodes.length)} patches in ${fmtInt(nums.compBefore ?? layout?.before.count)} separate groups.`,
    focus: `${label} is the most important patch in this network.`,
    remove: `Now imagine ${label} is lost…`,
    after: hasNums ? `The network loses ${nums.lossPct!.toFixed(1)}% of its connectivity.` : "Groups are recomputed without the lost patch.",
  };

  return (
    <div className="@container overflow-hidden rounded-2xl border border-black/[0.06] bg-[#f7faf8]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.05] bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={playing ? stop : play}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0f5132] px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-[#15803d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00e599]"
          >
            {playing ? <Pause className="h-4 w-4" /> : phase === "after" ? <RotateCcw className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current" />}
            {playing ? "Pause" : phase === "after" ? "Replay scenario" : "Play scenario"}
          </button>
          <div role="group" aria-label="Show state" className="flex rounded-xl border border-black/[0.08] bg-[#f6f8f7] p-0.5">
            {(["before", "after"] as const).map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={p === "after" ? gone : !gone}
                onClick={() => { stop(); setPhase(p); }}
                className={cn("rounded-lg px-3 py-1.5 text-[12px] font-semibold capitalize transition", (p === "after" ? regrouped : phase === "before") ? "bg-white text-[#0b1f17] shadow-sm" : "text-[#64748b] hover:text-[#0b1f17]")}
              >{p}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5" aria-hidden="true">
          {ORDER.map((p) => (
            <span key={p} className={cn("h-1.5 rounded-full transition-all duration-300", ORDER.indexOf(p) <= ORDER.indexOf(phase) ? "w-6 bg-[#15803d]" : "w-3 bg-[#d1ddd7]")} />
          ))}
        </div>
      </div>

      <div className="grid gap-0 @2xl:grid-cols-[1fr_250px]">
        {/* network picture */}
        <div className="relative min-h-[260px] p-4">
          <motion.p key={phase} aria-live="polite" initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={cn("px-1 text-[15px] font-semibold", phase === "after" ? "text-[#dc2626]" : "text-[#0b1f17]")}>{caption[phase]}</motion.p>
          {graphState === "loading" && (
            <div className="grid h-[300px] place-items-center text-[13px] text-[#64748b]"><span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Loading this run&apos;s network…</span></div>
          )}
          {graphState === "missing" && (
            <div className="grid h-[300px] place-items-center px-6 text-center text-[13px] text-[#64748b]">The network picture for this run could not be loaded. The numbers on the right still come from the report.</div>
          )}
          {graphState === "ready" && layout && graph && (
            <svg viewBox={layout.vb} className="mx-auto mt-1 h-[300px] w-full sm:h-[360px]" role="img" aria-label={`Habitat network before and after losing ${label}`}>
              {graph.edges.map((e) => {
                const a = layout.pos.get(e.source), b = layout.pos.get(e.target);
                if (!a || !b) return null;
                const cut = removed.has(e.source) || removed.has(e.target);
                const col = cut ? (phase === "before" ? "#9fb5ab" : "#dc2626") : (regrouped ? layout.after.colour.get(e.source) : layout.before.colour.get(e.source)) ?? "#9fb5ab";
                return (
                  <motion.line
                    key={e.id}
                    x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    strokeLinecap="round"
                    initial={false}
                    animate={{ stroke: col, opacity: cut && gone ? 0 : cut && phase === "focus" ? 1 : 0.55, strokeWidth: layout.u * (cut && phase === "focus" ? 3.5 : 2), strokeDasharray: cut && phase === "remove" ? `${5 * layout.u} ${5 * layout.u}` : "0 0" }}
                    transition={{ duration: reduce ? 0 : 0.7 }}
                  />
                );
              })}
              {graph.nodes.map((n) => {
                const p = layout.pos.get(n.id)!;
                const isGone = removed.has(n.id);
                const fill = isGone ? (phase === "before" ? layout.before.colour.get(n.id)! : "#dc2626") : (regrouped ? layout.after.colour.get(n.id) : layout.before.colour.get(n.id)) ?? LONE;
                return (
                  <g key={n.id}>
                    {isGone && phase === "focus" && !reduce && (
                      <motion.circle cx={p.x} cy={p.y} fill="none" stroke="#dc2626" strokeWidth={2.5 * layout.u}
                        initial={{ r: p.r, opacity: 0.9 }} animate={{ r: p.r + 22 * layout.u, opacity: 0 }}
                        transition={{ duration: 1.1, repeat: Infinity, ease: "easeOut" }} />
                    )}
                    <motion.circle
                      cx={p.x} cy={p.y}
                      initial={false}
                      animate={{ r: isGone && gone ? (phase === "after" ? 0 : p.r * 0.6) : p.r, fill, opacity: isGone && gone ? (phase === "after" ? 0 : 0.35) : 0.92 }}
                      transition={{ duration: reduce ? 0 : 0.8 }}
                      stroke="#ffffff" strokeWidth={layout.u * 1.4}
                    >
                      <title>{`${n.label} · ${fmtHa(n.areaHa)}`}</title>
                    </motion.circle>
                    {isGone && phase !== "after" && (
                      <text x={p.x} y={p.y - p.r - 7 * layout.u} textAnchor="middle" fontSize={14 * layout.u} fontWeight={700} fill="#dc2626">{n.label}</text>
                    )}
                  </g>
                );
              })}
              {isGoneMarker(phase) && [...removed].map((id) => {
                const p = layout.pos.get(id);
                if (!p) return null;
                return (
                  <motion.g key={`x-${id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduce ? 0 : 0.4 }}>
                    <circle cx={p.x} cy={p.y} r={Math.max(p.r, 9 * layout.u)} fill="none" stroke="#dc2626" strokeWidth={1.6 * layout.u} strokeDasharray={`${4 * layout.u} ${4 * layout.u}`} />
                    <text x={p.x} y={p.y - Math.max(p.r, 9 * layout.u) - 7 * layout.u} textAnchor="middle" fontSize={14 * layout.u} fontWeight={700} fill="#dc2626">{id} lost</text>
                  </motion.g>
                );
              })}
            </svg>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11.5px] text-[#64748b]">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#15803d]" />Colour = linked group</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: LONE }} />Patch on its own</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#dc2626]" />Lost patch</span>
            <span>Circle size = patch area</span>
          </div>
        </div>

        {/* real numbers */}
        <div className="border-t border-black/[0.05] bg-white p-4 @2xl:border-l @2xl:border-t-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#64748b]">{regrouped ? "After" : "Before"} · real run numbers</div>
          {hasNums ? (
            <div className="mt-3 space-y-4">
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[12.5px] font-semibold text-[#334155]">Connectivity</span>
                  <span className={cn("tabular text-[22px] font-bold", regrouped ? "text-[#dc2626]" : "text-[#0b1f17]")}>{regrouped ? `−${nums.lossPct!.toFixed(1)}%` : "100%"}</span>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-[#fee2e2]">
                  <motion.div className="h-full rounded-full bg-[#15803d]" initial={false} animate={{ width: regrouped ? `${100 - nums.lossPct!}%` : "100%" }} transition={{ duration: reduce ? 0 : 0.9 }} />
                </div>
                {nums.cBefore !== undefined && nums.cAfter !== undefined && (
                  <div className="mt-1 text-[11px] text-[#94a3b8]">{digest.graph.metric} {nums.cBefore.toPrecision(3)}{regrouped && <> → {nums.cAfter.toPrecision(3)}</>}</div>
                )}
              </div>
              <Row label="Habitat area" v={regrouped && nums.areaBefore !== undefined && nums.areaRemoved !== undefined ? fmtHa(nums.areaBefore - nums.areaRemoved) : fmtHa(nums.areaBefore)} changed={regrouped && !!nums.areaRemoved} />
              <Row label="Separate groups" v={fmtInt(regrouped ? nums.compAfter : nums.compBefore)} changed={regrouped && nums.compAfter !== nums.compBefore} />
              <Row label="Links" v={fmtInt(regrouped ? nums.edgesAfter : nums.edgesBefore)} changed={regrouped && nums.edgesAfter !== nums.edgesBefore} />
              <Row label="Patches newly cut off" v={regrouped ? fmtInt(nums.isolated) : "0"} changed={regrouped && !!nums.isolated} />
            </div>
          ) : (
            <p className="mt-3 text-[13px] leading-relaxed text-[#475569]">This report does not include the recomputed numbers. Run the same scenario in the Scenario Lab to see them.</p>
          )}
          <p className="mt-4 text-[11.5px] leading-snug text-[#64748b]">A simulation on this run&apos;s map, not a forecast.</p>
          <Link href="/scenario" className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#15803d] hover:text-[#0f5132]">
            Try other patches in Scenario Lab <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

const isGoneMarker = (p: Phase) => p === "after";

function Row({ label, v, changed }: { label: string; v: string; changed: boolean }) {
  return (
    <div className="flex items-baseline justify-between border-t border-black/[0.05] pt-2.5">
      <span className="text-[12.5px] text-[#475569]">{label}</span>
      <motion.span key={v} initial={{ opacity: 0.3 }} animate={{ opacity: 1 }} className={cn("tabular text-[16px] font-bold", changed ? "text-[#dc2626]" : "text-[#0b1f17]")}>{v}</motion.span>
    </div>
  );
}
