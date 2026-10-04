"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  Bell, Calendar, ChevronDown, ChevronsLeft, ChevronsRight, ClipboardList, Cpu, Database, FileText, FlaskConical, FolderKanban,
  History, Info, LayoutDashboard, Leaf, LogOut, Map as MapIcon, MapPin, Menu, Satellite, ScrollText, Search, Settings, Sprout, UploadCloud, X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { SelectMenu } from "@/components/ui/select-menu";
import { useAnalysis } from "@/hooks/use-analysis";
import { useAuth } from "@/hooks/use-auth";
import { ProvenanceBadge } from "@/components/shared/provenance-badge";
import { fetchAlerts } from "@/lib/api";
import { getHabitatMask, getScenes } from "@/lib/data";
import { requestMapFocus } from "@/lib/map-focus";
import { plainPurpose } from "@/lib/plain-language";
import { cn } from "@/lib/utils";

/** Navigation is role-aware: technical ML controls are hidden from field/officer roles. */
const NAV: { href: string; label: string; icon: typeof LayoutDashboard; roles?: string[]; children?: { href: string; label: string }[] }[] = [
  { href: "/command", label: "Dashboard", icon: LayoutDashboard },
  { href: "/analysis", label: "Interactive Map", icon: MapIcon },
  { href: "/satellite", label: "Satellite Monitor", icon: Satellite },
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
  { href: "/system", label: "System health", icon: Activity, roles: ["state_admin", "senior_officer"] },
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
  const purpose = plainPurpose(pathname);

  return (
    <div className="relative flex min-h-screen bg-[#eef5f0]">
      {/* soft green backdrop: mint washes + a faint mangrove canopy fading in at the bottom */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_85%_-10%,rgba(134,239,172,0.28),transparent_60%),radial-gradient(900px_500px_at_10%_110%,rgba(45,212,191,0.14),transparent_60%)]" />
        <div className="absolute inset-x-0 bottom-0 h-[45vh] bg-cover bg-bottom opacity-[0.10] [mask-image:linear-gradient(to_top,black,transparent)]"
          style={{ backgroundImage: "url(/images/coastal-mangrove-hero.jpg)" }} />
      </div>
      {/* ---------------------------------------------------- sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-[1200] flex flex-col overflow-hidden bg-[#062a1b] text-white shadow-[4px_0_24px_-12px_rgba(0,0,0,0.45)] transition-[width] duration-300 lg:sticky lg:top-0 lg:h-screen lg:shrink-0",
          collapsed ? "w-[72px]" : "w-[232px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          "transition-transform lg:transition-[width]",
        )}
      >
        {/* leafy canopy texture under a deep green wash */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-cover bg-center opacity-40 saturate-[1.4]" style={{ backgroundImage: "url(/images/coastal-mangrove-hero.jpg)" }} />
          <div className="absolute inset-0 bg-gradient-to-b from-[#042016]/95 via-[#063322]/90 to-[#04261a]/95" />
          <div className="absolute -left-16 top-1/3 h-64 w-64 rounded-full bg-[#22c55e]/15 blur-3xl" />
        </div>
        <div className="relative flex h-[68px] items-center gap-2.5 border-b border-white/10 px-4">
          <Link href={user ? "/command" : "/"} title={user ? "Dashboard" : "Home"} className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#22c55e] to-[#0f5132] text-white shadow-[0_0_18px_rgba(34,197,94,0.45)] ring-1 ring-white/20">
              <Leaf className="h-5 w-5 fill-white/20" strokeWidth={2.2} />
            </div>
            {!collapsed && (
              <div className="min-w-0 leading-tight">
                <div className="truncate text-[17px] font-black tracking-tight">EcoConnect<span className="text-[#4ade80]">AI</span></div>
                <div className="truncate text-[10.5px] text-white/60">Coastal habitat intelligence</div>
              </div>
            )}
          </Link>
          <Button size="icon-sm" variant="ghost" onClick={() => setMobileOpen(false)} className="ml-auto text-white hover:bg-white/10 lg:hidden" aria-label="Close menu"><X className="h-4 w-4" /></Button>
        </div>

        <nav className="scroll-slim relative flex-1 space-y-0.5 overflow-y-auto p-3">
          {visibleNav.map((item) => {
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href)) || (item.children?.some((c) => pathname.startsWith(c.href.split("#")[0])) ?? false);
            const link = (
              <div key={item.href}>
                <Link
                  href={item.href}
                  onClick={(e) => { if (item.children && !collapsed) { e.preventDefault(); setToolsOpen((o) => !o); } else setMobileOpen(false); }}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-colors",
                    active ? "text-white" : "text-white/75 hover:bg-white/[0.08] hover:text-white",
                    collapsed && "justify-center px-0",
                  )}
                >
                  {active && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-xl border border-[#4ade80]/35 bg-gradient-to-r from-[#22c55e]/35 to-[#15803d]/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_6px_18px_-8px_rgba(34,197,94,0.6)]" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
                  <item.icon className={cn("relative h-[18px] w-[18px] shrink-0", active ? "text-[#86efac]" : "text-white/70")} />
                  {!collapsed && <span className="relative flex-1 truncate">{item.label}</span>}
                  {!collapsed && item.children && <ChevronDown className={cn("relative h-4 w-4 text-white/60 transition-transform", toolsOpen && "rotate-180")} />}
                </Link>
                {!collapsed && item.children && toolsOpen && (
                  <div className="ml-9 mt-0.5 space-y-0.5">
                    {item.children.map((c) => (
                      <Link key={c.href} href={c.href} onClick={() => setMobileOpen(false)} className={cn("block rounded-lg px-2 py-1.5 text-[12px] text-white/65 hover:bg-white/[0.08] hover:text-white", pathname === c.href.split("#")[0] && "font-semibold text-[#86efac]")}>{c.label}</Link>
                    ))}
                  </div>
                )}
              </div>
            );
            return collapsed ? <Tooltip key={item.href} content={item.label} side="right">{link}</Tooltip> : link;
          })}

          <div className="!mt-3 px-1"><div className="h-px bg-white/10" /></div>
          <Link href="/upload" onClick={() => setMobileOpen(false)} className={cn("mt-2 flex items-center gap-3 rounded-xl border border-dashed border-[#4ade80]/40 px-3 py-2.5 text-[13px] font-medium text-[#86efac] transition-colors hover:bg-white/[0.08]", collapsed && "justify-center px-0")}>
            <UploadCloud className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span className="truncate">New Analysis</span>}
          </Link>
        </nav>

        <div className="relative border-t border-white/10 p-3">
          {!collapsed && (
            <div className="rounded-2xl border border-white/15 bg-white/[0.08] p-4 text-white backdrop-blur-md">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#22c55e]/30 text-[#bbf7d0]"><Leaf className="h-4 w-4" /></div>
              <div className="mt-3 text-[14px] font-semibold leading-tight">Healthier Coasts<br />Stronger Communities</div>
              <div className="mt-1 text-[11px] text-white/80">Data-driven conservation for a sustainable future.</div>
            </div>
          )}
          <button onClick={() => setCollapsed((v) => !v)} className={cn("mt-2 hidden w-full items-center gap-2 rounded-lg px-3 py-2 text-[11px] text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white lg:flex", collapsed && "justify-center px-0")}>
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /> Collapse</>}
          </button>
        </div>
      </aside>

      <AnimatePresence>
        {mobileOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileOpen(false)} className="fixed inset-0 z-[1100] bg-black/50 lg:hidden" />}
      </AnimatePresence>

      {/* ------------------------------------------------------- main */}
      <div className="relative z-[1] flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-[1150] flex h-[68px] items-center gap-3 border-b border-black/[0.05] bg-white/75 px-4 backdrop-blur-xl sm:px-5">
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
          <div className="flex flex-wrap items-center gap-3 px-4 pb-1 pt-5 sm:px-6">
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[24px] font-black tracking-tight text-[#0f172a]">{title}</h1>
              {subtitle && <p className="truncate text-[12px] text-muted-foreground">{subtitle}</p>}
              {purpose && (
                <p className="mt-1 flex items-start gap-1.5 text-[12.5px] leading-snug text-[#0f5132]">
                  <Info className="mt-[2px] h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span><span className="font-semibold">In plain words:</span> {purpose}</span>
                </p>
              )}
            </div>
            {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
          </div>
        )}
        {hideTitle && actions && <div className="sr-only">{actions}</div>}

        <main className={cn("min-w-0 flex-1", !bleed && "p-4 sm:p-6")}>{children}</main>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.05] bg-white/70 px-4 py-2.5 backdrop-blur text-[11px] text-muted-foreground sm:px-6">
          <div><span className="font-semibold text-foreground">EcoConnectAI</span> · Decision support — not automated conservation approval · every figure carries its provenance label</div>
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
      <div className="group relative">
        <input id="global-search" value={q} placeholder=" " autoComplete="off"
          onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => { if (e.key === "Enter" && results[0]) { results[0].run(); setOpen(false); } if (e.key === "Escape") (e.target as HTMLInputElement).blur(); }}
          className="peer h-10 w-full rounded-full border border-black/[0.08] bg-[#f4f7f5] pl-4 pr-10 text-[13px] outline-none transition-[background-color,border-color,box-shadow] duration-200 hover:border-black/[0.16] focus:border-[#15803d] focus:bg-white focus:shadow-[0_0_0_3px_rgba(21,128,61,0.12)]" />
        {/* floating label: sits inside the field, lifts onto the border on focus or once something is typed */}
        <label htmlFor="global-search"
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 rounded-full px-0 text-[13px] text-muted-foreground transition-all duration-200
            peer-focus:top-0 peer-focus:bg-white peer-focus:px-1.5 peer-focus:text-[10.5px] peer-focus:font-semibold peer-focus:text-[#15803d]
            peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:bg-white peer-[:not(:placeholder-shown)]:px-1.5 peer-[:not(:placeholder-shown)]:text-[10.5px] peer-[:not(:placeholder-shown)]:font-semibold">
          Search location, patch, or coordinates
        </label>
        <Search className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors peer-focus:text-[#15803d]" />
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
    <SelectMenu label="Study area" icon={MapPin} value={sceneId} onChange={setSceneId} className="hidden w-[170px] sm:block"
      options={scenes.map((s) => ({ value: s.id, label: s.state, hint: s.region }))} menuClassName="w-[240px]" />
  );
}

/** Observation period = the pipeline run being displayed (one run per scene year). */
function PeriodSelect() {
  const { runs, runId, setRunId, apiOnline } = useAnalysis();
  if (apiOnline !== true || runs.length === 0) return null;
  const latest = runs.find((r) => r.isLatest) ?? runs[0];
  const kind = (k?: string | null) => (k === "development" ? "development model" : k === "synthetic" ? "synthetic" : "run");
  const options = [
    { value: "latest", label: latest?.sceneYear ? `${latest.sceneYear} (latest run)` : "Latest run", hint: "most recent analysis" },
    ...runs.map((r) => ({
      value: r.runId,
      label: r.satellite ? `${r.sceneYear ?? "—"} · satellite NRT${r.satellite.reviewRecommended ? " (review)" : ""}` : `${r.sceneYear ?? "—"} · ${kind(r.resultKind)}`,
      hint: r.satellite ? `${r.satellite.compositeScenes ?? 1} Sentinel-1 acquisitions · model ${r.satellite.reliability ?? "?"} here · ${r.runId}` : r.runId,
    })),
  ];
  return (
    <SelectMenu label="Observation period" icon={Calendar} value={runId} onChange={setRunId} className="hidden w-[220px] lg:block"
      options={options} menuClassName="w-[340px]" align="right" />
  );
}

function AlertsBell() {
  const { apiOnline, sceneId, bundleVersion } = useAnalysis();
  const [n, setN] = useState(0);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener("eco:alerts-changed", bump);
    return () => window.removeEventListener("eco:alerts-changed", bump);
  }, []);
  useEffect(() => {
    if (apiOnline !== true) return;
    let cancelled = false;
    // counts OPEN alerts of the landscape being viewed — the same list the Alerts page shows
    fetchAlerts(sceneId, "OPEN").then((a) => { if (!cancelled) setN(a.length); }).catch(() => {});
    return () => { cancelled = true; };
  }, [apiOnline, sceneId, bundleVersion, tick]);
  return (
    <Link href="/alerts" aria-label={`${n} open alerts for this landscape`} title={`${n} open alert${n === 1 ? "" : "s"} for this landscape`} className="relative grid h-10 w-10 place-items-center rounded-xl border border-black/[0.08] bg-white hover:bg-[#f4f7f5]">
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
