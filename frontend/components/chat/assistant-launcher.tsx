"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUp,
  Bot,
  ChevronDown,
  Loader2,
  Quote,
  Sparkles,
  User,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ASSISTANT, matchAssistantReply } from "@/lib/data";
import { EASE } from "@/components/shared/motion";
import { cn } from "@/lib/utils";
import type { AssistantReply } from "@/types";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  reply?: AssistantReply;
}

const TONE: Record<string, string> = {
  eco: "text-[#00c896] bg-[#00c896]/10 border-[#00c896]/20",
  sky: "text-[#38bdf8] bg-[#38bdf8]/10 border-[#38bdf8]/20",
  warn: "text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/20",
  danger: "text-[#ef4444] bg-[#ef4444]/10 border-[#ef4444]/20",
};

let seq = 0;
const nextId = () => `m${++seq}`;

export function AssistantLauncher() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: "greeting", role: "assistant", text: ASSISTANT.greeting },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the newest message in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 260);
  }, [open]);

  // ⌘K / Ctrl+K toggles the panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text || thinking) return;

    setMessages((m) => [...m, { id: nextId(), role: "user", text }]);
    setInput("");
    setThinking(true);

    // Small deliberate latency — an instant reply reads as a lookup, not analysis.
    const reply = matchAssistantReply(text);
    const delay = 700 + Math.min(1100, text.length * 18);
    window.setTimeout(() => {
      setThinking(false);
      setMessages((m) => [
        ...m,
        {
          id: nextId(),
          role: "assistant",
          text: reply?.answer ?? ASSISTANT.fallback,
          reply: reply ?? undefined,
        },
      ]);
    }, delay);
  };

  // The assistant is contextual to an analysis — hide it on the landing page.
  if (pathname === "/") return null;

  const lastReply = [...messages].reverse().find((m) => m.reply)?.reply;
  const chips = lastReply?.followUps?.length ? lastReply.followUps : ASSISTANT.suggestions;

  return (
    <>
      {/* launcher */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 12 }}
            transition={{ duration: 0.28, ease: EASE }}
            onClick={() => setOpen(true)}
            className="group fixed bottom-5 right-5 z-[60] flex items-center gap-2.5 rounded-2xl bg-gradient-eco py-3 pl-3.5 pr-4 font-semibold text-[#04231b] shadow-2xl shadow-[#00c896]/25 transition-transform hover:scale-[1.03] sm:bottom-6 sm:right-6"
            aria-label="Open EcoConnect assistant"
          >
            <span className="relative grid h-6 w-6 place-items-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-[#04231b]/20" />
              <Sparkles className="relative h-[18px] w-[18px]" strokeWidth={2.4} />
            </span>
            <span className="text-[13px]">Ask AI</span>
            <kbd className="hidden rounded bg-[#04231b]/15 px-1.5 py-0.5 text-[10px] font-bold sm:inline">
              ⌘K
            </kbd>
          </motion.button>
        )}
      </AnimatePresence>

      {/* panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ duration: 0.32, ease: EASE }}
            className="fixed inset-x-3 bottom-3 z-[60] flex h-[min(640px,82vh)] flex-col overflow-hidden rounded-3xl glass-solid shadow-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[420px]"
          >
            {/* header */}
            <div className="flex items-center justify-between gap-3 border-b border-foreground/[0.08] bg-sidebar px-4 py-3.5">
              <div className="flex items-center gap-2.5">
                <div className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-eco">
                  <Bot className="h-[18px] w-[18px] text-[#04231b]" strokeWidth={2.2} />
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0b1120] bg-[#22c55e]" />
                </div>
                <div className="leading-tight">
                  <div className="text-[13px] font-semibold">EcoConnect Assistant</div>
                  <div className="text-[10px] text-muted-foreground">
                    Analysis context loaded
                  </div>
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setOpen(false)}
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                aria-label="Close assistant"
              >
                <ChevronDown className="h-4 w-4 sm:hidden" />
                <X className="hidden h-4 w-4 sm:block" />
              </Button>
            </div>

            {/* messages */}
            <div ref={scrollRef} className="scroll-slim flex-1 overflow-y-auto px-4 py-4">
              <div className="space-y-4">
                {messages.map((m) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className={cn("flex gap-2.5", m.role === "user" && "flex-row-reverse")}
                  >
                    <div
                      className={cn(
                        "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg",
                        m.role === "user"
                          ? "bg-foreground/[0.08] text-muted-foreground"
                          : "bg-[#00c896]/15 text-[#00c896]",
                      )}
                    >
                      {m.role === "user" ? (
                        <User className="h-3.5 w-3.5" />
                      ) : (
                        <Bot className="h-3.5 w-3.5" />
                      )}
                    </div>

                    <div className={cn("min-w-0 max-w-[85%]", m.role === "user" && "text-right")}>
                      <div
                        className={cn(
                          "inline-block rounded-2xl px-3.5 py-2.5 text-left text-[13px] leading-relaxed",
                          m.role === "user"
                            ? "bg-[#38bdf8]/12 text-foreground"
                            : "bg-foreground/[0.05] text-foreground/90",
                        )}
                      >
                        {m.text}
                      </div>

                      {/* metric chips */}
                      {m.reply?.metrics && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {m.reply.metrics.map((mt) => (
                            <div
                              key={mt.label}
                              className={cn(
                                "rounded-lg border px-2 py-1 text-left",
                                TONE[mt.tone ?? "eco"],
                              )}
                            >
                              <div className="text-[9px] uppercase tracking-wider opacity-70">
                                {mt.label}
                              </div>
                              <div className="text-[12px] font-bold tabular">{mt.value}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* citations */}
                      {m.reply?.citations && (
                        <div className="mt-2 space-y-1">
                          {m.reply.citations.map((c) => (
                            <div
                              key={c}
                              className="flex items-start gap-1.5 text-[10px] leading-snug text-muted-foreground"
                            >
                              <Quote className="mt-0.5 h-2.5 w-2.5 shrink-0" />
                              <span>{c}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}

                {thinking && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex gap-2.5"
                  >
                    <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#00c896]/15 text-[#00c896]">
                      <Bot className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex items-center gap-2 rounded-2xl bg-foreground/[0.05] px-3.5 py-2.5 text-[12px] text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#00c896]" />
                      Querying connectivity model…
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            {/* suggestion chips */}
            <div className="border-t border-foreground/[0.08] px-4 pt-3">
              <div className="scroll-slim flex gap-2 overflow-x-auto pb-2.5">
                {chips.slice(0, 4).map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    disabled={thinking}
                    className="shrink-0 rounded-full border border-foreground/10 bg-foreground/[0.05] px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:border-[#00c896]/30 hover:text-foreground disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-center gap-2 px-4 pb-4"
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about corridors, scenarios, restoration…"
                className="h-10 flex-1 rounded-xl border border-foreground/10 bg-foreground/[0.05] px-3.5 text-[13px] outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-[#00c896]/40"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || thinking}
                className="h-10 w-10 shrink-0 rounded-xl bg-gradient-eco text-[#04231b] hover:opacity-90 disabled:opacity-40"
                aria-label="Send message"
              >
                <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
