"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { createReview, decideReview, fetchReviews, gisReview, reviewFieldTask, setFeasibility, type RestorationReview } from "@/lib/api";
import { cn } from "@/lib/utils";

const STAGES = ["GIS_REVIEW", "FIELD_VERIFICATION", "FEASIBILITY", "DECIDED"] as const;
const FACTORS = ["ownership", "legal_status", "water_conditions", "land_use", "cost", "accessibility"];

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

  return (
    <Card>
      <CardHeader className="pb-1"><CardTitle className="text-[13px]">Decision workflow</CardTitle>
        <CardDescription>The model recommends; people decide. Every step is recorded with who, when and why.</CardDescription></CardHeader>
      <CardContent className="space-y-2.5 text-[12px]">
        {reviews === null ? <div className="text-muted-foreground">Loading…</div> : !r ? (
          can("review_detections")
            ? <Button size="sm" onClick={() => act(() => createReview(sceneId, runId, candidateId))}>Start review of {candidateId}</Button>
            : <div className="text-muted-foreground">No review started for this candidate.</div>
        ) : (
          <>
            <ol className="flex flex-wrap gap-1 text-[10.5px]">
              {STAGES.map((st, i) => {
                const cur = STAGES.indexOf(r.stage);
                return <li key={st} className={cn("rounded-full px-2 py-0.5", i < cur ? "bg-[#15803d]/15 text-[#15803d]" : i === cur ? "bg-[#0f5132] text-white" : "bg-foreground/[0.05] text-muted-foreground")}>{st.replace("_", " ").toLowerCase()}</li>;
              })}
            </ol>
            <div className="rounded-lg border border-[#6d5bd0]/25 bg-[#6d5bd0]/5 p-2">
              <div className="text-[10px] uppercase tracking-wider text-[#6d5bd0]">Model recommendation</div>
              <div>Rank #{r.model_recommendation.rank} · +{r.model_recommendation.gain_pct.toFixed(2)} % simulated connectivity · {r.model_recommendation.area_ha.toFixed(1)} ha · {r.model_recommendation.new_links} new link(s)</div>
            </div>
            <div className="rounded-lg border border-[#0f5132]/25 bg-[#0f5132]/5 p-2 space-y-1.5">
              <div className="text-[10px] uppercase tracking-wider text-[#0f5132]">Human review & decision</div>
              <div>GIS review: {r.gis_review ? `${r.gis_review.outcome} — ${r.gis_review.notes} (${r.gis_review.by})` : "pending"}</div>
              {r.stage === "GIS_REVIEW" && can("review_detections") && (
                <div className="flex gap-1.5"><Button size="sm" variant="outline" onClick={() => { const n = ask("GIS review notes (why proceed)?"); if (n) act(() => gisReview(r.id, "PROCEED", n)); }}>Proceed to field</Button>
                  <Button size="sm" variant="ghost" onClick={() => { const n = ask("Why hold?"); if (n) act(() => gisReview(r.id, "HOLD", n)); }}>Hold</Button></div>
              )}
              <div>Field verification: {r.field_task ? `task #${r.field_task.id} · ${r.field_task.status}` : r.stage === "FIELD_VERIFICATION" ? "no task yet" : "—"}</div>
              {r.stage === "FIELD_VERIFICATION" && !r.field_task && can("assign_tasks") && <Button size="sm" variant="outline" onClick={() => act(() => reviewFieldTask(r.id))}>Create field verification task</Button>}
              <div>
                <div className="mb-0.5">Feasibility {r.stage !== "FEASIBILITY" && r.stage !== "DECIDED" && <span className="text-muted-foreground">(after field verification)</span>}</div>
                <ul className="space-y-0.5">
                  {FACTORS.map((f) => {
                    const v = r.feasibility[f];
                    return (
                      <li key={f} className="flex items-start justify-between gap-2">
                        <span>{f.replace(/_/g, " ")}: {v ? <b>{v.value}</b> : <span className="text-muted-foreground">Not assessed</span>}{v && <span className="text-muted-foreground"> · {v.source} ({v.by})</span>}</span>
                        {r.stage === "FEASIBILITY" && can("review_detections") && (
                          <button className="shrink-0 text-[11px] text-[#0f5132] underline" onClick={() => { const val = ask(`${f.replace(/_/g, " ")} — value?`); if (!val) return; const src = ask("Source (document, survey, office record)?"); if (src) act(() => setFeasibility(r.id, f, val, src)); }}>set</button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">Decision: {r.decision ? <Badge variant={r.decision === "APPROVED" ? "success" : r.decision === "REJECTED" ? "danger" : "secondary"}>{r.decision}</Badge> : <span className="text-muted-foreground">none</span>}
                {r.decision_reason && <span className="text-muted-foreground">— {r.decision_reason}</span>}</div>
              {r.stage !== "DECIDED" && can("decide_restoration") && (
                <div className="flex flex-wrap gap-1.5">
                  {(["APPROVED", "DEFERRED", "REJECTED"] as const).map((d) => (
                    <Button key={d} size="sm" variant={d === "APPROVED" ? "default" : "outline"} disabled={d === "APPROVED" && r.stage !== "FEASIBILITY"}
                      onClick={() => { const why = ask(`Reason for ${d.toLowerCase()}? (≥ 10 characters)`); if (why) act(() => decideReview(r.id, d, why)); }}>{d.toLowerCase()}</Button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
        {err && <div className="text-[#b91c1c]">{err}</div>}
      </CardContent>
    </Card>
  );
}
