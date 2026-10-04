"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import {
  ArrowDownRight, ArrowUpRight, ChevronRight, ChevronUp, Cpu, Expand, Info, Layers, Leaf, Minimize2, Network, Ruler, Scissors,
  Settings2, Sprout, Trees, Waves,
} from "lucide-react";
import type { HabitatPatch, LatLng } from "@/types";
import { AppShell } from "@/components/dashboard/app-shell";
import { useAnalysis } from "@/hooks/use-analysis";
import { fetchAlerts, fetchSceneQuicklook, fetchTasks, type AlertItem, type FieldTaskItem, type QuicklookKind, type SceneQuicklook } from "@/lib/api";
import { getConnectivity, getGraph, getHabitatMask, getHeatmap, getRestoration, getTimeline, hasLiveTimeline } from "@/lib/data";
import { requestMapFocus, useMapFocus } from "@/lib/map-focus";
import { SelectMenu } from "@/components/ui/select-menu";
import { cn } from "@/lib/utils";
import { Term } from "@/components/shared/term";

const GisMap = dynamic(() => import("@/components/maps/gis-map"), { ssr: false });

// Tabs switch the side panel in place (the map stays); each panel links to its full page for the deep view.
const TABS = [["overview", "Overview"], ["patches", "Patches"], ["connectivity", "Connectivity"], ["restoration", "Restoration"], ["change", "Change"], ["reports", "Reports"]] as const;
type Tab = (typeof TABS)[number][0];
const HIGH_CONF = 0.8;
const CRITICAL_TOP = 5;
type Basemap = "satellite" | "rgb" | "ndvi" | "s1" | "terrain";
const BASEMAPS: { id: Basemap; label: string; real: boolean }[] = [
  { id: "satellite", label: "Satellite (True Color)", real: false },
  { id: "rgb", label: "Sentinel-2 (True colour, scene)", real: true },
  { id: "ndvi", label: "Sentinel-2 (NDVI)", real: true },
  { id: "s1", label: "Sentinel-1 (SAR, VV)", real: true },
  { id: "terrain", label: "Terrain", real: false },
];
const SEV: Record<string, string> = { critical: "#b91c1c", high: "#c2410c", medium: "#b45309", low: "#15803d" };

function patchBounds(p: HabitatPatch): [number, number, number, number] {
  const lats = p.polygon.map((q) => q[0]); const lons = p.polygon.map((q) => q[1]);
  return [Math.min(...lats), Math.min(...lons), Math.max(...lats), Math.max(...lons)];
}
function delta(cur?: number | null, prev?: number | null) {
  if (cur == null || prev == null || prev === 0) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}
function Delta({ v, invert = false, suffix = "%" }: { v: number | null; invert?: boolean; suffix?: string }) {
  if (v == null) return null; // no earlier run to compare with: show nothing rather than a dash
  const good = invert ? v <= 0 : v >= 0;
  const Icon = v >= 0 ? ArrowUpRight : ArrowDownRight;
  return <span className={cn("inline-flex items-center gap-0.5 text-[11.5px] font-semibold", good ? "text-[#15803d]" : "text-[#b91c1c]")}><Icon className="h-3.5 w-3.5" />{v > 0 ? "+" : ""}{v.toFixed(1)}{suffix}</span>;
}

/**
 * Dashboard — the map is the workspace; every number beside it is a value of the displayed run
 * (or a real difference between two runs of the same landscape). Nothing here is decorative.
 */
export default function Dashboard() {
  const { sceneId, scene, dataSource, apiOnline, selectedPatchId, setSelectedPatchId, removedPatchIds, togglePatchRemoved, clearRemoved, whatIf, whatIfLoading, runs, runId, bundleVersion } = useAnalysis();
  const live = dataSource.mode === "live" && dataSource.provenance?.resultKind !== "synthetic";
  const focus = useMapFocus();

  // ---- layers / basemap state
  const [layers, setLayers] = useState({ high: true, low: true, candidates: true, critical: true, links: true, boundary: true, alerts: false, tasks: false });
  const [basemap, setBasemap] = useState<Basemap>("satellite");
  const [panelOpen, setPanelOpen] = useState(true);
  const [full, setFull] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<LatLng[]>([]);
  // Quicklook result tagged with the request it answers, so a stale image is never shown for a new scene/basemap.
  const [quicklook, setQuicklook] = useState<{ key: string; data: SceneQuicklook | null } | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [tasks, setTasks] = useState<FieldTaskItem[]>([]);
  const [metric, setMetric] = useState<"habitatAreaHa" | "patchCount" | "ecaPctOfHabitat" | "iic" | "criticalPatches">("habitatAreaHa");
  const [tab, setTab] = useState<Tab>("overview");
  const [removeHint, setRemoveHint] = useState(false);

  // ---- data of the displayed run
  const mask = getHabitatMask(sceneId);
  const graph = getGraph(sceneId);
  const heatmap = getHeatmap(sceneId);
  const conn = getConnectivity(sceneId);
  const restoration = getRestoration(sceneId);
  const timeline = hasLiveTimeline(sceneId) ? getTimeline(sceneId) : null;
  const run = runs.find((r) => r.runId === runId) ?? runs.find((r) => r.isLatest) ?? runs[0] ?? null;
  const year = run?.sceneYear ?? null;
  const years = (timeline?.years ?? []).slice().sort((a, b) => a.year - b.year);
  const cur = years.find((y) => y.year === year) ?? years[years.length - 1] ?? null;
  const prev = cur ? years.filter((y) => y.year < cur.year).pop() ?? null : null;
  const selected = selectedPatchId ? mask.patches.find((p) => p.id === selectedPatchId) ?? null : null;
  const criticalIds = new Set(mask.patches.filter((p) => p.criticalityRank != null && p.criticalityRank <= CRITICAL_TOP).map((p) => p.id));
  const habitatHa = mask.patches.reduce((s, p) => s + p.areaHa, 0);
  const hidden = mask.patches.filter((p) => (p.confidence >= HIGH_CONF ? !layers.high : !layers.low)).map((p) => p.id);
  const quicklookKind: QuicklookKind | null = basemap === "rgb" || basemap === "ndvi" || basemap === "s1" ? basemap : null;
  const quicklookKey = quicklookKind ? `${sceneId}|${quicklookKind}|${year ?? ""}` : "";
  const overlay = quicklookKey && quicklook?.key === quicklookKey ? quicklook.data : null;
  const overlayMissing = !!quicklookKey && quicklook?.key === quicklookKey && quicklook.data === null;

  useEffect(() => {
    if (apiOnline !== true) return;
    let cancelled = false;
    fetchAlerts(sceneId).then((a) => { if (!cancelled) setAlerts(a); }).catch(() => {});
    fetchTasks(sceneId).then((t) => { if (!cancelled) setTasks(t); }).catch(() => {});
    return () => { cancelled = true; };
  }, [sceneId, apiOnline, bundleVersion]);

  // Real sensor quicklooks are rendered from the downloaded scene raster of the displayed year.
  useEffect(() => {
    if (!quicklookKind || apiOnline !== true) return;
    let cancelled = false;
    const key = quicklookKey;
    fetchSceneQuicklook(sceneId, quicklookKind, year).then((o) => { if (!cancelled) setQuicklook({ key, data: o }); }).catch(() => { /* no quicklook: basemap stays */ });
    return () => { cancelled = true; };
  }, [quicklookKind, quicklookKey, sceneId, year, apiOnline]);

  useEffect(() => {
    if (!full) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setFull(false); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [full]);

  const markers = [
    ...(layers.candidates ? restoration.actions.map((a) => ({ id: `c${a.id}`, lat: a.center[0], lon: a.center[1], color: "#f59e0b", label: `Restoration candidate ${a.id} · +${a.connectivityGain.toFixed(2)} % IIC`, kind: "candidate" as const })) : []),
    ...(layers.alerts ? alerts.filter((a) => a.lat != null && a.lon != null && a.status !== "RESOLVED" && a.status !== "DISMISSED").map((a) => ({ id: `al${a.id}`, lat: a.lat!, lon: a.lon!, color: SEV[a.severity], label: `${a.severity.toUpperCase()} · ${a.title}`, kind: "alert" as const })) : []),
    ...(layers.tasks ? tasks.map((t) => ({ id: `t${t.id}`, lat: t.lat, lon: t.lon, color: t.status === "VERIFIED" ? "#15803d" : "#1e5f8a", label: `${t.status} · ${t.title}`, kind: "task" as const })) : []),
  ];
  const patchStyle = (p: HabitatPatch) => {
    if (layers.critical && criticalIds.has(p.id)) return { color: "#dc2626", fillColor: "#dc2626", fillOpacity: 0.45 };
    if (p.confidence < HIGH_CONF) return { color: "#4ade80", fillColor: "#4ade80", fillOpacity: 0.22, dashArray: "3 3" };
    return { color: "#16a34a", fillColor: "#16a34a", fillOpacity: 0.42 };
  };
  const removePatch = (p: HabitatPatch) => {
    if (!removedPatchIds.includes(p.id)) requestMapFocus(p.center[0], p.center[1], 14);
    togglePatchRemoved(p.id);
    setRemoveHint(false);
  };
  const focusPatch = (p: HabitatPatch) => { setSelectedPatchId(p.id); requestMapFocus(p.center[0], p.center[1], 14); };
  const chartRows = years.map((y) => ({ year: y.year, v: y[metric] ?? null }));
  const metricLabel = { habitatAreaHa: "Mangrove area (ha)", patchCount: "Patch count", ecaPctOfHabitat: "ECA / habitat (%)", iic: "IIC", criticalPatches: "Critical patches" }[metric];
  const openAlerts = alerts.filter((a) => a.status === "OPEN").length;

  const mapBlock = (
    <div className={cn("relative overflow-hidden bg-[#0b1120]", full ? "fixed inset-0 z-[1300]" : "h-full min-h-[520px] rounded-2xl border border-black/[0.06]")}>
      <GisMap
        scene={scene} mask={mask} graph={graph} heatmap={heatmap}
        layers={{ satellite: true, probability: false, habitat: true, heatmap: false, connectivity: layers.links, protectedAreas: false, labels: false }}
        basemap={basemap === "terrain" ? "terrain" : "satellite"} heatOpacity={0}
        selectedPatchId={selectedPatchId} onSelectPatch={setSelectedPatchId} removedPatchIds={removedPatchIds}
        className="h-full w-full" markers={markers} sensorOverlay={overlay} patchStyle={patchStyle} hiddenPatchIds={hidden} showBoundary={layers.boundary}
        measuring={measuring} measurePoints={measurePoints} onMeasurePoint={(p) => setMeasurePoints((s) => [...s, p])} focus={focus}
      />
      {/* tool buttons under Leaflet's zoom control */}
      <div className="absolute left-[10px] top-[86px] z-[900] flex flex-col gap-1.5">
        <button onClick={() => setPanelOpen((o) => !o)} title="Layers" className={cn("grid h-[30px] w-[30px] place-items-center rounded border border-black/20 bg-white shadow", panelOpen && "bg-[#dcfce7]")}><Layers className="h-4 w-4" /></button>
        <button onClick={() => { setMeasuring((m) => !m); if (measuring) setMeasurePoints([]); }} title="Measure distance" className={cn("grid h-[30px] w-[30px] place-items-center rounded border border-black/20 bg-white shadow", measuring && "bg-[#0f5132] text-white")}><Ruler className="h-4 w-4" /></button>
        <button onClick={() => setFull((f) => !f)} title={full ? "Exit full screen" : "Full screen"} className="grid h-[30px] w-[30px] place-items-center rounded border border-black/20 bg-white shadow">{full ? <Minimize2 className="h-4 w-4" /> : <Expand className="h-4 w-4" />}</button>
      </div>
      {/* provenance strip */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-[900] rounded-md bg-black/60 px-2.5 py-1 text-[10.5px] font-medium text-white backdrop-blur">
        {live ? `${dataSource.provenance?.resultKind === "development" ? "REAL DATA · development model · not final" : dataSource.label}${year ? ` · scene ${year}` : ""}` : apiOnline === false ? "backend offline — no analysis" : "no real analysis for this landscape yet"}
        {overlayMissing && " · sensor quicklook unavailable for this landscape"}
        {overlay?.scene && ` · layer: ${overlay.scene.replace(/_10m\.tif$/, "").replace(/^.*?_(\d{4})_(s\d+)$/, "$2 scene $1")}`}
      </div>
      {/* layers panel */}
      {panelOpen && (
        <div className="absolute right-3 top-3 z-[900] w-[228px] rounded-xl bg-[#0b1120]/85 p-3 text-[12px] text-white shadow-xl backdrop-blur">
          <div className="mb-2 flex items-center justify-between"><span className="text-[13px] font-semibold">Layers</span><button onClick={() => setPanelOpen(false)} aria-label="Close layers"><ChevronUp className="h-4 w-4" /></button></div>
          {([
            ["high", "Mangrove (high confidence)", "#16a34a"], ["low", "Mangrove (lower confidence)", "#4ade80"], ["candidates", "Restoration candidates", "#f59e0b"],
            ["critical", `Critical patches (top ${CRITICAL_TOP})`, "#dc2626"], ["links", "Connectivity links", "#7dd3fc"], ["boundary", "Study area boundary", "#f8fafc"],
            ["alerts", `Alerts (${alerts.length})`, "#c2410c"], ["tasks", `Field tasks (${tasks.length})`, "#1e5f8a"],
          ] as const).map(([k, label, color]) => (
            <label key={k} className="flex cursor-pointer items-center gap-2 py-1">
              <input type="checkbox" checked={layers[k]} onChange={(e) => setLayers((l) => ({ ...l, [k]: e.target.checked }))} className="accent-[#16a34a]" />
              <span className="h-3 w-3 rounded-sm" style={{ background: color, opacity: k === "links" || k === "boundary" ? 0.9 : 1 }} />
              <span className="text-white/90">{label}</span>
            </label>
          ))}
          <div className="my-2 h-px bg-white/15" />
          {BASEMAPS.map((b) => (
            <label key={b.id} className="flex cursor-pointer items-center gap-2 py-1">
              <input type="radio" name="basemap" checked={basemap === b.id} onChange={() => setBasemap(b.id)} className="accent-[#16a34a]" disabled={b.real && !live} />
              <span className={cn("text-white/90", b.real && !live && "text-white/40")}>{b.label}</span>
            </label>
          ))}
          <div className="mt-1 text-[9.5px] text-white/50">Sentinel layers are rendered from the downloaded scene raster.</div>
        </div>
      )}
      {/* India inset */}
      <div className="absolute bottom-6 right-3 z-[900] hidden h-[110px] w-[110px] overflow-hidden rounded-lg border border-white/30 bg-[#0b1120] shadow-lg md:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="India" src="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/export?bbox=66,5,99,38&bboxSR=4326&imageSR=4326&size=220,220&format=png&f=image" className="h-full w-full object-cover opacity-90" />
        <span className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#4ade80] ring-2 ring-white" style={{ left: `${((scene.center[1] - 66) / 33) * 100}%`, top: `${((38 - scene.center[0]) / 33) * 100}%` }} />
        <span className="absolute bottom-1 right-1.5 text-[9px] text-white/80">{scene.state}</span>
      </div>
      {full && <button onClick={() => setFull(false)} className="absolute right-3 top-3 z-[950] rounded-lg bg-white px-3 py-1.5 text-[12px] font-semibold shadow">Exit full screen (Esc)</button>}
    </div>
  );

  const changeCard = (
            <section className="rounded-2xl border border-black/[0.06] bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <div><h2 className="text-[15px] font-semibold">Change Over Time</h2><p className="text-[12px] text-muted-foreground">One analysis per year</p></div>
                <SelectMenu label="Metric" value={metric} onChange={(v) => setMetric(v as typeof metric)} className="w-[160px]" align="right"
                  options={[{ value: "habitatAreaHa", label: "Mangrove area" }, { value: "patchCount", label: "Patches" }, { value: "ecaPctOfHabitat", label: "ECA / habitat" }, { value: "iic", label: "IIC" }, { value: "criticalPatches", label: "Critical patches" }]} />
              </div>
              {years.length >= 2 ? (
                <div className="mt-2 h-[150px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartRows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                      <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#16a34a" stopOpacity={0.35} /><stop offset="100%" stopColor="#16a34a" stopOpacity={0.02} /></linearGradient></defs>
                      <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="year" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} tickFormatter={(v: number) => (metric === "iic" ? v.toExponential(1) : String(v))} />
                      <RTooltip formatter={(v) => [typeof v === "number" ? (metric === "iic" ? v.toExponential(3) : v.toLocaleString("en-IN")) : String(v), metricLabel]} />
                      <Area type="monotone" dataKey="v" stroke="#15803d" strokeWidth={2} fill="url(#g)" dot={{ r: 4, fill: "#15803d" }} connectNulls />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="mt-3 rounded-lg border border-dashed border-black/[0.12] p-3 text-[12px] text-muted-foreground">{live ? "Only one year analysed so far — a second year will show the change." : "No real analysis for this landscape yet."}</div>
              )}
              {years.length >= 2 && <div className="mt-1 text-[10.5px] text-muted-foreground">{years.map((y) => y.year).join(" · ")} · real runs; change = binary-mask difference between consecutive years</div>}
            </section>
  );

  return (
    <AppShell title={scene.name} bleed hideTitle>
      <div className="px-4 pb-4 pt-3 sm:px-5">
        {/* heading + tabs */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] font-bold tracking-tight">{scene.name}</h1>
              {year && <span className="rounded-full bg-[#dcfce7] px-2.5 py-0.5 text-[11.5px] font-semibold text-[#0f5132]">{years[0]?.year === year ? "Baseline" : "Observation"} ({year})</span>}
            </div>
            <p className="text-[12.5px] text-muted-foreground">Satellite-derived mangrove habitats, connectivity analysis and restoration opportunities</p>
          </div>
          <nav role="tablist" aria-label="Dashboard views" className="flex overflow-x-auto rounded-xl border border-black/[0.08] bg-white p-1 text-[13px] font-medium">
            {TABS.map(([id, l]) => (
              <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                className={cn("whitespace-nowrap rounded-lg px-3.5 py-1.5 transition-colors", tab === id ? "bg-[#0f5132] text-white shadow-sm" : "text-[#334155] hover:bg-[#f4f7f5]")}>{l}</button>
            ))}
          </nav>
        </div>

        <div className="mt-3 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          {/* ---------------------------------------------------------- map + KPI strip */}
          <div className="flex min-w-0 flex-col gap-4">
            <div className="h-[62vh] min-h-[520px]">{mapBlock}</div>
            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              <Kpi icon={Trees} color="#16a34a" value={mask.patches.length} label="Habitat patches" d={<Delta v={delta(cur?.patchCount, prev?.patchCount)} />} />
              <Kpi icon={Network} color="#1e5f8a" value={graph.edges.length} label="Connections" d={<Delta v={delta(cur?.nEdges, prev?.nEdges)} />} />
              <Kpi icon={Leaf} color="#15803d" value={`${Math.round(habitatHa).toLocaleString("en-IN")} ha`} label="Mangrove area" d={<Delta v={delta(cur?.habitatAreaHa, prev?.habitatAreaHa)} />} />
              <Kpi icon={Sprout} color="#b45309" value={restoration.actions.length} label="Restoration options" />
            </div>
          </div>

          {/* ---------------------------------------------------------- right column (switches with the tabs) */}
          <div className="flex min-w-0 flex-col gap-4">
            {tab === "patches" && <PatchesPanel patches={mask.patches} selectedId={selectedPatchId} onPick={focusPatch} />}
            {tab === "connectivity" && <ConnectivityPanel graph={graph} components={run?.nComponents ?? cur?.nComponents ?? null} eca={conn.ecaPctOfHabitat ?? null} />}
            {tab === "restoration" && <RestorationPanel actions={restoration.actions} onPick={(a) => requestMapFocus(a.center[0], a.center[1], 14)} />}
            {tab === "change" && changeCard}
            {tab === "reports" && <ReportsPanel />}
            {tab === "overview" && (<>
            {/* selected patch */}
            <section className="rounded-2xl border border-black/[0.06] bg-white p-4">
              <div className="flex items-center justify-between"><h2 className="text-[15px] font-semibold">Selected Patch</h2><span className="text-[12px] text-muted-foreground">{selected ? selected.id : "click a patch"}</span></div>
              {selected ? (
                <>
                  <div className="mt-3 grid grid-cols-[132px_1fr] gap-3">
                    <PatchThumb p={selected} />
                    <div className="grid grid-cols-2 gap-x-2 gap-y-2.5 text-[12px]">
                      <div><div className="text-muted-foreground">Area</div><div className="text-[16px] font-bold">{selected.areaHa.toLocaleString("en-IN")} ha</div></div>
                      <div><div className="text-muted-foreground">Connectivity Loss</div><div className="text-[16px] font-bold">{selected.deltaPct != null ? `${selected.deltaPct.toFixed(1)}%` : "—"}</div></div>
                      <div><div className="text-muted-foreground">Importance</div><span className={cn("mt-0.5 inline-block rounded-md px-2 py-0.5 text-[11.5px] font-semibold capitalize", selected.sensitivity === "critical" || selected.sensitivity === "high" ? "bg-[#fee2e2] text-[#b91c1c]" : selected.sensitivity === "medium" ? "bg-[#fef3c7] text-[#b45309]" : "bg-[#dcfce7] text-[#15803d]")}>{selected.sensitivity}{selected.criticalityRank != null ? ` · #${selected.criticalityRank}` : ""}</span></div>
                      <div><div className="text-muted-foreground">Confidence</div><div className="text-[16px] font-bold">{Math.round(selected.confidence * 100)}%</div></div>
                    </div>
                  </div>
                  {selected.isCutVertex && <div className="mt-2 text-[11.5px] text-[#b91c1c]">Cut vertex — removing it splits the network into {selected.componentCountAfter} components.</div>}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Link href={`/analysis?scene=${sceneId}&patch=${selected.id}`} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0f5132] px-3 py-2.5 text-[12.5px] font-semibold text-white hover:bg-[#0b3d26]"><Info className="h-3.5 w-3.5" /> View Details</Link>
                    <button disabled={!live} onClick={() => removePatch(selected)} className={cn("inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-[12.5px] font-semibold disabled:opacity-40", removedPatchIds.includes(selected.id) ? "border-[#b91c1c] bg-[#fee2e2] text-[#b91c1c]" : "border-black/[0.1] bg-white hover:bg-[#f4f7f5]")}><Scissors className="h-3.5 w-3.5" /> {removedPatchIds.includes(selected.id) ? "Undo Removal" : "Simulate Removal"}</button>
                  </div>
                </>
              ) : (
                <p className="mt-2 text-[12.5px] text-muted-foreground">Click a patch on the map to see its details.</p>
              )}
            </section>

            {/* landscape metrics */}
            <section className="rounded-2xl border border-black/[0.06] bg-white p-4">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-[15px] font-semibold"><Waves className="h-4 w-4 text-[#1e5f8a]" /> Landscape Metrics</h2>
                <Link href="/reports" className="text-[12px] font-medium text-[#0f5132] hover:underline">View Full Report →</Link>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2">
                <Metric v={`${Math.round(habitatHa).toLocaleString("en-IN")} ha`} l="Total Mangrove Area" d={<Delta v={delta(cur?.habitatAreaHa, prev?.habitatAreaHa)} />} />
                <Metric v={mask.patches.length} l="Patches" d={<Delta v={delta(cur?.patchCount, prev?.patchCount)} />} />
                <Metric v={run?.nComponents ?? cur?.nComponents ?? "—"} l="Components" d={<Delta v={delta(cur?.nComponents, prev?.nComponents)} invert />} />
                <Metric v={conn.ecaPctOfHabitat != null ? `${conn.ecaPctOfHabitat.toFixed(1)}%` : "—"} l="ECA / Habitat" d={<Delta v={cur?.ecaPctOfHabitat != null && prev?.ecaPctOfHabitat != null ? cur.ecaPctOfHabitat - prev.ecaPctOfHabitat : null} suffix=" pp" />} />
              </div>
              <div className="mt-2 text-[10.5px] text-muted-foreground">{prev ? `Change vs. ${prev.year} run of the same landscape.` : "Change needs a second observation year for this landscape."}</div>
            </section>

            {/* what-if */}
            <section className="rounded-2xl border border-black/[0.06] bg-white p-4">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold"><Cpu className="h-4 w-4 text-[#1e5f8a]" /> What-if Simulation</h2>
              <p className="text-[12px] text-muted-foreground">Remove or restore a patch and see the effect.</p>
              {removeHint && !selected && <p className="mt-2 rounded-lg bg-[#fff7ed] px-3 py-2 text-[12px] text-[#9a3412]">Click a patch on the map first, then press Remove Patch.</p>}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button disabled={!live} onClick={() => (selected ? removePatch(selected) : setRemoveHint(true))} className="flex items-center gap-2 rounded-lg bg-[#fee2e2] px-3 py-3 text-[12.5px] font-semibold text-[#b91c1c] hover:bg-[#fecaca] disabled:opacity-40"><Scissors className="h-4 w-4" /> {selected && removedPatchIds.includes(selected.id) ? "Undo Removal" : "Remove Patch"}</button>
                <Link href="/restoration" className="flex items-center gap-2 rounded-lg bg-[#dcfce7] px-3 py-3 text-[12.5px] font-semibold text-[#15803d] hover:bg-[#bbf7d0]"><Sprout className="h-4 w-4" /> Restore Area</Link>
                <Link href="/scenario?type=remove_polygon" className="flex items-center gap-2 rounded-lg bg-[#dbeafe] px-3 py-3 text-[12.5px] font-semibold text-[#1e5f8a] hover:bg-[#bfdbfe]"><Waves className="h-4 w-4" /> Draw Impact Area</Link>
                <Link href="/scenario?type=tau" className="flex items-center gap-2 rounded-lg bg-[#ede9fe] px-3 py-3 text-[12.5px] font-semibold text-[#6d28d9] hover:bg-[#ddd6fe]"><Settings2 className="h-4 w-4" /> Scenario Lab</Link>
              </div>
              {removedPatchIds.length > 0 && (
                <div className="mt-3 rounded-lg border border-[#fecaca] bg-[#fff5f5] p-3 text-[12px]">
                  <div className="flex items-center justify-between"><span className="font-semibold">Removing {removedPatchIds.join(", ")}</span><button onClick={clearRemoved} className="text-[11px] text-[#b91c1c] underline">reset</button></div>
                  {whatIf ? (
                    <div className="mt-1 grid grid-cols-3 gap-2">
                      <div><div className="text-muted-foreground">{whatIf.metric.toUpperCase()} loss</div><div className="text-[15px] font-bold text-[#b91c1c]">−{whatIf.loss_pct.toFixed(1)}%</div></div>
                      <div><div className="text-muted-foreground">Habitat removed</div><div className="text-[15px] font-bold">{whatIf.habitat_area_removed_pct.toFixed(1)}%</div></div>
                      <div><div className="text-muted-foreground">Components</div><div className="text-[15px] font-bold">{whatIf.components_before} → {whatIf.components_after}</div></div>
                    </div>
                  ) : whatIfLoading ? <div className="mt-1 text-muted-foreground">computing on the backend…</div> : null}
                </div>
              )}
            </section>

            {openAlerts > 0 && (
              <Link href={`/alerts?study_area=${sceneId}`} className="flex items-center justify-between rounded-2xl border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-[12.5px]"><span><span className="font-semibold">{openAlerts} open alert{openAlerts === 1 ? "" : "s"}</span> for this landscape</span><ChevronRight className="h-4 w-4" /></Link>
            )}
            {changeCard}
            </>)}
          </div>
        </div>
      </div>
      {!live && apiOnline === true && (
        <div className="mx-4 mb-4 rounded-xl border border-[#fde68a] bg-[#fffbeb] px-4 py-2.5 text-[12px] text-[#78350f] sm:mx-5">No real pipeline run exists for {scene.region} yet, so there is nothing to show. Use <Link href="/upload" className="underline">New Analysis</Link> once the scene is downloaded.</div>
      )}
    </AppShell>
  );
}

function Kpi({ icon: Icon, color, value, label, d }: { icon: typeof Leaf; color: string; value: string | number; label: string; d?: ReactNode }) {
  // compact stat chip: tinted icon, value + label side by side
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/70 px-3.5 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.05)] backdrop-blur"
      style={{ background: `linear-gradient(135deg, ${color}14, rgba(255,255,255,0.92) 55%)` }}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white shadow-sm" style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}><Icon className="h-[18px] w-[18px]" /></span>
      <div className="min-w-0">
        <div className="text-[19px] font-black leading-none tracking-tight text-[#0f172a]">{value}</div>
        <div className="mt-1 text-[11.5px] font-medium leading-tight text-[#475569]">{label}</div>
        {d && <div className="mt-0.5 truncate text-[10.5px]">{d}</div>}
      </div>
    </div>
  );
}
function Metric({ v, l, d }: { v: string | number; l: string; d: ReactNode }) {
  return <div className="min-w-0"><div className="text-[18px] font-bold leading-none">{v}</div><div className="mt-1 text-[10.5px] leading-tight text-muted-foreground"><Term>{l}</Term></div><div className="mt-1">{d}</div></div>;
}

/** Real imagery of the patch's bounding box with its polygon outline. */
function PatchThumb({ p }: { p: HabitatPatch }) {
  const [minLat, minLon, maxLat, maxLon] = patchBounds(p);
  const padLat = Math.max((maxLat - minLat) * 0.35, 0.004); const padLon = Math.max((maxLon - minLon) * 0.35, 0.004);
  const b = [minLat - padLat, minLon - padLon, maxLat + padLat, maxLon + padLon];
  const src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${b[1]},${b[0]},${b[3]},${b[2]}&bboxSR=4326&imageSR=4326&size=264,264&format=jpg&f=image`;
  const pts = p.polygon.map(([la, lo]) => `${((lo - b[1]) / (b[3] - b[1])) * 100},${((b[2] - la) / (b[2] - b[0])) * 100}`).join(" ");
  return (
    <div className="relative h-[132px] w-[132px] overflow-hidden rounded-xl bg-[#0b1120]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={`${p.id} imagery`} className="h-full w-full object-cover" />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full"><polygon points={pts} fill="rgba(74,222,128,0.35)" stroke="#f97316" strokeWidth={1.2} vectorEffect="non-scaling-stroke" /></svg>
    </div>
  );
}

/* ------------------------------------------------------------------ tab panels */
function Panel({ title, href, cta, children }: { title: string; href: string; cta: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-black/[0.06] bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <Link href={href} className="inline-flex items-center gap-1 text-[12px] font-medium text-[#0f5132] hover:underline">{cta} <ChevronRight className="h-3.5 w-3.5" /></Link>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

const SENS_CLS: Record<string, string> = { critical: "bg-[#fee2e2] text-[#b91c1c]", high: "bg-[#ffedd5] text-[#c2410c]", medium: "bg-[#fef3c7] text-[#b45309]", low: "bg-[#dcfce7] text-[#15803d]" };

function PatchesPanel({ patches, selectedId, onPick }: { patches: HabitatPatch[]; selectedId: string | null; onPick: (p: HabitatPatch) => void }) {
  const rows = patches.slice().sort((a, b) => (a.criticalityRank ?? 999) - (b.criticalityRank ?? 999));
  return (
    <Panel title="Patches by importance" href="/analysis" cta="Full analysis">
      <p className="mb-2 text-[12px] text-muted-foreground">Click a patch to find it on the map.</p>
      <div className="max-h-[440px] space-y-1 overflow-y-auto pr-1">
        {rows.map((p) => (
          <button key={p.id} onClick={() => onPick(p)} className={cn("flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors", selectedId === p.id ? "border-[#15803d]/40 bg-[#f0fdf4]" : "border-black/[0.06] hover:bg-[#f8faf9]")}>
            <span className="w-7 text-[12px] font-bold tabular-nums text-muted-foreground">#{p.criticalityRank ?? "–"}</span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-[13px] font-semibold">{p.id}{p.isCutVertex && <span className="rounded bg-[#fee2e2] px-1.5 text-[10px] font-semibold text-[#b91c1c]">splits</span>}</span>
              <span className="text-[11.5px] text-muted-foreground">{p.areaHa.toLocaleString("en-IN")} ha{p.deltaPct != null ? ` · −${p.deltaPct.toFixed(1)}% if lost` : ""}</span>
            </span>
            <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize", SENS_CLS[p.sensitivity] ?? SENS_CLS.low)}>{p.sensitivity}</span>
          </button>
        ))}
      </div>
    </Panel>
  );
}

function ConnectivityPanel({ graph, components, eca }: { graph: ReturnType<typeof getGraph>; components: number | null; eca: number | null }) {
  const critical = graph.edges.filter((e) => e.critical);
  const stats: [string, string | number][] = [["Patches", graph.nodes.length], ["Links", graph.edges.length], ["Groups", components ?? "—"], ["ECA / habitat", eca != null ? `${eca.toFixed(1)}%` : "—"]];
  return (
    <Panel title="Connectivity" href="/graph" cta="Open network">
      <div className="grid grid-cols-2 gap-2">
        {stats.map(([l, v]) => <div key={l} className="rounded-xl bg-[#f8faf9] px-3 py-2.5"><div className="text-[18px] font-bold">{v}</div><div className="text-[11.5px] text-muted-foreground"><Term>{l}</Term></div></div>)}
      </div>
      <div className="mt-3 text-[12px] font-semibold">Critical links <span className="font-normal text-muted-foreground">— lose one and the network splits</span></div>
      <div className="mt-1.5 space-y-1">
        {critical.length ? critical.map((e) => (
          <div key={e.id} className="flex items-center justify-between rounded-lg border border-[#fde68a] bg-[#fffbeb] px-3 py-1.5 text-[12.5px]"><span className="font-medium">{e.source} ↔ {e.target}</span><span className="text-muted-foreground">{e.distanceKm} km</span></div>
        )) : <div className="text-[12px] text-muted-foreground">None — every link has an alternative route.</div>}
      </div>
    </Panel>
  );
}

function RestorationPanel({ actions, onPick }: { actions: ReturnType<typeof getRestoration>["actions"]; onPick: (a: ReturnType<typeof getRestoration>["actions"][number]) => void }) {
  return (
    <Panel title="Restoration options" href="/restoration" cta="Restoration planner">
      <p className="mb-2 text-[12px] text-muted-foreground">Model suggestions — each needs a field check.</p>
      <div className="max-h-[440px] space-y-1 overflow-y-auto pr-1">
        {actions.map((a) => (
          <button key={a.id} onClick={() => onPick(a)} className="flex w-full items-center gap-3 rounded-xl border border-black/[0.06] px-3 py-2 text-left hover:bg-[#f8faf9]">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#fef3c7] text-[#b45309]"><Sprout className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1"><span className="block text-[13px] font-semibold">{a.id}</span><span className="text-[11.5px] text-muted-foreground">{a.areaHa} ha{a.category === "uncertain_habitat" ? " · field check first" : ""}</span></span>
            <span className="text-[12.5px] font-semibold text-[#15803d]">+{a.connectivityGain.toFixed(1)}%</span>
          </button>
        ))}
      </div>
    </Panel>
  );
}

function ReportsPanel() {
  return (
    <Panel title="Reports" href="/reports" cta="All reports">
      <p className="text-[12.5px] text-muted-foreground">Printable reports for each analysis — what was found, how, and its limits.</p>
      <Link href="/reports" className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#0f5132] px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-[#0b3d26]">Open report for this run <ChevronRight className="h-3.5 w-3.5" /></Link>
    </Panel>
  );
}
