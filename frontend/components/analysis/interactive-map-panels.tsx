"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Expand, FileSearch, Info, Leaf, Loader2, MapPin, Network, Radar, Satellite, Send, Trash2, X } from "lucide-react";

import { Tooltip } from "@/components/ui/tooltip";
import { SENSITIVITY_META } from "@/lib/constants";
import { fetchSatelliteLatest, type SatelliteLatest } from "@/lib/api";
import type { ConnectivityMetrics, HabitatGraph, HabitatMask, HabitatPatch, HeatCell, HeatmapData, LatLng } from "@/types";
import { fmtArea, fmtIndex, fmtRatio } from "@/utils/format";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ shared bits */

export function PanelCard({ icon: Icon, title, action, children, className }: {
  icon: React.ComponentType<{ className?: string }>; title: string; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-black/[0.06] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex min-w-0 items-center gap-2 text-[15px] font-bold text-[#0f172a]">
          <Icon className="h-[18px] w-[18px] shrink-0 text-[#15803d]" />
          <span className="truncate">{title}</span>
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Row({ k, v, hint }: { k: string; v: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-[5px] text-[13px]">
      <span className="flex min-w-0 items-center gap-1 text-[#475569]">
        <span className="truncate">{k}</span>
        {hint && <Tooltip content={hint}><Info tabIndex={0} className="h-3.5 w-3.5 shrink-0 cursor-help text-[#94a3b8]" /></Tooltip>}
      </span>
      <span className="shrink-0 text-right font-semibold tabular text-[#0f172a]">{v}</span>
    </div>
  );
}

function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return <span className="rounded-md px-2 py-0.5 text-[12px] font-semibold" style={{ background: `${color}1f`, color }}>{children}</span>;
}

/** patch id -> its links (graph edges join node ids; nodes carry the patch id). */
export function linksByPatch(graph: HabitatGraph) {
  const pid = new Map(graph.nodes.map((n) => [n.id, n.patchId]));
  const out = new Map<string, { other: string; km: number }[]>();
  for (const e of graph.edges) {
    const a = pid.get(e.source) ?? e.source;
    const b = pid.get(e.target) ?? e.target;
    out.set(a, [...(out.get(a) ?? []), { other: b, km: e.distanceKm }]);
    out.set(b, [...(out.get(b) ?? []), { other: a, km: e.distanceKm }]);
  }
  return out;
}

/* ------------------------------------------------------------------ selected patch */

export function SelectedPatchCard({ patch, cell, mask, graph, live, canReview, onClose, onEvidence, onVerify, onSimulateLoss, note }: {
  patch: HabitatPatch | null; cell: HeatCell | null; mask: HabitatMask; graph: HabitatGraph; live: boolean; canReview: boolean;
  onClose: () => void; onEvidence: (id: string) => void; onVerify: (p: HabitatPatch) => void; onSimulateLoss: (id: string) => void; note?: string | null;
}) {
  const links = useMemo(() => linksByPatch(graph), [graph]);
  if (!patch && !cell) {
    return (
      <PanelCard icon={Leaf} title="Selected Patch">
        <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-black/15 bg-[#fbfcfb] px-3 py-3 text-[12.5px] text-muted-foreground">
          <MapPin className="h-4 w-4 shrink-0 text-[#15803d]" /> Click a habitat patch on the map to see its details.
        </div>
      </PanelCard>
    );
  }
  const close = <button onClick={onClose} aria-label="Close" className="grid h-7 w-7 place-items-center rounded-lg text-[#64748b] hover:bg-black/[0.05]"><X className="h-4 w-4" /></button>;
  if (!patch && cell) {
    const m = SENSITIVITY_META[cell.band];
    return (
      <PanelCard icon={Leaf} title="Selected Cell" action={close}>
        <Row k="Connectivity sensitivity" v={fmtRatio(cell.sensitivity)} />
        <Row k="Impact level" v={<Pill color={m.color}>{m.label}</Pill>} />
        <Row k="Habitat probability" v={fmtRatio(cell.habitatProbability)} />
        <Row k="Share of connectivity" v={fmtRatio(cell.connectivityContribution, 1)} />
        {cell.patchId && <Row k="Patch" v={cell.patchId} />}
        {cell.explanation && <p className="mt-2 text-[12px] leading-snug text-muted-foreground">{cell.explanation}</p>}
      </PanelCard>
    );
  }
  const p = patch!;
  const l = (links.get(p.id) ?? []).slice().sort((a, b) => a.km - b.km);
  const nearest = l[0] ?? (p.neighbourDistancesKm?.length ? { other: p.neighbourIds?.[0] ?? "", km: Math.min(...p.neighbourDistancesKm) } : null);
  const band = SENSITIVITY_META[p.sensitivity];
  const cls = mask.classes.find((c) => c.habitatClass === p.habitatClass)?.label ?? p.habitatClass;
  return (
    <PanelCard icon={Leaf} title={`Selected Patch · ${p.id}`} action={close}>
      <Row k="Area" v={fmtArea(p.areaHa)} />
      <Row k="Perimeter" v={p.perimeterKm != null ? `${p.perimeterKm.toFixed(1)} km` : "—"} />
      <Row k="Links" v={l.length} hint="Other patches within the travel distance (graph edges)." />
      <Row k="Nearest patch" v={nearest ? `${nearest.km.toFixed(1)} km${nearest.other ? ` · ${nearest.other}` : ""}` : "none within reach"} />
      <Row k="Habitat type" v={<span className="capitalize">{cls}</span>} />
      <Row k="Share of connectivity" v={fmtRatio(p.connectivityContribution, 1)} hint="How much of the network's connectivity this patch carries." />
      <Row k="Level of criticality" v={<span className="flex items-center gap-1.5">{p.criticalityRank != null && <span className="text-[11.5px] font-medium text-muted-foreground">#{p.criticalityRank}</span>}<Pill color={band.color}>{band.label}</Pill></span>}
        hint="From the leave-one-out test: how much connectivity is lost if this patch disappears." />
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <button onClick={() => onSimulateLoss(p.id)} className="flex items-center justify-center gap-1.5 rounded-lg border border-[#dc2626]/25 bg-[#fef2f2] px-2 py-1.5 text-[12px] font-semibold text-[#b91c1c] hover:bg-[#fee2e2]">
          <Trash2 className="h-3.5 w-3.5" /> Simulate loss
        </button>
        {live && (
          <button onClick={() => onEvidence(p.id)} className="flex items-center justify-center gap-1.5 rounded-lg border border-black/[0.08] bg-white px-2 py-1.5 text-[12px] font-semibold text-[#0f5132] hover:bg-[#f0fdf4]">
            <FileSearch className="h-3.5 w-3.5" /> Evidence
          </button>
        )}
        {live && canReview && (
          <button onClick={() => onVerify(p)} className="col-span-2 flex items-center justify-center gap-1.5 rounded-lg border border-black/[0.08] bg-white px-2 py-1.5 text-[12px] font-semibold text-[#0f5132] hover:bg-[#f0fdf4]">
            <Send className="h-3.5 w-3.5" /> Send to field verification
          </button>
        )}
      </div>
      {note && <p className="mt-2 rounded-lg bg-[#f0fdf4] px-2 py-1.5 text-[11.5px] text-[#0f5132]">{note}</p>}
    </PanelCard>
  );
}

/* ------------------------------------------------------------------ network */

export function NetworkCard({ mask, graph, conn, onExplorer }: { mask: HabitatMask; graph: HabitatGraph; conn: ConnectivityMetrics; onExplorer: () => void }) {
  const links = useMemo(() => linksByPatch(graph), [graph]);
  const connected = mask.patches.filter((p) => (links.get(p.id)?.length ?? 0) > 0).length;
  const largest = mask.patches.reduce((m, p) => Math.max(m, p.areaHa), 0);
  return (
    <PanelCard icon={Network} title="Ecological Network"
      action={<Tooltip content="Sensitivity explorer: does the ranking hold for other travel distances and neighbour counts?"><button onClick={onExplorer} className="rounded-lg px-2 py-1 text-[11.5px] font-semibold text-[#0f5132] hover:bg-[#f0fdf4]">τ · k</button></Tooltip>}>
      <Row k="Total patches" v={mask.totals.patchCount} />
      <Row k="Connected patches" v={connected} hint="Patches with at least one link to another patch." />
      <Row k="Links" v={graph.edges.length} />
      <Row k="Connectivity score" v={`${conn.score.toFixed(1)} / 100`} hint={`Headline score of this run. IIC = ${fmtIndex(conn.iicIndex)}${conn.research ? `, ECA = ${Math.round(conn.research.ecaHa).toLocaleString()} ha` : ""}.`} />
      <Row k="Largest patch" v={fmtArea(largest)} />
      <Row k="Total habitat" v={fmtArea(mask.totals.habitatAreaHa)} />
    </PanelCard>
  );
}

/* ------------------------------------------------------------------ simulation preview (impact thumbnail) */

/** Esri World Imagery for a lon/lat box (same imagery as the map's satellite basemap), linear in degrees. */
export function imageryUrl(bounds: number[][], w: number, h: number) {
  const [[minLat, minLng], [maxLat, maxLng]] = bounds as [number[], number[]];
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${minLng},${minLat},${maxLng},${maxLat}&bboxSR=4326&imageSR=4326&size=${w},${h}&format=jpg&f=image`;
}

const IMPACT = [
  { label: "High impact", color: "#ef4444", bands: ["critical", "high"] },
  { label: "Medium", color: "#facc15", bands: ["medium"] },
  { label: "Low impact", color: "#22c55e", bands: ["low"] },
] as const;

export function ImpactThumbnail({ bounds, heatmap, onOpen }: { bounds: number[][]; heatmap: HeatmapData; onOpen: () => void }) {
  const [[minLat, minLng], [maxLat, maxLng]] = bounds as [number[], number[]];
  const W = 240, H = Math.round(240 * ((maxLat - minLat) / ((maxLng - minLng) * Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180))));
  const h = Math.max(120, Math.min(220, H));
  const cells = heatmap.cells.filter((c) => c.sensitivity >= 0.18);
  const colorOf = (c: HeatCell) => IMPACT.find((i) => (i.bands as readonly string[]).includes(c.band))!.color;
  return (
    <div className="flex items-stretch gap-3">
      <button onClick={onOpen} className="group relative min-w-0 flex-1 overflow-hidden rounded-xl border border-black/[0.08] bg-[#0b1f17]" style={{ aspectRatio: `${W} / ${h}` }} aria-label="Show the impact map">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageryUrl(bounds, W * 2, h * 2)} alt="" className="absolute inset-0 h-full w-full object-fill" loading="lazy" />
        <svg viewBox={`${minLng} ${-maxLat} ${maxLng - minLng} ${maxLat - minLat}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          {cells.map((c) => {
            const [[a, b], [cLat, d]] = c.bounds as [LatLng, LatLng];
            const lat0 = Math.min(a, cLat), lat1 = Math.max(a, cLat), lon0 = Math.min(b, d), lon1 = Math.max(b, d);
            return <rect key={c.id} x={lon0} y={-lat1} width={lon1 - lon0} height={lat1 - lat0} fill={colorOf(c)} fillOpacity={0.4 + 0.5 * c.sensitivity} />;
          })}
        </svg>
        <span className="absolute bottom-1.5 right-1.5 grid h-6 w-6 place-items-center rounded-md bg-white/90 text-[#0f172a] opacity-0 shadow transition-opacity group-hover:opacity-100"><Expand className="h-3.5 w-3.5" /></span>
      </button>
      <ul className="flex shrink-0 flex-col justify-center gap-3 text-[12px] text-[#334155]">
        {IMPACT.map((i) => (
          <li key={i.label} className="flex items-center gap-2"><span className="h-4 w-2.5 rounded-sm" style={{ background: i.color }} />{i.label}</li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ real-time tab */

const utc = (s: string | null) => (s ? `${new Date(s).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC` : "—");

export function RealtimePanel({ areaId, onShowRun }: { areaId: string; onShowRun: (runId: string) => void }) {
  const [state, setState] = useState<{ key: string; data: SatelliteLatest | null; err: string | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchSatelliteLatest(areaId)
      .then((d) => { if (!cancelled) setState({ key: areaId, data: d, err: null }); })
      .catch((e) => { if (!cancelled) setState({ key: areaId, data: null, err: e instanceof Error ? e.message : String(e) }); });
    return () => { cancelled = true; };
  }, [areaId]);
  const cur = state?.key === areaId ? state : null;
  const o = cur?.data;
  const rel = o?.model_reliability;
  const a = o?.analysis;
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-black/[0.06] bg-white p-3.5">
        <div className="mb-2 flex items-center gap-2 text-[13.5px] font-bold text-[#0f172a]"><Satellite className="h-4 w-4 text-[#15803d]" /> Latest satellite pass</div>
        {!cur ? (
          <div className="flex items-center gap-2 py-2 text-[12.5px] text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Searching the catalogue…</div>
        ) : cur.err || !o?.available ? (
          <p className="text-[12.5px] text-muted-foreground">{cur.err ? `Catalogue not reachable: ${cur.err}` : "No Sentinel-1 pass covering this area in the search window."}</p>
        ) : (
          <>
            <Row k="Acquired" v={utc(o.acquisition_time)} />
            <Row k="Satellite" v={o.satellite} />
            <Row k="Product" v={`${o.product} · ${o.polarisation ?? "VV+VH"}`} />
            <Row k="Orbit" v={`${o.orbit_direction ?? "—"} · ${o.relative_orbit ?? "—"}`} />
            <Row k="Area covered" v={fmtRatio(o.aoi_coverage)} />
            {o.previous_acquisition && <Row k="Previous pass" v={utc(o.previous_acquisition)} />}
            <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{o.source}. Near-real-time: the satellite passes every 6–12 days and the image is published hours to a day later; this is not live video.</p>
          </>
        )}
      </div>
      {rel && (
        <div className={cn("rounded-2xl border px-3.5 py-3 text-[12.5px]", rel.level === "unreliable" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-green-200 bg-green-50 text-green-900")}>
          <div className="font-semibold">Model reliability here: {rel.level}{rel.iou != null ? ` (IoU ${rel.iou.toFixed(2)} vs GMW 2020)` : ""}</div>
          <div className="mt-0.5 text-[11.5px]">{rel.level === "unreliable" ? "Mangroves here are too small for this 10 m radar model; treat any result as a demonstration only." : "The model reproduces the 2020 reference map well here."}</div>
        </div>
      )}
      {a?.status === "COMPLETED" && a.run_id ? (
        <button onClick={() => onShowRun(a.run_id!)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0f5132] px-3 py-2.5 text-[13px] font-bold text-white hover:bg-[#0b3d26]">
          <Radar className="h-4 w-4" /> Show this pass&apos;s analysis on the map
        </button>
      ) : null}
      <Link href="/satellite" className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-black/[0.08] bg-white px-3 py-2.5 text-[13px] font-semibold text-[#0f5132] hover:bg-[#f0fdf4]">
        {a?.status === "COMPLETED" ? "Open Satellite Monitor" : "Analyse the latest pass in Satellite Monitor"} <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ inset mini map */

export function MiniInset({ bounds, label, cursor, onFit }: { bounds: number[][]; label: string; cursor: { lat: number; lng: number } | null; onFit: () => void }) {
  const [[minLat, minLng], [maxLat, maxLng]] = bounds as [number[], number[]];
  // context box: the study area plus a margin on every side
  const pad = 0.6;
  const dLat = maxLat - minLat, dLng = maxLng - minLng;
  const ctx = [[minLat - dLat * pad, minLng - dLng * pad], [maxLat + dLat * pad, maxLng + dLng * pad]];
  const [[cLat0, cLng0], [cLat1, cLng1]] = ctx;
  const pct = (lat: number, lng: number) => ({ x: ((lng - cLng0) / (cLng1 - cLng0)) * 100, y: ((cLat1 - lat) / (cLat1 - cLat0)) * 100 });
  const tl = pct(maxLat, minLng), br = pct(minLat, maxLng);
  const cur = cursor ? pct(cursor.lat, cursor.lng) : null;
  return (
    <div className="relative h-[124px] w-[156px] overflow-hidden rounded-xl border-2 border-white bg-[#0b1f17] shadow-xl">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageryUrl(ctx, 312, 248)} alt="" className="absolute inset-0 h-full w-full object-fill" loading="lazy" />
      <div className="absolute border-2 border-[#ef4444] bg-[#ef4444]/10" style={{ left: `${tl.x}%`, top: `${tl.y}%`, width: `${br.x - tl.x}%`, height: `${br.y - tl.y}%` }} />
      {cur && cur.x >= 0 && cur.x <= 100 && cur.y >= 0 && cur.y <= 100 && (
        <span className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#00e599] ring-2 ring-white" style={{ left: `${cur.x}%`, top: `${cur.y}%` }} />
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/75 to-transparent px-2 pb-1.5 pt-4">
        <span className="truncate text-[12px] font-semibold text-white">{label}</span>
        <button onClick={onFit} aria-label="Fit the study area" title="Fit the study area" className="pointer-events-auto grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/90 text-[#0f172a] hover:bg-white"><Expand className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}
