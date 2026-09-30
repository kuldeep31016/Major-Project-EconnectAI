"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/dashboard/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { fetchSystem, type SystemInfo } from "@/lib/api";
import { cn } from "@/lib/utils";

const fmtUptime = (s: number) => (s < 3600 ? `${Math.round(s / 60)} min` : s < 86400 ? `${(s / 3600).toFixed(1)} h` : `${(s / 86400).toFixed(1)} d`);

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" | "bad" }) {
  return (
    <div className="rounded-xl border border-foreground/[0.08] bg-card px-3 py-2.5">
      <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 text-[17px] font-semibold tabular", tone === "ok" && "text-[#15803d]", tone === "warn" && "text-[#b45309]", tone === "bad" && "text-[#b91c1c]")}>{value}</div>
    </div>
  );
}

/** Admin system view: liveness, schema readiness, background jobs, request metrics (since last restart). */
export default function SystemPage() {
  const { user, ready, can } = useAuth();
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => fetchSystem().then((i) => { setInfo(i); setErr(null); }).catch((e) => setErr(e instanceof Error ? e.message : String(e))), []);
  useEffect(() => {
    if (!ready || !can("view_audit")) return;
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [ready, can, load]);

  return (
    <AppShell title="System health" subtitle="API, database schema, background jobs and request metrics" actions={<Button size="sm" variant="outline" onClick={load}>Refresh</Button>}>
      <div className="space-y-4 p-4 sm:p-6">
        {ready && !user && <div className="text-[13px] text-muted-foreground">Sign in as an administrator or senior officer.</div>}
        {ready && user && !can("view_audit") && <div className="text-[13px] text-muted-foreground">Your role cannot view system health.</div>}
        {err && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-[12.5px] text-[#b91c1c]">{err}</div>}
        {info && (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="API" value={`v${info.version}`} tone="ok" />
              <Stat label="Uptime" value={fmtUptime(info.requests.uptime_s)} />
              <Stat label="Schema" value={info.schema.ok ? "at head" : `${info.schema.current} ≠ ${info.schema.head}`} tone={info.schema.ok ? "ok" : "bad"} />
              <Stat label="Database" value={info.database} />
              <Stat label="Requests / 5xx" value={`${info.requests.total_requests} / ${info.requests.total_5xx}`} tone={info.requests.total_5xx ? "warn" : "ok"} />
              <Stat label="Failed jobs 24 h" value={String(info.jobs.failed_24h.length)} tone={info.jobs.failed_24h.length ? "warn" : "ok"} />
            </div>
            <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-[13px]">Platform</CardTitle></CardHeader>
                <CardContent className="space-y-1.5 text-[12.5px]">
                  {[["Storage", info.storage], ["Background worker", info.inline_worker ? "inline (in API process)" : "external worker"], ["Assistant", info.assistant],
                    ["Access token lifetime", `${info.config.token_minutes} min (refresh tokens rotate)`], ["CORS origins", String(info.config.cors_origins)]].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3 border-t border-foreground/[0.06] pt-1.5"><span className="text-muted-foreground">{k}</span><span className="text-right">{v}</span></div>
                  ))}
                  <div className="pt-2 text-[11px] uppercase tracking-wider text-muted-foreground">Records</div>
                  <div className="flex flex-wrap gap-1.5">{Object.entries(info.counts).map(([k, v]) => <Badge key={k} variant="secondary">{k.replace("_", " ")} {v}</Badge>)}</div>
                  <div className="pt-2 text-[11px] uppercase tracking-wider text-muted-foreground">Jobs by status</div>
                  <div className="flex flex-wrap gap-1.5">{Object.keys(info.jobs.by_status).length ? Object.entries(info.jobs.by_status).map(([k, v]) => <Badge key={k} variant={k === "FAILED" ? "danger" : "secondary"}>{k} {v}</Badge>) : <span className="text-muted-foreground">no jobs yet</span>}</div>
                  {info.jobs.failed_24h.map((j) => <div key={j.id} className="text-[11.5px] text-[#b91c1c]">{j.type} · {j.error}</div>)}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-[13px]">Busiest routes</CardTitle><CardDescription>Since the last restart of this API instance (in-memory counters).</CardDescription></CardHeader>
                <CardContent className="overflow-x-auto p-0">
                  <table className="w-full text-[12px]">
                    <thead className="text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-3 py-2 text-left">Route</th><th className="px-2 text-right">Requests</th><th className="px-2 text-right">5xx</th><th className="px-2 text-right">p50 ms</th><th className="px-3 text-right">p95 ms</th></tr></thead>
                    <tbody className="tabular">{info.requests.routes.slice(0, 15).map((r) => (
                      <tr key={r.route} className="border-t border-foreground/[0.06]"><td className="max-w-[280px] truncate px-3 py-1.5 font-mono text-[11px]">{r.route}</td><td className="px-2 text-right">{r.requests}</td><td className={cn("px-2 text-right", r.errors_5xx && "text-[#b91c1c]")}>{r.errors_5xx}</td><td className="px-2 text-right">{r.p50_ms}</td><td className="px-3 text-right">{r.p95_ms}</td></tr>
                    ))}</tbody>
                  </table>
                  {info.requests.recent_errors.length > 0 && (
                    <div className="border-t border-foreground/[0.06] p-3 text-[11.5px]">
                      <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Recent server errors (quote the request id in bug reports)</div>
                      {info.requests.recent_errors.slice(-8).reverse().map((e) => <div key={e.request_id} className="font-mono text-[#b91c1c]">{e.at} {e.status} {e.route} · {e.request_id}</div>)}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
