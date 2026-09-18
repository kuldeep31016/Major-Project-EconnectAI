"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Bell, ClipboardCheck, FolderKanban, Layers, RefreshCw, TrendingDown } from "lucide-react";
import { AppShell } from "@/components/dashboard/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAnalysis } from "@/hooks/use-analysis";
import { useAuth } from "@/hooks/use-auth";
import {
  fetchAlerts, fetchDetections, fetchProjects, fetchStudyAreas, fetchTasks, generateAlerts,
  type AlertItem, type DetectionItem, type FieldTaskItem, type ProjectItem, type StudyAreaInfo,
} from "@/lib/api";
import { getHabitatMask, getGraph, getHeatmap, getScene } from "@/lib/data";
import { cn } from "@/lib/utils";

const GisMap = dynamic(() => import("@/components/maps/gis-map"), { ssr: false });

const SEV: Record<string, string> = { critical: "#b91c1c", high: "#c2410c", medium: "#b45309", low: "#15803d" };

/**
 * Command Center — the first screen answers "what needs my attention?" across monitored landscapes,
 * with the map as the workspace. Every number is a real run value or a workflow record; nothing decorative.
 */
export default function CommandCenter() {
  const { user, ready } = useAuth();
  const { sceneId, setSceneId, scene, dataSource, apiOnline, selectedPatchId, setSelectedPatchId } = useAnalysis();
  const [areas, setAreas] = useState<StudyAreaInfo[] | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [tasks, setTasks] = useState<FieldTaskItem[]>([]);
  const [detections, setDetections] = useState<DetectionItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [a, al, pr, de] = await Promise.all([
      fetchStudyAreas().catch(() => null), fetchAlerts().catch(() => []), fetchProjects().catch(() => []), fetchDetections().catch(() => []),
    ]);
    setAreas(a); setAlerts(al); setProjects(pr); setDetections(de);
    if (user) setTasks(await fetchTasks(undefined, user.role === "field_officer").catch(() => []));
  };
  useEffect(() => {
    if (ready) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user?.id]);

  const mask = getHabitatMask(sceneId);
  const graph = getGraph(sceneId);
  const heatmap = getHeatmap(sceneId);
  const live = dataSource.mode === "live";
  const areaAlerts = alerts.filter((a) => a.study_area_id === sceneId && a.status !== "RESOLVED" && a.status !== "DISMISSED");
  const openAlerts = alerts.filter((a) => a.status === "OPEN" || a.status === "ACKNOWLEDGED" || a.status === "ASSIGNED");
  const critical = useMemo(() => [...mask.patches].filter((p) => p.criticalityRank != null).sort((a, b) => (a.criticalityRank ?? 99) - (b.criticalityRank ?? 99)).slice(0, 5), [mask]);
  const pendingVerification = detections.filter((d) => ["AI_DETECTED", "UNDER_REVIEW", "FIELD_ASSIGNED"].includes(d.status));
  const change = alerts.find((a) => a.study_area_id === sceneId && (a.type === "habitat_change" || a.type === "connectivity_degradation"));
  const restoration = alerts.filter((a) => a.study_area_id === sceneId && a.type === "restoration_opportunity");

  const regenerate = async () => {
    setBusy(true);
    try {
      await generateAlerts(sceneId);
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell
      title="Coastal Ecosystem Command Center"
      subtitle={user ? `${user.roleLabel} · what needs your attention` : "Sign in for role-specific tasks"}
      bleed
      actions={
        user && user.capabilities.includes("manage_alerts") ? (
          <Button size="sm" variant="outline" onClick={regenerate} disabled={busy || !live}>
            <RefreshCw className={cn("h-3.5 w-3.5", busy && "animate-spin")} /> Re-evaluate alerts
          </Button>
        ) : null
      }
    >
      <div className="grid h-[calc(100vh-4rem)] grid-cols-1 lg:grid-cols-[360px_1fr_340px]">
        {/* ------------------------------------------------ left: landscapes + attention list */}
        <div className="scroll-slim overflow-y-auto border-r border-foreground/[0.08] p-3">
          <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Monitored landscapes</div>
          <div className="space-y-1.5">
            {(areas ?? []).map((a) => {
              const n = alerts.filter((x) => x.study_area_id === a.id && x.status === "OPEN").length;
              const r = a.latestRun;
              return (
                <button key={a.id} onClick={() => setSceneId(a.id)} className={cn("w-full rounded-xl border px-3 py-2 text-left transition", sceneId === a.id ? "border-[#0f5132]/40 bg-[#0f5132]/[0.06]" : "border-foreground/[0.08] hover:bg-foreground/[0.03]")}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-[12.5px] font-semibold">{a.short_name}</div>
                    {n > 0 && <Badge variant="danger">{n} open</Badge>}
                  </div>
                  <div className="mt-0.5 text-[10.5px] text-muted-foreground">
                    {r ? (r.resultKind === "synthetic" ? "demonstration data only" : `${r.resultKind === "development" ? "dev model" : "experimental"} · ${r.nPatches} patches · ECA ${r.ecaPctOfHabitat?.toFixed(0)} %`) : "no analysis yet"}
                  </div>
                </button>
              );
            })}
            {areas === null && <div className="rounded-xl border border-dashed border-foreground/15 p-3 text-[11.5px] text-muted-foreground">Backend offline — landscapes and alerts unavailable.</div>}
          </div>

          <div className="mb-2 mt-5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Needs attention — {scene.shortName}</div>
          {!live && <div className="rounded-xl border border-[#b45309]/30 bg-[#fffbeb] p-3 text-[11.5px] text-[#78350f]">No real analysis for this landscape yet. Values shown on the map are prototype demonstration data.</div>}
          {live && areaAlerts.length === 0 && <div className="rounded-xl border border-foreground/[0.08] p-3 text-[11.5px] text-muted-foreground">No open alerts. {user?.capabilities.includes("manage_alerts") ? "Re-evaluate alerts to check the latest run." : ""}</div>}
          <div className="space-y-1.5">
            {areaAlerts.slice(0, 12).map((a) => (
              <Link key={a.id} href={`/alerts?id=${a.id}`} className="block rounded-xl border border-foreground/[0.08] px-3 py-2 hover:bg-foreground/[0.03]" onMouseEnter={() => a.object_type === "patch" && a.object_id && setSelectedPatchId(a.object_id)}>
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SEV[a.severity] }} />
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-medium">{a.title}</div>
                    <div className="line-clamp-2 text-[10.5px] text-muted-foreground">{a.reason}</div>
                    <div className="mt-1 text-[9.5px] uppercase tracking-wider text-muted-foreground">{a.type.replace(/_/g, " ")} · {a.severity} · {a.status}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ------------------------------------------------ centre: map workspace */}
        <div className="relative min-h-[420px]">
          <GisMap
            scene={scene}
            mask={mask}
            graph={graph}
            heatmap={heatmap}
            layers={{ satellite: true, probability: false, habitat: true, heatmap: true, connectivity: true, protectedAreas: false, labels: false }}
            basemap="satellite"
            heatOpacity={0.55}
            selectedPatchId={selectedPatchId}
            onSelectPatch={setSelectedPatchId}
            className="h-full w-full"
          />
          <div className="pointer-events-none absolute left-3 top-3 z-[900] rounded-lg bg-white/90 px-3 py-1.5 text-[11px] text-[#0b1120] shadow">
            {live ? `${dataSource.provenance?.resultKind === "development" ? "REAL DATA · development model · not final" : dataSource.label}` : apiOnline === false ? "DEMONSTRATION DATA · backend offline" : "DEMONSTRATION DATA"}
          </div>
          <Link href="/analysis" className="absolute bottom-3 right-3 z-[900] inline-flex items-center gap-1.5 rounded-lg bg-[#0f5132] px-3 py-2 text-[12px] font-semibold text-white shadow hover:bg-[#0b3d26]">
            <Layers className="h-3.5 w-3.5" /> Open landscape workspace <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* ------------------------------------------------ right: decision queue */}
        <div className="scroll-slim overflow-y-auto border-l border-foreground/[0.08] p-3 space-y-3">
          <Card>
            <CardHeader className="pb-1"><CardTitle className="flex items-center gap-2 text-[13px]"><AlertTriangle className="h-4 w-4 text-[#c2410c]" />Highest-criticality patches</CardTitle><CardDescription>{live ? `exact leave-one-out on the latest run (τ = ${dataSource.provenance?.parameters.tauKm} km)` : "demonstration data"}</CardDescription></CardHeader>
            <CardContent className="space-y-1">
              {critical.map((p) => (
                <button key={p.id} onClick={() => setSelectedPatchId(p.id)} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[12px] hover:bg-foreground/[0.04]">
                  <span>#{p.criticalityRank} {p.id}{p.isCutVertex ? <span className="ml-1 text-[#b91c1c]">· bridge</span> : null}</span>
                  <span className="tabular text-muted-foreground">−{p.deltaPct?.toFixed(1)} %</span>
                </button>
              ))}
              {!critical.length && <div className="text-[11.5px] text-muted-foreground">No criticality ranking available.</div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1"><CardTitle className="flex items-center gap-2 text-[13px]"><TrendingDown className="h-4 w-4 text-[#b45309]" />Detected habitat change</CardTitle></CardHeader>
            <CardContent className="text-[12px] leading-relaxed">
              {change ? <>{change.title}. <span className="text-muted-foreground">{change.reason}</span> <Link href="/simulation" className="text-[#0f5132] underline">Compare periods →</Link></> : <span className="text-muted-foreground">No change detected between consecutive runs (or only one observation date).</span>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1"><CardTitle className="flex items-center gap-2 text-[13px]"><Bell className="h-4 w-4 text-[#15803d]" />Restoration opportunities</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-[12px]">
              {restoration.slice(0, 3).map((a) => <div key={a.id} className="rounded-lg bg-foreground/[0.03] px-2 py-1.5">{a.title}<div className="text-[10.5px] text-muted-foreground">ranked by connectivity gain; cost data unavailable</div></div>)}
              {!restoration.length && <div className="text-muted-foreground">None flagged.</div>}
              <Link href="/simulation" className="inline-flex items-center gap-1 text-[11.5px] text-[#0f5132] underline">Open restoration planner <ArrowRight className="h-3 w-3" /></Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1"><CardTitle className="flex items-center gap-2 text-[13px]"><ClipboardCheck className="h-4 w-4 text-[#1e5f8a]" />Field verification</CardTitle></CardHeader>
            <CardContent className="text-[12px] space-y-1">
              <div>{pendingVerification.length} detection{pendingVerification.length === 1 ? "" : "s"} awaiting verification</div>
              <div>{tasks.filter((t) => t.status === "PENDING" || t.status === "IN_PROGRESS").length} task{tasks.length === 1 ? "" : "s"} {user?.role === "field_officer" ? "assigned to you" : "in progress"} · {tasks.filter((t) => t.status === "SUBMITTED").length} awaiting review</div>
              <Link href="/field" className="inline-flex items-center gap-1 text-[11.5px] text-[#0f5132] underline">Open field work <ArrowRight className="h-3 w-3" /></Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1"><CardTitle className="flex items-center gap-2 text-[13px]"><FolderKanban className="h-4 w-4 text-[#0f5132]" />Conservation projects</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-[12px]">
              {projects.filter((p) => p.status !== "ARCHIVED").slice(0, 4).map((p) => <Link key={p.id} href={`/projects?id=${p.id}`} className="block rounded-lg px-2 py-1.5 hover:bg-foreground/[0.04]"><div className="font-medium">{p.name}</div><div className="text-[10.5px] text-muted-foreground">{p.status} · {p.verifiedTasks ?? 0}/{p.taskCount ?? 0} tasks verified</div></Link>)}
              {!projects.length && <div className="text-muted-foreground">No projects yet.</div>}
              <div className="text-[10.5px] text-muted-foreground">{openAlerts.length} open alert{openAlerts.length === 1 ? "" : "s"} across all landscapes</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
