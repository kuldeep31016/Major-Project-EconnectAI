"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, BookOpen, Check, Copy, Database, FileText, Loader2, MessageCircle, MessagesSquare, RotateCcw, Sparkles, ThumbsDown, ThumbsUp, Trash2, Wrench, X } from "lucide-react";

import { postScenario, sendChatFeedback, streamChat, type ChatAnswer, type ChatSource, type ScenarioResult } from "@/lib/api";
import { BeforeAfter } from "@/components/simulation/before-after";
import { useAnalysis } from "@/hooks/use-analysis";
import { useAuth } from "@/hooks/use-auth";
import { useChatFocus } from "@/lib/chat-focus";
import { EASE } from "@/components/shared/motion";
import { cn } from "@/lib/utils";

interface Msg { id: string; role: "user" | "assistant"; text: string; answer?: ChatAnswer; error?: boolean; retry?: string; pending?: boolean; rated?: 1 | -1 }

const STORE = "eco-assistant-v1";
const WELCOME = "Hello. I can help you understand EcoConnectAI's data, analysis results and decision-support workflow. "
  + "Facts come straight from the stored analysis; explanations come from the project's documents, and I show my sources.";

const TIER: Record<ChatAnswer["tier"], { label: string; icon: typeof Database; cls: string }> = {
  structured: { label: "From stored data · no AI call", icon: Database, cls: "border-[#15803d]/25 bg-[#15803d]/[0.07] text-[#15803d]" },
  retrieval: { label: "Retrieved from project data and documents · no AI call", icon: FileText, cls: "border-[#1e5f8a]/25 bg-[#1e5f8a]/[0.07] text-[#1e5f8a]" },
  llm: { label: "AI explanation · grounded in cited sources", icon: Sparkles, cls: "border-[#6d5bd0]/25 bg-[#6d5bd0]/[0.07] text-[#6d5bd0]" },
  refused: { label: "Not enough verified information", icon: X, cls: "border-foreground/15 text-muted-foreground" },
  conversation: { label: "Assistant", icon: MessagesSquare, cls: "border-foreground/15 text-muted-foreground" },
};

function SourceIcon({ s }: { s: ChatSource }) {
  const t = s.type ?? "";
  const I = t === "paper" ? BookOpen : t === "run_results" || t === "run" || t === "model" || t === "db" || t === "config" ? Database : FileText;
  return <I className="mt-[2px] h-3 w-3 shrink-0" />;
}

const SCEN_LABEL: Record<string, string> = {
  remove_patches: "Remove patch(es)", restore: "Restore candidate", restore_multi: "Restore candidates",
  reduce_area: "Reduce patch area", radius: "Change connection radius", sensitivity: "Sensitivity grid (τ × k)",
};

let seq = 0;
const nextId = () => `m${Date.now().toString(36)}${++seq}`;

function sessionId(): string {
  try {
    let s = sessionStorage.getItem(`${STORE}:sid`);
    if (!s) { s = crypto.randomUUID(); sessionStorage.setItem(`${STORE}:sid`, s); }
    return s;
  } catch { return "no-storage"; }
}

/** A simulation the assistant proposed (LLM tier). Nothing runs until the user presses Run. */
function ProposedScenario({ cmd, sceneId, runId }: { cmd: Record<string, unknown>; sceneId: string; runId: string }) {
  const [st, setSt] = useState<{ busy: boolean; res?: ScenarioResult; err?: string }>({ busy: false });
  const params = Object.entries(cmd).filter(([k]) => k !== "type").map(([k, v]) => `${k.replace(/_/g, " ")}: ${Array.isArray(v) ? v.join(", ") : String(v)}`).join(" · ");
  return (
    <div className="mt-2 rounded-xl border border-[#c2410c]/25 bg-[#c2410c]/[0.05] p-2.5 text-[12px]">
      <div className="text-[10px] uppercase tracking-wider text-[#c2410c]">Proposed simulation · needs your confirmation</div>
      <div className="mt-0.5 font-semibold">{SCEN_LABEL[String(cmd.type)] ?? String(cmd.type)}</div>
      {params && <div className="text-muted-foreground">{params}</div>}
      {!st.res && (
        <button disabled={st.busy} onClick={async () => {
          setSt({ busy: true });
          try { setSt({ busy: false, res: await postScenario(sceneId, runId, cmd) }); } catch (e) { setSt({ busy: false, err: e instanceof Error ? e.message : String(e) }); }
        }} className="mt-1.5 rounded-lg bg-[#0f5132] px-2.5 py-1 text-[11.5px] font-semibold text-white disabled:opacity-50">
          {st.busy ? "Computing…" : "Run simulation"}
        </button>
      )}
      {st.err && <div className="mt-1 text-[#b91c1c]">{st.err}</div>}
      {st.res && (
        <div className="mt-2 space-y-1.5">
          <div className="text-[10px] font-semibold text-[#c2410c]">{st.res.label}</div>
          {st.res.scenario && <BeforeAfter b={st.res.baseline} s={st.res.scenario} />}
          <p className="text-muted-foreground">{st.res.explanation}</p>
        </div>
      )}
    </div>
  );
}

export function EcoAssistant() {
  const pathname = usePathname();
  const router = useRouter();
  const { sceneId, scene, runId, selectedPatchId, apiOnline, clearRemoved, togglePatchRemoved } = useAnalysis();
  const { user, can } = useAuth();
  const focus = useChatFocus();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [debug, setDebug] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>(() => {
    try { return JSON.parse(sessionStorage.getItem(STORE) || "[]"); } catch { return []; }
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const canDebug = can("view_audit");
  const pageModule = pathname.split("/").filter(Boolean)[0] ?? "home";
  const selected = focus.candidate ?? selectedPatchId ?? null;

  useEffect(() => {
    try { sessionStorage.setItem(STORE, JSON.stringify(msgs.slice(-40))); } catch { /* storage blocked: history is per render only */ }
  }, [msgs]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [msgs, busy]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 200); }, [open]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((v) => !v); }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const suggestions = useMemo(() => {
    const base = ["Why is P07 critical?", "How many habitat patches are there?", "What model are we using?", "Why Sentinel-1?",
      "What happens if P07 is removed?", "Where could restoration help?", "What are the limitations?", "What is connectivity?", "What does a cut vertex mean?"];
    if (selected && selected !== "P07") return [`Why is ${selected} important?`, ...base.slice(1)];
    return base;
  }, [selected]);

  const send = async (raw: string) => {
    const text = raw.trim().slice(0, 500);
    if (!text || busy) return;
    const history = msgs.filter((m) => !m.error && !m.pending).slice(-6).map((m) => ({ role: m.role, text: m.text.slice(0, 1500) }));
    const pid = nextId();
    setMsgs((m) => [...m, { id: nextId(), role: "user", text }]);
    setInput("");
    if (apiOnline === false) {
      setMsgs((m) => [...m, { id: pid, role: "assistant", error: true, retry: text, text: "Backend unavailable — live analysis cannot be calculated, and I will not answer from memory." }]);
      return;
    }
    setBusy(true);
    setStage("Searching project data…");
    setMsgs((m) => [...m, { id: pid, role: "assistant", text: "", pending: true }]);
    try {
      const a = await streamChat(text, { study_area: sceneId, run_id: runId || "latest", selected_patch: focus.candidate ? null : selectedPatchId,
        selected_candidate: focus.candidate, module: pageModule }, sessionId(), history, debug && canDebug, {
        onStatus: (st) => setStage(st.charAt(0).toUpperCase() + st.slice(1) + "…"),
        onDelta: (t) => { setStage(null); setMsgs((m) => m.map((x) => (x.id === pid ? { ...x, text: x.text + t } : x))); },
      });
      setMsgs((m) => m.map((x) => (x.id === pid ? { id: pid, role: "assistant", text: a.answer, answer: a } : x)));    // validated final text
    } catch (e) {
      const msg = e instanceof Error && /429/.test(e.message) ? "Question limit reached for now — please try again in a few minutes." : "The assistant could not be reached. Nothing was answered.";
      setMsgs((m) => m.map((x) => (x.id === pid ? { id: pid, role: "assistant", error: true, retry: text, text: msg } : x)));
    } finally {
      setBusy(false);
      setStage(null);
    }
  };

  const rate = (m: Msg, r: 1 | -1) => {
    if (!m.answer?.event_id) return;
    setMsgs((all) => all.map((x) => (x.id === m.id ? { ...x, rated: r } : x)));
    sendChatFeedback(m.answer.event_id, r, sessionId()).catch(() => {});
  };

  const runAction = (a: NonNullable<ChatAnswer["action"]>) => {
    if (a.patch) { clearRemoved(); togglePatchRemoved(a.patch); }   // Scenario Lab opens with the patch preselected
    setOpen(false);
    router.push(a.href);
  };

  const copy = async (id: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(null), 1500); } catch { /* clipboard blocked */ }
  };

  if (pathname === "/login") return null;
  const ctxLabel = [scene?.name?.split(" — ")[0] ?? sceneId, selected].filter(Boolean).join(" · ");

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.2, ease: EASE }} onClick={() => setOpen(true)}
            className="fixed bottom-5 right-5 z-[1200] grid h-14 w-14 place-items-center rounded-full bg-[#0f5132] text-white shadow-xl shadow-black/20 ring-4 ring-white/70 transition-transform hover:scale-105 sm:bottom-6 sm:right-6"
            aria-label="Open EcoConnectAI Assistant" title="EcoConnectAI Assistant (⌘K)">
            <MessageCircle className="h-6 w-6" strokeWidth={2.2} />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} transition={{ duration: 0.22, ease: EASE }}
            role="dialog" aria-label="EcoConnectAI Assistant"
            className="fixed inset-x-2 bottom-2 z-[1200] flex h-[min(660px,calc(100dvh-1rem))] sm:h-[min(660px,calc(100dvh-3rem))] flex-col overflow-hidden rounded-2xl border border-black/10 bg-white text-foreground shadow-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[420px]">
            <header className="flex items-center gap-2.5 border-b border-black/[0.07] px-4 py-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#0f5132] text-white"><MessageCircle className="h-[18px] w-[18px]" /></div>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="text-[13.5px] font-semibold">EcoConnectAI Assistant</div>
                <div className="truncate text-[11px] text-muted-foreground">Grounded in project data{ctxLabel ? ` · ${ctxLabel}` : ""}</div>
              </div>
              {canDebug && (
                <button onClick={() => setDebug((d) => !d)} title="Diagnostics (admin only)"
                  className={cn("grid h-8 w-8 place-items-center rounded-lg hover:bg-black/[0.05]", debug ? "text-[#6d5bd0]" : "text-muted-foreground")}><Wrench className="h-4 w-4" /></button>
              )}
              <button onClick={() => setMsgs([])} title="Clear conversation" className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-black/[0.05]"><Trash2 className="h-4 w-4" /></button>
              <button onClick={() => setOpen(false)} title="Close" className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-black/[0.05]"><X className="h-4 w-4" /></button>
            </header>

            <div ref={scrollRef} className="scroll-slim flex-1 space-y-3 overflow-y-auto bg-[#f7f9f8] px-4 py-4">
              <div className="rounded-2xl border border-black/[0.06] bg-white px-3.5 py-2.5 text-[13px] leading-relaxed">{WELCOME}</div>
              {msgs.length === 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((s) => (
                    <button key={s} onClick={() => send(s)} className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11.5px] text-foreground/80 hover:border-[#15803d]/40 hover:text-foreground">{s}</button>
                  ))}
                </div>
              )}
              {msgs.map((m) => m.role === "user" ? (
                <div key={m.id} className="flex justify-end"><div className="max-w-[85%] rounded-2xl rounded-br-md bg-[#0f5132] px-3.5 py-2 text-[13px] text-white">{m.text}</div></div>
              ) : (
                <div key={m.id} className="max-w-[94%]">
                  <div className={cn("whitespace-pre-line rounded-2xl rounded-bl-md border bg-white px-3.5 py-2.5 text-[13px] leading-relaxed", m.error ? "border-[#b91c1c]/25 text-[#991b1b]" : "border-black/[0.06]")}>
                    {m.pending && !m.text ? (
                      <span className="inline-flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin text-[#15803d]" />{stage ?? "Thinking…"}</span>
                    ) : m.text}
                    {m.answer?.note && <div className="mt-1.5 text-[11.5px] text-[#b45309]">{m.answer.note}</div>}
                    {m.error && m.retry && (
                      <button onClick={() => { setMsgs((all) => all.filter((x) => x.id !== m.id)); void send(m.retry!); }}
                        className="mt-1.5 flex items-center gap-1 text-[11.5px] font-semibold text-[#0f5132]"><RotateCcw className="h-3 w-3" />Retry</button>
                    )}
                  </div>
                  {m.answer && (
                    <div className="mt-1.5 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5 text-[10.5px]">
                        {(() => { const t = TIER[m.answer.tier]; const I = t.icon; return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5", t.cls)}><I className="h-3 w-3" />{t.label}</span>; })()}
                        {m.answer.cache_hit && <span className="rounded-full border border-black/10 px-2 py-0.5 text-muted-foreground">cached answer</span>}
                        <button onClick={() => copy(m.id, m.text)} className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-muted-foreground hover:text-foreground" title="Copy answer">
                          {copied === m.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}{copied === m.id ? "Copied" : "Copy"}
                        </button>
                        {m.answer.event_id && (
                          <span className="inline-flex items-center gap-0.5">
                            <button onClick={() => rate(m, 1)} title="Helpful" className={cn("rounded p-0.5 hover:text-foreground", m.rated === 1 ? "text-[#15803d]" : "text-muted-foreground")}><ThumbsUp className="h-3 w-3" /></button>
                            <button onClick={() => rate(m, -1)} title="Not helpful" className={cn("rounded p-0.5 hover:text-foreground", m.rated === -1 ? "text-[#b91c1c]" : "text-muted-foreground")}><ThumbsDown className="h-3 w-3" /></button>
                          </span>
                        )}
                      </div>
                      {m.answer.sources.length > 0 && (
                        <div className="rounded-lg border border-black/[0.06] bg-white/70 px-2.5 py-1.5">
                          <div className="text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground">Sources</div>
                          {m.answer.sources.slice(0, 5).map((s, i) => (
                            <div key={i} className="mt-1 flex items-start gap-1.5 text-[11px] text-foreground/75" title={s.run_id ? `run ${s.run_id}` : s.uri ?? undefined}>
                              <SourceIcon s={s} />
                              <span className="min-w-0">
                                {s.id && /^S\d+$/.test(s.id) && <span className="mr-1 font-mono text-[10px] text-muted-foreground">[{s.id}]</span>}
                                {s.title && s.section ? <><span className="font-medium">{s.title}</span><span className="text-muted-foreground"> · {s.section}</span></> : s.label}
                                {s.page ? <span className="text-muted-foreground"> · p. {s.page}</span> : null}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {m.answer.action && (
                        <button onClick={() => runAction(m.answer!.action!)} className="rounded-lg border border-[#0f5132]/25 bg-[#0f5132]/[0.06] px-2.5 py-1 text-[11.5px] font-semibold text-[#0f5132] hover:bg-[#0f5132]/10">
                          {m.answer.action.label} →
                        </button>
                      )}
                      {m.answer.proposed_scenario && <ProposedScenario cmd={m.answer.proposed_scenario} sceneId={sceneId} runId={runId} />}
                      {m.answer.debug && (
                        <div className="rounded-lg border border-[#6d5bd0]/20 bg-[#6d5bd0]/[0.04] p-2 font-mono text-[10px] leading-snug text-foreground/75">
                          <div>tier {m.answer.tier} · intent {m.answer.intent} · {m.answer.debug.latency_ms} ms · provider {m.answer.debug.provider}</div>
                          <div>llm: {m.answer.llm_called ? `called (${Math.round(m.answer.debug.llm_ms ?? 0)} ms, ~${m.answer.debug.tokens_in_est}/${m.answer.debug.tokens_out_est} tok)` : `not called${m.answer.debug.llm_reason ? ` — ${m.answer.debug.llm_reason}` : ""}`}</div>
                          <div>cache: {m.answer.cache_hit ? `hit (similarity ${m.answer.debug.cache_similarity ?? "—"})` : "miss"} · run {m.answer.run_id ?? "—"}</div>
                          {m.answer.debug.retrieved.slice(0, 5).map((r, i) => <div key={i}>↳ {r.score.toFixed(3)} {r.category} · {r.source}</div>)}
                          {m.answer.debug.error && <div className="text-[#b91c1c]">error: {m.answer.debug.error}</div>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

            </div>

            {msgs.length > 0 && (
              <div className="scroll-slim flex gap-1.5 overflow-x-auto border-t border-black/[0.06] px-3 pt-2.5">
                {suggestions.slice(0, 5).map((s) => (
                  <button key={s} disabled={busy} onClick={() => send(s)} className="shrink-0 rounded-full border border-black/10 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50">{s}</button>
                ))}
              </div>
            )}
            <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="flex items-end gap-2 px-3 pb-3 pt-2.5">
              <textarea ref={inputRef} value={input} rows={1} maxLength={500}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); } }}
                placeholder={selected ? `Ask about ${selected}, the network, restoration…` : "Ask about patches, connectivity, restoration…"}
                className="max-h-28 min-h-10 flex-1 resize-none rounded-xl border border-black/10 bg-white px-3 py-2.5 text-[13px] outline-none focus:border-[#15803d]/50" />
              <button type="submit" disabled={!input.trim() || busy} aria-label="Send"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#0f5132] text-white disabled:opacity-40"><ArrowUp className="h-4 w-4" strokeWidth={2.5} /></button>
            </form>
            <div className="px-4 pb-2.5 text-center text-[10px] text-muted-foreground">
              Decision support only · answers cite stored results and project documents · {user ? `signed in as ${user.roleLabel ?? user.role}` : <Link href="/login" className="underline">sign in</Link>}
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}
