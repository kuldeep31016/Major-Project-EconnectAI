"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell, Calendar, ChevronDown, ChevronsLeft, ChevronsRight, ClipboardList, Cpu, Database, FileText, FlaskConical, FolderKanban,
  History, LayoutDashboard, Leaf, LogOut, Map as MapIcon, MapPin, Menu, ScrollText, Search, Settings, Sprout, UploadCloud, X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { useAnalysis } from "@/hooks/use-analysis";
import { useAuth } from "@/hooks/use-auth";
import { ProvenanceBadge } from "@/components/shared/provenance-badge";
import { fetchAlerts } from "@/lib/api";
import { getHabitatMask, getScenes } from "@/lib/data";
import { requestMapFocus } from "@/lib/map-focus";
import { cn } from "@/lib/utils";

/** Navigation is role-aware: technical ML controls are hidden from field/officer roles. */
const NAV: { href: string; label: string; icon: typeof LayoutDashboard; roles?: string[]; children?: { href: string; label: string }[] }[] = [
  { href: "/command", label: "Dashboard", icon: LayoutDashboard },
  { href: "/analysis", label: "Interactive Map", icon: MapIcon },
  {
    href: "/graph", label: "Analysis Tools", icon: FlaskConical,
    children: [{ href: "/graph", label: "Connectivity graph" }, { href: "/analysis#sensitivity", label: "Sensitivity explorer" }, { href: "/simulation", label: "Timeline & change" }],
  },
  { href: "/scenario", label: "Scenarios", icon: FlaskConical },
  { href: "/restoration", label: "Restoration", icon: Sprout },
  { href: "/field", label: "Field Reports", icon: ClipboardList },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/experiments", label: "Data & Models", icon: Database, roles: ["gis_officer", "analyst", "state_admin", "senior_officer"] },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/history", label: "Analyses", icon: History, roles: ["gis_officer", "analyst", "state_admin", "senior_officer", "range_officer"] },
  { href: "/audit", label: "Audit", icon: ScrollText, roles: ["state_admin", "senior_officer"] },
  { href: "/dashboard", label: "Overview", icon: Cpu, roles: ["analyst", "gis_officer", "state_admin"] },
  { href: "/settings", label: "Settings", icon: Settings },
];

/** Sidebar + top bar chrome shared by every authenticated-feeling page. */
export function AppShell({
  children,
  title,
  subtitle,
  actions,
  /** Full-bleed pages (the map) manage their own padding and scrolling. */
  bleed = false,
  /** Hide the page-title row (the page draws its own heading). */
  hideTitle = false,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  bleed?: boolean;
  hideTitle?: boolean;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(pathname.startsWith("/graph") || pathname.startsWith("/simulation"));
  const { user, signOut } = useAuth();
  const visibleNav = NAV.filter((n) => !n.roles || !user || n.roles.includes(user.role));

  return (
    <div className="flex min-h-screen bg-[#f4f7f5]">
      {/* ---------------------------------------------------- sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-[1200] flex flex-col border-r border-black/[0.06] bg-white transition-[width] duration-300 lg:sticky lg:top-0 lg:h-screen lg:shrink-0",
          collapsed ? "w-[72px]" : "w-[232px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          "transition-transform lg:transition-[width]",
        )}
      >
        <div className="flex h-16 items-center gap-2.5 border-b border-black/[0.06] px-4">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#dcfce7] text-[#15803d]">
              <Leaf className="h-5 w-5" strokeWidth={2.2} />
            </div>
            {!collapsed && (
              <div className="min-w-0 leading-none">
                <div className="truncate text-[16px] font-bold tracking-tight text-foreground">EcoConnectAI</div>
              </div>
            )}
          </Link>
          <Button size="icon-sm" variant="ghost" onClick={() => setMobileOpen(false)} className="ml-auto lg:hidden" aria-label="Close menu"><X className="h-4 w-4" /></Button>
        </div>

        <nav className="scroll-slim flex-1 space-y-0.5 overflow-y-auto p-3">
          {visibleNav.map((item) => {
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href)) || (item.children?.some((c) => pathname.startsWith(c.href.split("#")[0])) ?? false);
            const link = (
              <div key={item.href}>
                <Link
                  href={item.href}
                  onClick={(e) => { if (item.children && !collapsed) { e.preventDefault(); setToolsOpen((o) => !o); } else setMobileOpen(false); }}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-colors",
                    active ? "text-[#0f5132]" : "text-[#334155] hover:bg-black/[0.04] hover:text-foreground",
                    collapsed && "justify-center px-0",
                  )}
                >
                  {active && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-xl bg-[#dcfce7]/80 border-l-[3px] border-[#15803d]" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
                  <item.icon className={cn("relative h-[18px] w-[18px] shrink-0", active && "text-[#15803d]")} />
                  {!collapsed && <span className="relative flex-1 truncate">{item.label}</span>}
                  {!collapsed && item.children && <ChevronDown className={cn("relative h-4 w-4 text-muted-foreground transition-transform", toolsOpen && "rotate-180")} />}
                </Link>
                {!collapsed && item.children && toolsOpen && (
                  <div className="ml-9 mt-0.5 space-y-0.5">
                    {item.children.map((c) => (
                      <Link key={c.href} href={c.href} onClick={() => setMobileOpen(false)} className={cn("block rounded-lg px-2 py-1.5 text-[12px] text-[#475569] hover:bg-black/[0.04]", pathname === c.href.split("#")[0] && "font-semibold text-[#0f5132]")}>{c.label}</Link>
                    ))}
                  </div>
                )}
              </div>
            );
            return collapsed ? <Tooltip key={item.href} content={item.label} side="right">{link}</Tooltip> : link;
          })}

          <div className="!mt-3 px-1"><div className="h-px bg-black/[0.06]" /></div>
          <Link href="/upload" onClick={() => setMobileOpen(false)} className={cn("mt-2 flex items-center gap-3 rounded-xl border border-dashed border-[#15803d]/35 px-3 py-2.5 text-[13px] font-medium text-[#15803d] transition-colors hover:bg-[#15803d]/10", collapsed && "justify-center px-0")}>
            <UploadCloud className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span className="truncate">New Analysis</span>}
          </Link>
        </nav>

        <div className="border-t border-black/[0.06] p-3">
          {!collapsed && (
            <div className="rounded-2xl bg-gradient-to-br from-[#16a34a] to-[#0f5132] p-4 text-white">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-white/20"><Leaf className="h-4 w-4" /></div>
              <div className="mt-3 text-[14px] font-semibold leading-tight">Healthier Coasts<br />Stronger Communities</div>
              <div className="mt-1 text-[11px] text-white/80">Data-driven conservation for a sustainable future.</div>
            </div>
          )}
          <button onClick={() => setCollapsed((v) => !v)} className={cn("mt-2 hidden w-full items-center gap-2 rounded-lg px-3 py-2 text-[11px] text-muted-foreground transition-colors hover:bg-black/[0.04] hover:text-foreground lg:flex", collapsed && "justify-center px-0")}>
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /> Collapse</>}
          </button>
        </div>
      </aside>

      <AnimatePresence>
        {mobileOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} className="fixed inset-0 z-[1100] bg-black/50 lg:hidden" />}
      </AnimatePresence>

      {/* ------------------------------------------------------- main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[1150] flex h-16 items-center gap-3 border-b border-black/[0.06] bg-white px-4 sm:px-5">
          <Button size="icon-sm" variant="ghost" onClick={() => setMobileOpen(true)} className="lg:hidden" aria-label="Open menu"><Menu className="h-4.5 w-4.5" /></Button>
          <GlobalSearch />
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <SceneSelect />
            <PeriodSelect />
            <ProvenanceBadge compact />
            <AlertsBell />
            <UserChip user={user} signOut={signOut} />
          </div>
        </header>

        {!hideTitle && (
          <div className="flex flex-wrap items-center gap-3 border-b border-black/[0.06] bg-white/60 px-4 py-3 sm:px-6">
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[18px] font-semibold tracking-tight">{title}</h1>
              {subtitle && <p className="truncate text-[12px] text-muted-foreground">{subtitle}</p>}
            </div>
            {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
          </div>
        )}
        {hideTitle && actions && <div className="sr-only">{actions}</div>}

        <main className={cn("min-w-0 flex-1", !bleed && "p-4 sm:p-6")}>{children}</main>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.06] bg-white px-4 py-2.5 text-[11px] text-muted-foreground sm:px-6">
          <div><span className="font-semibold text-foreground">EcoConnectAI</span> · Ecological Intelligence & Decision-Support · every figure carries its provenance label</div>
          <div className="flex items-center gap-4"><Link href="/#about">About</Link><Link href="/reports">Documentation</Link><Link href="/settings">Help</Link><span className="rounded-full bg-[#dcfce7] px-3 py-1 text-[10.5px] font-medium text-[#0f5132]">Made for People, Nature and Future Generations</span></div>
        </footer>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* header widgets                                                      */
/* ------------------------------------------------------------------ */

/** Search patches of the current landscape, study areas, or "lat, lon" — the map flies to the match. */
function GlobalSearch() {
  const { sceneId, setSceneId, setSelectedPatchId } = useAnalysis();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const scenes = getScenes();
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [] as { key: string; label: string; hint: string; run: () => void }[];
    const out: { key: string; label: string; hint: string; run: () => void }[] = [];
    const coord = t.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (coord) out.push({ key: "coord", label: `Go to ${coord[1]}, ${coord[2]}`, hint: "coordinates (lat, lon)", run: () => requestMapFocus(Number(coord[1]), Number(coord[2]), 14) });
    scenes.filter((s) => `${s.name} ${s.region} ${s.state}`.toLowerCase().includes(t)).forEach((s) => out.push({ key: s.id, label: s.region, hint: `${s.state} · study area`, run: () => { setSceneId(s.id); router.push("/command"); } }));
    getHabitatMask(sceneId).patches.filter((p) => `${p.id} ${p.name}`.toLowerCase().includes(t)).slice(0, 6).forEach((p) => out.push({ key: p.id, label: `${p.id} · ${p.name}`, hint: `${p.areaHa} ha · patch`, run: () => { setSelectedPatchId(p.id); requestMapFocus(p.center[0], p.center[1], 14); } }));
    return out.slice(0, 8);
  }, [q, sceneId, scenes, setSceneId, setSelectedPatchId, router]);
  return (
    <div className="relative hidden w-full max-w-[460px] md:block">
      <div className="flex h-10 items-center gap-2 rounded-full border border-black/[0.08] bg-[#f4f7f5] px-4">
        <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => { if (e.key === "Enter" && results[0]) { results[0].run(); setOpen(false); } }}
          placeholder="Search location, patch, or coordinates…" className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground" />
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-xl border border-black/[0.08] bg-white shadow-xl">
          {results.map((r) => (
            <button key={r.key} onMouseDown={() => { r.run(); setOpen(false); setQ(""); }} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[#f4f7f5]">
              <MapPin className="h-3.5 w-3.5 text-[#15803d]" /><span className="text-[13px]">{r.label}</span><span className="ml-auto text-[11px] text-muted-foreground">{r.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SceneSelect() {
  const { sceneId, setSceneId } = useAnalysis();
  const scenes = getScenes();
  return (
    <label className="hidden h-10 items-center gap-2 rounded-lg border border-black/[0.08] bg-white px-3 text-[13px] sm:flex">
      <MapPin className="h-4 w-4 text-[#15803d]" />
      <select aria-label="Study area" value={sceneId} onChange={(e) => setSceneId(e.target.value)} className="max-w-[150px] bg-transparent font-medium outline-none">
        {scenes.map((s) => <option key={s.id} value={s.id}>{s.state}</option>)}
      </select>
    </label>
  );
}

/** Observation period = the pipeline run being displayed (one run per scene year). */
function PeriodSelect() {
  const { runs, runId, setRunId, apiOnline } = useAnalysis();
  const label = (r: (typeof runs)[number]) => `${r.sceneYear ?? "—"}${r.resultKind === "development" ? " · dev" : r.resultKind === "synthetic" ? " · synthetic" : ""} · ${r.runId}`;
  if (apiOnline !== true || runs.length === 0) return null;
  const latest = runs[0];
  return (
    <label className="hidden h-10 items-center gap-2 rounded-lg border border-black/[0.08] bg-white px-3 text-[13px] lg:flex">
      <Calendar className="h-4 w-4 text-[#15803d]" />
      <select aria-label="Observation period / run" value={runId} onChange={(e) => setRunId(e.target.value)} className="max-w-[210px] truncate bg-transparent font-medium outline-none">
        <option value="latest">{latest?.sceneYear ? `${latest.sceneYear} (latest run)` : "latest run"}</option>
        {runs.map((r) => <option key={r.runId} value={r.runId}>{label(r)}</option>)}
      </select>
    </label>
  );
}

function AlertsBell() {
  const { apiOnline } = useAnalysis();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (apiOnline !== true) return;
    let cancelled = false;
    fetchAlerts(undefined, "OPEN").then((a) => { if (!cancelled) setN(a.length); }).catch(() => {});
    return () => { cancelled = true; };
  }, [apiOnline]);
  return (
    <Link href="/alerts" aria-label={`${n} open alerts`} className="relative grid h-10 w-10 place-items-center rounded-lg border border-black/[0.08] bg-white hover:bg-[#f4f7f5]">
      <Bell className="h-4.5 w-4.5 text-[#334155]" />
      {n > 0 && <span className="absolute -right-1 -top-1 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-[#dc2626] px-1 text-[10px] font-bold text-white">{n}</span>}
    </Link>
  );
}

function UserChip({ user, signOut }: { user: ReturnType<typeof useAuth>["user"]; signOut: () => void }) {
  const [open, setOpen] = useState(false);
  if (!user) return <Link href="/login" className="h-10 rounded-lg bg-[#0f5132] px-4 text-[13px] font-semibold leading-10 text-white hover:bg-[#0b3d26]">Sign in</Link>;
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex h-10 items-center gap-2 rounded-lg px-1.5 hover:bg-[#f4f7f5]">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-[#0f5132] text-[13px] font-bold text-white">{user.fullName.charAt(0)}</span>
        <span className="hidden text-left leading-tight md:block"><span className="block text-[13px] font-semibold">{user.fullName.split(" ")[0]}</span><span className="block text-[10.5px] text-muted-foreground">{user.roleLabel}</span></span>
        <ChevronDown className="hidden h-4 w-4 text-muted-foreground md:block" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-xl border border-black/[0.08] bg-white shadow-xl">
            <div className="border-b border-black/[0.06] px-3 py-2"><div className="text-[13px] font-semibold">{user.fullName}</div><div className="text-[11px] text-muted-foreground">{user.roleLabel} · @{user.username}</div></div>
            <Link href="/settings" onClick={() => setOpen(false)} className="block px-3 py-2 text-[13px] hover:bg-[#f4f7f5]">Settings & capabilities</Link>
            <button onClick={() => { setOpen(false); signOut(); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-[#b91c1c] hover:bg-[#f4f7f5]"><LogOut className="h-3.5 w-3.5" /> Sign out</button>
          </div>
        </>
      )}
    </div>
  );
}
