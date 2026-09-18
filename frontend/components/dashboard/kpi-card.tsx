"use client";

import { motion } from "framer-motion";
import { ArrowDownRight, ArrowRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { AnimatedNumber } from "@/components/shared/animated-number";
import { Sparkline } from "@/components/charts";
import { EASE } from "@/components/shared/motion";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  thousands?: boolean;
  icon: LucideIcon;
  accent?: string;
  /** Period-on-period change; sign drives the arrow and colour. */
  delta?: number;
  deltaSuffix?: string;
  /** Lower is better (e.g. fragmentation) — inverts the delta colouring. */
  invertDelta?: boolean;
  hint?: string;
  spark?: number[];
  index?: number;
}

export function KpiCard({
  label,
  value,
  decimals = 0,
  suffix,
  prefix,
  thousands,
  icon: Icon,
  accent = "#00c896",
  delta,
  deltaSuffix = "",
  invertDelta = false,
  hint,
  spark,
  index = 0,
}: Props) {
  const good = delta === undefined ? null : invertDelta ? delta < 0 : delta > 0;
  const DeltaIcon = delta === undefined || delta === 0 ? ArrowRight : good ? ArrowUpRight : ArrowDownRight;
  const deltaColor =
    delta === undefined || delta === 0
      ? "text-muted-foreground"
      : good
        ? "text-[#22c55e]"
        : "text-[#ef4444]";

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE, delay: index * 0.06 }}
      className="group relative overflow-hidden rounded-2xl border border-foreground/[0.08] bg-card/80 p-4 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground/15 sm:p-5"
    >
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-25"
        style={{ background: accent }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-transform duration-300 group-hover:scale-105"
          style={{ background: `${accent}1f`, color: accent }}
        >
          <Icon className="h-[18px] w-[18px]" />
        </div>

        {delta !== undefined && (
          <div className={cn("flex items-center gap-0.5 text-[11px] font-semibold tabular", deltaColor)}>
            <DeltaIcon className="h-3.5 w-3.5" />
            {delta > 0 ? "+" : ""}
            {delta.toFixed(1)}
            {deltaSuffix}
          </div>
        )}
      </div>

      <div className="relative mt-4">
        <div className="text-[26px] font-bold leading-none tracking-tight sm:text-[28px]">
          <AnimatedNumber
            value={value}
            decimals={decimals}
            prefix={prefix}
            suffix={suffix}
            thousands={thousands}
          />
        </div>
        <div className="mt-2 text-[11px] font-medium text-muted-foreground">{label}</div>
        {hint && <div className="mt-1 text-[10px] leading-snug text-muted-foreground/70">{hint}</div>}
      </div>

      {spark && (
        <div className="relative -mx-1 mt-3 opacity-70 transition-opacity group-hover:opacity-100">
          <Sparkline data={spark} color={accent} height={34} />
        </div>
      )}
    </motion.div>
  );
}
