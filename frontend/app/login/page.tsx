"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Leaf, LogIn } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const DEMO = [
  ["admin", "State Administrator"], ["senior", "Senior Conservation Officer"], ["range", "Range Officer"],
  ["field", "Field Officer"], ["gis", "GIS / Technical Officer"], ["analyst", "Research Analyst"],
];

export default function LoginPage() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (u = username, p = password) => {
    setBusy(true);
    setError(null);
    try {
      const user = await signIn(u, p);
      router.push(user.role === "field_officer" ? "/field" : "/command");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f6f4] text-[#0b1120]">
      <div className="mx-auto grid min-h-screen max-w-5xl items-center gap-10 px-6 py-10 lg:grid-cols-2">
        <div>
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#0f5132] text-white"><Leaf className="h-5 w-5" /></span>
            <span className="text-[20px] font-bold tracking-tight">EcoConnectAI</span>
          </Link>
          <h1 className="mt-8 text-[30px] font-bold leading-tight tracking-tight">Coastal Ecosystem Intelligence and Decision-Support Platform</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[#475569]">
            AI recommends. Evidence explains. GIS contextualises. Scenarios quantify. Officers decide. Field verification confirms.
          </p>
          <div className="mt-6 rounded-xl border border-[#0f5132]/20 bg-white p-4 text-[12.5px] text-[#334155]">
            <div className="font-semibold text-[#0f5132]">Demonstration accounts</div>
            <div className="mt-1">Password for all demo accounts: the value of <code>ECO_DEMO_PASSWORD</code> (default <code>demo1234</code>). These are demo users seeded by the backend, not real personnel.</div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {DEMO.map(([u, l]) => (
                <button key={u} onClick={() => { setUsername(u); setPassword("demo1234"); void submit(u, "demo1234"); }} className="rounded-lg border border-black/10 px-2.5 py-1.5 text-left hover:border-[#0f5132]/50 hover:bg-[#f0fdf4]">
                  <div className="font-semibold">{u}</div>
                  <div className="text-[11px] text-[#64748b]">{l}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="rounded-2xl border border-black/[0.08] bg-white p-6 shadow-sm">
          <div className="text-[16px] font-semibold">Sign in</div>
          <label className="mt-4 block text-[12px] font-medium text-[#334155]">Username
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-[14px] outline-none focus:border-[#0f5132]" />
          </label>
          <label className="mt-3 block text-[12px] font-medium text-[#334155]">Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 text-[14px] outline-none focus:border-[#0f5132]" />
          </label>
          {error && <div className="mt-3 rounded-lg bg-[#fef2f2] px-3 py-2 text-[12px] text-[#b91c1c]">{error}</div>}
          <button disabled={busy} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0f5132] px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-[#0b3d26] disabled:opacity-60">
            <LogIn className="h-4 w-4" /> {busy ? "Signing in…" : "Sign in"}
          </button>
          <p className="mt-4 text-[11px] text-[#64748b]">Sessions use signed tokens; every action is written to the audit log with your username and role.</p>
        </form>
      </div>
    </div>
  );
}
