import type { ScenarioResult } from "@/lib/api";
import type { HabitatGraph, HabitatMask, HabitatPatch, LatLng, RestorationAction } from "@/types";
import type { MapMarker } from "@/components/maps/gis-map";
import type { Kind } from "@/components/simulation/scenario-kinds";

/**
 * Builds what the GIS map draws for the Scenario Lab: the inputs being prepared (before a run) and the
 * recomputed network (after a run). Styling hooks are unique stroke-dash / fill values that the
 * page-scoped CSS in <ScenarioMapStyles/> animates — the shared map component is left untouched.
 */

export type Phase = "idle" | "computing" | "reset" | "play" | "done";

/** Candidate markers carry id `cand-<id>`; the page attaches the click handler. */
export const candidateIdOfMarker = (id: string) => (id.startsWith("cand-") ? id.slice(5) : null);

/** Unique style signatures picked up by ScenarioMapStyles (Leaflet writes them as SVG attributes). */
export const SIG = {
  removeSelected: "6 3",   // patch picked for removal, before running
  shrink: "4 2",           // patch shrunk (reduce_area)
  added: "3 2",            // restored / hypothetical patch
  newLink: "7 4",          // links created by the scenario (drawn via the map's "critical" edge style)
  rippleCut: "#ff3b3b",    // marker fill: ripple at a removed patch
  rippleGrow: "#00e598",   // marker fill: ripple at an added site
};

type Added = { id: string; area_ha: number; centroid: [number, number]; name?: string | null; habitat_class?: string; geometry?: { type: string; coordinates: unknown } | null };
export const addedOf = (r: ScenarioResult | null) => ((r as { added?: Added[] } | null)?.added ?? []);

const REMOVAL: Kind[] = ["remove_patches", "remove_polygon"];
const GAIN: Kind[] = ["restore", "restore_multi", "add_patch"];

export function playbackSteps(r: ScenarioResult | null): { label: string }[] {
  if (!r) return [];
  const t = r.type as Kind;
  const s = r.scenario;
  if (REMOVAL.includes(t)) {
    const n = r.removed_patch_ids?.length ?? 0;
    return [{ label: `${n} patch${n === 1 ? "" : "es"} removed` }, { label: `${r.severed_edges?.length ?? 0} links cut` }, { label: "Network recomputed" }];
  }
  if (GAIN.includes(t)) {
    const n = addedOf(r).length;
    const d = s ? s.n_edges - r.baseline.n_edges : 0;
    return [{ label: `${n} ${t === "add_patch" ? "patch" : "site"}${n === 1 ? "" : "s"} added` }, { label: `${d >= 0 ? d : 0} new link${d === 1 ? "" : "s"}` }, { label: "Network recomputed" }];
  }
  if (t === "reduce_area") return [{ label: "Patches shrink" }, { label: "Network recomputed" }];
  if (t === "radius" && s) return [{ label: "Network rebuilt" }, { label: `${s.n_edges} links (was ${r.baseline.n_edges})` }, { label: "Network recomputed" }];
  return [];
}

/** True when the scenario has something to show on the map (the others are tables only). */
export const animates = (r: ScenarioResult | null) => playbackSteps(r).length > 0;

function ringFromGeometry(g: Added["geometry"]): LatLng[] | null {
  if (!g) return null;
  const coords = g.coordinates as number[][][] | number[][][][];
  const ring = g.type === "Polygon" ? (coords as number[][][])[0] : g.type === "MultiPolygon" ? (coords as number[][][][]).map((p) => p[0]).sort((a, b) => b.length - a.length)[0] : null;
  return ring ? ring.map(([lon, lat]) => [lat, lon] as LatLng) : null;
}
function circle(c: [number, number], areaHa: number): LatLng[] {
  const rM = Math.sqrt((Math.max(areaHa, 0.1) * 10000) / Math.PI);
  const dLat = rM / 111_320;
  const dLon = rM / (111_320 * Math.cos((c[0] * Math.PI) / 180));
  return Array.from({ length: 28 }, (_, i) => { const a = (2 * Math.PI * i) / 28; return [c[0] + dLat * Math.sin(a), c[1] + dLon * Math.cos(a)] as LatLng; });
}
function toPatch(a: Added): HabitatPatch {
  return {
    id: a.id, name: a.name || (a.id.startsWith("H") ? "Hypothetical patch" : `Candidate ${a.id}`), habitatClass: "mangrove",
    areaHa: +a.area_ha.toFixed(2), center: a.centroid as LatLng, polygon: ringFromGeometry(a.geometry) ?? circle(a.centroid, a.area_ha),
    confidence: 0, quality: 0, connectivityContribution: 0, bridgeScore: 0, sensitivity: "low", protected: false,
    carbonStockTonnes: null, speciesSupported: null, degradationRisk: null, notes: "Simulated (scenario)",
  };
}

export interface MapView {
  mask: HabitatMask;
  graph: HabitatGraph;
  removedPatchIds: string[];
  patchStyle: (p: HabitatPatch) => { color?: string; fillColor?: string; fillOpacity?: number; dashArray?: string } | null;
  markers: MapMarker[];
  /** Where to fly when the run plays. */
  focus: { lat: number; lon: number; zoom: number } | null;
}

export function buildMapView(args: {
  kind: Kind; phase: Phase; result: ScenarioResult | null; mask: HabitatMask; graph: HabitatGraph;
  picked: string[]; cands: string[]; actions: RestorationAction[];
}): MapView {
  const { kind, phase, result, mask, graph, picked, cands, actions } = args;
  const plain = { ...graph, edges: graph.edges.map((e) => ({ ...e, critical: false })) };
  const showResult = !!result && (phase === "play" || phase === "done");

  // ------------------------------------------------ before the run (or between replay frames)
  if (!showResult) {
    const preview = result ? (result.type as Kind) : kind;
    const pickIds = result ? (result.removed_patch_ids ?? result.affected_patch_ids ?? []) : picked;
    const markers: MapMarker[] = (preview === "restore" || preview === "restore_multi") && !result
      ? actions.filter((a) => a.center).map((a) => {
        const on = cands.includes(a.id);
        return { id: `cand-${a.id}`, lat: a.center[0], lon: a.center[1], kind: "candidate", color: on ? "#00e599" : a.category === "uncertain_habitat" ? "#fbbf24" : "#e2e8f0", label: `${a.id} · +${a.connectivityGain.toFixed(2)} %${on ? " · selected" : " · click to select"}` };
      })
      : [];
    return {
      mask, graph: plain, removedPatchIds: [], markers, focus: null,
      patchStyle: (p) => (preview === "remove_patches" || preview === "remove_polygon") && pickIds.includes(p.id)
        ? { color: "#dc2626", fillColor: "#dc2626", fillOpacity: 0.32, dashArray: SIG.removeSelected }
        : preview === "reduce_area" && pickIds.includes(p.id) ? { color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: 0.3, dashArray: SIG.removeSelected } : null,
    };
  }

  // ------------------------------------------------ after the run
  const r = result!;
  const t = r.type as Kind;
  const play = phase === "play";
  const added = addedOf(r);
  const addedIds = added.map((a) => a.id);
  const edgeList = r.edges_after ?? null;
  const newPairs = new Set<string>();
  if (t === "radius") for (const [a, b] of ((r as { links_added?: [string, string][] }).links_added ?? [])) { newPairs.add(`${a}|${b}`); newPairs.add(`${b}|${a}`); }
  const isNew = (s: string, tg: string) => addedIds.includes(s) || addedIds.includes(tg) || newPairs.has(`${s}|${tg}`);
  let edges = edgeList
    ? edgeList.map((e, i) => ({ id: `s${i}-${e.source}-${e.target}`, source: e.source, target: e.target, strength: e.weight, distanceKm: +e.distance_km.toFixed(2), resistance: 1 - e.weight, critical: isNew(e.source, e.target), speciesFlow: [] }))
    : plain.edges;
  const removed = r.removed_patch_ids ?? [];
  if (removed.length && r.severed_edges) {
    const sev = r.severed_edges as { source: string; target: string; distance_km?: number; weight?: number }[];
    edges = [...edges, ...sev.map((e, i) => ({ id: `cut${i}-${e.source}-${e.target}`, source: e.source, target: e.target, strength: e.weight ?? 0.4, distanceKm: +(e.distance_km ?? 0).toFixed(2), resistance: 1 - (e.weight ?? 0.4), critical: false, speciesFlow: [] }))];
  }
  const outMask = added.length ? { ...mask, patches: [...mask.patches, ...added.map(toPatch)] } : mask;
  const shrunk = t === "reduce_area" ? (r.affected_patch_ids ?? []) : [];

  const markers: MapMarker[] = [];
  if (play) {
    for (const id of removed) { const p = mask.patches.find((x) => x.id === id); if (p) markers.push({ id: `rip-${id}`, lat: p.center[0], lon: p.center[1], color: SIG.rippleCut, label: `${id} removed` }); }
    for (const a of added) markers.push({ id: `rip-${a.id}`, lat: a.centroid[0], lon: a.centroid[1], color: SIG.rippleGrow, label: `${a.id} added` });
  } else {
    for (const a of added) markers.push({ id: `pin-${a.id}`, lat: a.centroid[0], lon: a.centroid[1], kind: "candidate", color: "#16a34a", label: `${a.name || a.id} · ${a.area_ha.toFixed(1)} ha · SIMULATED` });
  }

  // fly so the change AND the patches it touches are in view
  const pts: [number, number][] = [];
  const centerOf = (id: string) => outMask.patches.find((p) => p.id === id)?.center as [number, number] | undefined;
  const core = new Set<string>([...addedIds, ...removed, ...shrunk]);
  const touched = new Set<string>(core);
  for (const e of edges) if (core.has(e.source) || core.has(e.target)) { touched.add(e.source); touched.add(e.target); }
  touched.forEach((id) => { const c = centerOf(id); if (c) pts.push(c); });
  let focus: MapView["focus"] = null;
  if (pts.length) {
    const lats = pts.map((p) => p[0]); const lons = pts.map((p) => p[1]);
    const span = Math.max(Math.max(...lats) - Math.min(...lats), (Math.max(...lons) - Math.min(...lons)) * 1.4, 0.01);
    // ~420 px of usable map for the span (360° = 256 px at zoom 0)
    const zoom = Math.max(11, Math.min(14, Math.floor(Math.log2((420 * 360) / (span * 1.25 * 256)))));
    focus = { lat: (Math.max(...lats) + Math.min(...lats)) / 2, lon: (Math.max(...lons) + Math.min(...lons)) / 2, zoom };
  }

  return {
    mask: outMask,
    graph: { ...graph, edges },
    removedPatchIds: removed,
    markers,
    focus,
    patchStyle: (p) => addedIds.includes(p.id)
      ? { color: "#00e599", fillColor: "#00e599", fillOpacity: 0.55, dashArray: SIG.added }
      : shrunk.includes(p.id) ? { color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: 0.3, dashArray: SIG.shrink } : null,
  };
}

/** On lg (1024–1279 px) a results drawer covers the right of the map: shift the fly-to centre so the point lands in the open part. */
export function lonBesideDrawer(lon: number, zoom: number, drawerPx = 340) {
  if (typeof window === "undefined" || !window.matchMedia("(min-width: 1024px) and (max-width: 1279.98px)").matches) return lon;
  return lon + ((drawerPx / 2) * 360) / (256 * 2 ** zoom);
}
