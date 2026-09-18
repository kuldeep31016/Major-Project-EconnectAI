"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FolderKanban, Plus } from "lucide-react";
import { AppShell } from "@/components/dashboard/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAnalysis } from "@/hooks/use-analysis";
import { useAuth } from "@/hooks/use-auth";
import { createProject, fetchProjects, fetchTasks, updateProject, type FieldTaskItem, type ProjectItem } from "@/lib/api";
import { getHabitatMask, getRestoration } from "@/lib/data";
import { cn } from "@/lib/utils";

const STATUSES = ["PLANNED", "ACTIVE", "UNDER_REVIEW", "COMPLETED", "ARCHIVED"];

function ProjectsView() {
  const { can } = useAuth();
  const { sceneId, scene, dataSource } = useAnalysis();
  const params = useSearchParams();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [tasks, setTasks] = useState<FieldTaskItem[]>([]);
  const [active, setActive] = useState<ProjectItem | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState(""); const [objectives, setObjectives] = useState("");
  const [patches, setPatches] = useState<string[]>([]); const [cands, setCands] = useState<string[]>([]);
  const mask = getHabitatMask(sceneId); const rest = getRestoration(sceneId);
  const load = async () => {
    const p = await fetchProjects().catch(() => []); setProjects(p);
    const wanted = Number(params.get("id")); if (wanted) setActive(p.find((x) => x.id === wanted) ?? null);
    setTasks(await fetchTasks().catch(() => []));
  };
  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const top = [...mask.patches].filter((p) => p.criticalityRank != null).sort((a, b) => (a.criticalityRank ?? 99) - (b.criticalityRank ?? 99)).slice(0, 8);

  return (
    <AppShell title="Conservation Projects" subtitle="Objectives, priority patches, restoration candidates, field tasks and reports in one record"
      actions={can("manage_projects") ? <Button size="sm" onClick={() => setShowNew((v) => !v)}><Plus className="h-3.5 w-3.5" /> New project</Button> : null}>
      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[380px_1fr]">
        <div className="space-y-2">
          {showNew && (
            <Card><CardHeader className="pb-2"><CardTitle className="text-[13px]">New project — {scene.shortName}</CardTitle><CardDescription>Linked to run {dataSource.provenance?.runId ?? "(no real run)"}</CardDescription></CardHeader>
              <CardContent><form className="space-y-2 text-[12.5px]" onSubmit={async (e) => { e.preventDefault(); await createProject({ name, study_area_id: sceneId, objectives, run_id: dataSource.provenance?.runId, priority_patches: patches, candidates: cands }); setShowNew(false); setName(""); setObjectives(""); setPatches([]); setCands([]); await load(); }}>
                <input placeholder="Project name (e.g. Vembanad Mangrove Conservation 2026)" value={name} onChange={(e) => setName(e.target.value)} required className="w-full rounded-lg border border-foreground/15 bg-background px-2 py-1.5" />
                <textarea placeholder="Objectives" value={objectives} onChange={(e) => setObjectives(e.target.value)} rows={2} className="w-full rounded-lg border border-foreground/15 bg-background px-2 py-1.5" />
                <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Priority patches (by criticality)</div>
                <div className="flex flex-wrap gap-1">{top.map((p) => <button type="button" key={p.id} onClick={() => setPatches((s) => s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id])} className={cn("rounded-full border px-2 py-0.5 text-[11px]", patches.includes(p.id) ? "border-[#0f5132] bg-[#0f5132] text-white" : "border-foreground/15")}>#{p.criticalityRank} {p.id}</button>)}</div>
                <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Restoration candidates (by gain)</div>
                <div className="flex flex-wrap gap-1">{rest.actions.slice(0, 8).map((a) => <button type="button" key={a.id} onClick={() => setCands((s) => s.includes(a.id) ? s.filter((x) => x !== a.id) : [...s, a.id])} className={cn("rounded-full border px-2 py-0.5 text-[11px]", cands.includes(a.id) ? "border-[#1e5f8a] bg-[#1e5f8a] text-white" : "border-foreground/15")}>#{a.rank} {a.id}</button>)}</div>
                <Button size="sm">Create</Button>
              </form></CardContent></Card>
          )}
          {projects.map((p) => (
            <button key={p.id} onClick={() => setActive(p)} className={cn("w-full rounded-xl border p-3 text-left", active?.id === p.id ? "border-[#0f5132]/40 bg-[#0f5132]/[0.05]" : "border-foreground/[0.08] hover:bg-foreground/[0.03]")}>
              <div className="flex items-center justify-between gap-2"><div className="text-[13px] font-semibold">{p.name}</div><Badge variant="secondary">{p.status}</Badge></div>
              <div className="mt-1 text-[11px] text-muted-foreground">{p.study_area_id} · {p.priority_patches.length} priority patches · {p.candidates.length} candidates · {p.verifiedTasks ?? 0}/{p.taskCount ?? 0} tasks verified</div>
            </button>
          ))}
          {!projects.length && <div className="rounded-xl border border-dashed border-foreground/15 p-4 text-[12px] text-muted-foreground">No projects yet.</div>}
        </div>
        <div>
          {active ? (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2"><FolderKanban className="h-4 w-4 text-[#0f5132]" />{active.name}</CardTitle><CardDescription>{active.study_area_id} · run {active.run_id ?? "—"} · created {new Date(active.created_at).toLocaleDateString()}</CardDescription></CardHeader>
              <CardContent className="space-y-3 text-[12.5px]">
                {active.objectives && <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Objectives</div><div>{active.objectives}</div></div>}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Priority patches</div><div>{active.priority_patches.join(", ") || "—"}</div></div>
                  <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Restoration candidates</div><div>{active.candidates.join(", ") || "—"}</div></div>
                </div>
                <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Field tasks</div>
                  {tasks.filter((t) => t.project_id === active.id || (t.study_area_id === active.study_area_id && active.priority_patches.includes(t.object_id ?? ""))).map((t) => <div key={t.id} className="flex justify-between border-t border-foreground/[0.06] py-1"><span>{t.title}</span><Badge variant="secondary">{t.status}</Badge></div>)}
                </div>
                {can("manage_projects") && (
                  <div className="flex flex-wrap gap-1.5">
                    {STATUSES.map((s) => <Button key={s} size="sm" variant={active.status === s ? "default" : "outline"} onClick={async () => { const p = await updateProject(active.id, { status: s, reason: "status change" }); setActive(p); await load(); }}>{s.replace("_", " ")}</Button>)}
                  </div>
                )}
                <a href={`/reports`} className="inline-block text-[12px] text-[#0f5132] underline">Generate report for this landscape →</a>
              </CardContent>
            </Card>
          ) : <Card><CardContent className="p-6 text-[13px] text-muted-foreground">Select a project.</CardContent></Card>}
        </div>
      </div>
    </AppShell>
  );
}

export default function ProjectsPage() {
  return <Suspense><ProjectsView /></Suspense>;
}
