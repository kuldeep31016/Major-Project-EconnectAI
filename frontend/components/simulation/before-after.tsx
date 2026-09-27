"use client";

import type { ScenarioSummary } from "@/lib/api";
import { cn } from "@/lib/utils";
import { fmtIndex } from "@/utils/format";

/** Headline before → after for one-change scenarios (all values exact recomputations). */
export function BeforeAfter({ b, s }: { b: ScenarioSummary; s: ScenarioSummary }) {
  const items: [string, string, string, number][] = [
    ["Connectivity (IIC)", fmtIndex(b.iic), fmtIndex(s.iic), b.iic ? (100 * (s.iic - b.iic)) / b.iic : 0],
    ["Components", String(b.n_components), String(s.n_components), s.n_components - b.n_components],
    ["Habitat (ha)", b.habitat_area_ha.toFixed(1), s.habitat_area_ha.toFixed(1), s.habitat_area_ha - b.habitat_area_ha],
    ["Links", String(b.n_edges), String(s.n_edges), s.n_edges - b.n_edges],
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map(([label, x, y, d], i) => (
        <div key={label} className="rounded-xl border border-foreground/[0.08] bg-card p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-0.5 text-[14px] font-semibold tabular">{x} <span className="text-muted-foreground">→</span> {y}</div>
          <div className={cn("text-[11px] tabular", (i === 1 ? -d : d) < 0 ? "text-[#b91c1c]" : d !== 0 ? "text-[#15803d]" : "text-muted-foreground")}>
            {d === 0 ? "no change" : i === 0 ? `${d > 0 ? "+" : ""}${d.toFixed(1)} %` : `${d > 0 ? "+" : ""}${Number.isInteger(d) ? d : d.toFixed(1)}`}
          </div>
        </div>
      ))}
    </div>
  );
}
