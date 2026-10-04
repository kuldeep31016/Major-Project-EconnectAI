"use client";

import { useMemo, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle, Brain, Calendar, CircleDollarSign, ClipboardCheck, Crosshair, Download, FileText, FlaskConical,
  FolderKanban, Layers, Loader2, Map as MapIcon, Network, Printer, Ruler, Satellite, ShieldAlert, Shapes, Sprout, Target, Waypoints,
} from "lucide-react";
import type { HabitatGraph, ReportSection, WhatIfResult } from "@/types";
import { Button } from "@/components/ui/button";
import { FlowSteps } from "@/components/shared/flow-steps";
import { fmtDate } from "@/utils/format";
import { cn } from "@/lib/utils";
import { areaName, digestReport, fmtHa, fmtInt, fmtPct, type ReportDigest, type ReportWithProvenance } from "./report-data";
import { BarList, C, PartBar, SectionCard, StatTile, TechnicalDetails } from "./report-visuals";
import { ScenarioPlayer } from "./scenario-player";

export function StatusChip({ status, className }: { status: string; className?: string }) {
  const s = status === "final" ? "bg-[#dcfce7] text-[#15803d]" : status === "draft" ? "bg-[#fef3c7] text-[#b45309]" : "bg-[#dbeafe] text-[#1e5f8a]";
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize", s, className)}>{status.replace("-", " ")}</span>;
}

function Chip({ icon: Icon, children, tone = "slate" }: { icon?: typeof Calendar; children: ReactNode; tone?: "slate" | "amber" | "blue" | "green" }) {
  const t = { slate: "border-black/[0.08] bg-white text-[#475569]", amber: "border-[#fde68a] bg-[#fffbeb] text-[#b45309]", blue: "border-[#bfdbfe] bg-[#eff6ff] text-[#1e5f8a]", green: "border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]" }[tone];
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium", t)}>{Icon && <Icon className="h-3.5 w-3.5" />}{children}</span>;
}

const rhoWords = (rho?: number) =>
  rho === undefined ? "" : rho >= 0.7 ? "Here, bigger patches usually matter more." : rho >= 0.3 ? "Size explains only part of a patch's importance." : "Here, size alone does not tell you which patch matters.";

export function ReportView({ report, graph, graphState, whatIf, downloading, onDownload, sceneYear }: {
  report: ReportWithProvenance; graph: HabitatGraph | null; graphState: "loading" | "ready" | "missing"; whatIf: WhatIfResult | null;
  downloading: boolean; onDownload: () => void; sceneYear?: number;
}) {
  const reduce = useReducedMotion();
  const d = useMemo(() => digestReport(report), [report]);
  const g = d.graph, top = d.crit.rows[0];
  const lossTop = d.whatIf.lossPct ?? (top?.score !== undefined ? top.score * 100 : undefined);
  const byId = (id: string) => report.sections.find((s) => s.id === id);
  const known = new Set(["data", "graph", "criticality", "whatif", "tau", "restoration", "limits", "project", "verification"]);
  const official = report.id.startsWith("official-");
  let step = 0;
  const next = () => ++step;

  return (
    <motion.div key={report.id} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="@container min-w-0 space-y-5">
      {/* ------------------------------------------------ header */}
      <header className="relative overflow-hidden rounded-2xl border border-black/[0.06] bg-white p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(0,229,153,0.16),transparent_70%)]" aria-hidden="true" />
        <div className="relative flex flex-col gap-5 @3xl:flex-row @3xl:items-start @3xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip status={report.status} />
              <span className="text-[12px] font-semibold text-[#64748b]">{official ? "Official report" : "Run report"}</span>
            </div>
            <h1 className="mt-2.5 text-balance text-[26px] font-bold leading-[1.15] tracking-tight text-[#0b1f17] sm:text-[30px]">{areaName(report)}</h1>
            <p className="mt-1 text-[14px] text-[#475569]">Habitat connectivity report</p>
            <div className="mt-3.5 flex flex-wrap gap-2">
              <Chip icon={Calendar}>{fmtDate(report.generatedAt)}</Chip>
              {sceneYear !== undefined && <Chip icon={Satellite}>Image year {sceneYear}</Chip>}
              {d.development && <Chip icon={FlaskConical} tone="amber">Development model — not final</Chip>}
              {d.synthetic ? <Chip icon={AlertTriangle} tone="amber">Test data, not a real map</Chip> : <Chip icon={MapIcon} tone="blue">Scored against GMW map, not field truth</Chip>}
            </div>
          </div>
          <div className="flex shrink-0 gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={() => window.print()} className="h-9 rounded-xl px-3.5"><Printer className="h-4 w-4" />Print</Button>
            <Button size="sm" onClick={onDownload} disabled={downloading} className="h-9 rounded-xl bg-[#0f5132] px-4 font-semibold text-white hover:bg-[#15803d]">
              {downloading ? <><Loader2 className="h-4 w-4 animate-spin" />Preparing…</> : <><Download className="h-4 w-4" />Download PDF</>}
            </Button>
          </div>
        </div>

        {/* one-line takeaway built only from the report's own numbers */}
        {g.nodes !== undefined && (
          <p className="relative mt-5 max-w-[70ch] border-t border-black/[0.05] pt-4 text-[16px] leading-relaxed text-[#1f2937]">
            <strong className="font-bold text-[#0b1f17]">{fmtInt(g.nodes)} habitat patches</strong>
            {g.habitatHa !== undefined && <> covering <strong className="font-bold text-[#0b1f17]">{fmtHa(g.habitatHa)}</strong></>}
            {g.components !== undefined && <> form <strong className="font-bold text-[#0b1f17]">{fmtInt(g.components)} separate {g.components === 1 ? "group" : "groups"}</strong></>}.
            {g.ecaPct !== undefined && <> About <strong className="font-bold text-[#15803d]">{fmtPct(g.ecaPct, 0)}</strong> of the habitat is well connected.</>}
            {top && lossTop !== undefined && <> Losing patch <strong className="font-bold text-[#dc2626]">{top.patch}</strong> would cut connectivity by <strong className="font-bold text-[#dc2626]">{fmtPct(lossTop)}</strong>.</>}
          </p>
        )}
      </header>

      {/* ------------------------------------------------ at a glance */}
      <section aria-labelledby="glance">
        <h2 id="glance" className="mb-3 text-[13px] font-bold uppercase tracking-[0.12em] text-[#64748b]">At a glance</h2>
        <div className="grid grid-cols-2 gap-3 @xl:grid-cols-3">
          <StatTile icon={Layers} label="Habitat mapped" value={fmtHa(g.habitatHa).split(" ")[0]} unit={fmtHa(g.habitatHa).split(" ")[1]} hint={g.landscapeHa ? `of ${fmtHa(g.landscapeHa)} studied` : undefined} />
          <StatTile icon={Shapes} label="Patches" value={fmtInt(g.nodes)} hint="separate pieces of habitat" delay={0.04} />
          <StatTile icon={Waypoints} label="Links" value={fmtInt(g.links)} hint={g.tauKm ? `between patches ≤ ${g.tauKm} km apart` : "between nearby patches"} tone="blue" delay={0.08} />
          <StatTile icon={Network} label="Groups" value={fmtInt(g.components)} hint="clusters with no link between them" tone="blue" delay={0.12} />
          <StatTile icon={Target} label="Well connected" value={g.ecaPct !== undefined ? g.ecaPct.toFixed(0) : "—"} unit="%" hint="of habitat acts as one block (ECA)" delay={0.16} />
          <StatTile icon={Crosshair} label="Key patch" value={top?.patch ?? "—"} hint={lossTop !== undefined ? <span className="font-semibold text-[#dc2626]">losing it: −{lossTop.toFixed(1)}%</span> : undefined} tone="red" delay={0.2} />
        </div>
      </section>

      {/* ------------------------------------------------ how it was made */}
      <section className="rounded-2xl border border-black/[0.06] bg-white p-5 sm:p-6">
        <h2 className="text-[19px] font-bold tracking-tight text-[#0b1f17]">How this result was made</h2>
        <p className="mt-1 text-[14px] text-[#475569]">Six steps. Each one uses the result of the step before.</p>
        <FlowSteps
          className="mt-4 bg-[#f7faf8] p-4"
          steps={[
            { label: "Satellite image", icon: Satellite, tone: "slate" },
            { label: "AI habitat map", icon: Brain, tone: "violet" },
            { label: "Patches", icon: Shapes, tone: "green" },
            { label: "Network", icon: Network, tone: "blue" },
            { label: "Importance", icon: Target, tone: "amber" },
            { label: "Restoration options", icon: Sprout, tone: "green" },
          ]}
          note={[
            d.data.threshold !== undefined && `AI confidence ≥ ${Math.round(d.data.threshold * 100)}%`,
            d.data.mmuHa !== undefined && `patches ≥ ${d.data.mmuHa} ha`,
            g.tauKm !== undefined && `links up to ${g.tauKm} km`,
            `importance = ${g.metric} drop when a patch is removed`,
          ].filter(Boolean).join(" · ")}
        />
      </section>

      {report.sections.filter((s) => s.id === "project").map((s) => (
        <SectionCard key={s.id} icon={FolderKanban} title="Project" lead={s.body?.[0]?.split(";")[0] ?? "Linked project"} section={s} />
      ))}

      {/* ------------------------------------------------ 1. habitat map */}
      {byId("data") && (
        <SectionCard step={next()} icon={Satellite} title="Finding the habitat" section={byId("data")}
          lead={d.synthetic ? "This run uses generated test patches, not a real satellite map. Its numbers show how the tool works, not a real coast." : (
            <>The AI marked <b>{fmtPct(d.data.coveragePct)}</b> of the studied area as habitat
              {d.data.threshold !== undefined && <>, counting only pixels it was at least <b>{Math.round(d.data.threshold * 100)}% sure</b> about</>}.
              {d.data.kept !== undefined && d.data.total !== undefined && <> We kept <b>{d.data.kept}</b> patches and dropped <b>{d.data.total - d.data.kept}</b> specks smaller than {d.data.mmuHa ?? "?"} ha.</>}</>
          )}>
          {d.data.coveragePct !== undefined && d.data.kept !== undefined && d.data.total !== undefined && (
            <div className="grid gap-5 @xl:grid-cols-2">
              <Mini title="Share of the studied area">
                <PartBar parts={[{ label: `Habitat ${fmtPct(d.data.coveragePct)}`, value: d.data.coveragePct, color: C.green }, { label: "Other land and water", value: 100 - d.data.coveragePct, color: "#d6e2dc" }]} />
              </Mini>
              <Mini title="Pieces found by the AI">
                <PartBar parts={[{ label: `${d.data.kept} kept as patches`, value: d.data.kept, color: C.leaf }, { label: `${d.data.total - d.data.kept} too small, dropped`, value: d.data.total - d.data.kept, color: C.amber }]} />
              </Mini>
            </div>
          )}
        </SectionCard>
      )}

      {/* ------------------------------------------------ 2. network */}
      {byId("graph") && (
        <SectionCard step={next()} icon={Network} title="Linking patches into a network" section={byId("graph")}
          lead={<>Patches closer than <b>{g.tauKm ?? "?"} km</b> are linked{g.k ? <>, each to its {g.k} nearest neighbours</> : null}. That gives <b>{fmtInt(g.links)} links</b> and <b>{fmtInt(g.components)} separate groups</b>.</>}>
          <div className="grid gap-5 @2xl:grid-cols-[1.4fr_1fr]">
            {g.ecaHa !== undefined && g.habitatHa !== undefined && (
              <Mini title={`${fmtPct(g.ecaPct, 0)} of the habitat works like one connected block`}>
                <PartBar height={18} parts={[{ label: `Well connected · ${fmtHa(g.ecaHa)}`, value: g.ecaHa, color: C.green }, { label: `Rest · ${fmtHa(Math.max(g.habitatHa - g.ecaHa, 0))}`, value: Math.max(g.habitatHa - g.ecaHa, 0), color: "#d6e2dc" }]} />
                <p className="mt-2 text-[12px] text-[#64748b]">Higher is better. This share can be compared between areas.</p>
              </Mini>
            )}
            <div className="grid grid-cols-3 gap-2">
              <Num label="Patches" v={fmtInt(g.nodes)} />
              <Num label="Links" v={fmtInt(g.links)} />
              <Num label="Avg links / patch" v={g.meanDegree !== undefined ? g.meanDegree.toFixed(1) : "—"} />
            </div>
          </div>
        </SectionCard>
      )}

      {/* ------------------------------------------------ 3. criticality */}
      {byId("criticality") && d.crit.rows.length > 0 && (
        <SectionCard step={next()} icon={Target} title="Which patches matter most" section={byId("criticality")}
          lead={<>We removed each patch one at a time and measured again. Losing <b className="text-[#dc2626]">{top.patch}</b> would cut connectivity by <b className="text-[#dc2626]">{fmtPct(lossTop)}</b>. {rhoWords(d.crit.rho)}{d.crit.cutVertices ? <> {d.crit.cutVertices} patches are <b>bridges</b>: losing one splits a group.</> : null}</>}>
          <Mini title={`Connectivity lost if each patch disappears · top ${d.crit.rows.length}${d.crit.total ? ` of ${d.crit.total}` : ""}`}>
            <BarList
              color={C.green}
              data={d.crit.rows.filter((r) => r.score !== undefined).map((r, i) => ({
                key: r.patch, label: r.patch, value: r.score!, display: `−${(r.score! * 100).toFixed(1)}%`, highlight: i === 0,
                note: r.areaPct !== undefined && r.score! / (d.crit.rows[0].score || 1) > 0.25 ? `${r.areaPct}% of area${r.cut ? " · bridge" : ""}` : undefined,
              }))}
            />
          </Mini>
        </SectionCard>
      )}

      {/* ------------------------------------------------ 4. what-if */}
      {byId("whatif") && (
        <SectionCard step={next()} icon={ShieldAlert} title={`What if ${d.whatIf.removed ?? top?.patch ?? "the top patch"} is lost?`} section={byId("whatif")}
          lead={<>Press <b>Play scenario</b> to watch the network lose its most important patch.{d.whatIf.compBefore !== undefined && <> Groups go from <b>{d.whatIf.compBefore}</b> to <b>{d.whatIf.compAfter}</b>{d.whatIf.severed !== undefined && <>, <b>{d.whatIf.severed}</b> links break</>}.</>}</>}>
          <ScenarioPlayer key={`${report.id}-${graphState}`} graph={graph} graphState={graphState} whatIf={whatIf} digest={d} />
        </SectionCard>
      )}

      {/* ------------------------------------------------ 5. tau */}
      {byId("tau") && d.tau.rows.length > 0 && (
        <SectionCard step={next()} icon={Ruler} title="Does travel distance change the answer?" section={byId("tau")}
          lead={<>We don&apos;t know exactly how far seeds and animals travel, so we re-ran with {d.tau.rows.map((r) => r.tau).join(", ")}. {tauVerdict(d)}</>}>
          <div className="grid gap-3 @md:grid-cols-3">
            {d.tau.rows.map((r) => (
              <div key={r.tau} className={cn("rounded-xl border p-4", r.rho === 1 ? "border-[#15803d]/30 bg-[#f0fdf4]" : "border-black/[0.06] bg-[#fafcfb]")}>
                <div className="flex items-baseline justify-between">
                  <span className="text-[20px] font-bold tracking-tight text-[#0b1f17]">{r.tau}</span>
                  {r.rho === 1 && <span className="text-[11px] font-semibold text-[#15803d]">main setting</span>}
                </div>
                <div className="mt-2 flex gap-4 text-[12.5px] text-[#475569]"><span><b className="text-[#0b1f17]">{fmtInt(r.links)}</b> links</span><span><b className="text-[#0b1f17]">{fmtInt(r.components)}</b> {r.components === 1 ? "group" : "groups"}</span></div>
                {r.rho !== undefined && (
                  <div className="mt-3">
                    <div className="flex justify-between text-[11.5px] text-[#64748b]"><span>Same ranking as main</span><b className="tabular text-[#0b1f17]">{Math.round(r.rho * 100)}%</b></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#e2e8e5]"><motion.div className="h-full rounded-full bg-[#1e5f8a]" initial={reduce ? false : { width: 0 }} whileInView={{ width: `${Math.max(r.rho, 0) * 100}%` }} viewport={{ once: true }} transition={{ duration: 0.7 }} /></div>
                  </div>
                )}
                {r.top3 && <div className="mt-3 flex flex-wrap gap-1">{r.top3.split(/,\s*/).map((p, i) => <span key={p} className={cn("rounded-md px-1.5 py-0.5 text-[11px] font-semibold", i === 0 ? "bg-[#fee2e2] text-[#dc2626]" : "bg-white text-[#475569] ring-1 ring-black/[0.06]")}>{p}</span>)}</div>}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ------------------------------------------------ 6. restoration */}
      {byId("restoration") && (
        <SectionCard step={next()} icon={Sprout} title="Where restoration helps most" section={byId("restoration")}
          lead={d.rest.rows.length ? <>We tested {d.rest.total ?? d.rest.rows.length} possible sites by adding each one to the network. Restoring <b className="text-[#15803d]">{d.rest.rows[0].id}</b> would add the most: <b className="text-[#15803d]">+{d.rest.rows[0].gainPct?.toFixed(1)}%</b> connectivity.{d.rest.noCost && <> No costs were given, so sites are ranked by gain only.</>}</> : "No restoration sites were found for this run."}>
          {d.rest.rows.length > 0 && (
            <Mini title={`Connectivity gained by restoring each site · top ${d.rest.rows.length}`}>
              <BarList color={C.leaf} highlightColor={C.green}
                data={d.rest.rows.filter((r) => r.gainPct !== undefined).map((r, i) => ({ key: r.id, label: r.id, value: r.gainPct!, display: `+${r.gainPct! < 0.1 ? r.gainPct!.toFixed(2) : r.gainPct!.toFixed(1)}%`, highlight: i === 0, note: r.areaHa !== undefined && r.gainPct! / (d.rest.rows[0].gainPct || 1) > 0.3 ? `${fmtHa(r.areaHa)} · ${r.newLinks ?? "?"} new links` : undefined }))} />
              {d.rest.uncertain > 0 && <p className="mt-3 flex items-center gap-1.5 text-[12px] text-[#b45309]"><AlertTriangle className="h-3.5 w-3.5" />{d.rest.uncertain} large site(s) may be missed habitat, not restoration sites — check in the field.</p>}
            </Mini>
          )}
        </SectionCard>
      )}

      {/* ------------------------------------------------ verification (official reports) */}
      {byId("verification") && (
        <SectionCard step={next()} icon={ClipboardCheck} title="Field checks" section={byId("verification")}
          lead={<><b>{fmtInt(d.verification?.detections)}</b> AI findings went to field teams and <b>{fmtInt(d.verification?.evidence)}</b> field reports are attached. Only findings confirmed in the field count as verified.</>} />
      )}

      {/* ------------------------------------------------ any other section, shown as-is */}
      {report.sections.filter((s) => !known.has(s.id)).map((s) => (
        <SectionCard key={s.id} icon={FileText} title={s.heading.replace(/^\d+\.\s*/, "")} lead={s.body?.[0] ?? ""} section={{ ...s, body: s.body?.slice(1) ?? [] }} />
      ))}

      {/* ------------------------------------------------ limits */}
      {byId("limits") && <Limits section={byId("limits")!} d={d} />}

      <footer className="flex flex-col gap-1 px-1 pb-4 text-[11.5px] text-[#94a3b8] sm:flex-row sm:justify-between">
        <span className="font-mono">{report.provenance?.runId ?? report.id} · v{report.version}</span>
        <span>Generated automatically by EcoConnectAI from this run&apos;s outputs</span>
      </footer>
    </motion.div>
  );
}

function tauVerdict(d: ReportDigest) {
  const tops = d.tau.rows.map((r) => r.top3?.split(/,\s*/)[0]).filter(Boolean);
  const sameTop = tops.length > 1 && tops.every((t) => t === tops[0]);
  const minRho = Math.min(...d.tau.rows.map((r) => r.rho ?? 1));
  return <>{sameTop ? <>The most important patch stays <b>{tops[0]}</b> every time</> : <>The most important patch changes with distance</>}, and rankings agree <b>{Math.round(minRho * 100)}%</b> or more.</>;
}

function Limits({ section, d }: { section: ReportSection; d: ReportDigest }) {
  const items = [
    d.development && { icon: FlaskConical, t: "Development model", s: "Not the final AI model. Treat results as a draft." },
    d.synthetic
      ? { icon: AlertTriangle, t: "Test data", s: "Patches are generated, not mapped from a real image." }
      : { icon: MapIcon, t: "Checked against a map, not the field", s: "Scored against Global Mangrove Watch reference labels, not field truth." },
    { icon: ShieldAlert, t: "Scenarios are simulations", s: "“What if” results are computed on the map, not observed." },
    { icon: CircleDollarSign, t: "No costs assumed", s: "Restoration is ranked by connectivity gain only." },
  ].filter(Boolean) as { icon: typeof MapIcon; t: string; s: string }[];
  return (
    <section className="rounded-2xl border border-[#fde68a] bg-[#fffbeb] p-5 sm:p-6 print:break-inside-avoid">
      <h2 className="flex items-center gap-2 text-[19px] font-bold tracking-tight text-[#0b1f17]"><AlertTriangle className="h-5 w-5 text-[#b45309]" />How far to trust this</h2>
      <div className="mt-4 grid gap-3 @lg:grid-cols-2 @3xl:grid-cols-4">
        {items.map((it) => (
          <div key={it.t} className="rounded-xl bg-white p-3.5 ring-1 ring-[#fde68a]">
            <it.icon className="h-4 w-4 text-[#b45309]" />
            <div className="mt-2 text-[13.5px] font-bold leading-snug text-[#0b1f17]">{it.t}</div>
            <div className="mt-1 text-[12.5px] leading-snug text-[#57534e]">{it.s}</div>
          </div>
        ))}
      </div>
      <TechnicalDetails section={section} label="Full limitations" />
    </section>
  );
}

function Mini({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-black/[0.05] bg-[#fafcfb] p-4">
      <div className="mb-3 text-[12.5px] font-semibold text-[#334155]">{title}</div>
      {children}
    </div>
  );
}

function Num({ label, v }: { label: string; v: string }) {
  return (
    <div className="flex flex-col justify-center rounded-xl border border-black/[0.05] bg-[#fafcfb] p-3 text-center">
      <div className="tabular text-[22px] font-bold leading-none text-[#0b1f17]">{v}</div>
      <div className="mt-1.5 text-[11.5px] leading-tight text-[#64748b]">{label}</div>
    </div>
  );
}
