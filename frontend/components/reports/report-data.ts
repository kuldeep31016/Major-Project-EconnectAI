/**
 * Reads the numbers that a run report already contains (its tables and its generated sentences) into a
 * structured "digest" so the Reports page can draw tiles and charts instead of paragraphs.
 *
 * Nothing here estimates or invents a value: every field is either parsed from the report the backend
 * composed (ecoconnect/pipeline/report.py) or left undefined, in which case the UI simply hides that visual.
 */
import type { ReportSection, ScientificReport } from "@/types";

export type ReportWithProvenance = ScientificReport & {
  provenance?: { runId?: string; resultKind?: string; resultLabel?: string; note?: string };
};

export interface CritRow { patch: string; areaHa?: number; areaPct?: number; score?: number; compAfter?: number; areaRank?: number; cut?: boolean; degree?: number }
export interface RestRow { id: string; areaHa?: number; gainPct?: number; newLinks?: number; cls?: string }
export interface TauRow { tau: string; links?: number; components?: number; rho?: number; top3?: string }

export interface ReportDigest {
  resultLabel?: string;
  development: boolean;
  synthetic: boolean;
  data: { model?: string; threshold?: number; mmuHa?: number; kept?: number; total?: number; coveragePct?: number; landscapeHa?: number };
  graph: { k?: number; tauKm?: number; nodes?: number; links?: number; components?: number; meanDegree?: number; habitatHa?: number; ecaHa?: number; ecaPct?: number; landscapeHa?: number; metric: string };
  crit: { rows: CritRow[]; total?: number; rho?: number; cutVertices?: number };
  whatIf: { removed?: string; removedHa?: number; removedPct?: number; lossPct?: number; severed?: number; isolated?: number; compBefore?: number; compAfter?: number; explanation?: string };
  tau: { rows: TauRow[] };
  rest: { rows: RestRow[]; total?: number; noCost: boolean; uncertain: number };
  verification?: { detections?: number; evidence: number };
}

const num = (s: string | undefined) => {
  if (s === undefined) return undefined;
  const v = Number(String(s).replace(/−/g, "-").replace(/,/g, ""));
  return Number.isFinite(v) ? v : undefined;
};
const cellNum = (c: string | number | undefined) => (typeof c === "number" ? c : num(c));

const text = (s?: ReportSection) => [...(s?.body ?? []), ...(s?.bullets ?? [])].join(" ");
const col = (s: ReportSection | undefined, ...names: string[]) => {
  const cols = s?.table?.columns ?? [];
  for (const n of names) {
    const i = cols.findIndex((c) => c.toLowerCase().startsWith(n.toLowerCase()));
    if (i >= 0) return i;
  }
  return -1;
};

export function digestReport(report: ReportWithProvenance): ReportDigest {
  const byId = (id: string) => report.sections.find((s) => s.id === id);
  const dataS = byId("data"), graphS = byId("graph"), critS = byId("criticality"), wiS = byId("whatif");
  const tauS = byId("tau"), restS = byId("restoration"), verS = byId("verification");

  const label = report.provenance?.resultLabel ?? /^([A-Z][A-Z \-]+?)\./.exec(report.abstract)?.[1];
  const kind = report.provenance?.resultKind ?? "";
  const dt = text(dataS);
  const synthetic = kind === "synthetic" || /synthetic/i.test(dt);

  // 1. data
  const kept = /\((\d+) of (\d+) components kept, habitat coverage (\d+(?:\.\d+)?) % of (\d+) ha/.exec(dt);
  const data = {
    model: /segmentation model '([^']+)'/.exec(dt)?.[1],
    threshold: num(/probability ≥ (\d+(?:\.\d+)?)/.exec(dt)?.[1]),
    mmuHa: num(/below the (\d+(?:\.\d+)?) ha minimum/.exec(dt)?.[1]),
    kept: num(kept?.[1]), total: num(kept?.[2]), coveragePct: num(kept?.[3]), landscapeHa: num(kept?.[4]),
  };

  // 2. graph
  const gt = text(graphS);
  const nodes = /(\d+) nodes, (\d+) links and (\d+) connected/.exec(gt);
  const eca = /ECA = (\d+) ha \((\d+(?:\.\d+)?) % of habitat area\)/.exec(gt);
  const metric = /C\(G\) = (\w+)/.exec(critS?.heading ?? "")?.[1] ?? "IIC";
  const graph = {
    k: num(/k = (\d+) nearest/.exec(gt)?.[1]),
    tauKm: num(/within τ = (\d+(?:\.\d+)?) km/.exec(gt)?.[1]),
    nodes: num(nodes?.[1]), links: num(nodes?.[2]), components: num(nodes?.[3]),
    meanDegree: num(/mean degree (\d+(?:\.\d+)?)/.exec(gt)?.[1]),
    habitatHa: num(/with (\d+(?:\.\d+)?) ha of habitat/.exec(gt)?.[1]),
    landscapeHa: num(/A_L = (\d+) ha/.exec(gt)?.[1]),
    ecaHa: num(eca?.[1]), ecaPct: num(eca?.[2]), metric,
  };

  // 3. criticality table
  const ct = text(critS);
  const ci = { patch: col(critS, "Patch"), area: col(critS, "Area (ha)"), pct: col(critS, "Area %"), s: col(critS, "S_i"), comp: col(critS, "Comp"), rank: col(critS, "Area rank"), cut: col(critS, "Cut"), deg: col(critS, "Degree") };
  const critRows: CritRow[] = (critS?.table?.rows ?? []).map((r) => ({
    patch: String(r[ci.patch] ?? "?"),
    areaHa: cellNum(r[ci.area]), areaPct: cellNum(r[ci.pct]), score: cellNum(r[ci.s]),
    compAfter: cellNum(r[ci.comp]), areaRank: cellNum(r[ci.rank]), degree: cellNum(r[ci.deg]),
    cut: ci.cut >= 0 ? String(r[ci.cut]) === "yes" : undefined,
  }));
  const cutM = /(\d+) of (\d+) patches are cut vertices/.exec(ct);
  const crit = {
    rows: critRows,
    total: num(/For each of the (\d+) patches/.exec(ct)?.[1]) ?? num(cutM?.[2]),
    rho: num(/ρ = ([−\-]?\d+(?:\.\d+)?)/.exec(ct)?.[1]),
    cutVertices: num(cutM?.[1]),
  };

  // 4. what-if (sentence composed by the backend from what_if_top1.json)
  const wt = text(wiS);
  const wm = /Removing (.+?) \((\d+(?:\.\d+)?) ha, (\d+(?:\.\d+)?) % of habitat\).*?\(−(\d+(?:\.\d+)?) %\), severs (\d+) links, leaves (\d+) patch(?:es)? newly isolated and changes the component count from (\d+) to (\d+)/.exec(wt);
  const whatIf = {
    removed: wm?.[1], removedHa: num(wm?.[2]), removedPct: num(wm?.[3]), lossPct: num(wm?.[4]),
    severed: num(wm?.[5]), isolated: num(wm?.[6]), compBefore: num(wm?.[7]), compAfter: num(wm?.[8]),
    explanation: /Explanation generated from the graph evidence: (.*)$/.exec(wiS?.body?.[1] ?? "")?.[1],
  };

  // 5. tau sensitivity
  const ti = { tau: col(tauS, "τ"), links: col(tauS, "Links"), comp: col(tauS, "Components"), rho: col(tauS, "ρ"), top: col(tauS, "Top") };
  const tau = {
    rows: (tauS?.table?.rows ?? []).map((r) => ({
      tau: String(r[ti.tau] ?? ""), links: cellNum(r[ti.links]), components: cellNum(r[ti.comp]), rho: cellNum(r[ti.rho]), top3: ti.top >= 0 ? String(r[ti.top]) : undefined,
    })),
  };

  // 6. restoration
  const rt = text(restS);
  const ri = { id: col(restS, "Candidate"), area: col(restS, "Area"), gain: col(restS, "R_i"), links: col(restS, "New links"), cls: col(restS, "Class") };
  const rest = {
    rows: (restS?.table?.rows ?? []).map((r) => ({
      id: String(r[ri.id] ?? "?"), areaHa: cellNum(r[ri.area]), gainPct: cellNum(r[ri.gain]), newLinks: cellNum(r[ri.links]), cls: ri.cls >= 0 ? String(r[ri.cls]) : undefined,
    })),
    total: num(/^(\d+) candidate sites/.exec(rt)?.[1]),
    noCost: /no cost data/i.test(rt),
    uncertain: num(/(\d+) candidate\(s\) are larger/.exec(rt)?.[1]) ?? 0,
  };

  const verification = verS ? { detections: num(/^(\d+) AI detection/.exec(text(verS))?.[1]), evidence: verS.table?.rows.length ?? 0 } : undefined;

  return { resultLabel: label, development: kind === "development" || /DEVELOPMENT/i.test(label ?? ""), synthetic, data, graph, crit, whatIf, tau, rest, verification };
}

/* ------------------------------------------------------------------ formatting */
export const fmtInt = (v?: number) => (v === undefined ? "—" : Math.round(v).toLocaleString("en-IN"));
export const fmtHa = (v?: number) => {
  if (v === undefined) return "—";
  if (v >= 1000) return `${(v / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })} km²`;
  return `${v.toLocaleString("en-IN", { maximumFractionDigits: 1 })} ha`;
};
export const fmtPct = (v?: number, d = 1) => (v === undefined ? "—" : `${v.toFixed(d)}%`);

/** "Sundarbans — Western Delta Block" → area name; falls back to the title. */
export const areaName = (r: ScientificReport) => r.region || r.title.replace(/^Connectivity assessment — /, "").replace(/\s*\(.*\)$/, "");
