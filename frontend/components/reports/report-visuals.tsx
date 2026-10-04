"use client";

import { useId, useState, type ComponentType, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { ReportSection } from "@/types";
import { Term } from "@/components/shared/term";
import { cn } from "@/lib/utils";

export const C = {
  deep: "#0f5132", green: "#15803d", leaf: "#16a34a", mint: "#00e599",
  red: "#dc2626", amber: "#f59e0b", blue: "#1e5f8a", slate: "#94a3b8",
};

/* ------------------------------------------------------------------ stat tile */
export function StatTile({ icon: Icon, label, value, unit, hint, tone = "green", delay = 0 }: {
  icon: ComponentType<{ className?: string }>; label: string; value: string; unit?: string; hint?: ReactNode;
  tone?: "green" | "blue" | "red" | "amber"; delay?: number;
}) {
  const reduce = useReducedMotion();
  const tones = {
    green: "bg-[#dcfce7] text-[#15803d]", blue: "bg-[#dbeafe] text-[#1e5f8a]",
    red: "bg-[#fee2e2] text-[#dc2626]", amber: "bg-[#fef3c7] text-[#b45309]",
  } as const;
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="flex min-w-0 flex-col rounded-2xl border border-black/[0.06] bg-white p-4"
    >
      <div className="flex items-center gap-2">
        <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg", tones[tone])}><Icon className="h-3.5 w-3.5" /></span>
        <span className="truncate text-[12px] font-semibold text-[#475569]">{label}</span>
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <span className="tabular text-[26px] font-bold leading-none tracking-tight text-[#0b1f17]">{value}</span>
        {unit && <span className="text-[13px] font-semibold text-[#64748b]">{unit}</span>}
      </div>
      {hint && <div className="mt-1.5 text-[12px] leading-snug text-[#64748b]">{hint}</div>}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ horizontal bars */
export interface BarDatum { key: string; label: string; value: number; display: string; highlight?: boolean; note?: string }

export function BarList({ data, color = C.green, highlightColor = C.red, max }: {
  data: BarDatum[]; color?: string; highlightColor?: string; max?: number;
}) {
  const reduce = useReducedMotion();
  const top = max ?? Math.max(...data.map((d) => d.value), 1e-9);
  return (
    <ul className="space-y-2">
      {data.map((d, i) => {
        const w = Math.max(1.5, (d.value / top) * 100);
        return (
          <li key={d.key} className="grid grid-cols-[52px_1fr_auto] items-center gap-3">
            <span className={cn("text-[12.5px] font-semibold", d.highlight ? "text-[#0b1f17]" : "text-[#475569]")}>{d.label}</span>
            <div className="relative h-[18px] overflow-hidden rounded-md bg-[#f1f5f4]">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-md"
                style={{ background: d.highlight ? highlightColor : color, opacity: d.highlight ? 1 : 0.55 + 0.45 * (1 - i / Math.max(data.length, 1)) }}
                initial={reduce ? { width: `${w}%` } : { width: 0 }}
                whileInView={{ width: `${w}%` }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.7, delay: reduce ? 0 : i * 0.05, ease: [0.22, 1, 0.36, 1] }}
              />
              {d.note && <span className="absolute inset-y-0 left-2 flex items-center text-[10.5px] font-semibold text-white mix-blend-normal">{d.note}</span>}
            </div>
            <span className="tabular min-w-[56px] text-right text-[12.5px] font-bold text-[#0b1f17]">{d.display}</span>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ proportion bar (part of a whole) */
export function PartBar({ parts, height = 14 }: { parts: { label: string; value: number; color: string }[]; height?: number }) {
  const reduce = useReducedMotion();
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div>
      <div className="flex w-full overflow-hidden rounded-full bg-[#f1f5f4]" style={{ height }}>
        {parts.map((p, i) => (
          <motion.div
            key={p.label}
            style={{ background: p.color }}
            initial={reduce ? { width: `${(p.value / total) * 100}%` } : { width: 0 }}
            whileInView={{ width: `${(p.value / total) * 100}%` }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: reduce ? 0 : i * 0.15 }}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {parts.map((p) => (
          <span key={p.label} className="flex items-center gap-1.5 text-[12px] text-[#475569]">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />{p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ technical details disclosure */
function SectionTechnical({ section }: { section: ReportSection }) {
  return (
    <div className="space-y-3">
      {section.body?.map((p, j) => <p key={j} className="text-[12.5px] leading-[1.7] text-[#475569]">{p}</p>)}
      {section.bullets && (
        <ul className="space-y-1.5">
          {section.bullets.map((b, j) => (
            <li key={j} className="flex gap-2 text-[12.5px] leading-relaxed text-[#475569]"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#15803d]" />{b}</li>
          ))}
        </ul>
      )}
      {section.table && section.table.rows.length > 0 && (
        <div className="scroll-slim overflow-x-auto rounded-xl border border-black/[0.06] bg-white">
          <table className="w-full min-w-[520px] border-collapse text-left">
            <thead>
              <tr className="bg-[#f6f8f7]">
                {section.table.columns.map((c) => (
                  <th key={c} className="whitespace-nowrap px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-[#64748b]"><Term side="bottom">{c}</Term></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.table.rows.map((row, ri) => (
                <tr key={ri} className="border-t border-black/[0.05]">
                  {row.map((cell, ci) => (
                    <td key={ci} className={cn("whitespace-nowrap px-3 py-2 text-[12px] tabular", ci <= 1 ? "font-medium text-[#0b1f17]" : "text-[#475569]")}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function TechnicalDetails({ section, label = "Technical details" }: { section: ReportSection; label?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const reduce = useReducedMotion();
  const hasContent = (section.body?.length ?? 0) > 0 || (section.bullets?.length ?? 0) > 0 || (section.table?.rows.length ?? 0) > 0;
  if (!hasContent) return null;
  return (
    <div className="mt-5 border-t border-dashed border-black/[0.08] pt-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg px-1 py-1 text-[12px] font-semibold text-[#15803d] hover:text-[#0f5132] print:hidden"
      >
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        {open ? "Hide" : "Show"} {label.toLowerCase()}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden print:hidden"
          >
            <div className="pt-3"><SectionTechnical section={section} /></div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* printed copy: the full original wording always goes on paper */}
      <div className="hidden pt-2 print:block"><SectionTechnical section={section} /></div>
    </div>
  );
}

/* ------------------------------------------------------------------ section card */
export function SectionCard({ step, icon: Icon, title, lead, children, section, aside, id }: {
  step?: number; icon: ComponentType<{ className?: string }>; title: string; lead: ReactNode;
  children?: ReactNode; section?: ReportSection; aside?: ReactNode; id?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      id={id}
      initial={reduce ? false : { opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.45 }}
      className="rounded-2xl border border-black/[0.06] bg-white p-5 sm:p-6 print:break-inside-avoid"
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#ecfdf3] text-[#15803d]"><Icon className="h-[18px] w-[18px]" /></span>
        <div className="min-w-0 flex-1">
          {step !== undefined && <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#16a34a]">Step {step}</div>}
          <h2 className="text-[19px] font-bold leading-tight tracking-tight text-[#0b1f17]">{title}</h2>
          <div className="mt-1.5 max-w-[68ch] text-[14px] leading-relaxed text-[#334155]">{lead}</div>
        </div>
        {aside}
      </div>
      {children && <div className="mt-5">{children}</div>}
      {section && <TechnicalDetails section={section} />}
    </motion.section>
  );
}

/** Big before → after comparison used in summaries. */
export function BeforeAfter({ label, before, after, worse }: { label: string; before: string; after: string; worse?: boolean }) {
  return (
    <div className="rounded-xl border border-black/[0.06] bg-[#fafcfb] px-3.5 py-3">
      <div className="text-[11.5px] font-semibold text-[#64748b]">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="tabular text-[17px] font-bold text-[#334155]">{before}</span>
        <span className="text-[13px] text-[#94a3b8]">→</span>
        <span className={cn("tabular text-[17px] font-bold", worse ? "text-[#dc2626]" : "text-[#15803d]")}>{after}</span>
      </div>
    </div>
  );
}
