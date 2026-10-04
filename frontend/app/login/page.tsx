"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, BarChart3, ChevronDown, Database, Eye, EyeOff, Layers, Leaf, LineChart, Loader2, Lock, Map,
  ShieldCheck, User, Users,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { setRememberSession } from "@/lib/api";
import { cn } from "@/lib/utils";

// Public demo accounts only; a real deployment sets its own password (backend ECO_DEMO_PASSWORD).
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? "demo1234";

const DEMO_USERS = [
  { username: "admin", label: "State Administrator", short: "Administrator", scope: "Users, audit, system health, all workflows", icon: Users },
  { username: "senior", label: "Senior Conservation Officer", short: "Senior Officer", scope: "Decisions, verification, reports", icon: ShieldCheck },
  { username: "range", label: "Range Officer", short: "Range Officer", scope: "Field operations and task assignment", icon: Map },
  { username: "field", label: "Field Officer", short: "Field Officer", scope: "Assigned verification tasks and evidence", icon: Leaf },
  { username: "gis", label: "GIS / Technical Officer", short: "GIS Officer", scope: "Analysis runs, scenarios, restoration review", icon: Database },
  { username: "analyst", label: "Research Analyst", short: "Research Analyst", scope: "Models, experiments, reproducibility", icon: LineChart },
];

const FEATURES = [
  { icon: Layers, title: "Traceable", text: "Every result links to its satellite data, model, parameters and a reproducible run." },
  { icon: BarChart3, title: "Simulations", text: "What-if and restoration outputs are simulations of the modelled network, not forecasts." },
  { icon: Users, title: "People decide", text: "Model recommendations are reviewed, field-verified and decided by officers — every step audited." },
];

/** Turn API errors ("401: invalid username or password") into sentences for the form. */
function friendly(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.startsWith("429")) return "Too many failed attempts. Please wait a few minutes and try again.";
  if (msg.startsWith("401")) return "The username or password is incorrect.";
  if (/abort|fetch|network/i.test(msg)) return "The server could not be reached. It may be starting up — try again in a moment.";
  return msg.replace(/^\d{3}:\s*/, "");
}

function Brand({ size = "md" }: { size?: "md" | "sm" }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className={cn("grid place-items-center rounded-xl bg-gradient-to-br from-[#22c55e] to-[#15803d] text-white shadow-lg shadow-[#15803d]/30",
        size === "md" ? "h-11 w-11" : "h-9 w-9")}>
        <Leaf className={size === "md" ? "h-5 w-5" : "h-4 w-4"} />
      </span>
      <span className={cn("font-medium tracking-tight text-white", size === "md" ? "text-[21px]" : "text-[17px]")}>
        EcoConnect<span className="text-[#4ade80]">AI</span>
      </span>
    </span>
  );
}

/** Dashed contour lines drawn over the imagery (decorative; not data). */
function Contours() {
  return (
    <svg aria-hidden viewBox="0 0 400 1000" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
      {[0, 22, 44, 70].map((o, i) => (
        <path key={o} fill="none" stroke="#bbf7d0" strokeOpacity={0.55 - i * 0.1} strokeWidth={1.2} strokeDasharray="3 6"
          d={`M ${40 + o} 0 C ${140 + o} 160, ${10 + o} 330, ${120 + o} 470 S ${260 + o} 720, ${150 + o} 1000`} />
      ))}
      {[0, 30].map((o) => (
        <path key={`r${o}`} fill="none" stroke="#bbf7d0" strokeOpacity={0.3} strokeWidth={1} strokeDasharray="2 7"
          d={`M ${330 - o} 0 C ${260 - o} 220, ${380 - o} 420, ${300 - o} 640 S ${360 - o} 880, ${320 - o} 1000`} />
      ))}
    </svg>
  );
}

export default function LoginPage() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeQuickUser, setActiveQuickUser] = useState<string | null>(null);

  const submit = async (u = username, p = password) => {
    if (!u.trim()) {
      setError("Enter your username, or choose a demonstration account below.");
      return;
    }
    if (!p) {
      setError("Enter your password.");
      return;
    }
    setBusy(true);
    setError(null);
    setRememberSession(remember);
    try {
      const user = await signIn(u.trim(), p);
      router.push(user.role === "field_officer" ? "/field" : "/command");
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
      setActiveQuickUser(null);
    }
  };

  const handleQuickLogin = (u: string) => {
    setActiveQuickUser(u);
    setUsername(u);
    setPassword(DEMO_PASSWORD);
    void submit(u, DEMO_PASSWORD);
  };

  // Sizes scale with the window height so the whole page fits one viewport on laptops (≈600 px tall) up to 1080p.
  // `short:` (below 1000 px of height) switches the demo list to a compact two-column grid.
  const field = "h-[clamp(40px,5.4vh,48px)] w-full rounded-xl border border-white/[0.12] bg-[#07170f]/80 pl-11 pr-3 text-[15px] text-white outline-none transition-colors placeholder:text-[#6f8a7c] focus:border-[#4ade80]/70 focus:ring-2 focus:ring-[#4ade80]/15";

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#04130d] text-white lg:grid lg:h-dvh lg:min-h-[560px] lg:grid-cols-[minmax(0,55fr)_minmax(0,45fr)]">
      {/* ================================================= left: story + imagery (desktop) */}
      <section className="relative hidden overflow-hidden lg:block">
        {/* real satellite imagery of the Vembanad–Kol study area, graded to the brand palette */}
        <div className="absolute inset-y-0 right-0 w-[44%]">
          <div className="absolute inset-0 bg-[length:auto_135%] bg-[position:52%_58%] saturate-[2] contrast-[1.2] brightness-[1.15]"
            style={{ backgroundImage: "url(/hero-vembanad.jpg)" }} />
          <div className="absolute inset-0 bg-[#10b981] mix-blend-color opacity-30" />
          <div className="absolute inset-0 bg-[#065f46] mix-blend-multiply opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#04130d] via-[#04130d]/10 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#04130d]/70 via-transparent to-[#04130d]/40" />
          <Contours />
          <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-[#4ade80]/50 to-transparent" />
          <p className="absolute right-4 top-3 whitespace-nowrap text-[10px] text-emerald-50/50">Vembanad–Kol, Kerala · imagery © Esri</p>
        </div>

        <div className="relative flex h-full w-[90%] flex-col justify-between px-[clamp(28px,3.6vw,56px)] py-[clamp(18px,3.6vh,44px)]">
          <Link href="/" className="w-fit rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#4ade80]">
            <Brand />
          </Link>

          <div className="py-[clamp(8px,2vh,24px)]">
            <div className="flex items-center gap-3 whitespace-nowrap text-[11px] font-medium tracking-[0.28em] text-[#4ade80]">
              ENVIRONMENTAL INTELLIGENCE PLATFORM <span className="h-px w-6 bg-[#4ade80]/70" />
            </div>
            <h1 className="mt-[clamp(10px,2.4vh,26px)] text-[clamp(34px,5.6vh,58px)] font-black leading-[1.05] tracking-tight text-white">
              Coastal habitat connectivity,<br /><span className="text-[#86efac]">made actionable.</span>
            </h1>
            <p className="mt-[clamp(10px,2.2vh,24px)] max-w-[640px] text-[clamp(14px,1.9vh,17px)] leading-relaxed text-emerald-50/80">
              From Sentinel satellite imagery to mapped mangrove patches, their connectivity network, and evidence for
              the decisions that protect it.
            </p>
            <div className="mt-[clamp(12px,3vh,36px)] max-w-[680px] space-y-[clamp(8px,1.4vh,14px)]">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <div key={title} className="flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 py-[clamp(8px,1.5vh,16px)] backdrop-blur-sm">
                  <span className="grid h-[clamp(38px,5.4vh,54px)] w-[clamp(38px,5.4vh,54px)] shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#14532d] to-[#0b3b24] text-[#86efac]">
                    <Icon className="h-[55%] w-[55%]" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[clamp(14px,1.9vh,17px)] font-medium">{title}</span>
                    <span className="mt-0.5 block text-[clamp(12.5px,1.65vh,14.5px)] leading-snug text-emerald-50/70">{text}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 text-[11px] tracking-[0.35em] text-emerald-50/60">
            <span className="grid h-10 w-10 place-items-center rounded-full border border-white/15 text-[#86efac]"><Leaf className="h-4 w-4" /></span>
            SCIENCE <span className="text-[#4ade80]">×</span> CONSERVATION <span className="text-[#4ade80]">×</span> IMPACT
          </div>
        </div>
      </section>

      {/* ================================================= right: sign-in card */}
      <section className="relative flex min-h-dvh flex-col px-5 py-4 sm:px-8 lg:min-h-0 lg:py-[clamp(12px,2.4vh,28px)]">
        <div aria-hidden className="pointer-events-none absolute right-[-10%] top-[20%] h-[480px] w-[480px] rounded-full bg-[#15803d]/15 blur-[120px]" />
        <div className="relative flex justify-end lg:absolute lg:right-6 lg:top-[clamp(12px,2.4vh,28px)] lg:z-10">
          <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#04130d]/60 px-4 py-2 text-[13px] text-emerald-50/85 backdrop-blur transition-colors hover:border-white/30 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4ade80]">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to overview
          </Link>
        </div>

        <div className="relative flex flex-1 items-center justify-center py-4 lg:py-0 lg:pt-[clamp(40px,6vh,64px)]">
          <div className="w-full max-w-[500px] rounded-[26px] border border-white/[0.09] bg-gradient-to-b from-[#0c2419]/95 to-[#06170f]/95 px-6 py-[clamp(16px,3vh,32px)] shadow-2xl shadow-black/40 sm:px-9">
            <div className="[@media(max-height:700px)]:hidden"><Brand size="sm" /></div>
            <h2 className="mt-[clamp(0px,2vh,20px)] text-[clamp(26px,4vh,36px)] font-black leading-none tracking-tight [@media(max-height:700px)]:mt-0">Welcome back</h2>
            <p className="mt-2 text-[14.5px] text-emerald-50/75 [@media(max-height:700px)]:hidden">Sign in to continue to your workspace.</p>

            <form className="mt-[clamp(12px,2.4vh,24px)] space-y-[clamp(8px,1.5vh,14px)]" noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }}>
              <div>
                <label htmlFor="username" className="text-[13.5px] font-medium">Username</label>
                <div className="relative mt-1.5">
                  <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8fa89b]" />
                  <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="e.g. analyst"
                    aria-invalid={!!error} aria-describedby={error ? "login-error" : undefined} className={field} />
                </div>
              </div>
              <div>
                <div className="flex items-baseline justify-between">
                  <label htmlFor="password" className="text-[13.5px] font-medium">Password</label>
                  <button type="button" onClick={() => setForgotOpen((o) => !o)} aria-expanded={forgotOpen} aria-controls="forgot-note"
                    className="rounded text-[13px] text-[#4ade80] hover:text-[#86efac] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4ade80]">
                    Forgot password?
                  </button>
                </div>
                <div className="relative mt-1.5">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8fa89b]" />
                  <input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password" placeholder="Enter your password"
                    aria-invalid={!!error} aria-describedby={error ? "login-error" : undefined} className={cn(field, "pr-12")} />
                  <button type="button" onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-xl text-[#9fb6aa] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4ade80]">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {forgotOpen && (
                  <p id="forgot-note" className="mt-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-[12.5px] leading-relaxed text-emerald-50/80">
                    Accounts are issued and managed by your State Administrator — ask them to reset your password.
                    Demonstration accounts use <code className="font-mono text-[#86efac]">{DEMO_PASSWORD}</code>.
                  </p>
                )}
              </div>

              <label className="flex w-fit cursor-pointer items-center gap-2.5 text-[14px] text-emerald-50/85">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 cursor-pointer rounded accent-[#22c55e]" />
                Remember me
              </label>

              {error && (
                <p id="login-error" role="alert" className="rounded-xl border border-[#f87171]/30 bg-[#7f1d1d]/30 px-3.5 py-2 text-[13px] text-[#fecaca]">
                  {error}
                </p>
              )}

              <button type="submit" disabled={busy}
                className="flex h-[clamp(40px,5.4vh,48px)] w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#22c55e] to-[#4ade80] text-[16px] font-medium text-[#052e16] shadow-lg shadow-[#22c55e]/25 transition-[filter,transform] hover:brightness-105 active:scale-[0.99] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4ade80]">
                {busy && !activeQuickUser ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</> : <>Sign in <ArrowRight className="h-4 w-4" /></>}
              </button>
            </form>

            <div className="my-[clamp(8px,1.8vh,18px)] flex items-center gap-3 text-[12px] text-emerald-50/55">
              <span className="h-px flex-1 bg-white/10" /> or use a demonstration account <span className="h-px flex-1 bg-white/10" />
            </div>

            <div className="rounded-2xl border border-white/[0.09] bg-white/[0.02]">
              <button type="button" onClick={() => setDemoOpen((o) => !o)} aria-expanded={demoOpen} aria-controls="demo-list"
                className="flex w-full items-center gap-3 rounded-2xl px-4 py-[clamp(7px,1.3vh,12px)] text-left text-[14px] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4ade80]">
                <Layers className="h-4 w-4 text-[#86efac]" /> Demonstration accounts
                <ChevronDown className={cn("ml-auto h-4 w-4 text-emerald-50/70 transition-transform", demoOpen && "rotate-180")} />
              </button>
              {demoOpen && (
                <ul id="demo-list" className="divide-y divide-white/[0.07] border-t border-white/[0.07] px-2 pb-1 sm:short:grid sm:short:grid-cols-2 sm:short:gap-x-1 sm:short:divide-y-0">
                  {DEMO_USERS.map(({ username: u, label, short, scope, icon: Icon }) => {
                    const loading = busy && activeQuickUser === u;
                    return (
                      <li key={u}>
                        <button type="button" disabled={busy} onClick={() => handleQuickLogin(u)}
                          className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-[clamp(4px,0.85vh,9px)] text-left transition-colors hover:bg-white/[0.05] focus-visible:bg-white/[0.06] focus-visible:outline-none disabled:cursor-wait">
                          <Icon className="h-[18px] w-[18px] shrink-0 text-emerald-50/75" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13.5px] font-medium short:hidden">{label}</span>
                            <span className="hidden truncate text-[13px] font-medium short:block">{short}</span>
                            <span className="hidden font-mono text-[11px] text-emerald-50/60 short:block">{u}</span>
                            <span className="block truncate text-[12px] text-emerald-50/60 short:hidden">{scope}</span>
                          </span>
                          <code className="shrink-0 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-0.5 font-mono text-[11.5px] text-emerald-50/85 short:hidden">{u}</code>
                          {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#4ade80]" />
                            : <ArrowRight className="h-4 w-4 shrink-0 text-emerald-50/60 transition-transform group-hover:translate-x-0.5 group-hover:text-[#4ade80] short:hidden" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <p className="mt-[clamp(6px,1.2vh,12px)] text-center text-[11px] text-emerald-50/45">
              Demo password <code className="font-mono text-emerald-50/75">{DEMO_PASSWORD}</code> · all actions audited · not field-validated
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
