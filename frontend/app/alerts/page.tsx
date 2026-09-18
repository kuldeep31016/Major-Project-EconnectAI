"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Bell, CheckCircle2, EyeOff, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/dashboard/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAnalysis } from "@/hooks/use-analysis";
import { useAuth } from "@/hooks/use-auth";
import { fetchAlerts, generateAlerts, updateAlert, type AlertItem } from "@/lib/api";
import { cn } from "@/lib/utils";

const SEV: Record<string, string> = { critical: "#b91c1c", high: "#c2410c", medium: "#b45309", low: "#15803d" };

function AlertsView() {
  const { user, can } = useAuth();
  const { sceneId, setSelectedPatchId } = useAnalysis();
  const params = useSearchParams();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [active, setActive] = useState<AlertItem | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const load = async () => {
    const a = await fetchAlerts(sceneId).catch(() => []);
    setAlerts(a);
    const wanted = Number(params.get("id"));
    if (wanted) setActive(a.find((x) => x.id === wanted) ?? null);
  };
  useEffect(() => { void load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneId]);
  const shown = alerts.filter((a) => filter === "all" || a.status === filter);

  return (
    <AppShell title="Alerts" subtitle="Rule-based, each with its triggering numbers — thresholds are operational settings, not ecological facts"
      actions={can("manage_alerts") ? <Button size="sm" variant="outline" onClick={async () => { await generateAlerts(sceneId).catch(() => null); await load(); }}><RefreshCw className="h-3.5 w-3.5" /> Re-evaluate</Button> : null}>
      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[420px_1fr]">
        <div>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {["all", "OPEN", "ACKNOWLEDGED", "ASSIGNED", "RESOLVED", "DISMISSED"].map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={cn("rounded-full border px-2.5 py-1 text-[11px]", filter === f ? "border-[#0f5132] bg-[#0f5132] text-white" : "border-foreground/15")}>{f.toLowerCase()}</button>
            ))}
          </div>
          <div className="space-y-1.5">
            {shown.map((a) => (
              <button key={a.id} onClick={() => { setActive(a); if (a.object_type === "patch" && a.object_id) setSelectedPatchId(a.object_id); }} className={cn("w-full rounded-xl border px-3 py-2 text-left", active?.id === a.id ? "border-[#0f5132]/40 bg-[#0f5132]/[0.05]" : "border-foreground/[0.08] hover:bg-foreground/[0.03]")}>
                <div className="flex items-start gap-2">
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SEV[a.severity] }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2"><div className="truncate text-[12.5px] font-medium">{a.title}</div><Badge variant="secondary">{a.status}</Badge></div>
                    <div className="text-[10.5px] text-muted-foreground">{a.type.replace(/_/g, " ")} · {a.severity} · {new Date(a.created_at).toLocaleString()}</div>
                  </div>
                </div>
              </button>
            ))}
            {!shown.length && <div className="rounded-xl border border-dashed border-foreground/15 p-4 text-[12px] text-muted-foreground">No alerts{user ? "" : " (sign in and re-evaluate)"}.</div>}
          </div>
        </div>
        <div>
          {active ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2"><Bell className="h-4 w-4" style={{ color: SEV[active.severity] }} />{active.title}</CardTitle>
                <CardDescription>{active.type.replace(/_/g, " ")} · severity {active.severity} · run {active.run_id ?? "—"} · status {active.status}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-[12.5px]">
                <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Reason</div><div className="mt-0.5 leading-relaxed">{active.reason}</div></div>
                {active.lat != null && <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Location</div><div className="tabular">{active.lat.toFixed(5)}, {active.lon?.toFixed(5)}</div></div>}
                <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Evidence (stored values that triggered the rule)</div>
                  <pre className="mt-1 max-h-72 overflow-auto rounded-lg bg-foreground/[0.04] p-2 text-[10.5px]">{JSON.stringify(active.evidence, null, 1)}</pre></div>
                {can("manage_alerts") && (
                  <div className="flex flex-wrap gap-2">
                    {active.status === "OPEN" && <Button size="sm" onClick={async () => { await updateAlert(active.id, "ACKNOWLEDGED", "reviewed"); await load(); }}><CheckCircle2 className="h-3.5 w-3.5" /> Acknowledge</Button>}
                    <Button size="sm" variant="outline" onClick={async () => { await updateAlert(active.id, "DISMISSED", "dismissed by officer"); await load(); }}><EyeOff className="h-3.5 w-3.5" /> Dismiss</Button>
                    <a href="/field" className="inline-flex items-center rounded-lg border border-foreground/15 px-3 py-1.5 text-[12px] hover:bg-foreground/[0.04]">Create field task →</a>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : <Card><CardContent className="p-6 text-[13px] text-muted-foreground">Select an alert to see its reason and the stored evidence that triggered it.</CardContent></Card>}
        </div>
      </div>
    </AppShell>
  );
}

export default function AlertsPage() {
  return <Suspense><AlertsView /></Suspense>;
}
