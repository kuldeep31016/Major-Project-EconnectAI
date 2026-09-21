"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, Leaf, Loader2, LogIn, ShieldCheck, UserCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const DEMO_USERS = [
  { username: "admin", label: "State Administrator", role: "Full Platform Admin", avatar: "AD", color: "from-emerald-600 to-teal-700" },
  { username: "senior", label: "Senior Conservation Officer", role: "Decisions & Strategy", avatar: "SC", color: "from-blue-600 to-indigo-700" },
  { username: "range", label: "Range Officer", role: "Field Operations", avatar: "RO", color: "from-amber-600 to-orange-700" },
  { username: "field", label: "Field Officer", role: "Ground Verification", avatar: "FO", color: "from-emerald-700 to-green-800" },
  { username: "gis", label: "GIS / Technical Officer", role: "Spatial Intelligence", avatar: "GT", color: "from-cyan-600 to-blue-700" },
  { username: "analyst", label: "Research Analyst", role: "Models & Data", avatar: "RA", color: "from-purple-600 to-indigo-700" },
];

export default function LoginPage() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeQuickUser, setActiveQuickUser] = useState<string | null>(null);

  const submit = async (u = username, p = password) => {
    if (!u.trim()) {
      setError("Please enter a username or select a demo account.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const user = await signIn(u, p || "demo1234");
      router.push(user.role === "field_officer" ? "/field" : "/command");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleQuickLogin = (u: string) => {
    setActiveQuickUser(u);
    setUsername(u);
    setPassword("demo1234");
    void submit(u, "demo1234");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#061510] via-[#0b1f18] to-[#040e0b] text-slate-100 flex flex-col justify-between selection:bg-[#00e599]/30 selection:text-white">
      {/* Top Navbar */}
      <header className="px-6 py-5 sm:px-10 flex items-center justify-between border-b border-white/[0.08]">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#00e599] to-[#0d9488] text-[#041a12] shadow-md shadow-[#00e599]/20 transition-transform duration-300 group-hover:scale-105">
            <Leaf className="h-5 w-5 fill-current" />
          </div>
          <div className="text-[20px] font-black tracking-tight text-white">
            <span>EcoConnect</span>
            <span className="text-[#00e599]">AI</span>
          </div>
        </Link>
        <Link
          href="/"
          className="text-xs font-medium text-slate-300 hover:text-[#00e599] transition-colors inline-flex items-center gap-1.5"
        >
          <span>Back to Overview</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      {/* Main Container */}
      <div className="mx-auto w-full max-w-6xl px-6 py-10 sm:py-16 grid lg:grid-cols-12 gap-10 items-center flex-1">
        {/* Left Column: Information & Demo Accounts */}
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#00e599]/30 bg-[#00e599]/10 px-3.5 py-1 text-xs font-semibold text-[#00e599]">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Conservation Decision-Support Platform</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-black tracking-tight leading-[1.12] text-white">
            Evidence-Based <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00e599] to-[#38bdf8]">
              Ecosystem Intelligence
            </span>
          </h1>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-xl">
            AI recommends. Evidence explains. GIS contextualises. Scenarios quantify. Officers decide. Field verification confirms.
          </p>

          {/* Demonstration Accounts Quick Switcher */}
          <div className="pt-2">
            <div className="flex items-center justify-between pb-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5 text-[#00e599]" />
                <span>One-Click Demonstration Roles</span>
              </div>
              <span className="text-[11px] text-slate-400">Pre-seeded accounts</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {DEMO_USERS.map((d) => {
                const isActive = activeQuickUser === d.username && busy;
                return (
                  <button
                    key={d.username}
                    onClick={() => handleQuickLogin(d.username)}
                    disabled={busy}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200",
                      isActive
                        ? "border-[#00e599] bg-[#00e599]/20 shadow-lg shadow-[#00e599]/10"
                        : "border-white/10 bg-white/[0.04] hover:border-[#00e599]/50 hover:bg-white/[0.08]"
                    )}
                  >
                    <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br text-white text-xs font-bold shadow", d.color)}>
                      {isActive ? <Loader2 className="h-4 w-4 animate-spin" /> : d.avatar}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-xs font-bold text-white group-hover:text-[#00e599] transition-colors">{d.label}</span>
                        <span className="text-[10px] font-mono text-slate-400 font-semibold">@{d.username}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">{d.role}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Sign In Form */}
        <div className="lg:col-span-5">
          <div className="relative rounded-3xl border border-white/15 bg-white/[0.05] p-7 sm:p-8 backdrop-blur-2xl shadow-2xl">
            <div className="flex items-center justify-between pb-6 border-b border-white/10">
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">Account Sign In</h2>
                <p className="text-xs text-slate-400 mt-0.5">Enter credentials or click any demo persona</p>
              </div>
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#00e599]/15 text-[#00e599] border border-[#00e599]/30">
                <KeyRound className="h-5 w-5" />
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
              className="mt-6 space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1.5">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. admin, senior, gis"
                  autoComplete="username"
                  className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-[#00e599] focus:ring-1 focus:ring-[#00e599]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Default: demo1234"
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-2.5 pr-10 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-[#00e599] focus:ring-1 focus:ring-[#00e599]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="group mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#00e599] py-3 text-sm font-extrabold text-[#02151d] shadow-lg shadow-[#00e599]/25 transition-all duration-200 hover:bg-[#00c896] hover:shadow-[#00c896]/40 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Signing in…</span>
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    <span>Sign In to Platform</span>
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#00e599]" />
                  <span>Role-based access · Audit logged</span>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="px-6 py-4 sm:px-10 border-t border-white/[0.08] text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-3">
        <div>EcoConnectAI · Autonomous Ecological Intelligence Platform</div>
        <div>Default demo password: <code className="text-[#00e599] font-mono">demo1234</code></div>
      </footer>
    </div>
  );
}
