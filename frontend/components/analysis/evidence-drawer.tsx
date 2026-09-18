"use client";

import { useEffect, useState } from "react";
import { FileSearch, X } from "lucide-react";
import { useAnalysis } from "@/hooks/use-analysis";
import { fetchEvidenceChain } from "@/lib/api";
import { fmtIndex } from "@/utils/format";

type Chain = {
  decision?: { object: string; priority?: string; rank?: number; of?: number; explanation: string; basis?: string };
  data_source?: { type?: string; scene?: Record<string, unknown>; scene_year?: number | null };
  model?: Record<string, unknown> & { id?: string; encoder?: string; result_label?: string; note?: string; metrics?: { test?: Record<string, number> } };
  parameters?: Record<string, unknown>;
  analysis?: { run_id: string; timestamp: string; result_label: string };
  patch?: { area_ha: number; confidence: number; centroid: [number, number]; perimeter_km?: number | null; pixel_count?: number };
  graph_neighbourhood?: { degree: number; neighbours: { id: string; distance_km: number; weight: number }[]; is_cut_vertex: boolean; components_before: number; components_after: number };
  criticality_calculation?: { C_G: number; C_G_minus_v: number; delta_C: number; S_i: number; delta_pct: number; rank_by_area: number; formula: string };
  restoration_calculation?: { C_G: number; C_G_plus_v: number; R_i: number; gain_pct: number; new_links: number; linked: string[]; formula: string };
  field_verification?: { detection: { status: string }; tasks: { title: string; status: string; evidence: { observation: string; verification: string; observed_at: string }[] }[] }[];
  verification_status?: string;
};

/** Evidence drawer: the full chain behind "why is this patch high priority?" — from imagery to field verification. */
function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="grid grid-cols-[130px_1fr] gap-2 border-t border-foreground/[0.06] py-1 text-[11.5px]"><span className="text-muted-foreground">{k}</span><span className="break-words">{v}</span></div>;
}

export function EvidenceDrawer({ objectType, objectId, onClose }: { objectType: "patch" | "candidate"; objectId: string; onClose: () => void }) {
  const { sceneId, runId, dataSource } = useAnalysis();
  // result tagged with the request it answers, so switching objects never shows a stale chain
  const key = `${sceneId}|${runId}|${objectType}|${objectId}`;
  const [res, setRes] = useState<{ key: string; chain: Chain | null; err: string | null } | null>(null);
  useEffect(() => {
    if (dataSource.mode !== "live") return;
    let cancelled = false;
    const k = key;
    fetchEvidenceChain(sceneId, runId, objectType, objectId)
      .then((c) => { if (!cancelled) setRes({ key: k, chain: c as Chain, err: null }); })
      .catch((e) => { if (!cancelled) setRes({ key: k, chain: null, err: e instanceof Error ? e.message : String(e) }); });
    return () => { cancelled = true; };
  }, [sceneId, runId, objectType, objectId, dataSource.mode, key]);
  const c = res?.key === key ? res.chain : null;
  const err = dataSource.mode !== "live" ? "Evidence chains exist only for real pipeline runs." : res?.key === key ? res.err : null;
  return (
    <div className="fixed right-4 top-20 z-[1100] flex max-h-[calc(100vh-6rem)] w-[400px] max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-foreground/[0.1] bg-card shadow-2xl">
      <div className="flex items-center justify-between border-b border-foreground/[0.08] px-4 py-2.5">
        <div className="flex items-center gap-2 text-[13px] font-semibold"><FileSearch className="h-4 w-4 text-[#0f5132]" /> Evidence — {objectId}</div>
        <button onClick={onClose} aria-label="close" className="rounded-md p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
      <div className="scroll-slim overflow-y-auto px-4 py-3 space-y-3">
        {err && <div className="text-[12px] text-[#b45309]">{err}</div>}
        {!c && !err && <div className="text-[12px] text-muted-foreground">Loading evidence chain…</div>}
        {c && (
          <>
            {c.decision && <section><div className="text-[10px] uppercase tracking-wider text-[#0f5132]">Decision</div>
              <div className="mt-1 text-[12.5px]">{c.decision.priority ? <b>Priority {c.decision.priority.toUpperCase()}</b> : null}{c.decision.rank ? ` · rank #${c.decision.rank}${c.decision.of ? ` of ${c.decision.of}` : ""}` : ""}</div>
              <p className="mt-1 text-[12px] leading-relaxed">{c.decision.explanation}</p></section>}
            <section><div className="text-[10px] uppercase tracking-wider text-[#0f5132]">Verification status</div><div className="mt-1 text-[12.5px] font-semibold">{c.verification_status}</div>
              {c.field_verification?.map((f, i) => <div key={i} className="mt-1 text-[11.5px]">{f.tasks.map((t, j) => <div key={j}>{t.title} — {t.status}{t.evidence.map((e, k) => <div key={k} className="pl-3 text-muted-foreground">{e.observed_at}: {e.observation} ({e.verification})</div>)}</div>)}</div>)}</section>
            {c.criticality_calculation && <section><div className="text-[10px] uppercase tracking-wider text-[#0f5132]">Criticality calculation</div>
              <Row k="C(G)" v={fmtIndex(c.criticality_calculation.C_G)} /><Row k="C(G − v)" v={fmtIndex(c.criticality_calculation.C_G_minus_v)} /><Row k="ΔC" v={fmtIndex(c.criticality_calculation.delta_C)} /><Row k="Sᵢ" v={`${c.criticality_calculation.S_i.toFixed(4)} (−${c.criticality_calculation.delta_pct.toFixed(1)} %)`} /><Row k="rank by area" v={`#${c.criticality_calculation.rank_by_area}`} /><Row k="formula" v={c.criticality_calculation.formula} /></section>}
            {c.restoration_calculation && <section><div className="text-[10px] uppercase tracking-wider text-[#0f5132]">Restoration calculation</div>
              <Row k="C(G)" v={fmtIndex(c.restoration_calculation.C_G)} /><Row k="C(G + v)" v={fmtIndex(c.restoration_calculation.C_G_plus_v)} /><Row k="Rᵢ" v={`${fmtIndex(c.restoration_calculation.R_i)} (+${c.restoration_calculation.gain_pct.toFixed(2)} %)`} /><Row k="new links" v={`${c.restoration_calculation.new_links} → ${c.restoration_calculation.linked.join(", ")}`} /><Row k="formula" v={c.restoration_calculation.formula} /></section>}
            {c.patch && <section><div className="text-[10px] uppercase tracking-wider text-[#0f5132]">Patch geometry & confidence</div>
              <Row k="area" v={`${c.patch.area_ha.toFixed(2)} ha (${c.patch.pixel_count ?? "—"} px)`} /><Row k="centroid" v={`${c.patch.centroid[0].toFixed(5)}, ${c.patch.centroid[1].toFixed(5)}`} /><Row k="confidence" v={`${(100 * c.patch.confidence).toFixed(0)} % mean class probability`} />{c.patch.perimeter_km != null && <Row k="perimeter" v={`${c.patch.perimeter_km.toFixed(2)} km`} />}</section>}
            {c.graph_neighbourhood && <section><div className="text-[10px] uppercase tracking-wider text-[#0f5132]">Graph neighbourhood</div>
              <Row k="degree" v={`${c.graph_neighbourhood.degree}${c.graph_neighbourhood.is_cut_vertex ? " · cut vertex (bridge)" : ""}`} /><Row k="components" v={`${c.graph_neighbourhood.components_before} → ${c.graph_neighbourhood.components_after} on removal`} /><Row k="neighbours" v={c.graph_neighbourhood.neighbours.map((n) => `${n.id} (${n.distance_km.toFixed(2)} km, w ${n.weight.toFixed(2)})`).join("; ") || "isolated"} /></section>}
            <section><div className="text-[10px] uppercase tracking-wider text-[#0f5132]">Analysis & parameters</div>
              <Row k="run" v={c.analysis?.run_id} /><Row k="label" v={c.analysis?.result_label} /><Row k="computed" v={c.analysis?.timestamp} /><Row k="parameters" v={Object.entries(c.parameters ?? {}).map(([k, v]) => `${k} = ${String(v)}`).join(", ")} /></section>
            <section><div className="text-[10px] uppercase tracking-wider text-[#0f5132]">Model</div>
              <Row k="model" v={String(c.model?.id ?? c.model?.note ?? "—")} />{c.model?.encoder ? <Row k="encoder" v={String(c.model.encoder)} /> : null}{c.model?.result_label ? <Row k="label" v={String(c.model.result_label)} /> : null}{c.model?.metrics?.test ? <Row k="test agreement" v={`IoU ${c.model.metrics.test.iou?.toFixed(3)} · Dice ${c.model.metrics.test.dice?.toFixed(3)} (vs GMW weak label, not field truth)`} /> : null}</section>
            <section><div className="text-[10px] uppercase tracking-wider text-[#0f5132]">Imagery / data source</div>
              <Row k="type" v={String(c.data_source?.type)} /><Row k="scene" v={String((c.data_source?.scene as Record<string, unknown> | undefined)?.id ?? (c.data_source?.scene as Record<string, unknown> | undefined)?.path ?? "—")} /><Row k="year" v={String(c.data_source?.scene_year ?? "—")} /></section>
          </>
        )}
      </div>
    </div>
  );
}
