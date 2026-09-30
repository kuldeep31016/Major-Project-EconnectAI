"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownUp, FileSearch, MapPin, Scissors, Search } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Term } from "@/components/shared/term";
import { useAnalysis } from "@/hooks/use-analysis";
import { fetchRunCriticality, type CriticalityRow } from "@/lib/api";
import { cn } from "@/lib/utils";

type SortKey = "rank" | "rank_by_area" | "area_ha" | "delta_pct" | "area_pct" | "degree";
const COLS: { key: SortKey; label: string }[] = [
  { key: "rank", label: "Criticality rank" },
  { key: "rank_by_area", label: "Area rank" },
  { key: "area_ha", label: "Area (ha)" },
  { key: "delta_pct", label: "IIC loss if removed" },
  { key: "area_pct", label: "Habitat loss" },
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

  const simulate = (id: string) => { clearRemoved(); togglePatchRemoved(id); router.push("/scenario?type=remove_patches"); };

  if (err) return <p className="p-6 text-[13px] text-muted-foreground">{err}</p>;
  if (!rows) return <p className="p-6 text-[13px] text-muted-foreground">Loading patch results…</p>;

  const n = rows.length;
  const W = 300, H = 300, pad = 34;
  const pos = (rank: number) => pad + ((rank - 1) / Math.max(1, n - 1)) * (W - 2 * pad);

  return (
    <div className="grid h-full gap-4 overflow-y-auto p-4 scroll-slim lg:grid-cols-[340px_1fr] sm:p-5">
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-[14px]">Size is not importance</CardTitle>
          <CardDescription>
            Area tells us how large a patch is. <Term>Criticality</Term> tells us how much the network depends on it.
            Points above the line matter more than their size suggests.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Area rank versus criticality rank">
            <line x1={pad} y1={pad} x2={W - pad} y2={H - pad} stroke="currentColor" strokeOpacity={0.2} strokeDasharray="4 4" />
            <text x={W / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="currentColor" opacity={0.6}>Area rank (1 = largest) →</text>
            <text x={10} y={H / 2} textAnchor="middle" fontSize="10" fill="currentColor" opacity={0.6} transform={`rotate(-90 10 ${H / 2})`}>← Criticality rank (1 = most critical)</text>
            {rows.map((r) => {
              const x = pos(r.rank_by_area), y = pos(r.rank);
              const on = hover === r.patch_id || standout?.patch_id === r.patch_id;
              return (
                <g key={r.patch_id} onMouseEnter={() => setHover(r.patch_id)} onMouseLeave={() => setHover(null)} className="cursor-pointer" onClick={() => onExplain(r.patch_id)}>
                  <circle cx={x} cy={y} r={on ? 6 : 4.5} fill={r.is_cut_vertex ? "#dc2626" : "#15803d"} fillOpacity={0.8} stroke="#fff" strokeWidth={1} />
                  {(on || r.rank <= 3) && <text x={x + 7} y={y + 3} fontSize="10" fontWeight={600} fill="currentColor">{r.patch_id}</text>}
                </g>
              );
            })}
          </svg>
          <div className="mt-1 flex gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#dc2626]" /><Term>cut vertex</Term> (splits the network)</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-[#15803d]" />other patch</span>
          </div>
          {standout && standout.rank_by_area > standout.rank && (
            <p className="mt-3 rounded-lg bg-foreground/[0.04] p-2.5 text-[12px] leading-snug">
              <b>{standout.patch_id}</b> is only #{standout.rank_by_area} of {n} by area ({standout.area_ha.toFixed(1)} ha), yet #{standout.rank} by
              criticality: removing it lowers IIC by {standout.delta_pct.toFixed(1)} %
              {standout.is_cut_vertex ? ` and splits the network from ${standout.component_count_before} into ${standout.component_count_after} groups` : ""}.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-[14px]">Leave-one-patch-out results</CardTitle>
          <CardDescription>Each patch removed in turn and the network recomputed exactly (run {runId || "latest"}). Click a header to sort.</CardDescription>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <label className="flex h-8 items-center gap-1.5 rounded-md border border-foreground/10 px-2 text-[12px]">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find patch (e.g. P07)" className="w-36 bg-transparent outline-none" />
            </label>
            <label className="flex items-center gap-1.5 text-[12px]"><input type="checkbox" checked={cutOnly} onChange={(e) => setCutOnly(e.target.checked)} /> only patches that split the network</label>
            <span className="text-[11.5px] text-muted-foreground">{shown.length} of {n}</span>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[12px]">
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-1.5 text-left">Patch</th>
                {COLS.map((c) => (
                  <th key={c.key} className="py-1.5 text-right">
                    <button onClick={() => setSort((s) => ({ key: c.key, asc: s.key === c.key ? !s.asc : c.key === "rank" || c.key === "rank_by_area" }))}
                      className={cn("inline-flex items-center gap-1", sort.key === c.key && "text-foreground")}>
                      {c.label}<ArrowDownUp className="h-3 w-3" />
                    </button>
                  </th>
                ))}
                <th className="py-1.5 text-center"><Term side="bottom">Groups</Term></th>
                <th className="py-1.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {shown.map((r) => (
                <tr key={r.patch_id} onMouseEnter={() => setHover(r.patch_id)} onMouseLeave={() => setHover(null)}
                  className={cn("border-t border-foreground/[0.06]", hover === r.patch_id && "bg-foreground/[0.03]")}>
                  <td className="py-1.5 font-semibold">{r.patch_id}{r.is_cut_vertex && <span className="ml-1.5 rounded bg-[#fee2e2] px-1 text-[10px] font-medium text-[#b91c1c]">splits</span>}</td>
                  <td className="text-right">#{r.rank}</td>
                  <td className="text-right">#{r.rank_by_area}</td>
                  <td className="text-right">{r.area_ha.toFixed(1)}</td>
                  <td className="text-right font-semibold">−{r.delta_pct.toFixed(1)} %</td>
                  <td className="text-right">{r.area_pct.toFixed(1)} %</td>
                  <td className="text-right">{r.degree}</td>
                  <td className="text-center">{r.component_count_before} → {r.component_count_after}</td>
                  <td className="py-1 text-right">
                    <div className="inline-flex gap-1">
                      <button title="Explain this patch (stored evidence)" onClick={() => onExplain(r.patch_id)} className="rounded-md border border-foreground/10 p-1 hover:bg-foreground/[0.05]"><FileSearch className="h-3.5 w-3.5" /></button>
                      <button title="Simulate removal in Scenario Lab" onClick={() => simulate(r.patch_id)} className="rounded-md border border-foreground/10 p-1 hover:bg-foreground/[0.05]"><Scissors className="h-3.5 w-3.5" /></button>
                      <button title="Show on map (send for verification from there)" onClick={() => onShowOnMap(r.patch_id)} className="rounded-md border border-foreground/10 p-1 hover:bg-foreground/[0.05]"><MapPin className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-muted-foreground">Habitat loss = the patch&apos;s share of mapped habitat. Model output (development model, GMW reference labels); not field-validated.</p>
        </CardContent>
      </Card>
    </div>
  );
}
