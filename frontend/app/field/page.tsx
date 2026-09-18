"use client";

import { useEffect, useState } from "react";
import { Camera, CheckCircle2, ClipboardCheck, MapPin, Plus, XCircle } from "lucide-react";
import { AppShell } from "@/components/dashboard/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAnalysis } from "@/hooks/use-analysis";
import { useAuth } from "@/hooks/use-auth";
import {
  createTask, evidencePhotoUrl, fetchAlerts, fetchEvidence, fetchTasks, fetchUsers, setTaskStatus, submitEvidence, verifyEvidence,
  type AlertItem, type EvidenceItem, type FieldTaskItem, type SessionUser,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const STATUS_COLOR: Record<string, string> = { PENDING: "secondary", IN_PROGRESS: "sky", SUBMITTED: "warning", VERIFIED: "success", REJECTED: "danger" };

/**
 * Field Work: officers create verification tasks from alerts/patches; field officers see MY TASKS and
 * submit GPS + observation + photo evidence; reviewing officers accept/reject. Mobile-friendly single column.
 */
export default function FieldPage() {
  const { user, ready, can } = useAuth();
  const { sceneId } = useAnalysis();
  const [tasks, setTasks] = useState<FieldTaskItem[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [users, setUsers] = useState<SessionUser[]>([]);
  const [active, setActive] = useState<FieldTaskItem | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const load = async () => {
    if (!user) return;
    setTasks(await fetchTasks(undefined, user.role === "field_officer").catch(() => []));
    if (can("assign_tasks")) {
      setAlerts(await fetchAlerts(sceneId).catch(() => []));
      setUsers(await fetchUsers().catch(() => []));
    }
  };
  useEffect(() => {
    if (ready) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user?.id, sceneId]);
  useEffect(() => {
    if (active) fetchEvidence(active.id).then(setEvidence).catch(() => setEvidence([]));
  }, [active]);

  if (ready && !user) {
    return (
      <AppShell title="Field Work" subtitle="Sign in to see your tasks">
        <div className="p-6 text-[13px]">Please <a className="text-[#0f5132] underline" href="/login">sign in</a>. Field tasks are personal and audited.</div>
      </AppShell>
    );
  }

  const isField = user?.role === "field_officer";

  return (
    <AppShell title={isField ? "My Tasks" : "Field Work"} subtitle={isField ? "Verify what the AI detected — your observation is the evidence" : "Assign, track and verify field tasks"}
      actions={can("assign_tasks") ? <Button size="sm" onClick={() => setShowNew((v) => !v)}><Plus className="h-3.5 w-3.5" /> New task</Button> : null}>
      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[380px_1fr]">
        <div className="space-y-2">
          {showNew && can("assign_tasks") && <NewTask alerts={alerts} users={users} sceneId={sceneId} onCreated={() => { setShowNew(false); void load(); }} />}
          {tasks.length === 0 && <div className="rounded-xl border border-dashed border-foreground/15 p-4 text-[12px] text-muted-foreground">No tasks{isField ? " assigned to you" : ""} yet.</div>}
          {tasks.map((t) => (
            <button key={t.id} onClick={() => setActive(t)} className={cn("w-full rounded-xl border p-3 text-left", active?.id === t.id ? "border-[#0f5132]/40 bg-[#0f5132]/[0.05]" : "border-foreground/[0.08] hover:bg-foreground/[0.03]")}>
              <div className="flex items-start justify-between gap-2">
                <div className="text-[13px] font-semibold">{t.title}</div>
                <Badge variant={STATUS_COLOR[t.status] as "secondary"}>{t.status.replace("_", " ")}</Badge>
              </div>
              <div className="mt-1 line-clamp-2 text-[11.5px] text-muted-foreground">{t.reason}</div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 text-[10.5px] text-muted-foreground">
                <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{t.lat.toFixed(4)}, {t.lon.toFixed(4)}</span>
                <span>{t.assigneeName ? `→ ${t.assigneeName}` : "unassigned"}</span>
                <span>{t.evidenceCount ?? 0} evidence</span>
              </div>
            </button>
          ))}
        </div>

        <div>
          {!active ? (
            <Card><CardContent className="p-6 text-[13px] text-muted-foreground">Select a task to see its reason, required evidence and location, and to submit or review evidence.</CardContent></Card>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-[#0f5132]" />{active.title}</CardTitle>
                  <CardDescription>Status {active.status} · created by {active.createdByName ?? "—"} · {new Date(active.created_at).toLocaleString()}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 text-[12.5px] sm:grid-cols-2">
                  <div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Reason (AI evidence)</div><div className="mt-0.5 leading-relaxed">{active.reason}</div></div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Location</div>
                    <div className="mt-0.5 tabular">{active.lat.toFixed(5)}, {active.lon.toFixed(5)}</div>
                    <a className="text-[11px] text-[#1e5f8a] underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${active.lat}&mlon=${active.lon}#map=16/${active.lat}/${active.lon}`}>open in map</a>
                    <div className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">Evidence required</div>
                    <div className="mt-0.5">{active.evidence_required}</div>
                    {active.object_id && <div className="mt-2 text-[11px] text-muted-foreground">Object: {active.object_type} {active.object_id} · run {active.run_id}</div>}
                  </div>
                </CardContent>
              </Card>

              {can("submit_evidence") && ["PENDING", "IN_PROGRESS", "SUBMITTED"].includes(active.status) && (
                <EvidenceForm task={active} onDone={async (m) => { setMsg(m); setEvidence(await fetchEvidence(active.id)); await load(); }} />
              )}

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-[13px]">Evidence ({evidence.length})</CardTitle><CardDescription>Field observations are the only path from AI DETECTED to VERIFIED.</CardDescription></CardHeader>
                <CardContent className="space-y-2">
                  {evidence.map((e) => (
                    <div key={e.id} className="rounded-xl border border-foreground/[0.08] p-3 text-[12px]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div><b>{e.observation.replace(/_/g, " ")}</b> · {e.observed_at} · {e.lat.toFixed(5)}, {e.lon.toFixed(5)}</div>
                        <Badge variant={e.verification === "ACCEPTED" ? "success" : e.verification === "REJECTED" ? "danger" : "secondary"}>{e.verification}</Badge>
                      </div>
                      {e.notes && <div className="mt-1 text-muted-foreground">{e.notes}</div>}
                      {e.photo_path && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={evidencePhotoUrl(e.photo_path)} alt="field photo" className="mt-2 max-h-56 rounded-lg" />
                      )}
                      {can("verify_evidence") && e.verification === "SUBMITTED" && (
                        <div className="mt-2 flex gap-2">
                          <Button size="sm" onClick={async () => { await verifyEvidence(e.id, "ACCEPTED", "reviewed"); setEvidence(await fetchEvidence(active.id)); await load(); }}><CheckCircle2 className="h-3.5 w-3.5" /> Accept</Button>
                          <Button size="sm" variant="outline" onClick={async () => { await verifyEvidence(e.id, "REJECTED", "reviewed"); setEvidence(await fetchEvidence(active.id)); await load(); }}><XCircle className="h-3.5 w-3.5" /> Reject</Button>
                        </div>
                      )}
                    </div>
                  ))}
                  {!evidence.length && <div className="text-[12px] text-muted-foreground">No evidence submitted yet.</div>}
                  {isField && active.status === "PENDING" && <Button size="sm" variant="outline" onClick={async () => { await setTaskStatus(active.id, "IN_PROGRESS"); await load(); }}>Start task</Button>}
                </CardContent>
              </Card>
              {msg && <div className="text-[12px] text-[#0f5132]">{msg}</div>}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function EvidenceForm({ task, onDone }: { task: FieldTaskItem; onDone: (msg: string) => void }) {
  const [lat, setLat] = useState(String(task.lat));
  const [lon, setLon] = useState(String(task.lon));
  const [observation, setObservation] = useState("habitat_present");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const locate = () => navigator.geolocation?.getCurrentPosition((p) => { setLat(p.coords.latitude.toFixed(6)); setLon(p.coords.longitude.toFixed(6)); });
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-[13px]"><Camera className="h-4 w-4 text-[#1e5f8a]" />Submit field evidence</CardTitle></CardHeader>
      <CardContent>
        <form className="grid gap-3 text-[12.5px] sm:grid-cols-2" onSubmit={async (e) => {
          e.preventDefault(); setBusy(true); setErr(null);
          try {
            const fd = new FormData();
            fd.set("lat", lat); fd.set("lon", lon); fd.set("observed_at", new Date().toISOString()); fd.set("observation", observation); fd.set("notes", notes);
            if (photo) fd.set("photo", photo);
            await submitEvidence(task.id, fd);
            onDone("Evidence submitted — awaiting officer review.");
            setNotes(""); setPhoto(null);
          } catch (x) { setErr(x instanceof Error ? x.message : String(x)); } finally { setBusy(false); }
        }}>
          <label>GPS latitude<input value={lat} onChange={(e) => setLat(e.target.value)} className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-2 py-1.5" /></label>
          <label>GPS longitude<input value={lon} onChange={(e) => setLon(e.target.value)} className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-2 py-1.5" /></label>
          <button type="button" onClick={locate} className="text-left text-[11px] text-[#1e5f8a] underline sm:col-span-2">Use device location</button>
          <label>Observation
            <select value={observation} onChange={(e) => setObservation(e.target.value)} className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-2 py-1.5">
              <option value="habitat_present">Habitat present (as detected)</option><option value="habitat_lost">Habitat lost / cleared</option><option value="degraded">Degraded</option><option value="unchanged">Unchanged since last visit</option><option value="not_habitat">Not habitat (false detection)</option><option value="other">Other (see notes)</option>
            </select>
          </label>
          <label>Photo (JPEG/PNG, ≤ 8 MB)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} className="mt-1 w-full text-[11.5px]" /></label>
          <label className="sm:col-span-2">Notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-foreground/15 bg-background px-2 py-1.5" /></label>
          {err && <div className="text-[#b91c1c] sm:col-span-2">{err}</div>}
          <Button disabled={busy} className="sm:col-span-2">{busy ? "Uploading…" : "Submit evidence"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function NewTask({ alerts, users, sceneId, onCreated }: { alerts: AlertItem[]; users: SessionUser[]; sceneId: string; onCreated: () => void }) {
  const [alertId, setAlertId] = useState<number | "">("");
  const [assignee, setAssignee] = useState<number | "">("");
  const [title, setTitle] = useState("");
  const [reason, setReason] = useState("");
  const [lat, setLat] = useState(""); const [lon, setLon] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const fieldUsers = users.filter((u) => u.role === "field_officer" || u.role === "range_officer");
  const pick = (id: number | "") => {
    setAlertId(id);
    const a = alerts.find((x) => x.id === id);
    if (a) { setTitle(`Verify: ${a.title}`); setReason(a.reason); setLat(String(a.lat ?? "")); setLon(String(a.lon ?? "")); }
  };
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-[13px]">New field task</CardTitle><CardDescription>From an alert (recommended) or free-form. The AI reason travels with the task.</CardDescription></CardHeader>
      <CardContent>
        <form className="space-y-2 text-[12.5px]" onSubmit={async (e) => {
          e.preventDefault(); setErr(null);
          try {
            const a = alerts.find((x) => x.id === alertId);
            await createTask({ study_area_id: sceneId, title, reason, lat: Number(lat), lon: Number(lon), assignee_id: assignee === "" ? undefined : assignee,
              alert_id: a?.id, object_type: a?.object_type ?? undefined, object_id: a?.object_id ?? undefined, run_id: a?.run_id ?? undefined } as never);
            onCreated();
          } catch (x) { setErr(x instanceof Error ? x.message : String(x)); }
        }}>
          <select value={alertId} onChange={(e) => pick(e.target.value === "" ? "" : Number(e.target.value))} className="w-full rounded-lg border border-foreground/15 bg-background px-2 py-1.5">
            <option value="">From alert…</option>
            {alerts.filter((a) => a.lat != null).map((a) => <option key={a.id} value={a.id}>[{a.severity}] {a.title}</option>)}
          </select>
          <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full rounded-lg border border-foreground/15 bg-background px-2 py-1.5" />
          <textarea placeholder="Reason / what to verify" value={reason} onChange={(e) => setReason(e.target.value)} required rows={2} className="w-full rounded-lg border border-foreground/15 bg-background px-2 py-1.5" />
          <div className="grid grid-cols-2 gap-2"><input placeholder="lat" value={lat} onChange={(e) => setLat(e.target.value)} required className="rounded-lg border border-foreground/15 bg-background px-2 py-1.5" /><input placeholder="lon" value={lon} onChange={(e) => setLon(e.target.value)} required className="rounded-lg border border-foreground/15 bg-background px-2 py-1.5" /></div>
          <select value={assignee} onChange={(e) => setAssignee(e.target.value === "" ? "" : Number(e.target.value))} className="w-full rounded-lg border border-foreground/15 bg-background px-2 py-1.5">
            <option value="">Assign to…</option>
            {fieldUsers.map((u) => <option key={u.id} value={u.id}>{u.fullName} ({u.roleLabel})</option>)}
          </select>
          {err && <div className="text-[#b91c1c]">{err}</div>}
          <Button size="sm">Create task</Button>
        </form>
      </CardContent>
    </Card>
  );
}
