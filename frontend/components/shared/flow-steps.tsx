"use client";

import { Fragment, type ComponentType } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface FlowStep {
  label: string;
  icon: ComponentType<{ className?: string }>;
  tone?: "green" | "blue" | "amber" | "violet" | "slate";
}

const TONE: Record<NonNullable<FlowStep["tone"]>, string> = {
  green: "bg-[#dcfce7] text-[#15803d] border-[#bbf7d0]",
  blue: "bg-[#dbeafe] text-[#1e5f8a] border-[#bfdbfe]",
  amber: "bg-[#fef3c7] text-[#b45309] border-[#fde68a]",
  violet: "bg-[#ede9fe] text-[#6d28d9] border-[#ddd6fe]",
  slate: "bg-[#f1f5f9] text-[#334155] border-[#e2e8f0]",
};

/**
 * A small animated workflow diagram (replaces long "A → B → C" sentences).
 * Steps appear one after another, and a dot travels along each connector to show the direction of the flow.
 * Wraps on narrow screens; static when the user prefers reduced motion.
 */
export function FlowSteps({ steps, className, note }: { steps: FlowStep[]; className?: string; note?: string }) {
  const reduce = useReducedMotion();
  return (
    <div className={cn("rounded-xl border border-black/[0.06] bg-[#fafcfb] p-3", className)}>
      <div className="flex flex-wrap items-center gap-y-3">
        {steps.map((s, i) => (
          <Fragment key={s.label}>
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.12, duration: 0.35 }}
              className="flex min-w-0 flex-col items-center gap-1.5 text-center"
            >
              <span className={cn("grid h-9 w-9 place-items-center rounded-xl border", TONE[s.tone ?? "slate"])}><s.icon className="h-[17px] w-[17px]" /></span>
              <span className="max-w-[92px] text-[11px] font-semibold leading-tight text-[#334155]">{s.label}</span>
            </motion.div>
            {i < steps.length - 1 && (
              <div className="relative mx-1.5 mb-5 h-[2px] min-w-6 flex-1 overflow-hidden rounded-full bg-[#d1e7dc]" aria-hidden="true">
                {!reduce && (
                  <motion.span
                    className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[#15803d]"
                    initial={{ left: "-10%" }}
                    animate={{ left: "110%" }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 }}
                  />
                )}
              </div>
            )}
          </Fragment>
        ))}
      </div>
      {note && <p className="mt-2.5 text-[11.5px] text-muted-foreground">{note}</p>}
    </div>
  );
}
