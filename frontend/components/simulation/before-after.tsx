"use client";

import type { ScenarioSummary } from "@/lib/api";
import { cn } from "@/lib/utils";
import { sci } from "@/components/simulation/sci";

/**
 * Headline before → after for one-change scenarios (all values exact recomputations).
 * Props unchanged — also used by the graph page and the chat assistant.
 */
export function BeforeAfter({ b, s }: { b: ScenarioSummary; s: ScenarioSummary }) {
  const iicPct = b.iic ? (100 * (s.iic - b.iic)) / b.iic : 0;
  const items: { label: string; big: string; sub: string; d: number; good: boolean }[] = [
    { label: "Connectivity (IIC)", big: iicPct === 0 ? "0 %" : `${iicPct > 0 ? "+" : "−"}${Math.abs(iicPct).toFixed(1)} %`, sub: `${sci(b.iic)} → ${sci(s.iic)}`, d: iicPct, good: iicPct > 0 },
    { label: "Separate groups", big: String(s.n_components), sub: `was ${b.n_components}`, d: s.n_components - b.n_components, good: s.n_components < b.n_components },
    { label: "Habitat", big: `${s.habitat_area_ha.toFixed(1)} ha`, sub: `was ${b.habitat_area_ha.toFixed(1)} ha`, d: s.habitat_area_ha - b.habitat_area_ha, good: s.habitat_area_ha > b.habitat_area_ha },
    { label: "Links", big: String(s.n_edges), sub: `was ${b.n_edges}`, d: s.n_edges - b.n_edges, good: s.n_edges > b.n_edges },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((x, i) => (
        <div key={x.label} className="min-w-0 rounded-xl border border-black/[0.07] bg-white px-2.5 py-2">
          <div className="truncate text-[10.5px] font-medium text-muted-foreground">{x.label}</div>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <span className={cn("text-[16px] font-bold leading-tight tabular", i === 0 && (x.d === 0 ? "text-muted-foreground" : x.good ? "text-[#15803d]" : "text-[#b91c1c]"))}>{x.big}</span>
            {i > 0 && (
              <span className={cn("text-[11px] font-semibold tabular", x.d === 0 ? "text-muted-foreground" : x.good ? "text-[#15803d]" : "text-[#b91c1c]")}>
                {x.d === 0 ? "same" : `${x.d > 0 ? "+" : "−"}${Number.isInteger(x.d) ? Math.abs(x.d) : Math.abs(x.d).toFixed(1)}`}
              </span>
            )}
          </div>
          <div className="truncate text-[10.5px] tabular text-muted-foreground" title={x.sub}>{x.sub}</div>
        </div>
      ))}
    </div>
  );
}
