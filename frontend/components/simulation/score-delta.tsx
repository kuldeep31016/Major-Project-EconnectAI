"use client";

import { motion } from "framer-motion";
import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import { AnimatedNumber } from "@/components/shared/animated-number";
import { scoreGradeColor } from "@/utils/format";
import { cn } from "@/lib/utils";

/**
 * Before → after connectivity readout. The centre delta is the number the
 * whole simulator exists to produce, so it gets the visual weight.
 */
export function ScoreDelta({
  before,
  after,
  label = "Connectivity score",
  className,
}: {
  before: number;
  after: number;
  label?: string;
  className?: string;
}) {
  const delta = after - before;
  const worse = delta < 0;
  const pctChange = before === 0 ? 0 : (delta / before) * 100;

  return (
    <div
      className={cn(
        "rounded-2xl border border-foreground/[0.08] bg-foreground/[0.03] p-4 sm:p-5",
        className,
      )}
    >
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>

      <div className="mt-3 flex items-center gap-3 sm:gap-4">
        {/* before */}
        <div className="min-w-0 flex-1">
          <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground">Before</div>
          <div
            className="mt-0.5 text-2xl font-bold leading-none tabular sm:text-[28px]"
            style={{ color: scoreGradeColor(before) }}
          >
            {before.toFixed(1)}
          </div>
        </div>

        <motion.div
          animate={{ x: [0, 4, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          className="shrink-0 text-muted-foreground"
        >
          <ArrowRight className="h-5 w-5" />
        </motion.div>

        {/* after */}
        <div className="min-w-0 flex-1">
          <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground">After</div>
          <div
            className="mt-0.5 text-2xl font-bold leading-none tabular sm:text-[28px]"
            style={{ color: scoreGradeColor(after) }}
          >
            <AnimatedNumber value={after} decimals={1} duration={900} />
          </div>
        </div>
      </div>

      {/* delta bar */}
      <div className="mt-4">
        <div className="relative h-2 overflow-hidden rounded-full bg-foreground/[0.08]">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ background: scoreGradeColor(after) }}
            initial={{ width: `${before}%` }}
            animate={{ width: `${Math.max(0, after)}%` }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          />
          {/* ghost of the original score */}
          <div
            className="absolute inset-y-0 w-px bg-white/60"
            style={{ left: `${before}%` }}
          />
        </div>
      </div>

      <div
        className={cn(
          "mt-3 flex items-center justify-between rounded-xl px-3 py-2.5",
          worse ? "bg-[#ef4444]/10" : "bg-[#22c55e]/10",
        )}
      >
        <span className="flex items-center gap-1.5 text-[11px] font-medium">
          {worse ? (
            <TrendingDown className="h-3.5 w-3.5 text-[#ef4444]" />
          ) : (
            <TrendingUp className="h-3.5 w-3.5 text-[#22c55e]" />
          )}
          <span className={worse ? "text-[#ef4444]" : "text-[#22c55e]"}>
            {worse ? "Connectivity loss" : "Connectivity gain"}
          </span>
        </span>
        <span
          className="text-[15px] font-bold tabular"
          style={{ color: worse ? "#ef4444" : "#22c55e" }}
        >
          {delta > 0 ? "+" : ""}
          {delta.toFixed(1)}
          <span className="ml-1.5 text-[11px] font-medium opacity-70">
            ({pctChange > 0 ? "+" : ""}
            {pctChange.toFixed(1)}%)
          </span>
        </span>
      </div>
    </div>
  );
}

/** Compact before/after row used inside impact tables. */
export function ImpactRow({
  label,
  before,
  after,
  unit,
  index = 0,
}: {
  label: string;
  before: number;
  after: number;
  unit: string;
  index?: number;
}) {
  const delta = after - before;
  const worse = delta < 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      className="flex items-center gap-3 rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-2.5"
    >
      <span className="min-w-0 flex-1 truncate text-[11.5px] text-muted-foreground">{label}</span>
      <span className="shrink-0 text-[11.5px] tabular text-muted-foreground line-through decoration-white/25">
        {before.toLocaleString("en-IN")}
      </span>
      <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/50" />
      <span
        className="shrink-0 text-[12px] font-bold tabular"
        style={{ color: worse ? "#ef4444" : "#22c55e" }}
      >
        {after.toLocaleString("en-IN")}
      </span>
      <span className="w-14 shrink-0 text-right text-[10px] text-muted-foreground">{unit}</span>
    </motion.div>
  );
}
