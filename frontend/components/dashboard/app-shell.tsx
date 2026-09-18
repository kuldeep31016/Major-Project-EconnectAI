"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  FlaskConical,
  History,
  LayoutDashboard,
  Map as MapIcon,
  Menu,
  Satellite,
  Settings,
  UploadCloud,
  Waves,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { useAnalysis } from "@/hooks/use-analysis";
import { ProvenanceBadge } from "@/components/shared/provenance-badge";
import { getScenes } from "@/lib/data";
import { EASE } from "@/components/shared/motion";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/analysis", label: "Analysis", icon: MapIcon },
  { href: "/simulation", label: "Simulation", icon: FlaskConical },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/history", label: "History", icon: History },
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
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  bleed?: boolean;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      {/* ---------------------------------------------------- sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-foreground/[0.08] bg-sidebar/95 backdrop-blur-xl transition-[width] duration-300 lg:static",
          collapsed ? "w-[72px]" : "w-[248px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          "transition-transform lg:transition-[width]",
        )}
      >
        {/* brand */}
        <div className="flex h-16 items-center gap-2.5 border-b border-foreground/[0.08] px-4">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-eco">
              <Waves className="h-5 w-5 text-[#04231b]" strokeWidth={2.4} />
            </div>
            {!collapsed && (
              <div className="min-w-0 leading-none">
                <div className="truncate text-[14px] font-semibold tracking-tight">
                  Eco<span className="text-[#00c896]">Connect</span>AI
                </div>
                <div className="mt-1 text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Conservation Intelligence
                </div>
              </div>
            )}
          </Link>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => setMobileOpen(false)}
            className="ml-auto lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* nav */}
        <nav className="scroll-slim flex-1 space-y-1 overflow-y-auto p-3">
          {NAV.map((item) => {
            const active =
              pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const link = (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground",
                  collapsed && "justify-center px-0",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-xl bg-[#00c896]/12 ring-1 ring-[#00c896]/25"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <item.icon
                  className={cn(
                    "relative h-[18px] w-[18px] shrink-0 transition-colors",
                    active && "text-[#00c896]",
                  )}
                />
                {!collapsed && <span className="relative truncate">{item.label}</span>}
              </Link>
            );

            return collapsed ? (
              <Tooltip key={item.href} content={item.label} side="right">
                {link}
              </Tooltip>
            ) : (
              link
            );
          })}

          <div className="!mt-4 px-1">
            <div className="h-px bg-foreground/[0.08]" />
          </div>

          <Link
            href="/upload"
            onClick={() => setMobileOpen(false)}
            className={cn(
              "mt-2 flex items-center gap-3 rounded-xl border border-dashed border-[#00c896]/30 px-3 py-2.5 text-[13px] font-medium text-[#00c896] transition-colors hover:bg-[#00c896]/10",
              collapsed && "justify-center px-0",
            )}
          >
            <UploadCloud className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span className="truncate">New Analysis</span>}
          </Link>
        </nav>

        {/* scene switcher + collapse */}
        <div className="border-t border-foreground/[0.08] p-3">
          {!collapsed && <SceneSwitcher />}
          <button
            onClick={() => setCollapsed((v) => !v)}
            className={cn(
              "mt-2 hidden w-full items-center gap-2 rounded-lg px-3 py-2 text-[11px] text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground lg:flex",
              collapsed && "justify-center px-0",
            )}
          >
            {collapsed ? (
              <ChevronsRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronsLeft className="h-4 w-4" />
                Collapse
              </>
            )}
          </button>
        </div>
      </aside>

      {/* mobile scrim */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------- main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-foreground/[0.08] bg-background/85 px-4 backdrop-blur-xl sm:px-6">
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => setMobileOpen(true)}
            className="lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-4.5 w-4.5" />
          </Button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-semibold tracking-tight sm:text-base">
              {title}
            </h1>
            {subtitle && (
              <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <ProvenanceBadge />
            {actions}
          </div>
        </header>

        <main className={cn("min-w-0 flex-1", !bleed && "p-4 sm:p-6")}>{children}</main>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* scene switcher                                                      */
/* ------------------------------------------------------------------ */

function SceneSwitcher() {
  const { sceneId, setSceneId, scene } = useAnalysis();
  const [open, setOpen] = useState(false);
  const scenes = getScenes();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] px-3 py-2.5 text-left transition-colors hover:bg-foreground/[0.08]"
      >
        <div
          className="h-8 w-8 shrink-0 rounded-lg"
          style={{
            background: `linear-gradient(135deg, ${scene.thumbnailGradient[0]}, ${scene.thumbnailGradient[1]})`,
          }}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-medium">{scene.state}</div>
          <div className="truncate text-[10px] text-muted-foreground">{scene.sensor.split(" ")[0]}</div>
        </div>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="absolute bottom-full left-0 z-50 mb-2 w-full min-w-[220px] overflow-hidden rounded-xl glass-strong shadow-2xl"
            >
              <div className="border-b border-foreground/[0.08] px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Active dataset
              </div>
              {scenes.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSceneId(s.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-foreground/[0.06]",
                    s.id === sceneId && "bg-[#00c896]/10",
                  )}
                >
                  <div
                    className="h-7 w-7 shrink-0 rounded-lg"
                    style={{
                      background: `linear-gradient(135deg, ${s.thumbnailGradient[0]}, ${s.thumbnailGradient[1]})`,
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-medium">{s.state}</div>
                    <div className="truncate text-[10px] text-muted-foreground">{s.region}</div>
                  </div>
                  {s.id === sceneId && (
                    <Satellite className="h-3.5 w-3.5 shrink-0 text-[#00c896]" />
                  )}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
