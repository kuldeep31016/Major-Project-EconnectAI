"use client";

import { useEffect, useState } from "react";
import type { FeasibilityCandidate } from "@/lib/api";
import { VERDICT, type Verdict } from "@/components/restoration/verdict";
import { cn } from "@/lib/utils";

const FILTERS: { id: "all" | Verdict; label: string }[] = [
  { id: "all", label: "All" },
  { id: "recommended", label: "Recommended" },
  { id: "conditional", label: "Conditional" },
  { id: "field_check", label: "Field check" },
];

/** Ranked restoration candidates: gain bar (linear, relative to the top gain), status chip, key facts. */
export function CandidateList({ candidates, metric, activeId, onSelect }: {
  candidates: FeasibilityCandidate[];
  metric: string;
  activeId: string | null;
  onSelect: (c: FeasibilityCandidate) => void;
}) {
  const [filter, setFilter] = useState<"all" | Verdict>("all");
  const max = Math.max(1e-9, ...candidates.map((c) => c.gain_pct));
  const count = (v: Verdict) => candidates.filter((c) => c.verdict === v).length;
  const shown = filter === "all" ? candidates : candidates.filter((c) => c.verdict === filter);
  // a candidate picked on the map scrolls into view in the list
  useEffect(() => { if (activeId) document.getElementById(`cand-row-${activeId}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [activeId]);
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1">
        {FILTERS.filter((f) => f.id === "all" || count(f.id) > 0).map((f) => (
          <button key={f.id} type="button" onClick={() => setFilter(f.id)} aria-pressed={filter === f.id}
            className={cn("rounded-full px-2 py-1 text-[11px] font-semibold transition", filter === f.id ? "bg-[#0f5132] text-white" : "bg-black/[0.04] text-[#475569] hover:bg-black/[0.07]")}>
            {f.label} <span className={cn("tabular", filter === f.id ? "text-white/70" : "text-[#94a3b8]")}>{f.id === "all" ? candidates.length : count(f.id)}</span>
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        {shown.map((c) => {
          const v = VERDICT[c.verdict];
          const on = activeId === c.candidate_id;
          return (
            <button key={c.candidate_id} id={`cand-row-${c.candidate_id}`} type="button" onClick={() => onSelect(c)} aria-pressed={on}
              className={cn("w-full rounded-xl border bg-white px-3 py-2.5 text-left transition-all", on ? "border-[#15803d] ring-2 ring-[#15803d]/15" : "border-black/[0.07] hover:border-black/[0.15] hover:shadow-sm")}>
              <div className="flex items-center gap-2">
                <span className="grid h-6 min-w-6 place-items-center rounded-md bg-[#f1f5f9] px-1 text-[11px] font-bold tabular text-[#475569]">{c.rank}</span>
                <span className="text-[13.5px] font-bold text-[#0f172a]">{c.candidate_id}</span>
                <span className="text-[11.5px] text-muted-foreground">{c.area_ha.toFixed(1)} ha</span>
                <span className="ml-auto text-[14px] font-black tabular" style={{ color: c.verdict === "field_check" ? "#b45309" : "#15803d" }}>+{c.gain_pct.toFixed(c.gain_pct >= 10 ? 0 : 1)}%</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/[0.05]">
                <div className="h-full rounded-full" style={{ width: `${Math.max(2, (100 * c.gain_pct) / max)}%`, background: c.verdict === "field_check" ? "#f59e0b" : "linear-gradient(90deg,#16a34a,#00e599)" }} />
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[10.5px] font-semibold" style={{ background: v.bg, color: v.color }}><v.icon className="h-3 w-3" />{v.short}</span>
                <span className="truncate text-[11px] text-muted-foreground">{c.new_links} new link{c.new_links === 1 ? "" : "s"}{c.nearest_habitat_km != null ? ` · ${c.nearest_habitat_km.toFixed(1)} km to habitat` : ""}</span>
              </div>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Gain = rise in {metric.toUpperCase()} connectivity if the site were added.</p>
    </div>
  );
}
