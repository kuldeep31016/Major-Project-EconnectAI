"use client";

import Link from "next/link";
import {
  ArrowRight,
  ChevronRight,
  Compass,
  Layers,
  TrendingUp,
  AlertTriangle,
  GitBranch,
  Sprout,
  ShieldCheck,
} from "lucide-react";

interface Capability {
  number: string;
  title: string;
  tagline: string;
  href: string;
  badge: string;
  icon: any;
  renderVisual: () => React.ReactNode;
}

const CAPABILITIES: Capability[] = [
  {
    number: "01",
    title: "Interactive Coastal Map",
    tagline: "High-resolution patch segmentation, corridor layers, and multi-spectral GIS overlays.",
    href: "/analysis?scene=kerala-coast",
    badge: "Spatial GIS",
    icon: Layers,
    renderVisual: () => (
      <div className="relative h-24 w-full rounded-lg bg-[#040914] overflow-hidden border border-white/10 p-3 flex flex-col justify-between">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40"
          style={{ backgroundImage: "url(/hero-vembanad.jpg)" }}
        />
        <div className="relative z-10 flex justify-between items-center text-[10px]">
          <span className="font-mono text-[#00c896] bg-black/60 px-2 py-0.5 rounded backdrop-blur border border-[#00c896]/20">
            Vembanad · 10m GSD
          </span>
          <span className="text-white/80 font-mono text-[9px]">9.87°N, 76.37°E</span>
        </div>
        <div className="relative z-10 flex items-center justify-between text-[10px]">
          <span className="text-slate-300">18 Patches</span>
          <span className="text-[#00c896] font-bold">95.6% Confidence</span>
        </div>
      </div>
    ),
  },
  {
    number: "02",
    title: "Change Detection",
    tagline: "Multi-year canopy regrowth differencing and baseline fragmentation tracking.",
    href: "/command",
    badge: "Multi-Temporal",
    icon: TrendingUp,
    renderVisual: () => (
      <div className="h-24 w-full rounded-lg bg-[#040914] p-3 border border-white/10 flex flex-col justify-between text-[10px]">
        <div className="flex justify-between items-center">
          <span className="text-slate-400">Baseline Multi-Year</span>
          <span className="text-[#38bdf8] font-mono font-bold">2020 → 2024</span>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px]">
            <span className="text-slate-300">Canopy Extent</span>
            <span className="text-[#00c896] font-bold">+2.1% Regrowth</span>
          </div>
          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#00c896] to-[#38bdf8] w-3/4 rounded-full" />
          </div>
        </div>
      </div>
    ),
  },
  {
    number: "03",
    title: "Criticality Analysis",
    tagline: "Automated identification of fragile stepping-stones whose loss severs the network.",
    href: "/analysis?scene=kerala-coast",
    badge: "Graph Sensitivity",
    icon: AlertTriangle,
    renderVisual: () => (
      <div className="h-24 w-full rounded-lg bg-[#040914] p-3 border border-white/10 flex flex-col justify-between text-[10px]">
        <div className="flex justify-between items-center">
          <span className="font-bold text-[#ef4444] flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ef4444] animate-pulse" />
            P-016 Cut-Vertex
          </span>
          <span className="bg-[#ef4444]/20 text-[#ef4444] px-1.5 py-0.5 rounded text-[9px] font-bold">
            Rank #1
          </span>
        </div>
        <div className="flex justify-between items-center bg-[#ef4444]/10 p-2 rounded border border-[#ef4444]/20">
          <span className="text-slate-300">Disruption Impact</span>
          <span className="text-[#ef4444] font-mono font-bold text-[12px]">-40.8% Connectivity</span>
        </div>
      </div>
    ),
  },
  {
    number: "04",
    title: "Scenario Lab",
    tagline: "Stress-test hypothetical cyclone landfall and infrastructure severance in advance.",
    href: "/simulation",
    badge: "Disaster Simulation",
    icon: GitBranch,
    renderVisual: () => (
      <div className="h-24 w-full rounded-lg bg-[#040914] p-3 border border-white/10 flex flex-col justify-between text-[10px]">
        <div className="flex justify-between items-center">
          <span className="text-slate-400">Disturbance Simulation</span>
          <span className="text-amber-400 font-semibold text-[9px]">Live Recompute</span>
        </div>
        <div className="flex items-center justify-between bg-white/5 p-2 rounded">
          <span className="text-slate-300">Cluster Separation</span>
          <span className="text-white font-mono font-bold">3 → 5 Clusters</span>
        </div>
      </div>
    ),
  },
  {
    number: "05",
    title: "Restoration Planner",
    tagline: "Prioritized candidate corridors ranked by network connectivity returned.",
    href: "/restoration",
    badge: "Corridor Design",
    icon: Sprout,
    renderVisual: () => (
      <div className="h-24 w-full rounded-lg bg-[#040914] p-3 border border-white/10 flex flex-col justify-between text-[10px]">
        <div className="flex justify-between items-center">
          <span className="font-bold text-white">Top Candidate R-003</span>
          <span className="bg-[#00c896]/20 text-[#00c896] px-1.5 py-0.5 rounded text-[9px] font-bold">
            Priority #1
          </span>
        </div>
        <div className="flex justify-between items-center bg-[#00c896]/10 p-2 rounded border border-[#00c896]/20">
          <span className="text-slate-300">Network Gain</span>
          <span className="text-[#00c896] font-mono font-bold text-[12px]">+12.4% Recovery</span>
        </div>
      </div>
    ),
  },
  {
    number: "06",
    title: "Field Verification",
    tagline: "Synchronized ground survey tasks dispatched directly to frontline forest rangers.",
    href: "/field",
    badge: "Ground Truth",
    icon: ShieldCheck,
    renderVisual: () => (
      <div className="h-24 w-full rounded-lg bg-[#040914] p-3 border border-white/10 flex flex-col justify-between text-[10px]">
        <div className="flex justify-between items-center">
          <span className="font-bold text-white">Patrol Task #084</span>
          <span className="text-[#00c896] font-semibold text-[9px] bg-[#00c896]/15 px-1.5 py-0.5 rounded">
            Synced
          </span>
        </div>
        <div className="flex justify-between items-center bg-white/5 p-2 rounded">
          <span className="text-slate-300">Target Stand</span>
          <span className="text-white font-mono font-bold">P-016 (Vembanad)</span>
        </div>
      </div>
    ),
  },
];

export function CapabilitiesSection() {
  return (
    <section id="capabilities" className="relative bg-[#060e1d] py-12 lg:py-16 text-white border-t border-white/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-white/10">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[#00c896]/30 bg-[#00c896]/10 px-3 py-0.5 text-[10.5px] font-semibold text-[#a7f3e0]">
              <Compass className="h-3 w-3 text-[#00c896]" />
              <span>PLATFORM CAPABILITIES</span>
            </div>
            <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight">
              Six Core Environmental Intelligence Modules
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-300">
              A decision-support system built for coastal authorities, forest rangers, and researchers.
            </p>
          </div>

          <Link
            href="/command"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#00c896] hover:underline shrink-0"
          >
            <span>Launch All in Command</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* 6 Capabilities Cards with Sleek Minimal Visual Previews */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-6">
          {CAPABILITIES.map((cap) => {
            const Icon = cap.icon;
            return (
              <div
                key={cap.number}
                className="group rounded-xl border border-white/10 bg-[#081224]/80 p-4 backdrop-blur-xl transition-all duration-300 hover:border-[#00c896]/40 hover:bg-[#0b172e] flex flex-col justify-between"
              >
                <div>
                  {/* Header with Number, Icon, and Badge */}
                  <div className="flex items-center justify-between pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-400">
                        {cap.number}
                      </span>
                      <Icon className="h-4 w-4 text-[#00c896]" />
                    </div>
                    <span className="text-[9.5px] font-bold uppercase tracking-wider text-[#00c896] bg-[#00c896]/10 px-2 py-0.5 rounded border border-[#00c896]/20">
                      {cap.badge}
                    </span>
                  </div>

                  {/* Clean Visual Preview */}
                  <div className="mb-3">{cap.renderVisual()}</div>

                  {/* Title & Tagline */}
                  <h3 className="text-sm font-bold text-white group-hover:text-[#00c896] transition-colors leading-snug">
                    {cap.title}
                  </h3>
                  <p className="mt-1 text-[11.5px] text-slate-300 leading-relaxed">
                    {cap.tagline}
                  </p>
                </div>

                {/* Bottom Action Link */}
                <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Module</span>
                  <Link
                    href={cap.href}
                    className="font-bold text-[#00c896] hover:underline flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform"
                  >
                    Launch <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
