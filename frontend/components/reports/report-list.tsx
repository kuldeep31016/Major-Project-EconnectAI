"use client";

import { motion, useReducedMotion } from "framer-motion";
import { FileText, ShieldCheck } from "lucide-react";
import type { ScientificReport } from "@/types";
import { fmtDate } from "@/utils/format";
import { cn } from "@/lib/utils";
import { areaName } from "./report-data";
import { StatusChip } from "./report-view";

export function ReportList({ reports, activeId, onSelect, detail }: { reports: ScientificReport[]; activeId?: string; onSelect: (id: string) => void; detail?: (r: ScientificReport) => string | undefined }) {
  const reduce = useReducedMotion();
  return (
    <nav aria-label="Reports" className="space-y-2">
      <div className="mb-1 flex items-baseline justify-between px-1">
        <span className="text-[13px] font-bold text-[#0b1f17]">Reports</span>
        <span className="text-[12px] text-[#64748b]">{reports.length}</span>
      </div>
      {reports.map((r, i) => {
        const active = r.id === activeId;
        const official = r.id.startsWith("official-");
        return (
          <motion.button
            key={r.id}
            type="button"
            aria-current={active ? "true" : undefined}
            initial={reduce ? false : { opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.3) }}
            onClick={() => onSelect(r.id)}
            className={cn(
              "group relative w-full rounded-2xl border bg-white p-3.5 text-left transition-all",
              active ? "border-[#15803d] shadow-[0_6px_20px_-12px_rgba(21,128,61,0.55)] ring-1 ring-[#15803d]/30" : "border-black/[0.06] hover:border-[#15803d]/35 hover:shadow-sm",
            )}
          >
            {active && <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-[#15803d]" aria-hidden="true" />}
            <div className="flex items-start gap-3">
              <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", active ? "bg-[#15803d] text-white" : "bg-[#f1f5f4] text-[#64748b] group-hover:text-[#15803d]")}>
                {official ? <ShieldCheck className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-[#0b1f17]">{areaName(r)}</div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <StatusChip status={r.status} />
                  <span className="text-[11.5px] text-[#64748b]">{fmtDate(r.generatedAt)}</span>
                </div>
                {(official || detail?.(r)) && (
                  <div className="mt-1 text-[11.5px] text-[#64748b]">
                    {official && <span className="font-semibold text-[#1e5f8a]">Official · </span>}{detail?.(r)}
                  </div>
                )}
              </div>
            </div>
          </motion.button>
        );
      })}
    </nav>
  );
}
