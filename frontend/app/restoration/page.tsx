"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { ChevronDown, ClipboardCheck, Gavel, Lightbulb, Search, Sprout, Upload, X } from "lucide-react";
import { AppShell } from "@/components/dashboard/app-shell";
import { Button } from "@/components/ui/button";
import { FlowSteps } from "@/components/shared/flow-steps";
import { useAnalysis } from "@/hooks/use-analysis";
import { useAuth } from "@/hooks/use-auth";
import { ReviewPanel } from "@/components/restoration/review-panel";
import { CandidateList } from "@/components/restoration/candidate-list";
import { CandidateDetail } from "@/components/restoration/candidate-detail";
import { VERDICT, markerColor, type Verdict } from "@/components/restoration/verdict";
import { applyRestorationRanking, createTask, fetchFeasibility, postRestoration, type Feasibility, type FeasibilityCandidate } from "@/lib/api";
import { applyRestorationActions, getGraph, getHabitatMask, getHeatmap, getRestoration } from "@/lib/data";
import { cn } from "@/lib/utils";
import { requestMapFocus, useMapFocus } from "@/lib/map-focus";
import { lonBesideDrawer } from "@/components/simulation/scenario-map";
import { setChatFocus } from "@/lib/chat-focus";

const GisMap = dynamic(() => import("@/components/maps/gis-map"), { ssr: false });

const FLOW = [
  { label: "Candidate found", icon: Search, tone: "violet" as const },
  { label: "Why it helps", icon: Lightbulb, tone: "green" as const },
  { label: "Field check", icon: ClipboardCheck, tone: "amber" as const },
  { label: "Decision", icon: Gavel, tone: "blue" as const },
];

/** Restoration Planner: gain ranking (Eq. 11), rule-based feasibility with WHY / WHY NOT / NOT ASSESSED, optional cost upload (Eq. 12). */
export default function RestorationPlanner() {
  const { can, user } = useAuth();
  const { sceneId, scene, runId, dataSource, bump, selectedPatchId, setSelectedPatchId } = useAnalysis();
  const live = dataSource.mode === "live";
  const focus = useMapFocus();
  // feasibility tagged with the run it answers so a stale table is never shown for another run
  const [feRes, setFeRes] = useState<{ key: string; data: Feasibility | null } | null>(null);
  const feKey = `${sceneId}|${dataSource.provenance?.runId ?? ""}`;
  const fe = feRes?.key === feKey ? feRes.data : null;
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = fe?.candidates.find((c) => c.candidate_id === activeId) ?? null;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const setActive = (c: FeasibilityCandidate | null) => { setActiveId(c?.candidate_id ?? null); setDrawerOpen(!!c); setChatFocus({ candidate: c?.candidate_id ?? null }); };
  useEffect(() => () => setChatFocus({ candidate: null }), []);   // leaving the page clears the assistant's focus
  const [note, setNote] = useState<string | null>(null);
  const mask = getHabitatMask(sceneId); const graph = getGraph(sceneId); const heatmap = getHeatmap(sceneId); const restoration = getRestoration(sceneId);
  const metric = fe?.metric ?? "iic";

  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    const key = feKey;
    fetchFeasibility(sceneId, runId).then((d) => { if (!cancelled) setFeRes({ key, data: d }); }).catch(() => { if (!cancelled) setFeRes({ key, data: null }); });
    return () => { cancelled = true; };
  }, [sceneId, runId, live, feKey]);

  const costUpload = async (f: File) => {
    const text = await f.text();
    const costs: Record<string, number> = {};
    text.split(/\r?\n/).forEach((l, i) => { const [id, c] = l.split(",").map((x) => x.trim()); if (i === 0 && Number.isNaN(Number(c))) return; if (id && !Number.isNaN(Number(c))) costs[id] = Number(c); });
    const r = await postRestoration(sceneId, { costs, cost_unit: "user units" }, runId);
    applyRestorationActions(sceneId, applyRestorationRanking(restoration.actions, r), r.ranking_basis);
    setNote(`${Object.keys(costs).length} user costs applied · ranking basis now ${r.ranking_basis} (Eq. 12)`); bump();
  };

  const counts = (["recommended", "conditional", "field_check", "not_recommended"] as Verdict[]).map((v) => ({ v, n: fe?.candidates.filter((c) => c.verdict === v).length ?? 0 })).filter((x) => x.n > 0);
  const select = (c: FeasibilityCandidate) => { setActive(c); requestMapFocus(c.centroid[0], lonBesideDrawer(c.centroid[1], 14), 14); };

  return (
    <AppShell title="Restoration Planner" subtitle={`${scene.shortName} · ${fe?.ranking_basis ?? "ranked by connectivity gain; cost data unavailable"}`} bleed>
      {/* ------------------------------------------------ flow header */}
      <div className="border-t border-black/[0.05] px-4 pb-3 pt-3 sm:px-6">
        <div className="flex flex-wrap items-stretch gap-3">
          <FlowSteps steps={FLOW} className="min-w-[300px] flex-1 py-2.5 xl:max-w-[560px]" />
          <div className="flex min-w-[260px] flex-1 flex-col justify-center gap-2 rounded-xl border border-black/[0.06] bg-white px-3.5 py-2.5">
            <p className="text-[13px] font-semibold leading-snug text-[#0f172a]">Sites where restoring would reconnect the most habitat. <span className="font-normal text-[#b45309]">Model output — field check first.</span></p>
            <div className="flex flex-wrap items-center gap-1.5">
              {fe && <span className="text-[12px] font-bold text-[#0f172a]">{fe.candidates.length} candidates</span>}
              {counts.map(({ v, n }) => { const m = VERDICT[v]; return <span key={v} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: m.bg, color: m.color }}><m.icon className="h-3 w-3" />{n} {m.short.toLowerCase()}</span>; })}
              <button type="button" onClick={() => setHowOpen((o) => !o)} aria-expanded={howOpen} className="ml-auto inline-flex items-center gap-1 text-[12px] font-semibold text-[#0f5132] hover:underline">
                How are candidates found? <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", howOpen && "rotate-180")} />
              </button>
            </div>
          </div>
        </div>
        {howOpen && (
          <div className="mt-2 grid gap-3 rounded-xl border border-black/[0.06] bg-white p-3.5 text-[12.5px] leading-relaxed text-[#334155] md:grid-cols-3">
            <div><b className="text-[#0f172a]">1 · Find.</b> Areas where the model is unsure whether habitat is there become candidates.</div>
            <div><b className="text-[#0f172a]">2 · Test.</b> Each one is added to the network on its own and connectivity is recomputed. The rise is its gain.</div>
            <div><b className="text-[#0f172a]">3 · Screen.</b> Simple rules (distance to habitat, open water, overlap) give a status. Land, law and cost are not checked.</div>
            {fe && (
              <div className="rounded-lg bg-[#f8fafc] px-3 py-2 text-[11.5px] text-[#475569] md:col-span-3">
                <div><b>Method:</b> {fe.candidate_method}.</div>
                <div><b>Gain:</b> Rᵢ = C(G + vᵢ) − C(G), {metric.toUpperCase()} · {fe.ranking_basis}.</div>
                <div><b>Rules:</b> within {String(fe.rules.near_km)} km of habitat favours; NDWI &gt; {String(fe.rules.water_ndwi)} flags open water; &gt; 50 % overlap with existing habitat rejects. {String(fe.rules.note ?? "")}</div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="relative grid grid-cols-1 border-t border-black/[0.05] lg:h-[calc(100dvh-68px)] lg:min-h-[520px] lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)_400px]">
        {/* ------------------------------------------------ list */}
        <aside className="scroll-slim min-h-0 overflow-y-auto border-r border-black/[0.06] bg-[#fbfcfb] p-3.5">
          <div className="mb-2 flex items-center gap-2">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-[#0f5132] text-[10.5px] font-bold text-white">1</span>
            <h2 className="text-[13px] font-bold text-[#0f172a]">Candidates · best gain first</h2>
          </div>
          {!live && <div className="rounded-xl border border-[#b45309]/30 bg-[#fffbeb] p-3 text-[12px] text-[#78350f]">Needs a real analysis run — candidates come from the model&apos;s uncertain-habitat areas.</div>}
          {live && !fe && <div className="space-y-1.5">{[0, 1, 2, 3].map((i) => <div key={i} className="h-[84px] animate-pulse rounded-xl bg-black/[0.04]" />)}</div>}
          {fe && <CandidateList candidates={fe.candidates} metric={metric} activeId={activeId} onSelect={select} />}
          {live && can("change_parameters") && (
            <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-black/15 bg-white px-3 py-2.5 text-[12px] font-medium text-[#334155] hover:border-[#0f5132]/50">
              <Upload className="h-3.5 w-3.5 text-[#15803d]" /> Add real costs (CSV: candidate_id,cost)
              <input type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && void costUpload(e.target.files[0])} />
            </label>
          )}
          {note && <div className="mt-2 text-[11.5px] text-[#1e5f8a]">{note}</div>}
        </aside>

        {/* ------------------------------------------------ map */}
        <div className="relative min-h-[440px] lg:min-h-0">
          <GisMap scene={scene} mask={mask} graph={graph} heatmap={heatmap} layers={{ satellite: true, probability: false, habitat: true, heatmap: false, connectivity: true, protectedAreas: false, labels: false }} basemap="satellite" heatOpacity={0.5} selectedPatchId={selectedPatchId} onSelectPatch={setSelectedPatchId} className="h-full w-full"
            markers={(fe?.candidates ?? []).map((c) => ({ id: c.candidate_id, lat: c.centroid[0], lon: c.centroid[1], color: c.candidate_id === activeId ? "#00e599" : markerColor(c.verdict), label: `#${c.rank} ${c.candidate_id} · +${c.gain_pct.toFixed(2)} % · ${VERDICT[c.verdict].label}`, kind: "candidate" as const, onClick: () => setActive(c) }))}
            focus={focus} />
          <div className="pointer-events-none absolute left-14 top-3 z-[900] rounded-full bg-white/92 px-2.5 py-1 text-[11px] font-semibold text-[#0f5132] shadow-sm">{live ? "Real data · candidates are model output" : "No analysis for this landscape yet"}</div>
          {fe && (
            <div className="pointer-events-none absolute bottom-3 left-3 z-[900] flex flex-wrap gap-x-3 gap-y-1 rounded-xl bg-white/92 px-3 py-2 text-[11px] font-medium text-[#334155] shadow">
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#16a34a]" />Recommended</span>
              <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]" />Conditional / field check</span>
              {active && <span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#00e599] ring-2 ring-[#00e599]/30" />Selected</span>}
            </div>
          )}
          {active && !drawerOpen && (
            <button onClick={() => setDrawerOpen(true)} className="absolute right-3 top-3 z-[950] hidden items-center gap-1.5 rounded-full bg-[#0f5132] px-3 py-1.5 text-[12px] font-semibold text-white shadow-lg lg:flex xl:hidden">
              <Sprout className="h-3.5 w-3.5" /> Show {active.candidate_id}
            </button>
          )}
        </div>

        {/* ------------------------------------------------ detail (column on xl, drawer over the map on lg) */}
        <aside className={cn(
          "scroll-slim min-h-0 space-y-3 overflow-y-auto border-l border-black/[0.06] bg-[#f6f8f7] p-3.5 pb-24",
          "lg:absolute lg:bottom-3 lg:right-3 lg:top-3 lg:z-[950] lg:w-[340px] lg:rounded-2xl lg:border lg:shadow-2xl",
          "xl:static xl:z-auto xl:w-auto xl:rounded-none xl:border-0 xl:border-l xl:shadow-none",
          (!active || !drawerOpen) && "lg:max-xl:hidden",
        )}>
          {active && (
            <div className="flex justify-end xl:hidden">
              <button onClick={() => setDrawerOpen(false)} className="hidden items-center gap-1 rounded-full px-2 py-1 text-[11.5px] font-semibold text-muted-foreground hover:bg-black/[0.04] lg:flex" aria-label="Hide details"><X className="h-3.5 w-3.5" /> Hide</button>
            </div>
          )}
          {!active ? (
            <div className="rounded-2xl border border-black/[0.06] bg-white p-5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#ecfdf5] text-[#15803d]"><Sprout className="h-5 w-5" /></span>
              <div className="mt-3 text-[15px] font-bold text-[#0f172a]">Pick a candidate</div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-[#475569]">Choose one from the list or the map to see why it helps, what holds it back, and what still needs checking.</p>
            </div>
          ) : (
            <>
              <CandidateDetail c={active} metric={metric} />
              {user && can("assign_tasks") && (
                <Button className="h-10 w-full rounded-xl bg-[#b45309] text-[13px] font-bold text-white hover:bg-[#92400e]" onClick={async () => { await createTask({ study_area_id: sceneId, title: `Site assessment: restoration candidate ${active.candidate_id}`, reason: `Model-ranked restoration site (+${active.gain_pct.toFixed(2)} % ${metric.toUpperCase()}). Verify land status, tidal regime and feasibility on the ground. ${active.why_not.join("; ")}`, lat: active.centroid[0], lon: active.centroid[1], object_type: "candidate", object_id: active.candidate_id, run_id: dataSource.provenance?.runId, evidence_required: "photo + observation + access notes" }); setNote(`Field assessment task created for ${active.candidate_id}.`); }}>
                  <ClipboardCheck className="h-4 w-4" /> Create field check task
                </Button>
              )}
              {note && <div className="text-[11.5px] text-[#1e5f8a]">{note}</div>}
              <ReviewPanel sceneId={sceneId} runId={dataSource.provenance?.runId ?? runId} candidateId={active.candidate_id} />
            </>
          )}
        </aside>
      </div>
    </AppShell>
  );
}
