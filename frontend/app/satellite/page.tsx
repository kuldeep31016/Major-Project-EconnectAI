"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, CheckCircle2, Circle, Database, Eye, Layers, Loader2, Play, RefreshCw, Satellite, ShieldCheck, XCircle,
} from "lucide-react";

import { AppShell } from "@/components/dashboard/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SelectMenu } from "@/components/ui/select-menu";
import type { SatLayer } from "@/components/satellite/satellite-map";
import { useAnalysis } from "@/hooks/use-analysis";
import { useAuth } from "@/hooks/use-auth";
import {
  fetchOverlay, fetchSatelliteLatest, fetchSatelliteObservations, fetchSatelliteRun, fetchSatelliteStatus, postSatelliteAnalyze,
  runFileUrl, satelliteMaskUrl, satelliteSceneUrl,
  type SatelliteAnalysisDetail, type SatelliteLatest, type SatelliteObservation, type SatelliteStatus,
} from "@/lib/api";
import { getScenes } from "@/lib/data";
import { cn } from "@/lib/utils";

const SatelliteMap = dynamic(() => import("@/components/satellite/satellite-map"), { ssr: false });

const STAGE_LABEL: Record<string, string> = {
  observation: "Satellite observation found", retrieval: "Data retrieved (Sentinel-1 VV/VH backscatter)",
  preprocessing: "Preprocessing (gamma0 → dB, training grid)", inference: "AI inference (U-Net, EfficientNet-B0)",
  habitat: "Habitat extraction (threshold → mask)", patches: "Patch extraction (≥ minimum mapping unit)",
  connectivity: "Connectivity analysis (graph, IIC)", criticality: "Criticality analysis (leave-one-out)",
  restoration: "Restoration analysis (candidate areas)",
};
const STAGES = Object.keys(STAGE_LABEL);
const ACTIVE = new Set(["QUEUED", "RUNNING", "SCENE_READY"]);

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/^\d{3}:\s*/, "");
function utc(s: string | null | undefined) {
  if (!s) return "—";
  const d = new Date(s);
  return `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })} · ${d.toISOString().slice(11, 16)} UTC`;
}
const days = (a: string | null | undefined, b: string | null | undefined) =>
  a && b ? Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000) : null;

export default function SatelliteMonitorPage() {
  const router = useRouter();
  const { sceneId, setSceneId, setRunId, runs } = useAnalysis();
  const { user, can } = useAuth();
  const areas = getScenes();
  const [mode, setMode] = useState<"stored" | "nrt">("nrt");
  const [status, setStatus] = useState<SatelliteStatus | null>(null);
  const [latest, setLatest] = useState<SatelliteLatest | null>(null);
  const [obs, setObs] = useState<SatelliteObservation[]>([]);
  const [aoi, setAoi] = useState<GeoJSON.Polygon | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);              // true until the first catalogue answer
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composite, setComposite] = useState("8");
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SatelliteAnalysisDetail | null>(null);
  // bumped whenever the page clears `detail`: re-selecting the SAME analysis id must still refetch it
  const [detailNonce, setDetailNonce] = useState(0);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [patches, setPatches] = useState<GeoJSON.FeatureCollection | null>(null);
  const [scene, setScene] = useState<Awaited<ReturnType<typeof fetchOverlay>>>(null);
  const [mask, setMask] = useState<Awaited<ReturnType<typeof fetchOverlay>>>(null);
  const [focusFp, setFocusFp] = useState(0);
  const [layers, setLayers] = useState<Record<SatLayer, boolean>>({ footprint: true, scene: true, mask: true, patches: true, critical: true });

  useEffect(() => {
    fetchSatelliteStatus().then(setStatus).catch(() => setStatus(null));
  }, []);

  const loadSeq = useRef(0);          // only the newest catalogue load may update the page (area switches race)
  const load = useCallback((area: string) => {
    const seq = ++loadSeq.current;
    setLoading(true);
    Promise.allSettled([fetchSatelliteLatest(area), fetchSatelliteObservations(area)]).then(([l, o]) => {
      if (seq !== loadSeq.current) return;
      setLatest(l.status === "fulfilled" ? l.value : null);
      if (o.status === "fulfilled") { setObs(o.value.observations); setAoi(o.value.aoi); } else { setObs([]); setAoi(null); }
      const err = l.status === "rejected" ? l.reason : o.status === "rejected" ? o.reason : null;
      setLoadErr(err ? errText(err) : null);
      const first = l.status === "fulfilled" ? l.value : null;
      setSelectedId(first?.product_id ?? null);
      setAnalysisId(first?.analysis?.id ?? null);
      setDetail(null); setPatches(null); setScene(null); setMask(null); setActionErr(null); setNote(null);
      setDetailNonce((n) => n + 1);
    }).finally(() => { if (seq === loadSeq.current) setLoading(false); });
  }, []);

  useEffect(() => {
    if (mode !== "nrt") return;
    const t = window.setTimeout(() => load(sceneId), 0);
    return () => window.clearTimeout(t);
  }, [mode, sceneId, load]);

  const selected = useMemo(() => obs.find((o) => o.product_id === selectedId) ?? latest ?? null, [obs, selectedId, latest]);

  // analysis record: load, and poll while the job runs (real backend job state)
  useEffect(() => {
    if (!analysisId || !user) return;
    let stop = false;
    let timer: number | undefined;
    let failures = 0;          // the API can be briefly busy while a job composites large rasters: keep polling
    const tick = () => fetchSatelliteRun(analysisId).then((d) => {
      if (stop) return;
      failures = 0;
      setActionErr(null);
      setDetail(d);
      if (ACTIVE.has(d.status) || (d.job && (d.job.status === "QUEUED" || d.job.status === "RUNNING"))) timer = window.setTimeout(tick, 2000);
    }).catch((e) => {
      if (stop) return;
      failures += 1;
      if (failures >= 5) setActionErr(`Lost contact with the server while following the analysis (${errText(e)}). It keeps running; retrying…`);
      timer = window.setTimeout(tick, Math.min(15000, 2000 * failures));
    });
    tick();
    return () => { stop = true; window.clearTimeout(timer); };
  }, [analysisId, user, detailNonce]);

  // result layers once the scene / run exist
  const sceneReady = !!detail?.scene.available;
  const runId = detail?.status === "COMPLETED" ? detail.run_id : null;
  // responses for a previously selected area/run can arrive late: ignore them (the cleanup flips `stale`)
  useEffect(() => {
    if (!detail || !sceneReady) return;
    let stale = false;
    fetchOverlay(satelliteSceneUrl(detail.id)).then((o) => { if (!stale) setScene(o); });
    if (runId) fetchOverlay(satelliteMaskUrl(detail.id)).then((o) => { if (!stale) setMask(o); });
    return () => { stale = true; };
  }, [detail?.id, sceneReady, runId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!runId || !detail) return;
    let stale = false;
    fetch(runFileUrl(detail.study_area_id, runId, "patches.geojson")).then((r) => (r.ok ? r.json() : null))
      .then((g) => { if (!stale) setPatches(g); }).catch(() => { if (!stale) setPatches(null); });
    return () => { stale = true; };
  }, [runId]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickObservation = (o: SatelliteObservation) => {
    setSelectedId(o.product_id);
    setAnalysisId(o.analysis?.id ?? null);
    setDetail(null); setPatches(null); setScene(null); setMask(null); setActionErr(null); setNote(null);
    setDetailNonce((n) => n + 1);
  };

  const analyze = async () => {
    if (!selected) return;
    setSubmitting(true); setActionErr(null); setNote(null);
    try {
      const r = await postSatelliteAnalyze({ area_id: sceneId, product_id: selected.product_id, composite_scenes: Number(composite) });
      setNote(r.reused === "completed" ? "This exact analysis already exists - showing the stored result (no new satellite request)."
        : r.reused === "in_progress" ? "This analysis is already running - following its progress." : r.note ?? null);
      setAnalysisId(r.analysis.id);
    } catch (e) {
      setActionErr(errText(e));
    } finally {
      setSubmitting(false);
    }
  };

  const openInDashboard = (run: string) => { setSceneId(sceneId); setRunId(run); router.push("/command"); };

  const canAnalyze = !!user && can("run_analysis");
  const retrievalOk = !!status?.retrieval.configured;
  const prev = latest ? days(latest.acquisition_time, latest.previous_acquisition) : null;
  const latestStored = runs.find((r) => r.isLatest) ?? runs[0] ?? null;

  return (
    <AppShell title="Satellite Monitor" subtitle="Near-real-time Earth observation · latest available Sentinel-1 acquisition">
      <div className="space-y-4">
        {/* area + data-source mode */}
        <div className="flex flex-wrap items-center gap-3">
          <SelectMenu value={sceneId} onChange={setSceneId} label="Study area" icon={Satellite} className="w-[260px]"
            options={areas.map((a) => ({ value: a.id, label: a.region, hint: a.state }))} />
          <div role="tablist" aria-label="Data source" className="inline-flex rounded-xl border border-black/[0.08] bg-white p-1">
            {([["stored", "Stored analysis (static data)"], ["nrt", "Latest observation (near-real-time)"]] as const).map(([k, label]) => (
              <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)}
                className={cn("rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
                  mode === k ? "bg-[#15803d] text-white" : "text-[#334155] hover:bg-[#f0fdf4]")}>{label}</button>
            ))}
          </div>
          {mode === "nrt" && (
            <Button variant="outline" size="sm" onClick={() => load(sceneId)} disabled={loading}>
              <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", loading && "animate-spin")} /> Check for new observations
            </Button>
          )}
        </div>

        {mode === "stored" ? (
          <StoredMode area={areas.find((a) => a.id === sceneId)?.region ?? sceneId} run={latestStored}
            onOpen={() => openInDashboard("latest")} />
        ) : (
          <>
            <CapabilityStrip status={status} />
            {loadErr && <Banner tone="error">{loadErr}</Banner>}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="min-w-0 space-y-4 lg:col-span-5">
                <ObservationCard o={selected} isLatest={!!latest && selected?.product_id === latest.product_id} prevDays={prev}
                  loading={loading}
                  analysisStatus={detail?.status === "FAILED" && detail.stage === "inference" && detail.scene.available ? "SCENE_READY"
                    : detail?.status === "SCENE_READY" ? "RUNNING" : detail?.status ?? selected?.analysis?.status ?? null}
                  onView={() => { setLayers((l) => ({ ...l, footprint: true })); setFocusFp((n) => n + 1); }}>
                  <div className="flex flex-wrap items-center gap-2">
                    <SelectMenu value={composite} onChange={setComposite} label="Scenes" className="w-[230px]"
                      options={[{ value: "8", label: "Median of latest 8 (recommended)", hint: "same orbit · matches how the model was trained" },
                        { value: "4", label: "Median of latest 4", hint: "fewer dates · more speckle" },
                        { value: "1", label: "This acquisition only", hint: "single date · not recommended (over-predicts)" }]} />
                    <Button onClick={analyze} disabled={!selected || submitting || !canAnalyze || (!retrievalOk && !selected?.analysis)}
                      className="bg-[#15803d] hover:bg-[#166534]">
                      {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Play className="mr-1.5 h-4 w-4" />}
                      {latest && selected?.product_id === latest.product_id ? "Analyze latest scene" : "Analyze this scene"}
                    </Button>
                  </div>
                  {!user ? <p className="text-[12px] text-muted-foreground"><Link href="/login" className="font-semibold text-[#15803d]">Sign in</Link> as a GIS officer, analyst or administrator to run an analysis.</p>
                    : !canAnalyze ? <p className="text-[12px] text-muted-foreground">Your role can view observations but not run analyses.</p>
                    : !retrievalOk ? <p className="text-[12px] text-[#b45309]">{status?.retrieval.note ?? "Image retrieval is not configured on this server."}</p> : null}
                </ObservationCard>

                {latest?.model_reliability && <ReliabilityNote r={latest.model_reliability} />}
                {note && <Banner tone="info">{note}</Banner>}
                {actionErr && <Banner tone="error">{actionErr}</Banner>}
                {detail && <Progress detail={detail} />}
                {detail && <Provenance detail={detail} onOpen={openInDashboard} />}
              </div>

              <div className="min-w-0 space-y-4 lg:col-span-7">
                <Card className="overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-[15px]"><Layers className="h-4 w-4 text-[#15803d]" /> Observation map</CardTitle>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {([["footprint", "Footprint", true], ["scene", "Sentinel-1 VV", !!scene], ["mask", "Predicted mask", !!mask],
                        ["patches", "Habitat patches", !!patches], ["critical", "Critical patches", !!patches]] as const).map(([k, label, ok]) => (
                        <button key={k} disabled={!ok} onClick={() => setLayers((l) => ({ ...l, [k]: !l[k] }))}
                          className={cn("rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-colors",
                            !ok ? "cursor-not-allowed border-black/[0.06] text-black/30"
                              : layers[k] ? "border-[#15803d] bg-[#f0fdf4] text-[#15803d]" : "border-black/[0.1] text-[#334155]")}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="h-[420px] w-full">
                      <SatelliteMap aoi={aoi} footprint={selected?.footprint ?? null} scene={scene} mask={mask} patches={patches} layers={layers} focusFootprint={focusFp} />
                    </div>
                    <p className="px-4 py-2 text-[11px] text-muted-foreground">
                      Dashed box = study area. Blue = the observation&apos;s footprint from the catalogue. Imagery, mask and patches appear once an analysis retrieves the scene.
                    </p>
                  </CardContent>
                </Card>
                <History obs={obs} selectedId={selected?.product_id ?? null} latestId={latest?.product_id ?? null} onPick={pickObservation} />
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

/* ------------------------------------------------------------------------------------------------ pieces */

function Banner({ tone, children }: { tone: "error" | "info"; children: React.ReactNode }) {
  return (
    <div className={cn("flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[12.5px]",
      tone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-sky-200 bg-sky-50 text-sky-900")}>
      {tone === "error" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
      <span>{children}</span>
    </div>
  );
}

function ReliabilityNote({ r }: { r: NonNullable<SatelliteLatest["model_reliability"]> }) {
  const ok = r.level !== "unreliable";
  return (
    <div className={cn("rounded-xl border px-3 py-2.5 text-[12.5px]", ok ? "border-green-200 bg-green-50 text-green-900" : "border-amber-200 bg-amber-50 text-amber-900")}>
      <p className="font-semibold">Model reliability in this area: {r.level}{r.iou != null ? ` (IoU ${r.iou.toFixed(2)} vs GMW 2020${r.held_out_iou != null ? ", held-out tiles" : ", whole scene incl. training tiles"})` : ""}</p>
      <p className="mt-0.5 text-[12px]">
        {ok ? "The model reproduces the 2020 reference map well here, so near-real-time maps of this area are meaningful."
          : `Mangroves here are too small or too few (${Math.round(r.reference_habitat_ha)} ha in the 2020 reference) for this 10 m radar model to map; treat any result as a demonstration only.`}
      </p>
    </div>
  );
}

function CapabilityStrip({ status }: { status: SatelliteStatus | null }) {
  const items = [
    { label: "Catalogue search", ok: status ? status.catalogue.available : null, hint: status ? `${status.source} · ${status.catalogue.auth}` : "" },
    { label: "Image retrieval", ok: status ? status.retrieval.configured : null, hint: status?.retrieval.configured ? status.retrieval.api : status?.retrieval.note ?? "" },
    { label: "AI inference", ok: status ? status.inference.available : null, hint: status?.inference.available ? status.inference.model_version : status?.inference.reason ?? "" },
  ];
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {items.map((i) => (
        <div key={i.label} className="flex items-start gap-2 rounded-xl border border-black/[0.06] bg-white px-3 py-2.5">
          {i.ok === null ? <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-muted-foreground" />
            : i.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#15803d]" /> : <XCircle className="mt-0.5 h-4 w-4 text-[#b45309]" />}
          <div className="min-w-0">
            <p className="text-[12.5px] font-semibold text-[#0f172a]">{i.label}</p>
            <p className="line-clamp-2 text-[11.5px] text-muted-foreground" title={i.hint}>{i.hint}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-black/[0.04] py-1.5 last:border-0">
      <span className="text-[12px] text-muted-foreground">{k}</span>
      <span className="text-right text-[12.5px] font-medium text-[#0f172a]">{v}</span>
    </div>
  );
}

const STATUS_STYLE: Record<string, string> = {
  Available: "bg-sky-50 text-sky-800 border-sky-200", Processing: "bg-amber-50 text-amber-800 border-amber-200",
  Completed: "bg-green-50 text-green-800 border-green-200", Failed: "bg-red-50 text-red-800 border-red-200",
  "Scene ready": "bg-violet-50 text-violet-800 border-violet-200",
};

function ObservationCard({ o, isLatest, prevDays, loading, analysisStatus, onView, children }: {
  o: SatelliteObservation | null; isLatest: boolean; prevDays: number | null; loading: boolean;
  analysisStatus: string | null; onView: () => void; children: React.ReactNode;
}) {
  const st = !analysisStatus ? "Available" : analysisStatus === "COMPLETED" ? "Completed" : analysisStatus === "FAILED" ? "Failed"
    : analysisStatus === "SCENE_READY" ? "Scene ready" : "Processing";
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-[15px]"><Satellite className="h-4 w-4 text-[#15803d]" />
            {isLatest ? "Latest satellite observation" : "Selected observation"}</CardTitle>
          {o && <span className={cn("shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold", STATUS_STYLE[st])}>● {st}</span>}
        </div>
        <CardDescription>{o?.source ?? "Sentinel-1"} · metadata as published in the catalogue</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && !o ? <p className="flex items-center gap-2 text-[12.5px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Searching the satellite catalogue…</p>
          : !o ? <p className="text-[12.5px] text-muted-foreground">No Sentinel-1 observation with VV + VH fully covers this study area in the search window.</p>
          : (
            <div>
              <Row k="Satellite" v={o.satellite} />
              <Row k="Product" v={`${o.product_type ?? "GRD"} · ${o.mode ?? "IW"}`} />
              <Row k="Polarization" v={o.polarization.join(" + ")} />
              <Row k="Resolution" v={`${o.resolution_m} m (retrieved on the training grid)`} />
              <Row k="Acquired" v={utc(o.acquisition_time)} />
              <Row k="Published" v={utc(o.published_at)} />
              <Row k="Timeliness" v={o.timeliness ?? "—"} />
              <Row k="Orbit" v={`${o.orbit_direction?.toLowerCase() ?? "—"} · relative orbit ${o.relative_orbit ?? "—"}`} />
              <Row k="Study-area coverage" v={`${Math.round(o.aoi_coverage * 100)} %`} />
              {isLatest && prevDays !== null && <Row k="Previous acquisition" v={`${prevDays} days earlier`} />}
              <p className="mt-2 truncate font-mono text-[10.5px] text-muted-foreground" title={o.name}>{o.name}</p>
            </div>
          )}
        {o && <Button variant="outline" size="sm" onClick={onView}><Eye className="mr-1.5 h-3.5 w-3.5" /> View observation footprint</Button>}
        {children}
      </CardContent>
    </Card>
  );
}

function Progress({ detail }: { detail: SatelliteAnalysisDetail }) {
  const cur = detail.stage ? STAGES.indexOf(detail.stage) : -1;
  const done = detail.status === "COMPLETED";
  const failed = detail.status === "FAILED";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-[15px]">{done ? "Analysis complete" : failed ? "Analysis stopped" : "Analysis running"}</CardTitle>
        <CardDescription>{detail.id} · backend job state{detail.job ? ` · ${Math.round(detail.job.progress * 100)} %` : ""}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {STAGES.map((s, i) => {
          const state = done || i < cur ? "done" : i === cur ? (failed ? "failed" : "active") : "pending";
          return (
            <div key={s} className="flex items-center gap-2 text-[12.5px]">
              {state === "done" ? <CheckCircle2 className="h-4 w-4 text-[#15803d]" />
                : state === "active" ? <Loader2 className="h-4 w-4 animate-spin text-[#b45309]" />
                : state === "failed" ? <XCircle className="h-4 w-4 text-red-600" /> : <Circle className="h-4 w-4 text-black/20" />}
              <span className={cn(state === "pending" ? "text-muted-foreground" : "text-[#0f172a]", state === "failed" && "font-semibold text-red-700")}>{STAGE_LABEL[s]}</span>
            </div>
          );
        })}
        <div className="flex items-center gap-2 pt-1 text-[12.5px]">
          {done ? <CheckCircle2 className="h-4 w-4 text-[#15803d]" /> : <Circle className="h-4 w-4 text-black/20" />}
          <span className={done ? "font-semibold text-[#15803d]" : "text-muted-foreground"}>Completed</span>
        </div>
        {failed && detail.error && <Banner tone="error">{detail.error}</Banner>}
      </CardContent>
    </Card>
  );
}

function Provenance({ detail, onOpen }: { detail: SatelliteAnalysisDetail; onOpen: (runId: string) => void }) {
  const run = detail.summary?.run;
  const dist = detail.scene.distribution_check ?? detail.summary?.distribution_check;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-[15px]"><ShieldCheck className="h-4 w-4 text-[#15803d]" /> Data provenance</CardTitle>
        <CardDescription>Everything needed to reproduce this result</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {run && (
          <div className="grid grid-cols-3 gap-2">
            {[["Habitat patches", run.nPatches], ["Links", run.nEdges], ["Components", run.nComponents],
              ["Habitat (ha)", run.habitatAreaHa != null ? Math.round(run.habitatAreaHa) : "—"],
              ["IIC", run.iic != null ? run.iic.toExponential(2) : "—"], ["ECA (ha)", run.ecaHa != null ? Math.round(run.ecaHa) : "—"]].map(([k, v]) => (
              <div key={k as string} className="rounded-lg border border-black/[0.06] bg-[#fafcfb] px-2.5 py-2">
                <p className="text-[10.5px] uppercase tracking-wide text-muted-foreground">{k}</p>
                <p className="text-[15px] font-semibold text-[#0f172a]">{v}</p>
              </div>
            ))}
          </div>
        )}
        <div>
          <Row k="Source" v={detail.product_type === "S1_RTC_IW" ? "Microsoft Planetary Computer · Sentinel-1 RTC" : "Copernicus Data Space · Sentinel-1 GRD"} />
          <Row k="Acquisition" v={utc(detail.acquisition_time)} />
          <Row k="Scenes used" v={`${detail.product_ids.length} (${detail.composite_scenes > 1 ? "temporal median" : "single acquisition"})`} />
          <Row k="Processed" v={utc(detail.processed_at)} />
          <Row k="Preprocessing" v={<span className="font-mono text-[11px]">{detail.preprocessing_version}</span>} />
          <Row k="Model" v={detail.model_version} />
          <Row k="Threshold · MMU" v={`${detail.threshold ?? "—"} · ${detail.mmu_ha ?? "—"} ha`} />
          <Row k="Graph" v={`k = ${detail.k_neighbors ?? "—"}, τ = ${detail.tau_km ?? "—"} km`} />
          <Row k="Software" v={<span className="font-mono text-[11px]">{detail.software_version}</span>} />
          <Row k="Run" v={detail.run_id ? <span className="font-mono text-[11px]">{detail.run_id}</span> : "—"} />
        </div>
        {detail.summary?.plausibility && (
          <div className={cn("rounded-lg border px-3 py-2 text-[12px]", detail.summary.plausibility.review_recommended ? "border-amber-200 bg-amber-50 text-amber-900" : "border-green-200 bg-green-50 text-green-900")}>
            <p className="font-semibold">Result check vs 2020 reference area</p>
            <p>{detail.summary.plausibility.note}</p>
          </div>
        )}
        {dist && (
          <div className={cn("rounded-lg border px-3 py-2 text-[12px]", dist.review_recommended ? "border-amber-200 bg-amber-50 text-amber-900" : "border-green-200 bg-green-50 text-green-900")}>
            <p className="font-semibold">Input check vs training data</p>
            <p>{dist.note}</p>
            <p className="mt-1 font-mono text-[11px]">
              {dist.bands.map((b) => `${b.band.replace("s1_", "").replace("_db", "").toUpperCase()} mean ${b.mean_db ?? "—"} dB (train ${b.train_mean_db ?? "—"}, shift ${b.mean_shift_sd ?? "—"} SD)`).join(" · ")}
              {` · valid ${Math.round(dist.valid_fraction * 100)} %`}
            </p>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          Model prediction on {detail.composite_scenes > 1 ? `a median of ${detail.composite_scenes} recent satellite observations` : "one satellite observation"}
          {" "}(development model; agreement with GMW weak labels, not field-validated).
          Differences from earlier runs are model-output differences, not confirmed habitat change. Restoration areas are potential candidates.
        </p>
        {detail.run_id && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => onOpen(detail.run_id!)} className="bg-[#15803d] hover:bg-[#166534]">Open in dashboard</Button>
            <Button size="sm" variant="outline" asChild><Link href="/analysis">Interactive map</Link></Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function History({ obs, selectedId, latestId, onPick }: {
  obs: SatelliteObservation[]; selectedId: string | null; latestId: string | null; onPick: (o: SatelliteObservation) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-[15px]">Observation history</CardTitle>
        <CardDescription>Sentinel-1 IW acquisitions over the study area ({obs[0]?.source ?? "catalogue"}). Click a row to inspect it.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[320px] overflow-auto">
          <table className="w-full text-[11.5px] sm:text-[12px]">
            <thead className="sticky top-0 bg-white text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-2 py-2 sm:px-3">Acquired (UTC)</th><th className="px-1.5 py-2 sm:px-2">Satellite</th>
                <th className="px-1.5 py-2 sm:px-2">Cover</th><th className="hidden px-1.5 py-2 sm:table-cell sm:px-2">Usable</th><th className="px-2 py-2 sm:px-3">Analysis</th></tr>
            </thead>
            <tbody>
              {obs.length === 0 && <tr><td colSpan={5} className="px-4 py-4 text-muted-foreground">No observations loaded.</td></tr>}
              {obs.map((o) => {
                const usable = o.full_coverage && o.polarization.length === 2;
                return (
                  <tr key={o.product_id} onClick={() => onPick(o)}
                    className={cn("cursor-pointer border-t border-black/[0.04] hover:bg-[#f0fdf4]", o.product_id === selectedId && "bg-[#f0fdf4]")}>
                    <td className="px-2 py-2 sm:px-3">
                      <span className="whitespace-nowrap font-medium">{utc(o.acquisition_time).split(" · ")[0]}</span>
                      <span className="block whitespace-nowrap text-[11px] text-muted-foreground">
                        {utc(o.acquisition_time).split(" · ")[1]}
                        {o.product_id === latestId && <span className="ml-1.5 rounded bg-[#15803d] px-1.5 py-px text-[9.5px] font-semibold text-white">LATEST</span>}
                      </span>
                    </td>
                    <td className="px-1.5 py-2 sm:px-2"><span className="whitespace-nowrap">{o.satellite}</span><span className="block text-[11px] text-muted-foreground">{o.product} · {o.polarisation}</span></td>
                    <td className="px-1.5 py-2 sm:px-2">{Math.round(o.aoi_coverage * 100)} %</td>
                    <td className="hidden px-1.5 py-2 sm:table-cell sm:px-2">{usable ? <span className="text-[#15803d]">yes</span> : <span className="text-muted-foreground">{o.full_coverage ? "single-pol" : "partial"}</span>}</td>
                    <td className="px-2 py-2 sm:px-3">{!o.analysis ? "—" : o.analysis.status === "FAILED" && o.analysis.stage === "inference" ? "scene ready"
                      : o.analysis.status.toLowerCase().replace("_", " ")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function StoredMode({ area, run, onOpen }: { area: string; run: { runId: string; sceneYear?: number | null; resultLabel?: string; nPatches?: number; nEdges?: number; habitatAreaHa?: number; iic?: number; model?: string | null } | null; onOpen: () => void }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-[15px]"><Database className="h-4 w-4 text-[#15803d]" /> Stored analysis · {area}</CardTitle>
        <CardDescription>
          The existing analysis the dashboard shows by default: built from the 2020 Sentinel-1 RTC composite (Microsoft Planetary Computer)
          the model was trained and calibrated on. This is static data - it is not the latest satellite observation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!run ? <p className="text-[12.5px] text-muted-foreground">No stored run loaded for this study area.</p> : (
          <div>
            <Row k="Run" v={<span className="font-mono text-[11px]">{run.runId}</span>} />
            <Row k="Scene year" v={run.sceneYear ?? "—"} />
            <Row k="Result label" v={run.resultLabel ?? "—"} />
            <Row k="Habitat patches · links" v={`${run.nPatches ?? "—"} · ${run.nEdges ?? "—"}`} />
            <Row k="Habitat area" v={run.habitatAreaHa != null ? `${run.habitatAreaHa.toFixed(1)} ha` : "—"} />
            <Row k="IIC" v={run.iic != null ? run.iic.toExponential(3) : "—"} />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onOpen} className="bg-[#15803d] hover:bg-[#166534]">Open in dashboard</Button>
          <Button size="sm" variant="outline" asChild><Link href="/upload">New analysis from a stored scene</Link></Button>
        </div>
      </CardContent>
    </Card>
  );
}
