"use client";

import { useEffect, useState } from "react";
import { animate, motion, useReducedMotion } from "framer-motion";
import { ChevronDown, Leaf, Link2, Split } from "lucide-react";

import type { ScenarioResult } from "@/lib/api";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Counts from `from` to `to` once (presentation only — both ends are the recomputed values). */
function useCount(from: number, to: number, delay = 0, duration = 1.1) {
  const reduce = useReducedMotion();
  const [v, setV] = useState(reduce ? to : from);
  useEffect(() => {
    if (reduce) return;
    const c = animate(from, to, { duration, delay, ease: EASE, onUpdate: setV });
    return () => c.stop();
  }, [from, to, delay, duration, reduce]);
  return reduce ? to : v;
}

/**
 * Before → after of one digital-twin what-if. Every number is the backend's exact recomputation (baseline vs
 * scenario); the count-up and slide-in are presentation only.
 */
export function TwinResult({ res }: { res: ScenarioResult }) {
  const b = res.baseline, s = res.scenario!;
  const pct = res.difference?.iic_pct ?? (b.iic ? (100 * (s.iic - b.iic)) / b.iic : 0);
  const shown = useCount(0, pct, 0.15, 1.3);
  const up = pct > 0;

  const tiles: { icon: typeof Split; label: string; from: number; to: number; dec: number; worse: boolean }[] = [
    { icon: Split, label: "Groups", from: b.n_components, to: s.n_components, dec: 0, worse: s.n_components > b.n_components },
    { icon: Link2, label: "Links", from: b.n_edges, to: s.n_edges, dec: 0, worse: s.n_edges < b.n_edges },
    { icon: Leaf, label: "Area ha", from: b.habitat_area_ha, to: s.habitat_area_ha, dec: 1, worse: s.habitat_area_ha < b.habitat_area_ha },
  ];

  return (
    <div className="space-y-2.5">
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE }}
        className={cn(
          "relative overflow-hidden rounded-2xl border p-4",
          up ? "border-[#16a34a]/20 bg-gradient-to-br from-[#f0fdf4] to-white" : pct < 0 ? "border-[#dc2626]/20 bg-gradient-to-br from-[#fef2f2] to-white" : "border-black/[0.06] bg-white",
        )}
      >
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Connectivity (IIC)</div>
        <div className={cn("mt-1 text-[34px] font-black leading-none tracking-tight tabular", up ? "text-[#15803d]" : pct < 0 ? "text-[#dc2626]" : "text-foreground")}>
          {pct === 0 ? "No change" : `${shown > 0 ? "+" : shown < 0 ? "−" : ""}${Math.abs(shown).toFixed(1)} %`}
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
          <motion.div
            className={cn("h-full rounded-full", up ? "bg-[#16a34a]" : "bg-[#dc2626]")}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, Math.abs(pct))}%` }}
            transition={{ duration: 1.3, delay: 0.15, ease: EASE }}
          />
        </div>
      </motion.div>

      <div className="grid grid-cols-3 gap-2">
        {tiles.map((t, i) => <Tile key={t.label} {...t} delay={0.25 + i * 0.1} />)}
      </div>

      <details className="group rounded-xl border border-black/[0.06] bg-white px-3 py-2 text-[11.5px] text-muted-foreground">
        <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-foreground">
          What changed
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
        </summary>
        <p className="mt-1.5 leading-relaxed">{res.explanation}</p>
      </details>
    </div>
  );
}

function Tile({ icon: Icon, label, from, to, dec, worse, delay }: { icon: typeof Split; label: string; from: number; to: number; dec: number; worse: boolean; delay: number }) {
  const v = useCount(from, to, delay + 0.2, 1);
  const same = from === to;
  return (
    <motion.div
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.45, delay, ease: EASE }}
      className="rounded-xl border border-black/[0.06] bg-white px-2.5 py-2"
    >
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />{label}
      </div>
      <div className={cn("mt-1 text-[18px] font-extrabold leading-none tabular", same ? "text-foreground" : worse ? "text-[#dc2626]" : "text-[#15803d]")}>
        {v.toFixed(dec)}
      </div>
      <div className="mt-1 text-[10.5px] tabular text-muted-foreground">{same ? "no change" : `was ${from.toFixed(dec)}`}</div>
    </motion.div>
  );
}
