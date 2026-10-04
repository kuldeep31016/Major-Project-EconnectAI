"use client";

import { motion, useReducedMotion } from "framer-motion";
import { BookOpen, Check, Cpu, GitCompareArrows } from "lucide-react";
import type { ModelInfo, ModelStatus, RegistryModel } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Soft glassy card surface shared by every block on the Data & Models page. */
export const GLASS =
  "rounded-2xl border border-white/70 bg-white/85 shadow-[0_1px_2px_rgba(16,40,28,0.04),0_12px_32px_-18px_rgba(16,64,40,0.22)] backdrop-blur-xl";

export const STATUS_TONE: Record<ModelStatus, string> = {
  DEVELOPMENT: "border-amber-200 bg-amber-50 text-amber-800",
  EXPERIMENTAL: "border-sky-200 bg-sky-50 text-sky-800",
  CANDIDATE: "border-violet-200 bg-violet-50 text-violet-800",
  VALIDATED: "border-emerald-200 bg-emerald-50 text-emerald-800",
};

export function StatusChip({ status, className }: { status?: ModelStatus | null; className?: string }) {
  if (!status) return <span className={cn("rounded-full border border-black/10 bg-black/[0.03] px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground", className)}>not registered</span>;
  return (
    <span title="Model registry status" className={cn("whitespace-nowrap rounded-full border px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider", STATUS_TONE[status], className)}>
      {status}
    </span>
  );
}

export function ModelList({
  models, active, onSelect, registry, compareIds, onToggleCompare, onCompare,
}: {
  models: ModelInfo[] | null;
  active: string | null;
  onSelect: (id: string) => void;
  registry: Record<string, RegistryModel>;
  compareIds: string[];
  onToggleCompare: (id: string) => void;
  onCompare: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#3f5b4c]">
          <Cpu className="h-4 w-4 text-[#15803d]" />
          Trained models ({models?.length ?? 0})
        </span>
        {compareIds.length >= 2 && (
          <button
            onClick={onCompare}
            className="flex items-center gap-1 rounded-full bg-[#15803d] px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm transition hover:bg-[#166534]"
          >
            <GitCompareArrows className="h-3.5 w-3.5" /> Compare {compareIds.length}
          </button>
        )}
      </div>

      <div className="space-y-2">
        {(models ?? []).map((m, i) => {
          const selected = active === m.experimentId;
          const checked = compareIds.includes(m.experimentId);
          const reg = registry[m.experimentId];
          return (
            <motion.div
              key={m.experimentId}
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.25 }}
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              onClick={() => onSelect(m.experimentId)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(m.experimentId); } }}
              className={cn(
                "group cursor-pointer rounded-2xl border p-3.5 text-left outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[#15803d]/40",
                selected
                  ? "border-[#15803d] bg-gradient-to-br from-[#f0fdf4] to-white shadow-[0_0_0_3px_rgba(21,128,61,0.10),0_10px_24px_-16px_rgba(21,128,61,0.5)]"
                  : "border-white/70 bg-white/80 shadow-[0_1px_2px_rgba(16,40,28,0.04)] hover:border-[#15803d]/35 hover:bg-white",
              )}
            >
              <div className={cn("truncate text-[13px] font-semibold", selected ? "text-[#0f5132]" : "text-foreground")} title={m.experimentId}>{m.experimentId}</div>
              <div className="mt-1 flex min-w-0 items-center gap-1.5">
                <StatusChip status={reg?.status} />
                {reg?.display_name && <span className="min-w-0 truncate text-[10.5px] text-muted-foreground" title={reg.display_name}>{reg.display_name}{reg.version ? ` · v${reg.version}` : ""}</span>}
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <span className="min-w-0 truncate rounded-md bg-black/[0.035] px-1.5 py-0.5 font-mono text-[10.5px] text-[#334155]">{m.encoder || "—"}</span>
                <span className="shrink-0 whitespace-nowrap text-[11px] font-semibold text-[#15803d]">U-Net</span>
                <label
                  className="ml-auto inline-flex shrink-0 cursor-pointer select-none items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input type="checkbox" className="peer sr-only" checked={checked} onChange={() => onToggleCompare(m.experimentId)} />
                  <span className={cn(
                    "grid h-3.5 w-3.5 place-items-center rounded border transition peer-focus-visible:ring-2 peer-focus-visible:ring-[#15803d]/40",
                    checked ? "border-[#15803d] bg-[#15803d] text-white" : "border-black/20 bg-white",
                  )}>
                    {checked && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                  </span>
                  compare
                </label>
              </div>
            </motion.div>
          );
        })}

        {models === null && (
          <div className="rounded-2xl border border-dashed border-black/10 bg-white/70 p-4 text-center text-xs text-muted-foreground">Loading models…</div>
        )}
        {models?.length === 0 && (
          <div className="rounded-2xl border border-dashed border-black/10 bg-white/70 p-4 text-center text-xs text-muted-foreground">No trained models found.</div>
        )}
      </div>
      {compareIds.length === 1 && <p className="px-1 text-[10.5px] text-muted-foreground">Tick one more model to compare.</p>}

      <BaselineCard />
    </div>
  );
}

/** The foundation paper's number — shown for orientation only, never as ours. */
export function BaselineCard() {
  return (
    <div className={cn(GLASS, "space-y-1.5 p-4")}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-amber-800">
        <BookOpen className="h-3.5 w-3.5" /> Published baseline — not our result
      </div>
      <div className="text-[13px] font-semibold text-foreground">UNB7 (Ghorbanian et al.)</div>
      <p className="text-[11.5px] leading-relaxed text-muted-foreground">
        U-Net + EfficientNet-B7 · OA 95.56% · κ 0.94 (their Sentinel-1 study, their data).{" "}
        <span className="font-medium text-[#7c2d12]">UNB7 is not yet trained here.</span>
      </p>
    </div>
  );
}
