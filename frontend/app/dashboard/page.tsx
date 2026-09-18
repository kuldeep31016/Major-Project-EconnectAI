"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  ClipboardCheck,
  Download,
  FileText,
  FolderKanban,
  Layers,
  Leaf,
  Network,
  ShieldCheck,
  Sprout,
  TrendingDown,
  Waves,
} from "lucide-react";

import { AppShell } from "@/components/dashboard/app-shell";
import { ModelsPanel } from "@/components/dashboard/models-panel";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  CompositionChart,
  ConnectivityTrendChart,
  HealthRadarChart,
  ScoreGauge,
} from "@/components/charts";
import { EASE } from "@/components/shared/motion";
import { useAnalysis } from "@/hooks/use-analysis";
import {
  getConnectivity,
  getGraph,
  getHabitatMask,
  getHistory,
  getReports,
  getRestoration,
} from "@/lib/data";
import { fmtArea, fmtCurrency, fmtDate, relativeTime, fmtIndex } from "@/utils/format";
import { SENSITIVITY_META } from "@/lib/constants";

export default function DashboardPage() {
  const { sceneId, scene } = useAnalysis();

  const conn = getConnectivity(sceneId);
  const mask = getHabitatMask(sceneId);
  const graph = getGraph(sceneId);
  const restoration = getRestoration(sceneId);
  const reports = getReports();
  const history = getHistory();

  const critical = mask.patches.filter((p) => p.sensitivity === "critical");
  const high = mask.patches.filter((p) => p.sensitivity === "high");
  const protectedHa = mask.patches.filter((p) => p.protected).reduce((s, p) => s + p.areaHa, 0);
  const protectedPct = (protectedHa / mask.totals.habitatAreaHa) * 100;
  const topAction = restoration.actions[0];
  const sparkTrend = conn.trend.length ? conn.trend.map((t) => t.connectivity) : undefined;
  const scoreDelta = conn.previousScore != null ? conn.score - conn.previousScore : undefined;
  const isLive = conn.research != null;

  const bandCounts = (["critical", "high", "medium", "low"] as const).map((band) => ({
    band,
    count: mask.patches.filter((p) => p.sensitivity === band).length,
  }));

  return (
    <AppShell
      title="Overview"
      subtitle={`${scene.name} · ${scene.sensor} · acquired ${fmtDate(scene.acquisitionDate)}`}
      actions={
        <>
          <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
            <Link href="/reports">
              <Download className="h-3.5 w-3.5" />
              Export
            </Link>
          </Button>
          <Button asChild size="sm" className="bg-gradient-eco font-semibold text-[#ffffff]">
            <Link href="/analysis">
              Open Analysis
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </>
      }
    >
      <div className="mx-auto max-w-[1600px] space-y-5">
        {/* ------------------------------------------------------ kpis */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard
            index={0}
            label="Active projects"
            value={4}
            icon={FolderKanban}
            accent="#6d5bd0"
            hint="Coastal landscapes monitored"
            delta={1}
            deltaSuffix=""
          />
          <KpiCard
            index={1}
            label="Connectivity score"
            value={conn.score}
            decimals={1}
            icon={Network}
            accent="#15803d"
            delta={scoreDelta}
            hint={conn.grade ?? `Interface score · Eq. (7) · IIC ${conn.iicIndex.toExponential(2)}`}
            spark={sparkTrend}
          />
          <KpiCard
            index={2}
            label="Protected habitat"
            value={protectedPct}
            decimals={1}
            suffix="%"
            icon={ShieldCheck}
            accent="#22c55e"
            hint={`${fmtArea(protectedHa)} under notification`}
            delta={2.4}
            deltaSuffix="%"
          />
          <KpiCard
            index={3}
            label="Critical regions"
            value={critical.length}
            icon={AlertTriangle}
            accent="#ef4444"
            delta={1}
            invertDelta
            hint={`${high.length} further patches high sensitivity`}
          />
          <KpiCard
            index={4}
            label="Restoration priority"
            value={topAction.connectivityGain}
            decimals={1}
            prefix="+"
            suffix=" pts"
            icon={Sprout}
            accent="#1e5f8a"
            hint={topAction ? `${topAction.costLakh != null ? fmtCurrency(topAction.costLakh) + " · " : ""}${topAction.location}` : "no candidates"}
          />
        </div>

        {/* --------------------------------------------- score + trend */}
        <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle>Landscape connectivity</CardTitle>
              <CardDescription>{conn.grade ?? "Interface score (Eq. 7) — not a research metric"}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center pb-6">
              <ScoreGauge score={conn.score} size={186} />

              <div className="mt-5 grid w-full grid-cols-3 gap-2 text-center">
                {[
                  ["PC index", fmtIndex(conn.pcIndex)],
                  ["IIC index", fmtIndex(conn.iicIndex)],
                  ["Confidence", conn.confidence.toFixed(2)],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] py-2.5">
                    <div className="text-[15px] font-bold tabular">{v}</div>
                    <div className="mt-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                      {k}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 w-full space-y-2.5">
                {conn.components.map((c) => (
                  <div key={c.label}>
                    <div className="mb-1 flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">{c.label}</span>
                      <span className="font-semibold tabular">{c.value.toFixed(1)}</span>
                    </div>
                    <Progress
                      value={c.value}
                      height={4}
                      color={c.value >= 75 ? "#22c55e" : c.value >= 55 ? "#15803d" : "#f59e0b"}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            <Card>
              <CardHeader className="flex-row items-start justify-between gap-3 pb-1">
                <div>
                  <CardTitle>Connectivity trend</CardTitle>
                  <CardDescription>Rolling 12-month landscape index</CardDescription>
                </div>
                {scoreDelta != null && (
                  <Badge variant={scoreDelta >= 0 ? "success" : "danger"}>
                    <TrendingDown className="h-3 w-3" />
                    {scoreDelta.toFixed(1)} vs last run
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="pt-2">
                {conn.trend.length ? (
                  <ConnectivityTrendChart data={conn.trend} height={196} />
                ) : (
                  <div className="grid h-[196px] place-items-center text-center text-[11px] text-muted-foreground">
                    No time series yet — a single pipeline run has one date.
                    {conn.research && (
                      <div className="mt-2 grid grid-cols-3 gap-3 text-left">
                        <div><div className="text-[9px] uppercase tracking-wider">IIC</div><div className="text-foreground tabular">{conn.research.iic.toExponential(3)}</div></div>
                        <div><div className="text-[9px] uppercase tracking-wider">PC</div><div className="text-foreground tabular">{conn.research.pc.toExponential(3)}</div></div>
                        <div><div className="text-[9px] uppercase tracking-wider">ECA</div><div className="text-foreground tabular">{Math.round(conn.research.ecaHa).toLocaleString()} ha</div></div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-1">
                  <CardTitle>Habitat composition</CardTitle>
                  <CardDescription>
                    {mask.totals.patchCount} patches · {fmtArea(mask.totals.habitatAreaHa)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-2">
                  <CompositionChart data={conn.composition} height={208} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-1">
                  <CardTitle>Habitat health</CardTitle>
                  <CardDescription>Observed against regional benchmark</CardDescription>
                </CardHeader>
                <CardContent className="pt-2">
                  {conn.health.length ? (
                    <HealthRadarChart data={conn.health} height={208} />
                  ) : (
                    <div className="grid h-[208px] place-items-center px-4 text-center text-[11px] text-muted-foreground">
                      Not computed by the pipeline (prototype-only chart).
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* --------------------------------- sensitivity + restoration */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Sensitivity distribution</CardTitle>
              <CardDescription>Patches by connectivity criticality</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {bandCounts.map(({ band, count }, i) => {
                const meta = SENSITIVITY_META[band];
                const pct = (count / mask.totals.patchCount) * 100;
                return (
                  <motion.div
                    key={band}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.07, ease: EASE }}
                  >
                    <div className="mb-1.5 flex items-center justify-between text-[12px]">
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: meta.color }}
                        />
                        <span className="font-medium">{meta.label}</span>
                      </span>
                      <span className="tabular text-muted-foreground">
                        {count} · {pct.toFixed(0)}%
                      </span>
                    </div>
                    <Progress value={pct} height={5} color={meta.color} />
                  </motion.div>
                );
              })}

              <div className="!mt-5 rounded-xl border border-[#ef4444]/20 bg-[#ef4444]/8 p-3.5">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#ef4444]" />
                  <div>
                    <div className="text-[12px] font-semibold text-[#ef4444]">
                      {critical.length} critical bridge{critical.length === 1 ? "" : "s"} detected
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                      {critical[0]?.name} and neighbouring patches carry flow with no redundant
                      route. Loss would fragment the network.
                    </p>
                    <Button asChild variant="ghost" size="sm" className="mt-2 h-7 px-2 text-[11px] text-[#ef4444]">
                      <Link href="/analysis">
                        Inspect on map
                        <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <ModelsPanel />

          <Card className="lg:col-span-2">
            <CardHeader className="flex-row items-start justify-between gap-3 pb-3">
              <div>
                <CardTitle>Restoration priorities</CardTitle>
                <CardDescription>Ranked by connectivity gain per rupee</CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/simulation">
                  Open planner
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {restoration.actions.slice(0, 4).map((a, i) => (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.06, ease: EASE }}
                  className="group flex items-center gap-3.5 rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] p-3.5 transition-colors hover:border-foreground/15 hover:bg-foreground/[0.06]"
                >
                  <div
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[13px] font-bold ${
                      i === 0
                        ? "bg-[#15803d]/15 text-[#15803d]"
                        : i === 1
                          ? "bg-[#1e5f8a]/15 text-[#1e5f8a]"
                          : "bg-foreground/[0.06] text-muted-foreground"
                    }`}
                  >
                    {a.rank}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">{a.location}</div>
                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {a.interventionType} · {a.areaHa} ha{a.timeToImpactMonths != null ? ` · ${a.timeToImpactMonths} mo` : ""}
                    </div>
                  </div>

                  <div className="hidden shrink-0 text-right sm:block">
                    <div className="text-[11px] text-muted-foreground">Cost</div>
                    <div className="text-[13px] font-semibold tabular">{a.costLakh != null ? fmtCurrency(a.costLakh) : "—"}</div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="text-[11px] text-muted-foreground">Gain</div>
                    <div className="text-[13px] font-bold tabular text-[#15803d]">
                      +{a.connectivityGain}
                    </div>
                  </div>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* --------------------------------- recent reports + activity */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex-row items-start justify-between gap-3 pb-3">
              <div>
                <CardTitle>Recent reports</CardTitle>
                <CardDescription>Published conservation assessments</CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/reports">
                  View all
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {reports.slice(0, 4).map((r, i) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.06, ease: EASE }}
                >
                  <Link
                    href={`/reports?id=${r.id}`}
                    className="group flex items-center gap-3.5 rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] p-3.5 transition-colors hover:border-[#15803d]/25 hover:bg-foreground/[0.06]"
                  >
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#1e5f8a]/12 text-[#1e5f8a]">
                      <FileText className="h-[18px] w-[18px]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">{r.title}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="truncate">{r.author}</span>
                        <span>·</span>
                        <span className="shrink-0">{r.pages} pp</span>
                        <span>·</span>
                        <span className="shrink-0">{relativeTime(r.generatedAt)}</span>
                      </div>
                    </div>
                    <Badge
                      variant={
                        r.status === "final" ? "success" : r.status === "draft" ? "secondary" : "warning"
                      }
                      className="hidden shrink-0 sm:inline-flex"
                    >
                      {r.status}
                    </Badge>
                  </Link>
                </motion.div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Analysis activity</CardTitle>
              <CardDescription>Latest processing runs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative space-y-4 pl-5">
                <div className="absolute bottom-2 left-[7px] top-2 w-px bg-foreground/10" />
                {history.slice(0, 5).map((h, i) => (
                  <motion.div
                    key={h.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: i * 0.07, ease: EASE }}
                    className="relative"
                  >
                    <span
                      className="absolute -left-5 top-1 h-[9px] w-[9px] rounded-full ring-4 ring-sidebar"
                      style={{
                        background:
                          h.status === "failed"
                            ? "#ef4444"
                            : h.scoreDelta > 0
                              ? "#22c55e"
                              : "#15803d",
                      }}
                    />
                    <div className="text-[12px] font-medium leading-tight">{h.name}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] text-muted-foreground">
                      <span>{relativeTime(h.runAt)}</span>
                      <span>·</span>
                      <span>{h.analyst}</span>
                      {h.status !== "failed" && (
                        <>
                          <span>·</span>
                          <span
                            className="font-semibold tabular"
                            style={{ color: h.scoreDelta >= 0 ? "#22c55e" : "#ef4444" }}
                          >
                            {h.scoreDelta > 0 ? "+" : ""}
                            {h.scoreDelta}
                          </span>
                        </>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>

              <Button asChild variant="ghost" size="sm" className="mt-4 w-full">
                <Link href="/history">
                  <CalendarClock className="h-3.5 w-3.5" />
                  Full history
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ------------------------------------------------ scene meta */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Scene metadata</CardTitle>
            <CardDescription>{scene.productId}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
              {[
                ["Sensor", scene.sensor, Waves],
                ["Resolution", `${scene.resolutionM} m`, Layers],
                ["Cloud cover", `${scene.cloudCover}%`, Activity],
                ["Scene area", `${scene.areaKm2} km²`, Leaf],
                ["Projection", scene.epsg, Network],
                ["Bands", `${scene.bands.length} channels`, ClipboardCheck],
              ].map(([label, value, Icon]) => {
                const I = Icon as typeof Waves;
                return (
                  <div
                    key={label as string}
                    className="rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] p-3.5"
                  >
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <I className="h-3.5 w-3.5" />
                      {label as string}
                    </div>
                    <div className="mt-1.5 truncate text-[13px] font-semibold">
                      {value as string}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {scene.tags.map((t) => (
                <Badge key={t} variant="secondary">
                  {t}
                </Badge>
              ))}
              {scene.protectedAreas?.map((p) => (
                <Badge key={p} variant="success">
                  <ShieldCheck className="h-3 w-3" />
                  {p}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
