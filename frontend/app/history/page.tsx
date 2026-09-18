"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  Filter,
  Loader2,
  Search,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  X,
  XCircle,
} from "lucide-react";

import { AppShell } from "@/components/dashboard/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { EASE } from "@/components/shared/motion";
import { getScenes, getScene } from "@/lib/data";
import { fetchRuns } from "@/lib/api";
import type { AnalysisHistoryEntry, RunSummary } from "@/types";

/** Map a real pipeline run onto the history row shape. */
function runToEntry(r: RunSummary): AnalysisHistoryEntry {
  const scene = getScene(r.studyAreaId);
  const kind = r.resultKind;
  return {
    id: `${r.studyAreaId}/${r.runId}`,
    sceneId: r.studyAreaId,
    name: `${scene.shortName} · ${r.runId}`,
    region: scene.region,
    state: scene.state,
    runAt: r.timestamp,
    durationSec: r.elapsedS ?? 0,
    connectivityScore: r.interfaceScore,
    scoreDelta: 0,
    habitatAreaHa: r.habitatAreaHa ?? 0,
    criticalPatches: r.criticalPatches ?? 0,
    status: "completed",
    analyst:
      kind === "synthetic" ? "exact maths · synthetic geometry" : kind === "development" ? "real pipeline · dev subset · NOT FINAL" : kind === "experiment" ? "our experimental result" : kind,
    sensor: r.model && r.model !== "none (synthetic geometry)" ? `model ${r.model.split("/").slice(-2, -1)[0] ?? r.model}` : "no model (synthetic)",
    tags: [kind, r.dataSourceType ?? "", r.sceneYear ? String(r.sceneYear) : "", `${r.nPatches} patches`, `IIC ${r.iic.toExponential(2)}`].filter(Boolean),
  };
}
import { fmtArea, fmtDate, fmtDuration, relativeTime } from "@/utils/format";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "completed" | "archived" | "failed";

const STATUS_META = {
  completed: { icon: CheckCircle2, color: "#22c55e", variant: "success" as const },
  archived: { icon: Clock, color: "#94a3b8", variant: "secondary" as const },
  failed: { icon: XCircle, color: "#ef4444", variant: "danger" as const },
  processing: { icon: Loader2, color: "#1e5f8a", variant: "sky" as const },
};

export default function HistoryPage() {
  const scenes = getScenes();
  // Real runs from the backend (outputs/runs); empty when the backend is offline.
  const [runs, setRuns] = useState<RunSummary[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchRuns()
      .then((r) => {
        if (!cancelled) setRuns(r);
      })
      .catch(() => {
        if (!cancelled) setRuns(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const isLive = runs !== null && runs.length > 0;
  const history = useMemo(() => (isLive ? runs!.map(runToEntry) : []), [isLive, runs]);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sceneFilter, setSceneFilter] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return history.filter((h) => {
      if (status !== "all" && h.status !== status) return false;
      if (sceneFilter && h.sceneId !== sceneFilter) return false;
      if (!q) return true;
      return (
        h.name.toLowerCase().includes(q) ||
        h.region.toLowerCase().includes(q) ||
        h.state.toLowerCase().includes(q) ||
        h.analyst.toLowerCase().includes(q) ||
        h.id.toLowerCase().includes(q) ||
        h.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [history, query, status, sceneFilter]);

  const stats = useMemo(
    () => ({
      total: history.length,
      completed: history.filter((h) => h.status === "completed").length,
      failed: history.filter((h) => h.status === "failed").length,
      avgDuration: Math.round(
        history.filter((h) => h.status !== "failed").reduce((s, h) => s + h.durationSec, 0) /
          Math.max(1, history.filter((h) => h.status !== "failed").length),
      ),
    }),
    [history],
  );

  const activeFilters = (sceneFilter ? 1 : 0) + (status !== "all" ? 1 : 0) + (query ? 1 : 0);

  return (
    <AppShell
      title="Analysis History"
      subtitle={
        isLive
          ? `${history.length} real pipeline run${history.length === 1 ? "" : "s"} (outputs/runs) — labels per run`
          : "no runs available — backend offline or nothing analysed yet"
      }
      actions={
        <Button asChild size="sm" className="bg-gradient-eco font-semibold text-[#ffffff]">
          <Link href="/upload">
            New analysis
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      }
    >
      <div className="mx-auto max-w-[1400px] space-y-5">
        {/* ------------------------------------------------------ stats */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Total runs", stats.total, "#1e5f8a", Clock],
            ["Completed", stats.completed, "#22c55e", CheckCircle2],
            ["Failed", stats.failed, "#ef4444", XCircle],
            ["Avg. duration", fmtDuration(stats.avgDuration), "#6d5bd0", SlidersHorizontal],
          ].map(([label, value, color, Icon], i) => {
            const I = Icon as typeof Clock;
            return (
              <motion.div
                key={label as string}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.06, ease: EASE }}
                className="rounded-2xl border border-foreground/[0.08] bg-card/80 p-4 backdrop-blur"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {label as string}
                  </span>
                  <I className="h-3.5 w-3.5" style={{ color: color as string }} />
                </div>
                <div
                  className="mt-2 text-[24px] font-bold leading-none tabular"
                  style={{ color: color as string }}
                >
                  {value as string}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* ---------------------------------------------------- filters */}
        <Card>
          <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, region, analyst, run ID or tag…"
                className="h-10 w-full rounded-xl border border-foreground/10 bg-foreground/[0.04] pl-10 pr-9 text-[13px] outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-[#15803d]/40"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <Tabs
              layoutId="history-status"
              size="sm"
              value={status}
              onValueChange={(v) => setStatus(v as StatusFilter)}
              items={[
                { value: "all", label: "All" },
                { value: "completed", label: "Completed" },
                { value: "archived", label: "Archived" },
                { value: "failed", label: "Failed" },
              ]}
            />
          </CardContent>

          <div className="scroll-slim flex gap-2 overflow-x-auto border-t border-foreground/[0.08] px-4 py-3">
            <span className="flex shrink-0 items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              <Filter className="h-3 w-3" />
              Landscape
            </span>
            <button
              onClick={() => setSceneFilter(null)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-[11px] transition-colors",
                !sceneFilter
                  ? "border-[#15803d]/35 bg-[#15803d]/12 text-[#15803d]"
                  : "border-foreground/10 bg-foreground/[0.04] text-muted-foreground hover:bg-foreground/[0.08]",
              )}
            >
              All
            </button>
            {scenes.map((s) => (
              <button
                key={s.id}
                onClick={() => setSceneFilter(sceneFilter === s.id ? null : s.id)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-[11px] transition-colors",
                  sceneFilter === s.id
                    ? "border-[#15803d]/35 bg-[#15803d]/12 text-[#15803d]"
                    : "border-foreground/10 bg-foreground/[0.04] text-muted-foreground hover:bg-foreground/[0.08]",
                )}
              >
                {s.shortName}
              </button>
            ))}
          </div>
        </Card>

        {/* ------------------------------------------------------- list */}
        <div className="flex items-center justify-between">
          <div className="text-[12px] text-muted-foreground">
            {filtered.length} result{filtered.length === 1 ? "" : "s"}
            {activeFilters > 0 && ` · ${activeFilters} filter${activeFilters === 1 ? "" : "s"} active`}
          </div>
          {activeFilters > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery("");
                setStatus("all");
                setSceneFilter(null);
              }}
            >
              Clear filters
            </Button>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((h, i) => {
              const meta = STATUS_META[h.status];
              const Icon = meta.icon;
              const failed = h.status === "failed";

              return (
                <motion.div
                  key={h.id}
                  layout
                  initial={{ opacity: 0, y: 14, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.25), ease: EASE }}
                >
                  <div className="group h-full rounded-2xl border border-foreground/[0.08] bg-card/80 p-4 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-foreground/15">
                    <div className="flex items-start gap-3">
                      <div
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                        style={{ background: `${meta.color}1f`, color: meta.color }}
                      >
                        <Icon className="h-[18px] w-[18px]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-semibold">{h.name}</div>
                        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {h.region}
                        </div>
                      </div>
                      <Badge variant={meta.variant} className="shrink-0">
                        {h.status}
                      </Badge>
                    </div>

                    {failed ? (
                      <div className="mt-3.5 flex items-start gap-2 rounded-xl border border-[#ef4444]/20 bg-[#ef4444]/8 px-3 py-2.5">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ef4444]" />
                        <span className="text-[11px] leading-snug text-muted-foreground">
                          Run aborted — scene cloud cover exceeded the 40% processing threshold.
                        </span>
                      </div>
                    ) : (
                      <div className="mt-3.5 grid grid-cols-3 gap-2">
                        <div className="rounded-lg border border-foreground/[0.08] bg-foreground/[0.03] px-2.5 py-2">
                          <div className="flex items-center gap-1 text-[15px] font-bold leading-none tabular">
                            {h.connectivityScore.toFixed(1)}
                            {h.scoreDelta !== 0 &&
                              (h.scoreDelta > 0 ? (
                                <TrendingUp className="h-3 w-3 text-[#22c55e]" />
                              ) : (
                                <TrendingDown className="h-3 w-3 text-[#ef4444]" />
                              ))}
                          </div>
                          <div className="mt-1 text-[9px] uppercase tracking-wider text-muted-foreground">
                            Score
                          </div>
                        </div>
                        <div className="rounded-lg border border-foreground/[0.08] bg-foreground/[0.03] px-2.5 py-2">
                          <div className="text-[15px] font-bold leading-none tabular">
                            {(h.habitatAreaHa / 1000).toFixed(1)}k
                          </div>
                          <div className="mt-1 text-[9px] uppercase tracking-wider text-muted-foreground">
                            Hectares
                          </div>
                        </div>
                        <div className="rounded-lg border border-foreground/[0.08] bg-foreground/[0.03] px-2.5 py-2">
                          <div className="text-[15px] font-bold leading-none tabular text-[#ef4444]">
                            {h.criticalPatches}
                          </div>
                          <div className="mt-1 text-[9px] uppercase tracking-wider text-muted-foreground">
                            Critical
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {h.tags.slice(0, 3).map((t) => (
                        <Badge key={t} variant="secondary">
                          {t}
                        </Badge>
                      ))}
                    </div>

                    <div className="mt-3.5 flex items-center justify-between border-t border-foreground/[0.08] pt-3 text-[10.5px] text-muted-foreground">
                      <span className="truncate">
                        {h.analyst} · {relativeTime(h.runAt)}
                      </span>
                      <span className="shrink-0 tabular">{h.durationSec > 0 ? fmtDuration(h.durationSec) : "—"}</span>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <Button asChild variant="outline" size="sm" className="flex-1">
                        <Link href="/analysis">
                          Open
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </Button>
                      {h.reportId && (
                        <Button asChild variant="ghost" size="sm" className="flex-1">
                          <Link href={`/reports?id=${h.reportId}`}>
                            <FileText className="h-3 w-3" />
                            Report
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {filtered.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-foreground/[0.08] bg-card/70 py-16 text-center"
          >
            <Search className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <h3 className="mt-4 text-[14px] font-semibold">No matching runs</h3>
            <p className="mx-auto mt-2 max-w-sm text-[12px] text-muted-foreground">
              Nothing matches the current search and filters. Try a different landscape or clear
              the filters.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                setQuery("");
                setStatus("all");
                setSceneFilter(null);
              }}
            >
              Clear filters
            </Button>
          </motion.div>
        )}
      </div>
    </AppShell>
  );
}
