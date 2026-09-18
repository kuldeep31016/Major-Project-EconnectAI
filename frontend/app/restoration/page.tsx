"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { CheckCircle2, ClipboardCheck, Sprout, Upload, XCircle } from "lucide-react";
import { AppShell } from "@/components/dashboard/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAnalysis } from "@/hooks/use-analysis";
import { useAuth } from "@/hooks/use-auth";
import { applyRestorationRanking, createTask, fetchFeasibility, postRestoration, type Feasibility, type FeasibilityCandidate } from "@/lib/api";
import { applyRestorationActions, getGraph, getHabitatMask, getHeatmap, getRestoration } from "@/lib/data";
import { cn } from "@/lib/utils";

const GisMap = dynamic(() => import("@/components/maps/gis-map"), { ssr: false });
const VERDICT: Record<string, { label: string; variant: "success" | "warning" | "danger" }> = {
  recommended: { label: "Recommended", variant: "success" }, conditional: { label: "Conditional", variant: "warning" }, not_recommended: { label: "Not recommended", variant: "danger" },
};

/** Restoration Planner: gain ranking (Eq. 11), rule-based feasibility with WHY / WHY NOT / NOT ASSESSED, optional cost upload (Eq. 12). */
export default function RestorationPlanner() {
  const { can, user } = useAuth();
  const { sceneId, scene, runId, dataSource, bump, selectedPatchId, setSelectedPatchId } = useAnalysis();
  const live = dataSource.mode === "live";
  const [fe, setFe] = useState<Feasibility | null>(null);
  const [active, setActive] = useState<FeasibilityCandidate | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const mask = getHabitatMask(sceneId); const graph = getGraph(sceneId); const heatmap = getHeatmap(sceneId); const restoration = getRestoration(sceneId);

  useEffect(() => {
    setFe(null); setActive(null);
    if (!live) return;
    fetchFeasibility(sceneId, runId).then(setFe).catch(() => setFe(null));
  }, [sceneId, runId, live, dataSource.provenance?.runId]);

  const costUpload = async (f: File) => {
    const text = await f.text();
    const costs: Record<string, number> = {};
    text.split(/\r?\n/).forEach((l, i) => { const [id, c] = l.split(",").map((x) => x.trim()); if (i === 0 && Number.isNaN(Number(c))) return; if (id && !Number.isNaN(Number(c))) costs[id] = Number(c); });
    const r = await postRestoration(sceneId, { costs, cost_unit: "user units" }, runId);
    applyRestorationActions(sceneId, applyRestorationRanking(restoration.actions, r), r.ranking_basis);
    setNote(`${Object.keys(costs).length} user costs applied · ranking basis now ${r.ranking_basis} (Eq. 12)`); bump();
  };

  return (
    <AppShell title="Restoration Planner" subtitle={`${scene.shortName} · ${fe?.ranking_basis ?? "ranked by connectivity gain; cost data unavailable"}`} bleed>
      <div className="grid h-[calc(100vh-4rem)] grid-cols-1 lg:grid-cols-[400px_1fr_380px]">
        <div className="scroll-slim overflow-y-auto border-r border-foreground/[0.08] p-3 space-y-2">
          {!live && <div className="rounded-xl border border-[#b45309]/30 bg-[#fffbeb] p-3 text-[11.5px] text-[#78350f]">Needs a real analysis run (candidates come from the model's marginal-probability areas).</div>}
          {fe && <div className="rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] p-3 text-[11px] leading-relaxed text-muted-foreground"><b className="text-foreground">Candidate method:</b> {fe.candidate_method}. <b className="text-foreground">Gain:</b> Rᵢ = C(G + vᵢ) − C(G), {fe.metric.toUpperCase()}.</div>}
          {fe?.candidates.map((c) => (
            <button key={c.candidate_id} onClick={() => setActive(c)} className={cn("w-full rounded-xl border px-3 py-2 text-left", active?.candidate_id === c.candidate_id ? "border-[#0f5132]/40 bg-[#0f5132]/[0.06]" : "border-foreground/[0.08] hover:bg-foreground/[0.03]")}>
              <div className="flex items-center justify-between gap-2"><span className="text-[12.5px] font-semibold">#{c.rank} {c.candidate_id} · {c.area_ha.toFixed(1)} ha</span><Badge variant={VERDICT[c.verdict].variant}>{VERDICT[c.verdict].label}</Badge></div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">+{c.gain_pct.toFixed(2)} % {fe.metric.toUpperCase()} · {c.new_links} link(s) · {c.nearest_habitat_km != null ? `${c.nearest_habitat_km.toFixed(2)} km to habitat` : ""}</div>
            </button>
          ))}
          {live && can("change_parameters") && (
            <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-foreground/15 px-3 py-2 text-[11.5px] hover:border-[#0f5132]/50"><Upload className="h-3.5 w-3.5" /> Upload real cost table (candidate_id,cost) → Eq. 12
              <input type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && void costUpload(e.target.files[0])} /></label>
          )}
          {note && <div className="text-[11px] text-[#1e5f8a]">{note}</div>}
        </div>
        <div className="relative min-h-[420px]">
          <GisMap scene={scene} mask={mask} graph={graph} heatmap={heatmap} layers={{ satellite: true, probability: false, habitat: true, heatmap: false, connectivity: true, protectedAreas: false, labels: false }} basemap="satellite" heatOpacity={0.5} selectedPatchId={selectedPatchId} onSelectPatch={setSelectedPatchId} className="h-full w-full" />
          <div className="pointer-events-none absolute left-3 top-3 z-[900] rounded-lg bg-white/90 px-3 py-1.5 text-[11px] shadow">{live ? "REAL DATA · candidates are model output, not surveyed sites" : "DEMONSTRATION DATA"}</div>
          {active && <div className="absolute bottom-3 left-3 z-[900] rounded-lg bg-white/95 px-3 py-2 text-[11px] shadow">Candidate {active.candidate_id} at {active.centroid[0].toFixed(4)}, {active.centroid[1].toFixed(4)} · links to {active.linked_patch_ids.join(", ") || "—"}</div>}
        </div>
        <div className="scroll-slim overflow-y-auto border-l border-foreground/[0.08] p-3 space-y-3">
          {!active ? <Card><CardContent className="p-5 text-[12.5px] text-muted-foreground"><Sprout className="mb-2 h-5 w-5 text-[#15803d]" />Select a candidate to see why it is (or is not) recommended and what has not been assessed.</CardContent></Card> : (
            <>
              <Card>
                <CardHeader className="pb-1"><CardTitle className="flex items-center justify-between text-[13px]">{active.candidate_id}<Badge variant={VERDICT[active.verdict].variant}>{VERDICT[active.verdict].label}</Badge></CardTitle><CardDescription>{active.area_ha.toFixed(1)} ha · +{active.gain_pct.toFixed(2)} % {fe?.metric.toUpperCase()} · {active.new_links} new link(s)</CardDescription></CardHeader>
                <CardContent className="space-y-3 text-[12px]">
                  <div><div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-[#15803d]"><CheckCircle2 className="h-3 w-3" /> Why recommended</div><ul className="list-disc space-y-0.5 pl-4">{active.why.map((w) => <li key={w}>{w}</li>)}</ul></div>
                  <div><div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-[#b91c1c]"><XCircle className="h-3 w-3" /> Why not / conditions</div>{active.why_not.length ? <ul className="list-disc space-y-0.5 pl-4">{active.why_not.map((w) => <li key={w}>{w}</li>)}</ul> : <div className="text-muted-foreground">No rule against it in the available layers.</div>}</div>
                  <div><div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Not assessed (no data loaded)</div><ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">{active.not_assessed.map((w) => <li key={w}>{w}</li>)}</ul></div>
                </CardContent>
              </Card>
              {user && can("assign_tasks") && (
                <Button size="sm" onClick={async () => { await createTask({ study_area_id: sceneId, title: `Site assessment: restoration candidate ${active.candidate_id}`, reason: `Model-ranked restoration site (+${active.gain_pct.toFixed(2)} % ${fe?.metric.toUpperCase()}). Verify land status, tidal regime and feasibility on the ground. ${active.why_not.join("; ")}`, lat: active.centroid[0], lon: active.centroid[1], object_type: "candidate", object_id: active.candidate_id, run_id: dataSource.provenance?.runId, evidence_required: "photo + observation + access notes" }); setNote(`Field assessment task created for ${active.candidate_id}.`); }}><ClipboardCheck className="h-3.5 w-3.5" /> Create field assessment task</Button>
              )}
              <div className="text-[10.5px] text-muted-foreground">Rules: within {String(fe?.rules.near_km)} km of habitat favours; NDWI &gt; {String(fe?.rules.water_ndwi)} flags open water; &gt; 50 % overlap with existing habitat rejects. {String(fe?.rules.note)}</div>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
