"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, Check, ClipboardList, Gavel, Map as MapIcon, Scale, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { createReview, decideReview, fetchReviews, gisReview, reviewFieldTask, setFeasibility, type RestorationReview } from "@/lib/api";
import { cn } from "@/lib/utils";

const STAGES = ["GIS_REVIEW", "FIELD_VERIFICATION", "FEASIBILITY", "DECIDED"] as const;
const STAGE_META: Record<(typeof STAGES)[number], { label: string; icon: typeof MapIcon }> = {
  GIS_REVIEW: { label: "Map check", icon: MapIcon },
  FIELD_VERIFICATION: { label: "Field visit", icon: ClipboardList },
  FEASIBILITY: { label: "Feasibility", icon: Scale },
  DECIDED: { label: "Decision", icon: Gavel },
};
const FACTORS = ["ownership", "legal_status", "water_conditions", "land_use", "cost", "accessibility"];

function Row({ label, done, children }: { label: string; done: boolean; children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5">
      <span className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full", done ? "bg-[#15803d] text-white" : "border border-black/15 bg-white")}>{done && <Check className="h-3 w-3" strokeWidth={3} />}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-semibold text-[#0f172a]">{label}</div>
        <div className="text-[12px] text-[#475569]">{children}</div>
      </div>
    </div>
  );
}

/** Model candidate → GIS review → field verification → feasibility → human decision. */
export function ReviewPanel({ sceneId, runId, candidateId }: { sceneId: string; runId: string; candidateId: string }) {
  const { can } = useAuth();
  const [reviews, setReviews] = useState<RestorationReview[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => fetchReviews(sceneId).then(setReviews).catch(() => setReviews([])), [sceneId]);
  useEffect(() => { load(); }, [load]);
  const r = reviews?.find((x) => x.candidate_id === candidateId && (!runId || runId === "latest" || x.run_id === runId)) ?? null;
  const act = async (f: () => Promise<unknown>) => { setErr(null); try { await f(); await load(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } };
  const ask = (q: string) => window.prompt(q)?.trim() || null;
  const cur = r ? STAGES.indexOf(r.stage) : -1;

  return (
    <section className="rounded-2xl border border-black/[0.06] bg-white p-3.5">
      <div className="flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-lg bg-[#e0f2fe] text-[#1e5f8a]"><UserCheck className="h-3.5 w-3.5" /></span>
        <h3 className="text-[13px] font-bold text-[#0f172a]">Decision</h3>
        <span className="ml-auto text-[11px] text-muted-foreground">The model suggests; people decide.</span>
      </div>

      {reviews === null ? <div className="mt-3 text-[12px] text-muted-foreground">Loading…</div> : !r ? (
        <div className="mt-3 rounded-xl border border-dashed border-black/15 bg-[#f8fafc] p-3 text-[12px] text-[#475569]">
          No review yet. Every step is logged with who, when and why.
          {can("review_detections") && <Button size="sm" className="mt-2 w-full bg-[#0f5132] text-white hover:bg-[#0b3d26]" onClick={() => act(() => createReview(sceneId, runId, candidateId))}>Start review of {candidateId}</Button>}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <ol className="grid grid-cols-4 gap-1">
            {STAGES.map((st, i) => {
              const M = STAGE_META[st];
              const state = i < cur || r.stage === "DECIDED" ? "done" : i === cur ? "now" : "next";
              return (
                <li key={st} className="flex flex-col items-center gap-1 text-center">
                  <span className={cn("grid h-7 w-7 place-items-center rounded-lg", state === "done" ? "bg-[#dcfce7] text-[#15803d]" : state === "now" ? "bg-[#0f5132] text-white shadow" : "bg-black/[0.04] text-[#94a3b8]")}><M.icon className="h-3.5 w-3.5" /></span>
                  <span className={cn("text-[10.5px] font-semibold leading-tight", state === "next" ? "text-[#94a3b8]" : "text-[#334155]")}>{M.label}</span>
                </li>
              );
            })}
          </ol>

          <div className="flex items-start gap-2 rounded-xl bg-[#f5f3ff] px-3 py-2 text-[12px] text-[#4c1d95]">
            <Bot className="mt-px h-3.5 w-3.5 shrink-0" />
            <span>Model: rank #{r.model_recommendation.rank} · +{r.model_recommendation.gain_pct.toFixed(2)} % simulated · {r.model_recommendation.area_ha.toFixed(1)} ha · {r.model_recommendation.new_links} new link(s)</span>
          </div>

          <div className="space-y-2.5">
            <Row label="Map check" done={!!r.gis_review}>
              {r.gis_review ? `${r.gis_review.outcome} — ${r.gis_review.notes} (${r.gis_review.by})` : "Pending"}
              {r.stage === "GIS_REVIEW" && can("review_detections") && (
                <div className="mt-1.5 flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => { const n = ask("GIS review notes (why proceed)?"); if (n) act(() => gisReview(r.id, "PROCEED", n)); }}>Proceed to field</Button>
                  <Button size="sm" variant="ghost" onClick={() => { const n = ask("Why hold?"); if (n) act(() => gisReview(r.id, "HOLD", n)); }}>Hold</Button>
                </div>
              )}
            </Row>
            <Row label="Field visit" done={!!r.field_task && /done|complete|verified|closed/i.test(r.field_task.status)}>
              {r.field_task ? `Task #${r.field_task.id} · ${r.field_task.status}` : r.stage === "FIELD_VERIFICATION" ? "No task yet" : "After the map check"}
              {r.stage === "FIELD_VERIFICATION" && !r.field_task && can("assign_tasks") && <div className="mt-1.5"><Button size="sm" variant="outline" onClick={() => act(() => reviewFieldTask(r.id))}>Create field verification task</Button></div>}
            </Row>
            <Row label="Feasibility" done={r.stage === "DECIDED"}>
              {r.stage !== "FEASIBILITY" && r.stage !== "DECIDED" && <span className="text-muted-foreground">After the field visit</span>}
              <ul className="mt-1 grid grid-cols-2 gap-1">
                {FACTORS.map((f) => {
                  const val = r.feasibility[f];
                  return (
                    <li key={f} className={cn("rounded-lg px-2 py-1 text-[11.5px]", val ? "bg-[#f0fdf4]" : "bg-[#f8fafc]")} title={val ? `${val.source} (${val.by})` : undefined}>
                      <div className="flex items-center justify-between gap-1">
                        <span className="capitalize text-[#475569]">{f.replace(/_/g, " ")}</span>
                        {r.stage === "FEASIBILITY" && can("review_detections") && (
                          <button className="text-[11px] font-semibold text-[#0f5132] hover:underline" onClick={() => { const v = ask(`${f.replace(/_/g, " ")} — value?`); if (!v) return; const src = ask("Source (document, survey, office record)?"); if (src) act(() => setFeasibility(r.id, f, v, src)); }}>set</button>
                        )}
                      </div>
                      <div className={cn("truncate font-semibold", val ? "text-[#0f172a]" : "text-[#94a3b8]")}>{val ? val.value : "Not assessed"}</div>
                    </li>
                  );
                })}
              </ul>
            </Row>
            <Row label="Decision" done={!!r.decision}>
              <span className="flex flex-wrap items-center gap-1.5">
                {r.decision ? <Badge variant={r.decision === "APPROVED" ? "success" : r.decision === "REJECTED" ? "danger" : "secondary"}>{r.decision}</Badge> : "None yet"}
                {r.decision_reason && <span className="text-muted-foreground">— {r.decision_reason}</span>}
              </span>
              {r.stage !== "DECIDED" && can("decide_restoration") && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {(["APPROVED", "DEFERRED", "REJECTED"] as const).map((d) => (
                    <Button key={d} size="sm" variant={d === "APPROVED" ? "default" : "outline"} disabled={d === "APPROVED" && r.stage !== "FEASIBILITY"}
                      onClick={() => { const why = ask(`Reason for ${d.toLowerCase()}? (≥ 10 characters)`); if (why) act(() => decideReview(r.id, d, why)); }}>{d === "APPROVED" ? "Approve" : d === "DEFERRED" ? "Defer" : "Reject"}</Button>
                  ))}
                </div>
              )}
            </Row>
          </div>
        </div>
      )}
      {err && <div className="mt-2 text-[12px] text-[#b91c1c]">{err}</div>}
    </section>
  );
}
