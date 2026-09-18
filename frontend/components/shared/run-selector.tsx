"use client";

import { useAnalysis } from "@/hooks/use-analysis";

/** Switch the displayed run of the current study area (E1 primary, ablations, other years, synthetic). */
export function RunSelector() {
  const { runs, runId, setRunId, apiOnline } = useAnalysis();
  if (apiOnline !== true || runs.length === 0) return null;
  const short = (r: (typeof runs)[number]) =>
    `${r.runId}${r.sceneYear ? ` · ${r.sceneYear}` : ""} · ${r.resultKind === "synthetic" ? "synthetic" : r.resultKind === "development" ? "dev" : r.resultKind}`;
  return (
    <select
      aria-label="Pipeline run"
      value={runId}
      onChange={(e) => setRunId(e.target.value)}
      className="hidden max-w-[260px] truncate rounded-full border border-foreground/[0.12] bg-foreground/[0.04] px-2.5 py-1 text-[10.5px] text-foreground outline-none md:block"
    >
      <option value="latest">latest run</option>
      {runs.map((r) => (
        <option key={r.runId} value={r.runId}>
          {short(r)}
        </option>
      ))}
    </select>
  );
}
