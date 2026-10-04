"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BarChart3, Bell, CheckCircle2, ClipboardList, EyeOff, MapPin, RefreshCw, RotateCcw, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/dashboard/app-shell";
import { Button } from "@/components/ui/button";
import { AlertChartCard, chartsFor } from "@/components/alerts/alert-chart";
import { EvidencePanel, buildEvidence } from "@/components/alerts/alert-evidence";
import { SEVERITY, SEVERITY_ORDER, sev, status as statusMeta, timeAgo, typeMeta } from "@/components/alerts/alert-meta";
import { useAnalysis } from "@/hooks/use-analysis";
import { useAuth } from "@/hooks/use-auth";
import { fetchAlerts, generateAlerts, updateAlert, type AlertItem } from "@/lib/api";
import { cn } from "@/lib/utils";

const FILTERS = ["all", "OPEN", "ACKNOWLEDGED", "ASSIGNED", "RESOLVED", "DISMISSED"];
const RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function StatusChip({ s, className }: { s: string; className?: string }) {
  const m = statusMeta(s);
  return <span className={cn("inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1", m.cls, className)}>{m.label}</span>;
}

function AlertDetail({ a, canManage, canAssign, onUpdate }: { a: AlertItem; canManage: boolean; canAssign: boolean; onUpdate: (s: string, why: string) => Promise<void> }) {
  const reduce = useReducedMotion();
  const [showChart, setShowChart] = useState(false);
  const [busy, setBusy] = useState(false);
  const s = sev(a.severity);
  const meta = typeMeta(a.type);
  const view = buildEvidence(a);
  const charts = chartsFor(a);
  const act = (st: string, why: string) => async () => { setBusy(true); try { await onUpdate(st, why); } finally { setBusy(false); } };
  const mapHref = a.object_type === "patch" && a.object_id
    ? `/analysis?scene=${a.study_area_id}&patch=${a.object_id}`
    : a.lat != null && a.lon != null ? `/analysis?scene=${a.study_area_id}&lat=${a.lat}&lon=${a.lon}` : null;

  return (
    <motion.div key={a.id} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)]">
      {/* header */}
      <div className="relative border-b border-black/[0.05] px-5 pb-4 pt-5" style={{ background: `linear-gradient(180deg, ${s.soft} 0%, #ffffff 100%)` }}>
        <span className="absolute inset-x-0 top-0 h-1" style={{ background: s.solid }} />
        <div className="flex flex-wrap items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl text-white" style={{ background: s.solid }}><meta.icon className="h-4 w-4" /></span>
          <span className="text-[12px] font-semibold text-[#334155]">{meta.label}</span>
          <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider ring-1" style={{ color: s.solid, background: "#fff", boxShadow: `inset 0 0 0 1px ${s.ring}` }}>{s.label}</span>
          <StatusChip s={a.status} className="ml-auto" />
        </div>
        <h2 className="mt-3 text-[20px] font-bold leading-snug tracking-tight text-[#0f172a]">{a.title}</h2>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#475569]">{meta.meaning}</p>
        {(a.lat != null || mapHref) && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
            {a.lat != null && a.lon != null && <span className="tabular inline-flex items-center gap-1 text-[#64748b]"><MapPin className="h-3.5 w-3.5" />{a.lat.toFixed(4)}° N, {a.lon.toFixed(4)}° E</span>}
            {mapHref && <Link href={mapHref} className="font-semibold text-[#15803d] hover:underline">{a.object_type === "patch" ? "Open patch on map →" : "Open on map →"}</Link>}
            <span className="text-[#94a3b8]">· raised {timeAgo(a.created_at)}</span>
          </div>
        )}
      </div>

      <div className="space-y-5 px-5 py-5">
        {/* evidence */}
        <section>
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-[14px] font-bold tracking-tight text-[#0f172a]">Evidence</h3>
              <p className="text-[11.5px] text-[#94a3b8]">The stored numbers that triggered this rule.</p>
            </div>
            {charts.length > 0 && (
              <button onClick={() => setShowChart((v) => !v)} aria-expanded={showChart}
                className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors",
                  showChart ? "bg-[#0f5132] text-white shadow-sm" : "bg-[#0f5132]/[0.07] text-[#0f5132] ring-1 ring-[#0f5132]/15 hover:bg-[#0f5132]/[0.12]")}>
                <BarChart3 className="h-3.5 w-3.5" />{showChart ? "Hide analysis" : "Data analysis"}
              </button>
            )}
          </div>
          <AnimatePresence initial={false}>
            {showChart && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }} className="overflow-hidden">
                <div className={cn("mb-3 grid gap-2.5", charts.length > 1 && "xl:grid-cols-2")}>
                  {charts.map((c) => <AlertChartCard key={c.title} chart={c} />)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <EvidencePanel view={view} raw={a.evidence} />
        </section>

        {/* why */}
        <section className="rounded-xl bg-[#f8fafc] px-4 py-3">
          <div className="text-[11.5px] font-semibold text-[#475569]">Why it fired</div>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-[#334155]">{a.reason}</p>
        </section>

        {/* actions */}
        {(canManage || (canAssign && a.lat != null)) && (
          <section className="flex flex-wrap items-center gap-2">
            {canManage && a.status === "OPEN" && <Button size="sm" disabled={busy} onClick={act("ACKNOWLEDGED", "reviewed")}><CheckCircle2 className="h-3.5 w-3.5" /> Acknowledge</Button>}
            {canManage && (a.status === "ACKNOWLEDGED" || a.status === "ASSIGNED") && <Button size="sm" disabled={busy} onClick={act("RESOLVED", "resolved by officer")}><CheckCircle2 className="h-3.5 w-3.5" /> Resolve</Button>}
            {canManage && a.status !== "DISMISSED" && a.status !== "RESOLVED" && <Button size="sm" variant="outline" disabled={busy} onClick={act("DISMISSED", "dismissed by officer")}><EyeOff className="h-3.5 w-3.5" /> Dismiss</Button>}
            {canManage && (a.status === "DISMISSED" || a.status === "RESOLVED") && <Button size="sm" variant="outline" disabled={busy} onClick={act("OPEN", "reopened")}><RotateCcw className="h-3.5 w-3.5" /> Reopen</Button>}
            {canManage && canAssign && a.lat != null && (
              <Link href={`/field?alert=${a.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-black/[0.1] px-3 py-1.5 text-[12px] font-medium hover:bg-black/[0.03]"><ClipboardList className="h-3.5 w-3.5" /> Create field task</Link>
            )}
          </section>
        )}
        <p className="flex items-start gap-1.5 text-[11px] leading-snug text-[#94a3b8]">
          <ShieldAlert className="mt-px h-3.5 w-3.5 shrink-0" />
          Rule-based alert from a development model, scored against weak labels. Not field-validated: confirm on the ground before acting.
        </p>
      </div>
    </motion.div>
  );
}

function AlertsView() {
  const { user, can } = useAuth();
  const { sceneId, setSelectedPatchId } = useAnalysis();
  const params = useSearchParams();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [activeId, setActiveId] = useState<number | null>(Number(params.get("id")) || null);
  const load = () => fetchAlerts(sceneId).catch(() => [] as AlertItem[]).then((a) => { setAlerts(a); window.dispatchEvent(new Event("eco:alerts-changed")); });
  useEffect(() => {
    let cancelled = false;
    fetchAlerts(sceneId).catch(() => [] as AlertItem[]).then((a) => { if (!cancelled) setAlerts(a); });
    return () => { cancelled = true; };
  }, [sceneId]);
  // the detail panel always reflects the freshly loaded record
  const active = alerts.find((a) => a.id === activeId) ?? null;
  // most urgent first; within a severity, newest first
  const shown = alerts
    .filter((a) => filter === "all" || a.status === filter)
    .sort((x, y) => (RANK[x.severity] ?? 9) - (RANK[y.severity] ?? 9) || String(y.created_at).localeCompare(String(x.created_at)));
  const counts = Object.fromEntries(FILTERS.slice(1).map((k) => [k, alerts.filter((a) => a.status === k).length]));
  const live = alerts.filter((a) => a.status !== "RESOLVED" && a.status !== "DISMISSED");
  const bySev = Object.fromEntries(SEVERITY_ORDER.map((k) => [k, live.filter((a) => a.severity === k).length]));

  return (
    <AppShell title="Alerts" subtitle="Rule-based checks on the latest analysis, each with the numbers that triggered it"
      actions={can("manage_alerts") ? <Button size="sm" variant="outline" onClick={async () => { await generateAlerts(sceneId).catch(() => null); await load(); }}><RefreshCw className="h-3.5 w-3.5" /> Re-evaluate</Button> : null}>
      <div className="space-y-4 p-4 sm:p-6">
        {/* summary */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          <div className="col-span-2 flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-white px-4 py-3 sm:col-span-1">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#0f5132] text-white"><Bell className="h-4 w-4" /></span>
            <div><div className="tabular text-[22px] font-bold leading-none tracking-tight text-[#0f172a]">{live.length}</div><div className="mt-1 text-[11px] font-medium text-[#64748b]">active alerts</div></div>
          </div>
          {SEVERITY_ORDER.map((k) => (
            <div key={k} className="rounded-2xl border border-black/[0.06] bg-white px-4 py-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: SEVERITY[k].solid }}><span className="h-2 w-2 rounded-full" style={{ background: SEVERITY[k].solid }} />{SEVERITY[k].label}</div>
              <div className="tabular mt-1 text-[22px] font-bold leading-none tracking-tight text-[#0f172a]">{bySev[k]}</div>
            </div>
          ))}
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-[300px_1fr] xl:grid-cols-[340px_1fr] 2xl:grid-cols-[400px_1fr]">
          {/* list */}
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
                    filter === f ? "bg-[#0f5132] text-white shadow-sm" : "bg-white text-[#475569] ring-1 ring-black/[0.08] hover:bg-black/[0.03]")}>
                  {f === "all" ? "All" : statusMeta(f).label}
                  {(f === "all" ? alerts.length : counts[f]) > 0 && <span className={cn("tabular text-[10.5px]", filter === f ? "text-white/70" : "text-[#94a3b8]")}>{f === "all" ? alerts.length : counts[f]}</span>}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {shown.map((a) => {
                const s = sev(a.severity), m = typeMeta(a.type), on = active?.id === a.id;
                return (
                  <button key={a.id} onClick={() => { setActiveId(a.id); if (a.object_type === "patch" && a.object_id) setSelectedPatchId(a.object_id); }}
                    className={cn("group relative w-full overflow-hidden rounded-xl border bg-white py-2.5 pl-4 pr-3 text-left transition-all",
                      on ? "border-[#0f5132]/30 shadow-[0_0_0_3px_rgba(15,81,50,0.08)]" : "border-black/[0.06] hover:border-black/[0.12] hover:shadow-sm")}>
                    <span className="absolute inset-y-0 left-0 w-1" style={{ background: s.solid }} />
                    <div className="flex items-start justify-between gap-2">
                      <div className="line-clamp-2 text-[13px] font-semibold leading-snug text-[#0f172a]">{a.title}</div>
                      <StatusChip s={a.status} />
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#64748b]">
                      <m.icon className="h-3 w-3" style={{ color: s.solid }} />
                      <span>{m.label}</span><span className="text-[#cbd5e1]">·</span><span>{timeAgo(a.created_at)}</span>
                    </div>
                  </button>
                );
              })}
              {!shown.length && <div className="rounded-xl border border-dashed border-black/[0.12] bg-white p-5 text-center text-[12.5px] text-[#64748b]">No alerts here{user ? "" : " (sign in and re-evaluate)"}.</div>}
            </div>
          </div>

          {/* detail */}
          <div className="min-w-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:rounded-2xl" data-alert-detail>
            {active ? (
              <AlertDetail key={active.id} a={active} canManage={can("manage_alerts")} canAssign={can("assign_tasks")}
                onUpdate={async (st, why) => { await updateAlert(active.id, st, why); await load(); }} />
            ) : (
              <div className="grid place-items-center rounded-2xl border border-dashed border-black/[0.1] bg-white px-6 py-16 text-center">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#0f5132]/[0.07] text-[#0f5132]"><Bell className="h-5 w-5" /></span>
                <div className="mt-3 text-[15px] font-bold tracking-tight text-[#0f172a]">Pick an alert</div>
                <p className="mt-1 max-w-xs text-[12.5px] text-[#64748b]">See what it means, the numbers behind it and a quick chart.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function AlertsPage() {
  return <Suspense><AlertsView /></Suspense>;
}
