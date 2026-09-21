"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  GitFork,
  HelpCircle,
  Info,
  Layers,
  Maximize2,
  Network,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function InsightSection() {
  const [simulation, setSimulation] = useState<"intact" | "remove-p16" | "remove-p14">("intact");

  return (
    <section id="paradox" className="relative bg-[#080d1e] py-20 lg:py-28 text-white border-t border-white/10">
      {/* Background radial accent */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[800px] bg-[#00c896]/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Heading */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#00c896]/30 bg-[#00c896]/10 px-3.5 py-1 text-[12px] font-semibold text-[#a7f3e0]">
            <Sparkles className="h-3.5 w-3.5 text-[#00c896]" />
            <span>The Fundamental Ecological Breakthrough</span>
          </div>
          <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
            The 3.8% Paradox: <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00c896] via-[#38bdf8] to-[#86efac]">
              Why Area-Based Conservation Fails
            </span>
          </h2>
          <p className="mt-4 text-[16px] text-slate-300 leading-relaxed">
            Conventional conservation allocates budgets to the largest patches by hectares. But
            landscape ecology shows that small stepping-stone bridges carry far more network
            connectivity than their footprint suggests.
          </p>
        </div>

        {/* Interactive Comparison & Topology Demonstration */}
        <div className="mt-14 grid lg:grid-cols-12 gap-8 items-stretch">
          {/* Left: Scientific Case Study (Table VII from Paper) */}
          <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0c1427]/90 p-6 backdrop-blur-xl shadow-xl">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#38bdf8]/20 text-[#38bdf8]">
                    <GitFork className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold text-white">Vembanad–Kol Evidence</h3>
                    <p className="text-[11px] text-slate-400">18 Patches · 18 Edges · Baseline 3 Components</p>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-[#00c896] bg-[#00c896]/10 px-2 py-0.5 rounded border border-[#00c896]/20">
                  Exact Si Formula
                </span>
              </div>

              {/* Comparative Cards: P16 vs P14 */}
              <div className="mt-5 space-y-4">
                {/* Patch P16 Card */}
                <div className="rounded-xl border border-[#ef4444]/40 bg-[#ef4444]/10 p-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 h-16 w-16 bg-[#ef4444]/15 rounded-full blur-xl pointer-events-none" />
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[14px] text-white flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" />
                      Patch P16 · Structural Bridge
                    </span>
                    <span className="text-[10.5px] font-bold text-[#fca5a5] uppercase tracking-wider bg-[#ef4444]/20 px-2 py-0.5 rounded border border-[#ef4444]/30">
                      Rank #1 Criticality
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="bg-black/30 rounded-lg p-2">
                      <div className="text-[10px] text-slate-400">Habitat Area</div>
                      <div className="text-[13px] font-bold text-white">263 ha (3.8%)</div>
                      <div className="text-[9.5px] text-amber-300">11th by size</div>
                    </div>
                    <div className="bg-black/30 rounded-lg p-2">
                      <div className="text-[10px] text-slate-400">Network Loss ($S_i$)</div>
                      <div className="text-[13px] font-bold text-[#ef4444]">-40.8%</div>
                      <div className="text-[9.5px] text-[#fca5a5]">Catastrophic</div>
                    </div>
                    <div className="bg-black/30 rounded-lg p-2">
                      <div className="text-[10px] text-slate-400">Post-Removal</div>
                      <div className="text-[13px] font-bold text-[#ef4444]">5 Comp.</div>
                      <div className="text-[9.5px] text-[#fca5a5]">+2 Fractures</div>
                    </div>
                  </div>
                  <p className="mt-2.5 text-[11.5px] text-slate-300 leading-snug">
                    Holding only 3.8% of habitat, P16 links three otherwise disconnected clusters.
                    Destroying it shatters the landscape.
                  </p>
                </div>

                {/* Patch P14 Card */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[14px] text-white flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#38bdf8]" />
                      Patch P14 · Largest Stand
                    </span>
                    <span className="text-[10.5px] font-bold text-slate-300 uppercase tracking-wider bg-white/10 px-2 py-0.5 rounded border border-white/15">
                      Rank #1 by Area
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="bg-black/30 rounded-lg p-2">
                      <div className="text-[10px] text-slate-400">Habitat Area</div>
                      <div className="text-[13px] font-bold text-white">820.6 ha (11.8%)</div>
                      <div className="text-[9.5px] text-[#38bdf8]">1st by size</div>
                    </div>
                    <div className="bg-black/30 rounded-lg p-2">
                      <div className="text-[10px] text-slate-400">Network Loss ($S_i$)</div>
                      <div className="text-[13px] font-bold text-slate-200">-24.5%</div>
                      <div className="text-[9.5px] text-slate-400">Rank #6 Si</div>
                    </div>
                    <div className="bg-black/30 rounded-lg p-2">
                      <div className="text-[10px] text-slate-400">Post-Removal</div>
                      <div className="text-[13px] font-bold text-[#00c896]">3 Comp.</div>
                      <div className="text-[9.5px] text-[#00c896]">No Fracture</div>
                    </div>
                  </div>
                  <p className="mt-2.5 text-[11.5px] text-slate-300 leading-snug">
                    Even though P14 is 3.1× larger, its loss causes no network fragmentation because
                    redundant perimeter pathways exist.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
              <span>Spearman ρ(Area, Si) = 0.459 in Kerala</span>
              <Link href="/simulation" className="text-[#00c896] hover:underline font-semibold flex items-center gap-1">
                Try Simulation Lab <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* Right: Live Interactive Network Shatter Sandbox */}
          <div className="lg:col-span-7 flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0a1122]/90 p-6 backdrop-blur-xl shadow-xl">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/10">
                <div>
                  <h3 className="text-[15px] font-bold text-white flex items-center gap-2">
                    <Network className="h-4 w-4 text-[#00c896]" />
                    Interactive Topology Severance Simulator
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Click buttons below to test how node removal alters global graph connectivity
                  </p>
                </div>

                {/* Scenario Buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setSimulation("intact")}
                    className={`px-3 py-1 rounded-lg text-[11.5px] font-semibold transition-all ${
                      simulation === "intact"
                        ? "bg-[#00c896] text-[#04231b]"
                        : "bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    Baseline (Intact)
                  </button>
                  <button
                    onClick={() => setSimulation("remove-p16")}
                    className={`px-3 py-1 rounded-lg text-[11.5px] font-semibold transition-all ${
                      simulation === "remove-p16"
                        ? "bg-[#ef4444] text-white"
                        : "bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    Sever P16 (Bridge)
                  </button>
                  <button
                    onClick={() => setSimulation("remove-p14")}
                    className={`px-3 py-1 rounded-lg text-[11.5px] font-semibold transition-all ${
                      simulation === "remove-p14"
                        ? "bg-[#38bdf8] text-[#04231b]"
                        : "bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    Sever P14 (Largest)
                  </button>
                </div>
              </div>

              {/* Graphical Network Canvas */}
              <div className="relative mt-4 aspect-[16/9] w-full rounded-xl border border-white/10 bg-[#050914] overflow-hidden">
                {/* SVG Topology */}
                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 500 280">
                  {/* Cluster Background Zones */}
                  <rect x="30" y="30" width="140" height="220" rx="16" fill="#38bdf8" fillOpacity="0.04" stroke="#38bdf8" strokeDasharray="3 3" strokeOpacity="0.2" />
                  <text x="40" y="50" fill="#38bdf8" fontSize="10" fontWeight="600" opacity="0.7">North Cluster (A)</text>

                  <rect x="330" y="30" width="140" height="110" rx="16" fill="#00c896" fillOpacity="0.04" stroke="#00c896" strokeDasharray="3 3" strokeOpacity="0.2" />
                  <text x="340" y="50" fill="#00c896" fontSize="10" fontWeight="600" opacity="0.7">East Cluster (B)</text>

                  <rect x="330" y="150" width="140" height="110" rx="16" fill="#a78bfa" fillOpacity="0.04" stroke="#a78bfa" strokeDasharray="3 3" strokeOpacity="0.2" />
                  <text x="340" y="170" fill="#a78bfa" fontSize="10" fontWeight="600" opacity="0.7">South Cluster (C)</text>

                  {/* Edges inside North Cluster */}
                  <line x1="70" y1="80" x2="130" y2="100" stroke="#38bdf8" strokeWidth="2" opacity="0.7" />
                  <line x1="70" y1="80" x2="80" y2="180" stroke="#38bdf8" strokeWidth="2" opacity="0.7" />
                  <line x1="80" y1="180" x2="130" y2="190" stroke="#38bdf8" strokeWidth="2" opacity="0.7" />
                  <line x1="130" y1="100" x2="130" y2="190" stroke="#38bdf8" strokeWidth="2" opacity="0.7" />

                  {/* Edges inside East Cluster (Contains P14) */}
                  {simulation !== "remove-p14" ? (
                    <>
                      <line x1="370" y1="70" x2="430" y2="90" stroke="#00c896" strokeWidth="3" opacity="0.8" />
                      <line x1="370" y1="70" x2="400" y2="120" stroke="#00c896" strokeWidth="2.5" opacity="0.8" />
                      <line x1="430" y1="90" x2="400" y2="120" stroke="#00c896" strokeWidth="2.5" opacity="0.8" />
                    </>
                  ) : (
                    <line x1="370" y1="70" x2="400" y2="120" stroke="#00c896" strokeWidth="2" opacity="0.4" strokeDasharray="2 2" />
                  )}

                  {/* Edges inside South Cluster */}
                  <line x1="370" y1="190" x2="430" y2="210" stroke="#a78bfa" strokeWidth="2" opacity="0.7" />
                  <line x1="370" y1="190" x2="390" y2="240" stroke="#a78bfa" strokeWidth="2" opacity="0.7" />
                  <line x1="430" y1="210" x2="390" y2="240" stroke="#a78bfa" strokeWidth="2" opacity="0.7" />

                  {/* BRIDGE EDGES CONNECTING P16 */}
                  {simulation !== "remove-p16" ? (
                    <g>
                      <line x1="130" y1="145" x2="250" y2="145" stroke="#ef4444" strokeWidth="3.5" opacity="0.95" />
                      <line x1="250" y1="145" x2="370" y2="70" stroke="#ef4444" strokeWidth="3.5" opacity="0.95" />
                      <line x1="250" y1="145" x2="370" y2="190" stroke="#ef4444" strokeWidth="3.5" opacity="0.95" />
                    </g>
                  ) : (
                    <g opacity="0.2">
                      <line x1="130" y1="145" x2="250" y2="145" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4 4" />
                      <line x1="250" y1="145" x2="370" y2="70" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4 4" />
                      <line x1="250" y1="145" x2="370" y2="190" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4 4" />
                    </g>
                  )}

                  {/* NODES */}
                  {/* North Cluster Nodes */}
                  <circle cx="70" cy="80" r="8" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
                  <circle cx="130" cy="100" r="9" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
                  <circle cx="80" cy="180" r="7" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
                  <circle cx="130" cy="190" r="8" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
                  <circle cx="130" cy="145" r="10" fill="#1e293b" stroke="#38bdf8" strokeWidth="2.5" />
                  <text x="130" y="149" fill="#38bdf8" fontSize="8" fontWeight="bold" textAnchor="middle">P02</text>

                  {/* East Cluster Nodes (P14 is at 430,90) */}
                  <circle cx="370" cy="70" r="9" fill="#1e293b" stroke="#00c896" strokeWidth="2" />
                  {simulation !== "remove-p14" ? (
                    <g>
                      <circle cx="430" cy="90" r="16" fill="#00c896" stroke="#ffffff" strokeWidth="3" />
                      <text x="430" y="94" fill="#04231b" fontSize="10" fontWeight="bold" textAnchor="middle">P14</text>
                    </g>
                  ) : (
                    <g opacity="0.3">
                      <circle cx="430" cy="90" r="16" fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="3 3" />
                      <text x="430" y="94" fill="#ef4444" fontSize="9" fontWeight="bold" textAnchor="middle">SEVERED</text>
                    </g>
                  )}
                  <circle cx="400" cy="120" r="7" fill="#1e293b" stroke="#00c896" strokeWidth="2" />

                  {/* South Cluster Nodes */}
                  <circle cx="370" cy="190" r="9" fill="#1e293b" stroke="#a78bfa" strokeWidth="2" />
                  <circle cx="430" cy="210" r="8" fill="#1e293b" stroke="#a78bfa" strokeWidth="2" />
                  <circle cx="390" cy="240" r="7" fill="#1e293b" stroke="#a78bfa" strokeWidth="2" />

                  {/* BRIDGE NODE P16 */}
                  {simulation !== "remove-p16" ? (
                    <g>
                      <circle cx="250" cy="145" r="18" fill="#ef4444" fillOpacity="0.2" className="animate-pulse" />
                      <circle cx="250" cy="145" r="11" fill="#ef4444" stroke="#ffffff" strokeWidth="3" />
                      <text x="250" y="149" fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle">P16</text>
                    </g>
                  ) : (
                    <g>
                      <circle cx="250" cy="145" r="14" fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="3 3" />
                      <text x="250" y="149" fill="#ef4444" fontSize="8" fontWeight="bold" textAnchor="middle">LOST</text>
                    </g>
                  )}
                </svg>

                {/* Status Indicator Overlay */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-lg bg-[#050816]/90 px-3.5 py-2.5 backdrop-blur-md border border-white/10 text-[12px]">
                  <div>
                    <span className="text-slate-400">Current Status: </span>
                    <span className="font-bold text-white">
                      {simulation === "intact" && "Baseline Network · 1 Component Group · Highly Resilient"}
                      {simulation === "remove-p16" && "🚨 CRITICAL SEVERANCE: 3 Isolated Component Subgraphs Created!"}
                      {simulation === "remove-p14" && "Local Area Loss Only: Graph Remains 100% Connected"}
                    </span>
                  </div>
                  <div className="font-mono font-bold text-[13px]">
                    {simulation === "intact" && <span className="text-[#00c896]">IIC = 5.38 × 10⁻³</span>}
                    {simulation === "remove-p16" && <span className="text-[#ef4444]">IIC Drop: -40.8%</span>}
                    {simulation === "remove-p14" && <span className="text-amber-400">IIC Drop: -24.5%</span>}
                  </div>
                </div>
              </div>

              {/* Bottom Insight Footer */}
              <div className="mt-4 flex items-center gap-3 rounded-xl bg-white/[0.03] p-3 border border-white/10 text-[12px] text-slate-300">
                <Info className="h-5 w-5 text-[#38bdf8] shrink-0" />
                <span>
                  <strong>Takeaway for Planners:</strong> Prioritizing purely by area would leave
                  bridge patch P16 unprotected (rank #11). EcoConnectAI ensures bottleneck patches are
                  flagged for urgent conservation.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
