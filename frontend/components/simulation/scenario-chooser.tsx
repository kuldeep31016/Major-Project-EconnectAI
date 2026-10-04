"use client";

import { GROUPS, KINDS, type Kind } from "@/components/simulation/scenario-kinds";
import { cn } from "@/lib/utils";

/** A–K scenario picker: three groups of small icon tiles; the chosen one is described below the grid by the page. */
export function ScenarioChooser({ value, onChange, disabled = {} }: {
  value: Kind; onChange: (k: Kind) => void;
  /** kinds that cannot run on the current run, with the reason shown as the tile's tooltip */
  disabled?: Partial<Record<Kind, string>>;
}) {
  return (
    <div className="space-y-3">
      {GROUPS.map((g) => (
        <div key={g.id}>
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#475569]">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: g.tone }} />{g.label}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {KINDS.filter((k) => k.group === g.id).map((k) => {
              const on = value === k.id;
              const off = disabled[k.id];
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => !off && onChange(k.id)}
                  title={off ?? k.desc}
                  aria-pressed={on}
                  aria-disabled={!!off}
                  className={cn(
                    "group relative flex min-h-[64px] flex-col items-start gap-1 rounded-xl border px-2 py-2 text-left transition-all",
                    on ? "border-transparent text-white shadow-[0_6px_18px_-8px_rgba(15,81,50,0.7)]"
                      : off ? "cursor-not-allowed border-black/[0.05] bg-white opacity-45"
                      : "border-black/[0.07] bg-white hover:-translate-y-px hover:border-black/[0.14] hover:shadow-sm",
                  )}
                  style={on ? { background: g.id === "lose" ? "linear-gradient(135deg,#b91c1c,#dc2626)" : g.id === "gain" ? "linear-gradient(135deg,#0f5132,#15803d)" : "linear-gradient(135deg,#164e72,#1e5f8a)" } : undefined}
                >
                  <span className="flex w-full items-center justify-between">
                    <span style={on ? undefined : { color: g.tone }}><k.icon className="h-4 w-4" /></span>
                    <span className={cn("text-[10px] font-bold tabular", on ? "text-white/70" : "text-[#94a3b8]")}>{k.letter}</span>
                  </span>
                  <span className={cn("text-[12px] font-semibold leading-tight", on ? "text-white" : "text-[#0f172a]")}>{k.short}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
