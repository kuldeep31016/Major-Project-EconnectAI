"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight, ArrowUp, BarChart3, BookOpen, Check, Copy, Database, FileText, History, Layers, Leaf, Loader2, MapPin,
  Maximize2, MessageCircle, MessagesSquare, Minimize2, RefreshCw, RotateCcw, Sparkles, Sprout, ThumbsDown, ThumbsUp,
  Trash2, Wrench, X,
} from "lucide-react";

import { postScenario, sendChatFeedback, streamChat, type ChatAnswer, type ChatSource, type ScenarioResult } from "@/lib/api";
import { BeforeAfter } from "@/components/simulation/before-after";
import { useAnalysis } from "@/hooks/use-analysis";
import { useAuth } from "@/hooks/use-auth";
import { useChatFocus } from "@/lib/chat-focus";
import { EASE } from "@/components/shared/motion";
import { cn } from "@/lib/utils";

interface Msg {
  id: string; role: "user" | "assistant"; text: string; at: number; answer?: ChatAnswer;
  error?: boolean; retry?: string; pending?: boolean; rated?: 1 | -1;
}

const STORE = "eco-assistant-v2";
const GREEN = "#0f5132";

const TIER: Record<ChatAnswer["tier"], { label: string; icon: typeof Database; cls: string }> = {
  structured: { label: "From stored data · no AI call", icon: Database, cls: "border-[#15803d]/25 bg-[#15803d]/[0.07] text-[#15803d]" },
  retrieval: { label: "From project documents · no AI call", icon: FileText, cls: "border-[#1e5f8a]/25 bg-[#1e5f8a]/[0.07] text-[#1e5f8a]" },
  llm: { label: "AI explanation · cites its sources", icon: Sparkles, cls: "border-[#6d5bd0]/25 bg-[#6d5bd0]/[0.07] text-[#6d5bd0]" },
  refused: { label: "Not enough verified information", icon: X, cls: "border-black/10 text-muted-foreground" },
  conversation: { label: "Assistant", icon: MessagesSquare, cls: "border-black/10 text-muted-foreground" },
};

type Mode = "chat" | "analysis" | "patches" | "restoration" | "docs";
interface Starter { title: string; hint: string; q: string; icon: typeof Database }

/** Each rail mode changes the starter cards and suggestion chips (and tells the backend which module the user is in). */
function modeContent(mode: Mode, patch: string, cand: string | null): { starters: Starter[]; chips: string[] } {
  switch (mode) {
    case "analysis":
      return {
        starters: [
          { title: "Most critical patches", hint: "Ranked by connectivity loss", q: "Which patches are most critical?", icon: BarChart3 },
          { title: "Network bridges", hint: "Patches that split the network", q: "Which patches hold the network together?", icon: Layers },
          { title: "What is IIC?", hint: "The connectivity index", q: "What is IIC?", icon: BookOpen },
          { title: "Sensitivity", hint: "Does the 5 km assumption matter?", q: "What is the 5 km assumption and how sensitive are the results?", icon: RefreshCw },
        ],
        chips: ["How many connectivity links?", "How many components does the network have?", "What is a cut vertex?", "What does ECA mean?"],
      };
    case "patches":
      return {
        starters: [
          { title: `Explain ${patch}`, hint: "Why it matters", q: `Why is ${patch} important?`, icon: MessageCircle },
          { title: `${patch} area`, hint: "Size and share of habitat", q: `What is ${patch}'s area?`, icon: MapPin },
          { title: `${patch} neighbours`, hint: "Its links and distances", q: `What are ${patch}'s neighbours?`, icon: Layers },
          { title: "Largest patch", hint: "Size vs importance", q: "Which is the largest patch?", icon: BarChart3 },
        ],
        chips: ["How many habitat patches are there?", `What is ${patch}'s connectivity loss?`, `Is ${patch} a cut vertex?`, "Why can a small patch matter more than a big one?"],
      };
    case "restoration":
      return {
        starters: [
          { title: "Where to restore", hint: "Largest simulated gain", q: "Where could restoration help?", icon: Sprout },
          { title: cand ? `Explain ${cand}` : "Explain C05", hint: "Why this location?", q: cand ? `Why is ${cand} a good candidate?` : "What is C05?", icon: MapPin },
          { title: "Approved sites?", hint: "What candidates are (and are not)", q: "Are restoration candidates approved sites?", icon: BookOpen },
          { title: "How many candidates", hint: "Sites vs field checks", q: "How many restoration candidates are there?", icon: BarChart3 },
        ],
        chips: ["What is the purpose of restoration analysis?", "What is C01?", "What is the restoration cost of C05?"],
      };
    case "docs":
      return {
        starters: [
          { title: "Why Sentinel-1?", hint: "Radar through monsoon cloud", q: "Why do we use Sentinel-1?", icon: BookOpen },
          { title: "Limitations", hint: "What the model cannot claim", q: "What are the limitations of the current model?", icon: FileText },
          { title: "Field verification", hint: "How results are checked", q: "How does field verification work?", icon: Check },
          { title: "How I answer", hint: "Data, documents, AI", q: "How does the assistant answer questions?", icon: MessagesSquare },
        ],
        chips: ["What data does the project use?", "Is the model field validated?", "Does the system predict animal movement?", "What is EcoConnectAI?"],
      };
    default:
      return {
        starters: [
          { title: "Summarize this study area", hint: "Get a quick overview", q: "How many patches are in this run?", icon: FileText },
          { title: "Explain a patch", hint: `e.g. Why is ${patch} critical?`, q: `Why is ${patch} critical?`, icon: MessageCircle },
          { title: "Compare scenarios", hint: "e.g. Before vs after removal", q: `What happens if ${patch} is removed?`, icon: RefreshCw },
          { title: "Suggest restoration sites", hint: "Based on model results", q: "Where could restoration help?", icon: Sprout },
        ],
        chips: ["Which patch is most critical?", "How many study areas are there?", `What if ${patch} is removed?`, "What model are we using?", "What are the limitations?"],
      };
  }
}


let seq = 0;
const nextId = () => `m${Date.now().toString(36)}${++seq}`;
const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function sessionId(): string {
  try {
    let s = sessionStorage.getItem(`${STORE}:sid`);
    if (!s) { s = crypto.randomUUID(); sessionStorage.setItem(`${STORE}:sid`, s); }
    return s;
  } catch { return "no-storage"; }
}

/** Minimal, safe formatter: numbered / bulleted lists, **bold**, citation markers - no HTML injection. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\[S\d+\])/g).map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (/^\[S\d+\]$/.test(p)) return <sup key={i} className="mx-0.5 rounded bg-black/[0.06] px-1 text-[9.5px] font-semibold text-foreground/60">{p.slice(1, -1)}</sup>;
    return <Fragment key={i}>{p}</Fragment>;
  });
}

function RichText({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: ReactNode[] = [];
  let list: { kind: "ol" | "ul"; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const L = list;
    out.push(L.kind === "ol"
      ? <ol key={out.length} className="my-1 list-decimal space-y-0.5 pl-5">{L.items.map((t, i) => <li key={i}>{inline(t)}</li>)}</ol>
      : <ul key={out.length} className="my-1 list-disc space-y-0.5 pl-5">{L.items.map((t, i) => <li key={i}>{inline(t)}</li>)}</ul>);
    list = null;
  };
  for (const ln of lines) {
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(ln);
    const ul = /^\s*[-•]\s+(.*)$/.exec(ln);
    if (ol || ul) {
      const kind = ol ? "ol" : "ul";
      if (!list || list.kind !== kind) { flush(); list = { kind, items: [] }; }
      list.items.push((ol ?? ul)![1]);
    } else {
      flush();
      if (ln.trim()) out.push(<p key={out.length} className="my-0.5">{inline(ln)}</p>);
    }
  }
  flush();
  return <>{out}</>;
}

function SourceIcon({ s, className }: { s: ChatSource; className?: string }) {
  const t = s.type ?? "";
  const I = t === "paper" ? BookOpen : ["run_results", "run", "model", "db", "config"].includes(t) ? Database : FileText;
  return <I className={className} />;
}

const SCEN_LABEL: Record<string, string> = {
  remove_patches: "Remove patch(es)", restore: "Restore candidate", restore_multi: "Restore candidates",
  reduce_area: "Reduce patch area", radius: "Change connection radius", sensitivity: "Sensitivity grid (τ × k)",
};

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
        }} className="mt-1.5 rounded-lg px-2.5 py-1 text-[11.5px] font-semibold text-white disabled:opacity-50" style={{ background: GREEN }}>
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

/** Floating launcher: glowing green orb, chat bubble with a leaf, sprouting leaves and an "online" dot. Pure SVG/CSS. */
function LauncherMark() {
  return (
    <span className="relative block h-full w-full">
      {/* soft outer glow */}
      <span aria-hidden className="absolute -inset-2 rounded-full bg-[#0f5132]/45 blur-xl transition-opacity duration-300 group-hover:opacity-90 motion-safe:animate-[pulse_3.2s_ease-in-out_infinite]" />
      {/* orb */}
      <span aria-hidden className="absolute inset-0 rounded-full shadow-[0_10px_28px_-6px_rgba(4,60,32,0.7)]"
        style={{ background: "radial-gradient(circle at 35% 28%, #1f9d5c 0%, #0f6b3c 45%, #0a4a2a 100%)" }} />
      {/* bright inner ring */}
      <span aria-hidden className="absolute inset-[5px] rounded-full border-2 border-[#4ff0a6]/80 shadow-[0_0_14px_rgba(79,240,166,0.55),inset_0_0_12px_rgba(79,240,166,0.35)]" />
      {/* sprouting leaves, top-left */}
      <svg aria-hidden viewBox="0 0 40 40" className="absolute -left-2.5 -top-3 h-8 w-8 drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)] transition-transform duration-300 group-hover:-rotate-6">
        <path d="M22 30C12 30 5 22 4 12c9 0 17 6 18 18Z" fill="#3fbf5f" />
        <path d="M22 30C14 22 9 17 4 12" stroke="#1f7a3a" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        <path d="M23 29c-2-9 2-18 11-24 3 10-1 19-11 24Z" fill="#5fd36f" />
        <path d="M23 29c3-8 6-15 11-24" stroke="#2b8a45" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      </svg>
      {/* chat bubble with typing dots + small leaf */}
      <svg aria-hidden viewBox="0 0 32 32" className="absolute left-1/2 top-1/2 h-[30px] w-[30px] -translate-x-1/2 -translate-y-1/2">
        <path d="M16 6.5c-5.8 0-10.5 3.9-10.5 8.8 0 2.6 1.3 4.9 3.4 6.5l-1.3 4.2 4.7-2.3c1.2.3 2.4.5 3.7.5 5.8 0 10.5-3.9 10.5-8.9" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="11.6" cy="15.6" r="1.6" fill="#fff" /><circle cx="16.2" cy="15.6" r="1.6" fill="#fff" /><circle cx="20.8" cy="15.6" r="1.6" fill="#fff" />
        <path d="M23.5 13c-.4-4.6 2.3-8 6.5-9 .6 4.4-1.8 8-6.5 9Z" fill="#6ee07a" />
        <path d="M23.6 12.8c1.4-2.8 3.3-5.3 6.2-8.6" stroke="#2f9a4a" strokeWidth=".9" fill="none" strokeLinecap="round" />
      </svg>
      {/* online dot */}
      <span aria-hidden className="absolute bottom-0.5 right-0.5 grid h-[17px] w-[17px] place-items-center rounded-full bg-[#0a3d24] ring-2 ring-[#0a4a2a]">
        <span className="h-[10px] w-[10px] rounded-full bg-[#7ff5c4] shadow-[0_0_8px_rgba(127,245,196,0.9)]" />
      </span>
    </span>
  );
}

function LeafAvatar({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const cls = size === "lg" ? "h-12 w-12" : size === "sm" ? "h-7 w-7" : "h-9 w-9";
  return (
    <div className={cn("grid shrink-0 place-items-center rounded-full text-white shadow-sm", cls)} style={{ background: `linear-gradient(135deg, #15803d, ${GREEN})` }}>
      <Leaf className={size === "lg" ? "h-6 w-6" : size === "sm" ? "h-3.5 w-3.5" : "h-[18px] w-[18px]"} />
    </div>
  );
}

export function EcoAssistant() {
  const pathname = usePathname();
  const router = useRouter();
  const { sceneId, scene, runId, selectedPatchId, apiOnline, clearRemoved, togglePatchRemoved } = useAnalysis();
  const { can } = useAuth();
  const focus = useChatFocus();
  const [open, setOpen] = useState(false);
  const [wide, setWide] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
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
  const patch = selectedPatchId ?? "P07";
  const selected = focus.candidate ?? selectedPatchId ?? null;
  // suggestions follow what the user is doing: the selected object first, then the page they are on
  const mode: Mode = focus.candidate || pageModule === "restoration" ? "restoration"
    : selectedPatchId ? "patches"
    : ["analysis", "graph", "scenario", "simulation", "command"].includes(pageModule) ? "analysis"
    : ["reports", "experiments", "system", "field"].includes(pageModule) ? "docs" : "chat";
  const { starters } = useMemo(() => modeContent(mode, patch, focus.candidate), [mode, patch, focus.candidate]);
  const pastQuestions = useMemo(() => [...new Set(msgs.filter((m) => m.role === "user").map((m) => m.text))].reverse().slice(0, 12), [msgs]);
  const areaName = scene?.name?.split(" — ")[0] ?? sceneId;

  useEffect(() => {
    try { sessionStorage.setItem(STORE, JSON.stringify(msgs.slice(-40))); } catch { /* storage blocked */ }
  }, [msgs]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [msgs, busy]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 200); }, [open]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((v) => !v); }
      if (e.key === "Escape") { setShowHistory(false); setOpen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const send = async (raw: string) => {
    const text = raw.trim().slice(0, 500);
    if (!text || busy) return;
    setShowHistory(false);
    const history = msgs.filter((m) => !m.error && !m.pending).slice(-6).map((m) => ({ role: m.role, text: m.text.slice(0, 1500) }));
    const pid = nextId();
    setMsgs((m) => [...m, { id: nextId(), role: "user", text, at: Date.now() }]);
    setInput("");
    if (apiOnline === false) {
      setMsgs((m) => [...m, { id: pid, role: "assistant", at: Date.now(), error: true, retry: text, text: "Backend unavailable — live analysis cannot be calculated, and I will not answer from memory." }]);
      return;
    }
    setBusy(true);
    setStage("Searching project data…");
    setMsgs((m) => [...m, { id: pid, role: "assistant", text: "", at: Date.now(), pending: true }]);
    try {
      const a = await streamChat(text, { study_area: sceneId, run_id: runId || "latest", selected_patch: focus.candidate ? null : selectedPatchId,
        selected_candidate: focus.candidate, module: pageModule }, sessionId(), history, debug && canDebug, {
        onStatus: (st) => setStage(st.charAt(0).toUpperCase() + st.slice(1) + "…"),
        onDelta: (t) => { setStage(null); setMsgs((m) => m.map((x) => (x.id === pid ? { ...x, text: x.text + t } : x))); },
      });
      setMsgs((m) => m.map((x) => (x.id === pid ? { id: pid, role: "assistant", text: a.answer, answer: a, at: Date.now() } : x)));
    } catch (e) {
      const msg = e instanceof Error && /429/.test(e.message) ? "Question limit reached for now — please try again in a few minutes." : "The assistant could not be reached. Nothing was answered.";
      setMsgs((m) => m.map((x) => (x.id === pid ? { id: pid, role: "assistant", at: Date.now(), error: true, retry: text, text: msg } : x)));
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

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.2, ease: EASE }} onClick={() => setOpen(true)}
            className="group fixed bottom-4 right-4 z-[1200] h-[68px] w-[68px] rounded-full transition-transform duration-300 hover:scale-[1.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3ee59a] focus-visible:ring-offset-2 active:scale-95 motion-reduce:transition-none sm:bottom-5 sm:right-5"
            aria-label="Open EcoConnectAI Assistant" title="EcoConnectAI Assistant (⌘K)">
            <LauncherMark />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 14 }} transition={{ duration: 0.2, ease: EASE }}
            role="dialog" aria-label="EcoConnectAI Assistant"
            className={cn("fixed inset-x-2 bottom-2 z-[1200] flex h-[calc(100dvh-1rem)] flex-col overflow-hidden rounded-2xl border border-black/10 bg-white text-foreground shadow-2xl",
              "sm:inset-x-auto sm:bottom-5 sm:right-5 sm:h-[min(640px,calc(100dvh-2.5rem))]", wide ? "sm:w-[min(720px,calc(100vw-2.5rem))]" : "sm:w-[440px]")}>
            {/* header */}
            <header className="relative flex items-center gap-1 border-b border-black/[0.06] px-3 py-2.5">
              <LeafAvatar />
              <div className="ml-1.5 min-w-0 flex-1 leading-tight">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-[14.5px] font-semibold tracking-tight">EcoConnectAI Assistant</span>
                  <span className="shrink-0 rounded bg-[#1e5f8a]/10 px-1 py-px text-[9px] font-bold tracking-wide text-[#1e5f8a]">BETA</span>
                </div>
                <div className="truncate text-[11.5px] text-muted-foreground">{areaName}{selected ? ` · ${selected} selected` : ""}</div>
              </div>
              {canDebug && (
                <button onClick={() => setDebug((d) => !d)} title="Diagnostics (admin only)"
                  className={cn("grid h-7 w-7 place-items-center rounded-lg hover:bg-black/[0.05]", debug ? "text-[#6d5bd0]" : "text-muted-foreground")}><Wrench className="h-[15px] w-[15px]" /></button>
              )}
              <button onClick={() => setWide((w) => !w)} title={wide ? "Smaller" : "Expand"} className="hidden h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-black/[0.05] sm:grid">
                {wide ? <Minimize2 className="h-[15px] w-[15px]" /> : <Maximize2 className="h-[15px] w-[15px]" />}
              </button>
              <button onClick={() => setShowHistory((h) => !h)} title="Questions asked in this session" className={cn("grid h-7 w-7 place-items-center rounded-lg hover:bg-black/[0.05]", showHistory ? "text-foreground" : "text-muted-foreground")}>
                <History className="h-[15px] w-[15px]" />
              </button>
              <button onClick={() => setOpen(false)} title="Close" className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-black/[0.05]"><X className="h-[15px] w-[15px]" /></button>
              {showHistory && (
                <div className="absolute right-3 top-[52px] z-10 w-64 rounded-xl border border-black/10 bg-white p-1.5 shadow-xl">
                  <div className="flex items-center justify-between px-1.5 pb-1">
                    <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">This session</span>
                    {msgs.length > 0 && <button onClick={() => { setMsgs([]); setShowHistory(false); }} className="flex items-center gap-1 text-[11px] text-[#b91c1c]"><Trash2 className="h-3 w-3" />New chat</button>}
                  </div>
                  {pastQuestions.length === 0 && <div className="px-1.5 py-2 text-[12px] text-muted-foreground">No questions yet.</div>}
                  {pastQuestions.map((q) => (
                    <button key={q} onClick={() => send(q)} className="block w-full truncate rounded-lg px-2 py-1.5 text-left text-[12.5px] hover:bg-black/[0.04]">{q}</button>
                  ))}
                </div>
              )}
            </header>

            <div className="flex min-h-0 flex-1">
              {/* conversation */}
              <div className="flex min-w-0 flex-1 flex-col">
                <div ref={scrollRef} className="scroll-slim flex-1 space-y-5 overflow-y-auto px-3.5 py-4">
                  {/* welcome + starters: only in an empty chat (suggestions follow the page and the selection) */}
                  {msgs.length === 0 && <div>
                    <div className="text-[14px] font-semibold">Hi, I&apos;m your EcoConnectAI Assistant</div>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
                      Ask about mangrove patches, connectivity, what-if scenarios or restoration{selected ? ` — or about ${selected}, which you have selected` : ""}.
                    </p>
                    <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                      {starters.map((st) => (
                        <button key={st.title} onClick={() => send(st.q)} disabled={busy}
                          className="flex items-start gap-2 rounded-xl border border-black/[0.08] bg-white px-2.5 py-2 text-left transition hover:border-[#15803d]/35 hover:bg-[#f6faf7] disabled:opacity-60">
                          <st.icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#15803d]" />
                          <span className="min-w-0">
                            <span className="block truncate text-[12px] font-medium">{st.title}</span>
                            <span className="block truncate text-[10.5px] text-muted-foreground">{st.hint}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>}

                  {msgs.map((m) => m.role === "user" ? (
                    <div key={m.id} className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[#eef3f0] px-3.5 py-2 text-[13px] text-foreground">
                        <div className="whitespace-pre-line">{m.text}</div>
                      </div>
                    </div>
                  ) : (
                    <div key={m.id} className="flex items-start gap-2.5">
                      <LeafAvatar size="sm" />
                      <div className="min-w-0 flex-1 pt-0.5">
                        <div className={cn("text-[13px] leading-relaxed", m.error && "text-[#991b1b]")}>
                          {m.pending && !m.text ? (
                            <span className="inline-flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin text-[#15803d]" />{stage ?? "Thinking…"}</span>
                          ) : <RichText text={m.text} />}
                          {m.answer?.note && <div className="mt-1 text-[11.5px] text-[#b45309]">{m.answer.note}</div>}
                          {m.error && m.retry && (
                            <button onClick={() => { setMsgs((all) => all.filter((x) => x.id !== m.id)); void send(m.retry!); }}
                              className="mt-1 flex items-center gap-1 text-[12px] font-semibold text-[#0f5132]"><RotateCcw className="h-3 w-3" />Retry</button>
                          )}
                        </div>

                        {m.answer && (
                          <div className="mt-2 space-y-2">
                            {(m.answer.suggestions?.length ?? 0) > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {m.answer.suggestions!.map((q) => (
                                  <button key={q} disabled={busy} onClick={() => send(q)}
                                    className="rounded-full border border-[#15803d]/25 bg-[#f6faf7] px-2.5 py-1 text-[11.5px] text-[#0f5132] hover:bg-[#ecf5ef] disabled:opacity-50">{q}</button>
                                ))}
                              </div>
                            )}
                            {(m.answer.sources.length > 0 || m.answer.action) && (
                              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                                {m.answer.sources.length > 0 && <span className="text-muted-foreground">Sources</span>}
                                {m.answer.sources.slice(0, 3).map((src, i) => (
                                  <span key={i} title={[src.title, src.section, src.run_id ? `run ${src.run_id}` : null].filter(Boolean).join(" · ")}
                                    className="inline-flex max-w-[220px] items-center gap-1 rounded-md bg-black/[0.045] px-1.5 py-0.5 text-foreground/70">
                                    <SourceIcon s={src} className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{src.section || src.title || src.label}</span>
                                  </span>
                                ))}
                                {m.answer.action && (
                                  <button onClick={() => runAction(m.answer!.action!)} className="ml-auto inline-flex items-center gap-0.5 font-semibold text-[#15803d] hover:underline">
                                    {m.answer.action.label}<ArrowRight className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            )}
                            <div className="flex items-center gap-1 text-[10.5px] text-muted-foreground">
                              <span title={TIER[m.answer.tier].label}>{clock(m.at)}{{ llm: " · AI explanation", structured: " · from stored data", retrieval: " · from project documents", refused: "", conversation: "" }[m.answer.tier]}</span>
                              <span className="flex-1" />
                              <button onClick={() => copy(m.id, m.text)} className="rounded p-1 hover:bg-black/[0.05] hover:text-foreground" title="Copy answer">
                                {copied === m.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                              </button>
                              {m.answer.event_id && (
                                <>
                                  <button onClick={() => rate(m, 1)} title="Helpful" className={cn("rounded p-1 hover:bg-black/[0.05]", m.rated === 1 && "text-[#15803d]")}><ThumbsUp className="h-3 w-3" /></button>
                                  <button onClick={() => rate(m, -1)} title="Not helpful" className={cn("rounded p-1 hover:bg-black/[0.05]", m.rated === -1 && "text-[#b91c1c]")}><ThumbsDown className="h-3 w-3" /></button>
                                </>
                              )}
                            </div>
                            {m.answer.proposed_scenario && <ProposedScenario cmd={m.answer.proposed_scenario} sceneId={sceneId} runId={runId} />}
                            {m.answer.debug && (
                              <div className="rounded-lg border border-[#6d5bd0]/20 bg-[#6d5bd0]/[0.04] p-2 font-mono text-[10px] leading-snug text-foreground/75">
                                <div>tier {m.answer.tier} · intent {m.answer.intent} · {m.answer.debug.latency_ms} ms · provider {m.answer.debug.provider}</div>
                                <div>llm: {m.answer.llm_called ? `called (${Math.round(m.answer.debug.llm_ms ?? 0)} ms, ~${m.answer.debug.tokens_in_est}/${m.answer.debug.tokens_out_est} tok)` : `not called${m.answer.debug.llm_reason ? ` — ${m.answer.debug.llm_reason}` : ""}`}</div>
                                <div>cache: {m.answer.cache_hit ? `hit (similarity ${m.answer.debug.cache_similarity ?? "—"})` : "miss"} · run {m.answer.run_id ?? "—"}</div>
                                {m.answer.debug.retrieved.slice(0, 5).map((r, i) => <div key={i}>↳ {r.score.toFixed(3)} {r.category} · {r.source}</div>)}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* composer */}
                <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="px-3 pb-3 pt-1.5">
                  <div className="flex items-end gap-1.5 rounded-2xl border border-black/10 bg-[#f7f8f7] py-1 pl-3 pr-1 focus-within:border-[#15803d]/45 focus-within:bg-white">
                    <textarea ref={inputRef} value={input} rows={1} maxLength={500}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(input); } }}
                      placeholder={selected ? `Ask about ${selected}…` : "Ask anything about this project…"}
                      className="max-h-24 min-h-9 flex-1 resize-none bg-transparent py-2 text-[13px] outline-none" />
                    <button type="submit" disabled={!input.trim() || busy} aria-label="Send"
                      className="mb-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-white transition disabled:opacity-35" style={{ background: "#15803d" }}>
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-4 w-4" strokeWidth={2.5} />}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}
