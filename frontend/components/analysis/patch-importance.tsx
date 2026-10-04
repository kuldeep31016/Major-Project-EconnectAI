"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, FileSearch, MapPin, Scissors, Search, Split } from "lucide-react";

import { Term } from "@/components/shared/term";
import { ImportanceScatter } from "@/components/analysis/importance-scatter";
import { useAnalysis } from "@/hooks/use-analysis";
import { getGraph } from "@/lib/data";
import { SENSITIVITY_META } from "@/lib/constants";
import type { SensitivityBand } from "@/types";
import { fetchRunCriticality, type CriticalityRow } from "@/lib/api";
import { cn } from "@/lib/utils";

type SortKey = "rank" | "rank_by_area" | "area_ha" | "delta_pct" | "area_pct" | "degree";
const COLS: { key: SortKey; label: string; align?: "left" }[] = [
  { key: "rank", label: "Importance" },
  { key: "rank_by_area", label: "Size rank" },
  { key: "area_ha", label: "Area (ha)" },
  { key: "delta_pct", label: "IIC loss if lost", align: "left" },
  { key: "area_pct", label: "Habitat share" },
  { key: "degree", label: "Links" },
];

/**
 * "A large patch is not automatically the most important one": area rank versus criticality rank for every patch
 * of the selected run, plus the sortable leave-one-out table. Every value is read from the run's criticality.json.
 */
export function PatchImportance({ onExplain, onShowOnMap }: { onExplain: (id: string) => void; onShowOnMap: (id: string) => void }) {
  const { sceneId, runId, clearRemoved, togglePatchRemoved } = useAnalysis();
  const router = useRouter();
  const key = `${sceneId}/${runId || "latest"}`;
  const [loaded, setLoaded] = useState<{ key: string; rows: CriticalityRow[] | null; err: string | null } | null>(null);
  const rows = loaded?.key === key ? loaded.rows : null;
  const err = loaded?.key === key ? loaded.err : null;
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: "rank", asc: true });
  const [q, setQ] = useState("");
  const [cutOnly, setCutOnly] = useState(false);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchRunCriticality(sceneId, runId || "latest")
      .then((r) => { if (!cancelled) setLoaded({ key, rows: r, err: null }); })
      .catch((e) => { if (!cancelled) setLoaded({ key, rows: null, err: e instanceof Error ? e.message : "Could not load criticality" }); });
    return () => { cancelled = true; };
  }, [sceneId, runId, key]);

  const shown = useMemo(() => {
    if (!rows) return [];
    const t = q.trim().toLowerCase();
    return rows
      .filter((r) => (!cutOnly || r.is_cut_vertex) && (!t || r.patch_id.toLowerCase().includes(t)))
      .sort((a, b) => (sort.asc ? 1 : -1) * ((a[sort.key] as number) - (b[sort.key] as number)));
  }, [rows, q, cutOnly, sort]);

  // the patch whose importance most exceeds its size (same rule as the guided demo)
  const standout = useMemo(() => {
    if (!rows?.length) return null;
    return rows.reduce((a, b) => (b.rank_by_area - b.rank > a.rank_by_area - a.rank ? b : a));
  }, [rows]);

  // criticality band per patch (colours the scatter like the map and graph)
  const graph = getGraph(sceneId);
  const bands = useMemo(() => new Map<string, SensitivityBand>(graph.nodes.map((nd) => [nd.patchId, nd.sensitivity])), [graph.nodes]);

  const simulate = (id: string) => { clearRemoved(); togglePatchRemoved(id); router.push("/scenario?type=remove_patches"); };

  if (err) return <p className="p-6 text-[13px] text-muted-foreground">{err}</p>;
  if (!rows) return (
    <div className="grid h-full gap-4 p-5 lg:grid-cols-[minmax(360px,440px)_1fr]">
      {[0, 1].map((i) => <div key={i} className="animate-pulse rounded-2xl border border-black/[0.06] bg-white" />)}
    </div>
  );

  const n = rows.length;
  const maxDelta = Math.max(...rows.map((r) => r.delta_pct), 1e-9);
  const cutCount = rows.filter((r) => r.is_cut_vertex).length;
  const card = "flex min-w-0 flex-col rounded-2xl border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

  return (
    <div className="scroll-slim grid h-full gap-4 overflow-y-auto p-4 sm:p-5 lg:grid-cols-[minmax(330px,400px)_minmax(0,1fr)] [@media(min-width:1024px)_and_(min-height:760px)]:overflow-hidden">
      {/* ---------------------------------------------------- scatter */}
      <section className={cn(card, "p-5 lg:min-h-0 lg:overflow-y-auto scroll-slim")}>
        <h2 className="text-[17px] font-bold tracking-tight text-foreground">Size is not importance</h2>
        <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">
          Dots in the green half matter more to the network than their size suggests.
        </p>

        <div className="mt-3">
          <ImportanceScatter rows={rows} bands={bands} hover={hover} onHover={setHover} onPick={onExplain} />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
          {(["critical", "high", "medium", "low"] as const).map((b) => (
            <span key={b} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: SENSITIVITY_META[b].color }} />
              {SENSITIVITY_META[b].label}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border-[1.5px] border-dashed border-[#b91c1c]" />
            Splits the network
          </span>
        </div>

        {standout && standout.rank_by_area > standout.rank && (
          <div className="mt-4 flex gap-3 rounded-xl border border-[#16a34a]/15 bg-[#f0fdf4] p-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[15px] font-black text-[#15803d] shadow-sm">
              {standout.patch_id}
            </div>
            <p className="text-[12.5px] leading-snug text-[#14532d]">
              Only <b>#{standout.rank_by_area}</b> by size ({standout.area_ha.toFixed(1)} ha), but <b>#{standout.rank}</b> by importance.
              Losing it cuts IIC by <b>{standout.delta_pct.toFixed(1)} %</b>
              {standout.is_cut_vertex ? <> and splits the network ({standout.component_count_before} → {standout.component_count_after} groups)</> : null}.
            </p>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------ table */}
      <section className={cn(card, "lg:min-h-0")}>
        <div className="flex flex-wrap items-end justify-between gap-3 px-5 pb-3 pt-5">
          <div>
            <h2 className="text-[17px] font-bold tracking-tight text-foreground">If one patch is lost</h2>
            <p className="mt-1 text-[12.5px] text-muted-foreground">Each patch removed in turn and the network recomputed. Click a header to sort.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-9 items-center gap-1.5 rounded-xl border border-black/[0.08] bg-white px-2.5 text-[12.5px] focus-within:border-[#15803d] focus-within:shadow-[0_0_0_3px_rgba(21,128,61,0.12)]">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find patch (e.g. P07)" className="w-32 bg-transparent outline-none" aria-label="Find patch" />
            </label>
            <button
              type="button"
              aria-pressed={cutOnly}
              onClick={() => setCutOnly((v) => !v)}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[12.5px] font-semibold transition-colors",
                cutOnly ? "border-[#b91c1c]/30 bg-[#fef2f2] text-[#b91c1c]" : "border-black/[0.08] bg-white text-muted-foreground hover:text-foreground",
              )}
            >
              <Split className="h-3.5 w-3.5" />
              Splits network
              <span className={cn("rounded-full px-1.5 text-[10.5px] tabular", cutOnly ? "bg-[#b91c1c] text-white" : "bg-foreground/[0.06]")}>{cutCount}</span>
            </button>
            <span className="text-[11.5px] tabular text-muted-foreground">{shown.length} of {n}</span>
          </div>
        </div>

        <div className="scroll-slim min-h-0 flex-1 overflow-auto border-t border-black/[0.06]">
          <table className="w-full min-w-[680px] border-separate border-spacing-0 text-[12.5px]">
            <thead>
              <tr className="whitespace-nowrap text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="sticky top-0 z-10 bg-[#f8faf9] py-2.5 pl-5 text-left">Patch</th>
                {COLS.map((c) => {
                  const on = sort.key === c.key;
                  const Icon = !on ? ArrowUpDown : sort.asc ? ArrowUp : ArrowDown;
                  return (
                    <th key={c.key} className={cn("sticky top-0 z-10 bg-[#f8faf9] px-1.5 py-2.5", c.align === "left" ? "text-left" : "text-right")}>
                      <button
                        onClick={() => setSort((s) => ({ key: c.key, asc: s.key === c.key ? !s.asc : c.key === "rank" || c.key === "rank_by_area" }))}
                        className={cn("inline-flex items-center gap-1 uppercase transition-colors hover:text-foreground", on && "text-[#0f5132]")}
                      >
                        {c.label}<Icon className={cn("h-3 w-3", !on && "opacity-40")} />
                      </button>
                    </th>
                  );
                })}
                <th className="sticky top-0 z-10 bg-[#f8faf9] px-2 py-2.5 text-center"><Term side="bottom">Groups</Term></th>
                <th className="sticky top-0 z-10 bg-[#f8faf9] py-2.5 pr-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {shown.map((r) => {
                const band = bands.get(r.patch_id) ?? "low";
                const splits = r.component_count_after > r.component_count_before;
                return (
                  <tr
                    key={r.patch_id}
                    onMouseEnter={() => setHover(r.patch_id)}
                    onMouseLeave={() => setHover(null)}
                    className={cn("transition-colors [&>td]:border-b [&>td]:border-black/[0.05]", hover === r.patch_id ? "bg-[#f0fdf4]" : "bg-white")}
                  >
                    <td className="py-2.5 pl-5">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SENSITIVITY_META[band].color }} />
                        <b className="text-[13px] text-foreground">{r.patch_id}</b>
                        {r.is_cut_vertex && (
                          <span className="inline-flex items-center gap-0.5 rounded-full border border-[#b91c1c]/20 bg-[#fef2f2] px-1.5 py-px text-[10px] font-semibold text-[#b91c1c]">
                            <Split className="h-2.5 w-2.5" />splits
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-2 text-right font-bold text-foreground">#{r.rank}</td>
                    <td className="px-2 text-right text-muted-foreground">#{r.rank_by_area}</td>
                    <td className="px-2 text-right">{r.area_ha.toFixed(1)}</td>
                    <td className="px-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-16 shrink-0 overflow-hidden rounded-full bg-[#fee2e2]/60">
                          <div className="h-full rounded-full bg-gradient-to-r from-[#f87171] to-[#dc2626] transition-[width] duration-700" style={{ width: `${Math.max(2, (r.delta_pct / maxDelta) * 100)}%` }} />
                        </div>
                        <span className="w-14 whitespace-nowrap font-semibold text-[#b91c1c]">−{r.delta_pct.toFixed(1)} %</span>
                      </div>
                    </td>
                    <td className="px-2 text-right text-muted-foreground">{r.area_pct.toFixed(1)} %</td>
                    <td className="px-2 text-right">{r.degree}</td>
                    <td className="px-2 text-center">
                      <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px]", splits ? "bg-[#fef2f2] font-semibold text-[#b91c1c]" : "text-muted-foreground")}>
                        {r.component_count_before} → {r.component_count_after}
                      </span>
                    </td>
                    <td className="py-1.5 pr-5 text-right">
                      <div className="inline-flex gap-1">
                        <button title="Why this patch? (stored evidence)" aria-label={`Explain ${r.patch_id}`} onClick={() => onExplain(r.patch_id)} className="grid h-7 w-7 place-items-center rounded-lg border border-black/[0.08] text-muted-foreground transition-colors hover:border-[#15803d]/40 hover:bg-[#f0fdf4] hover:text-[#15803d]"><FileSearch className="h-3.5 w-3.5" /></button>
                        <button title="Simulate losing it (Scenario Lab)" aria-label={`Simulate removing ${r.patch_id}`} onClick={() => simulate(r.patch_id)} className="grid h-7 w-7 place-items-center rounded-lg border border-black/[0.08] text-muted-foreground transition-colors hover:border-[#b91c1c]/30 hover:bg-[#fef2f2] hover:text-[#b91c1c]"><Scissors className="h-3.5 w-3.5" /></button>
                        <button title="Show on map" aria-label={`Show ${r.patch_id} on map`} onClick={() => onShowOnMap(r.patch_id)} className="grid h-7 w-7 place-items-center rounded-lg border border-black/[0.08] text-muted-foreground transition-colors hover:border-[#1e5f8a]/30 hover:bg-[#eff6ff] hover:text-[#1e5f8a]"><MapPin className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-black/[0.06] px-5 py-2.5 text-[11px] text-muted-foreground">
          Run {runId || "latest"} · model output vs GMW reference labels · not field-validated.
        </p>
      </section>
    </div>
  );
}
