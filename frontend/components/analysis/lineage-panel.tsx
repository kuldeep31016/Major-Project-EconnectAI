"use client";

import { useState } from "react";
import { CheckCircle2, CircleDashed, Loader2, RotateCcw, XCircle } from "lucide-react";
import { reproduceRun, type Lineage, type ReproduceResult } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";

const DOT: Record<string, string> = { recorded: "bg-[#15803d]", partial: "bg-[#d97706]", not_recorded: "bg-[#b91c1c]", not_applicable: "bg-slate-300" };

function fmt(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "number") return Math.abs(v) > 0 && Math.abs(v) < 1e-3 ? v.toExponential(3) : String(Math.round(v * 1e4) / 1e4);
  if (Array.isArray(v)) return v.map(fmt).join(", ");
  if (typeof v === "object") return Object.entries(v as Record<string, unknown>).filter(([, x]) => x != null).map(([k, x]) => `${k} ${fmt(x)}`).join(" · ");
  return String(v);
}

/** "Why am I seeing this?" — the stored evidence chain, step by step, plus an on-demand reproduction check. */
export function LineagePanel({ lineage, studyArea }: { lineage: Lineage; studyArea: string }) {
  const { user } = useAuth();
  const [state, setState] = useState<{ busy: boolean; stage?: string; res?: ReproduceResult; err?: string }>({ busy: false });
  const run = async () => {
    setState({ busy: true });
    try {
      const res = await reproduceRun(studyArea, lineage.run_id, (j) => setState({ busy: true, stage: j.stage ?? j.status }));
      setState({ busy: false, res });
    } catch (e) {
      setState({ busy: false, err: e instanceof Error ? e.message : String(e) });
    }
  };
  return (
    <section>
      <div className="text-[10px] uppercase tracking-wider text-[#0f5132]">Why am I seeing this? — provenance</div>
      <ol className="mt-1.5 space-y-1.5 border-l border-foreground/10 pl-3">
        {lineage.steps.map((s) => (
          <li key={s.step} className="relative text-[11.5px]">
            <span className={`absolute -left-[17px] top-1 h-2 w-2 rounded-full ${DOT[s.status] ?? "bg-slate-300"}`} title={s.status} />
            <div className="font-semibold">{s.title}{s.status !== "recorded" && <span className="ml-1 font-normal text-muted-foreground">({s.status.replace("_", " ")})</span>}</div>
            <div className="break-words text-muted-foreground">{fmt(s.detail)}</div>
            {s.artifacts.length > 0 && <div className="font-mono text-[10px] text-muted-foreground">{s.artifacts.map((a) => `${a.kind} ${a.sha256?.slice(0, 10) ?? "—"}`).join(" · ")}</div>}
            {s.caveat && <div className="text-[#b45309]">{s.caveat}</div>}
          </li>
        ))}
      </ol>
      <div className="mt-2 flex items-center gap-2">
        <button disabled={!user || state.busy} onClick={run}
          className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/15 px-2.5 py-1 text-[11.5px] font-medium hover:bg-foreground/[0.04] disabled:opacity-50">
          {state.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Reproduce this analysis
        </button>
        {!user && <span className="text-[11px] text-muted-foreground">sign in to run</span>}
        {state.busy && state.stage && <span className="text-[11px] text-muted-foreground">{state.stage}</span>}
      </div>
      {state.err && <div className="mt-1 text-[11.5px] text-[#b91c1c]">{state.err}</div>}
      {state.res && (
        <div className="mt-1.5 rounded-lg bg-foreground/[0.03] p-2 text-[11.5px]">
          <div className="flex items-center gap-1.5 font-semibold">
            {state.res.reproduced ? <CheckCircle2 className="h-4 w-4 text-[#15803d]" /> : <XCircle className="h-4 w-4 text-[#b91c1c]" />}
            {state.res.reproduced ? "Reproduced exactly" : "Differences found"} <span className="font-normal text-muted-foreground">({state.res.level} level)</span>
          </div>
          {state.res.checks.map((c) => (
            <div key={c.name} className="flex items-start gap-1.5">
              {c.match ? <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-[#15803d]" /> : <CircleDashed className="mt-0.5 h-3 w-3 shrink-0 text-[#b91c1c]" />}
              <span>{c.name}{!c.match && `: stored ${fmt(c.stored)} vs ${fmt(c.recomputed)}`}</span>
            </div>
          ))}
          {state.res.note && <div className="mt-1 text-muted-foreground">{state.res.note}</div>}
        </div>
      )}
      <ul className="mt-2 list-disc pl-4 text-[11px] text-muted-foreground">{lineage.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
    </section>
  );
}
