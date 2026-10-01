"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/dashboard/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { clearChatCache, deleteRagDoc, fetchChatDiagnostics, fetchRagDocuments, fetchRagStatus, fetchSystem, ingestRag, reindexChat, reindexRagDoc, uploadRagDoc, type ChatDiagnostics, type RagDoc, type SystemInfo } from "@/lib/api";
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
            <AssistantDiagnostics />
            <KnowledgeIndex canManage={can("manage_users")} />
          </>
        )}
      </div>
    </AppShell>
  );
}

/** Developer/admin view of the assistant: which tier answered, cache and LLM use, retrieval index, latest questions. */
function AssistantDiagnostics() {
  const [d, setD] = useState<ChatDiagnostics | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(() => fetchChatDiagnostics().then(setD).catch((e) => setMsg(e instanceof Error ? e.message : String(e))), []);
  useEffect(() => { load(); }, [load]);
  if (!d) return msg ? <div className="text-[12px] text-[#b91c1c]">{msg}</div> : null;
  const t = d.last_24h;
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 pb-2">
        <div>
          <CardTitle className="text-[13px]">Assistant (RAG) — last 24 h</CardTitle>
          <CardDescription>
            LLM {d.config.llm_enabled ? (d.config.provider_available ? `on (${d.config.provider}, ≤ ${d.config.max_output_tokens} output tokens)` : "on but no provider configured") : "off"} ·
            index {d.index.chunks} chunks · embeddings {d.embedder.model_version ?? "off"} · vector search {d.index.pgvector ? "pgvector" : "in-process"}
          </CardDescription>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Button size="sm" variant="outline" onClick={() => reindexChat().then(() => { setMsg("Incremental ingest queued"); load(); })}>Re-index</Button>
          <Button size="sm" variant="outline" onClick={() => clearChatCache().then((r) => { setMsg(`${r.deleted} cached answers cleared`); load(); })}>Clear cache</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-[12px]">
        {msg && <div className="text-muted-foreground">{msg}</div>}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Stat label="Questions" value={String(t.questions)} />
          <Stat label="From stored data" value={String(t.by_tier.structured ?? 0)} tone="ok" />
          <Stat label="From documents" value={String(t.by_tier.retrieval ?? 0)} tone="ok" />
          <Stat label="LLM calls" value={`${t.llm_calls} (${Math.round(t.llm_share * 100)} %)`} tone={t.llm_calls ? "warn" : "ok"} />
          <Stat label="Cache hits · est. tokens" value={`${t.cache_hits} · ${t.tokens_in_est}/${t.tokens_out_est}`} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="LLM cost (24 h)" value={`$${t.cost_usd.toFixed(4)}`} tone={t.cost_usd ? "warn" : "ok"} />
          <Stat label="Cost per answer" value={`$${t.cost_per_answer_usd.toFixed(5)}`} />
          <Stat label="Latency p50 / p95" value={`${t.latency_p50_ms ?? "—"} / ${t.latency_p95_ms ?? "—"} ms`} />
          <Stat label="Feedback 👍 / 👎" value={`${t.feedback.up} / ${t.feedback.down}`} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11.5px]">
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="py-1.5 text-left">When</th><th className="text-left">Role</th><th className="text-left">Question</th><th className="text-left">Tier</th><th>Cache</th><th>LLM</th><th className="text-right">$</th><th className="text-right">ms</th></tr></thead>
            <tbody>{d.recent.slice(0, 20).map((e, i) => (
              <tr key={i} className="border-t border-foreground/[0.06]" title={e.llm_reason ?? e.error ?? undefined}>
                <td className="py-1 font-mono text-[10.5px]">{e.ts?.slice(11, 19)}</td><td>{e.role}</td><td className="max-w-[320px] truncate">{e.question}</td>
                <td>{e.tier}{e.intent ? ` · ${e.intent}` : ""}</td><td className="text-center">{e.cache_hit ? "hit" : "—"}</td>
                <td className="text-center">{e.llm_called ? (e.model ?? "yes") : "—"}</td><td className="text-right tabular">{e.cost_usd ? e.cost_usd.toFixed(4) : "—"}</td><td className="text-right tabular">{e.latency_ms?.toFixed(0)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

const STATUS_TONE: Record<string, string> = { INDEXED: "text-[#15803d]", FAILED: "text-[#b91c1c]", STALE: "text-[#b45309]", PROCESSING: "text-[#1e5f8a]",
  PENDING: "text-[#1e5f8a]", DELETED: "text-muted-foreground line-through" };

/** RAG knowledge index: what the assistant can retrieve, at which version, and whether it is current. */
function KnowledgeIndex({ canManage }: { canManage: boolean }) {
  const [docs, setDocs] = useState<RagDoc[] | null>(null);
  const [st, setSt] = useState<Awaited<ReturnType<typeof fetchRagStatus>> | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [vis, setVis] = useState("staff");
  const load = useCallback(() => {
    fetchRagDocuments().then(setDocs).catch((e) => setMsg(e instanceof Error ? e.message : String(e)));
    fetchRagStatus().then(setSt).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  const act = (p: Promise<unknown>, done: string) => p.then(() => { setMsg(done); setTimeout(load, 1500); }).catch((e) => setMsg(e instanceof Error ? e.message : String(e)));
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 pb-2">
        <div>
          <CardTitle className="text-[13px]">Knowledge index (RAG)</CardTitle>
          <CardDescription>
            {st ? <>{Object.entries(st.documents_by_status).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(" · ")} · {st.chunks} chunks ({st.chunks_embedded} embedded) ·
              {" "}{st.embedder.model_version ?? `dense search off (${st.embedder.error ?? st.embedder.provider})`} · vector search {st.pgvector ? "pgvector" : "in-process"}
              {st.stale_detected_now ? ` · ${st.stale_detected_now} stale` : ""}</> : "Loading…"}
          </CardDescription>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          <Button size="sm" variant="outline" onClick={() => act(ingestRag(false), "Incremental ingest queued (unchanged documents are skipped)")}>Re-index changed</Button>
          <Button size="sm" variant="outline" onClick={() => act(ingestRag(true), "Full re-index queued")}>Force re-index</Button>
          {canManage && (
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-foreground/15 px-2.5 py-1 text-[12px] hover:bg-foreground/[0.04]">
              <select value={vis} onChange={(e) => setVis(e.target.value)} className="bg-transparent text-[11.5px] outline-none" onClick={(e) => e.stopPropagation()}>
                <option value="public">public</option><option value="staff">staff</option><option value="admin">admin</option>
              </select>
              Upload
              <input type="file" accept=".md,.markdown,.txt,.html,.htm,.json,.csv,.pdf" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) act(uploadRagDoc(f, vis), `${f.name} uploaded (${vis}) and queued for indexing`); e.target.value = ""; }} />
            </label>
          )}
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        {msg && <div className="px-3 pb-2 text-[11.5px] text-muted-foreground">{msg}</div>}
        <table className="w-full text-[11.5px]">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-3 py-2 text-left">Document</th><th className="text-left">Type</th><th className="text-left">Visibility</th><th className="text-left">Status</th><th className="text-right">v</th><th className="text-right">Chunks</th><th className="text-left">Embedding</th><th className="text-left">Indexed</th><th className="px-3 text-right" /></tr></thead>
          <tbody>{(docs ?? []).map((d) => (
            <tr key={d.id} className="border-t border-foreground/[0.06]" title={d.error ?? d.source_key}>
              <td className="max-w-[260px] truncate px-3 py-1.5">{d.title || d.source_key}</td><td>{d.source_type.toLowerCase().replace("_", " ")}</td><td>{d.visibility}</td>
              <td className={cn("font-medium", STATUS_TONE[d.status])}>{d.status}{d.error ? " ⚠" : ""}</td>
              <td className="text-right tabular">{d.version}</td><td className="text-right tabular">{d.chunk_count}</td>
              <td className="max-w-[140px] truncate font-mono text-[10px]">{d.embedding_model?.replace("fastembed:", "") ?? "—"}</td>
              <td className="font-mono text-[10px]">{d.indexed_at?.slice(0, 16).replace("T", " ") ?? "—"}</td>
              <td className="whitespace-nowrap px-3 text-right">
                <button className="text-[11px] text-[#1e5f8a] hover:underline" onClick={() => act(reindexRagDoc(d.id), `${d.title} queued`)}>re-index</button>
                {canManage && d.source_type === "UPLOAD" && d.status !== "DELETED" && (
                  <button className="ml-2 text-[11px] text-[#b91c1c] hover:underline" onClick={() => act(deleteRagDoc(d.id), `${d.title} deleted`)}>delete</button>
                )}
              </td>
            </tr>
          ))}</tbody>
        </table>
      </CardContent>
    </Card>
  );
}

