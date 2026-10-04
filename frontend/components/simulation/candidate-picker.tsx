"use client";

import { Check, HelpCircle } from "lucide-react";
import type { RestorationAction } from "@/types";
import { cn } from "@/lib/utils";

/** Restoration candidates ranked by connectivity gain, with a gain bar (linear, relative to the top candidate). */
export function CandidatePicker({ actions, selected, multi, onToggle }: {
  actions: RestorationAction[];
  selected: string[];
  multi: boolean;
  onToggle: (id: string) => void;
}) {
  const max = Math.max(1e-9, ...actions.map((a) => a.connectivityGain));
  if (!actions.length) return <div className="rounded-xl border border-dashed border-black/10 p-3 text-[12px] text-muted-foreground">No candidates for this run.</div>;
  return (
    <div className="space-y-1.5" role={multi ? "group" : "radiogroup"} aria-label="Restoration candidates">
      {actions.map((a) => {
        const on = selected.includes(a.id);
        const uncertain = a.category === "uncertain_habitat";
        return (
          <button
            key={a.id}
            type="button"
            role={multi ? "checkbox" : "radio"}
            aria-checked={on}
            onClick={() => onToggle(a.id)}
            className={cn(
              "w-full rounded-xl border bg-white px-2.5 py-2 text-left transition-all",
              on ? "border-[#15803d] ring-2 ring-[#15803d]/15" : "border-black/[0.07] hover:border-black/[0.15]",
            )}
          >
            <div className="flex items-center gap-2">
              <span className={cn("grid h-5 w-5 shrink-0 place-items-center border transition", multi ? "rounded-md" : "rounded-full", on ? "border-[#15803d] bg-[#15803d] text-white" : "border-black/15 bg-white")}>
                {on && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>
              <span className="text-[12.5px] font-bold text-[#0f172a]">{a.id}</span>
              <span className="text-[11px] text-muted-foreground">#{a.rank} · {a.areaHa.toFixed(1)} ha</span>
              <span className={cn("ml-auto text-[13px] font-bold tabular", uncertain ? "text-[#b45309]" : "text-[#15803d]")}>+{a.connectivityGain.toFixed(a.connectivityGain >= 10 ? 0 : 1)}%</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2 pl-7">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.05]">
                <div className="h-full rounded-full" style={{ width: `${Math.max(2, (100 * a.connectivityGain) / max)}%`, background: uncertain ? "#f59e0b" : "linear-gradient(90deg,#16a34a,#00e599)" }} />
              </div>
              {uncertain && (
                <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-[#fef3c7] px-1.5 py-px text-[10px] font-semibold text-[#92400e]" title="Large area with an unsure model signal — probably existing forest. Field check first.">
                  <HelpCircle className="h-2.5 w-2.5" /> Uncertain habitat
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
