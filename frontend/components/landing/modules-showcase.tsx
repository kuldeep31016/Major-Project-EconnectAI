"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Compass,
  Cpu,
  Eye,
  FileSpreadsheet,
  FileText,
  Flame,
  GitGraph,
  HelpCircle,
  Layers,
  Leaf,
  Network,
  Radio,
  RotateCw,
  Search,
  ShieldAlert,
  Sliders,
  Sparkles,
  Sprout,
  Users,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ModuleInfo {
  id: string;
  name: string;
  badge: string;
  icon: any;
  href: string;
  headline: string;
  tagline: string;
  keyFeatures: string[];
}

const MODULES: ModuleInfo[] = [
  {
    id: "command",
    name: "Command Center",
    badge: "Operations Hub",
    icon: Compass,
    href: "/command",
    headline: "Mission Control for Coastal Ecosystems",
    tagline:
      "A unified cockpit aggregating real-time satellite imagery, study area health, patch geometry, and diagnostic alerts across India's coastline.",
    keyFeatures: [
      "Multi-scene switching between Kerala, Sundarbans, Gulf of Mannar & Odisha",
      "Live provenance tracking distinguishing experimental runs from synthetic seeds",
      "One-click pipeline execution with staged progress monitoring",
    ],
  },
  {
    id: "graph",
    name: "Topology & Criticality",
    badge: "Graph Ecology",
    icon: Network,
    href: "/graph",
    headline: "Interactive Graph Theory Engine",
    tagline:
      "Explore habitat networks represented as nodes and weighted edges. Uncover hidden cut-vertices, stepping stones, and structural vulnerability.",
    keyFeatures: [
      "Dynamic force-directed graph with edge weights calibrated by distance and quality",
      "Cut-vertex & bridge node detection pinpointing fragile connectivity bottlenecks",
      "Exact leave-one-out sensitivity ranking (Si) for every detected habitat polygon",
    ],
  },
  {
    id: "simulation",
    name: "What-If Disaster Lab",
    badge: "Stress Testing",
    icon: Zap,
    href: "/simulation",
    headline: "Simulate Cyclones, Roads & Habitat Severance",
    tagline:
      "Model hypothetical loss scenarios before breaking ground. Assess the cascading network impact of cyclone landfalls, coastal roads, or industrial encroachment.",
    keyFeatures: [
      "Interactive multi-patch deletion with real-time recalculated Integral Index (IIC)",
      "Severed corridor detection highlighting newly isolated component clusters",
      "Pre-computed disaster presets (e.g. Cyclone Cyclone landfall in Sundarbans)",
    ],
  },
  {
    id: "restoration",
    name: "Restoration Optimizer",
    badge: "Economics & ROI",
    icon: Sprout,
    href: "/restoration",
    headline: "Maximize Ecological Return Per Rupee",
    tagline:
      "Rank candidate restoration sites by connectivity gain per lakh rupees invested (Ri / Costi), ensuring scarce conservation capital delivers maximum resilience.",
    keyFeatures: [
      "Budget band filtering from INR 50 Lakh to INR 10 Crore",
      "Dual ranking comparison: raw connectivity gain vs cost-efficiency score",
      "Candidate node insertion computing delta connectivity before planting begins",
    ],
  },
  {
    id: "reports",
    name: "Rule-Based XAI",
    badge: "Transparent AI",
    icon: FileText,
    href: "/reports",
    headline: "Audit-Ready, Zero-Hallucination Explanations",
    tagline:
      "Generate natural-language explanations backed by deterministic graph metrics. Every score provides clear evidence for forest officers and policy makers.",
    keyFeatures: [
      "Detailed justification stating area, degree, cut-vertex role, and measured ΔCi",
      "Executive PDF and GIS export ready for forest working plans and compliance",
      "Transparent provenance labels for every metric shown",
    ],
  },
  {
    id: "field",
    name: "Field Verification",
    badge: "Ground Truth",
    icon: ClipboardList,
    href: "/field",
    headline: "Bridge Satellite AI with Frontline Rangers",
    tagline:
      "Dispatch field inspection tasks to rangers with GPS coordinates, collect mobile photo evidence, and validate model confidence on the ground.",
    keyFeatures: [
      "GPS patrol task generation for borderline and critical habitat patches",
      "Evidence photo collection and ground canopy cover validation",
      "Loop ground truth observations back into the validation registry",
    ],
  },
];

export function ModulesShowcase() {
  const [activeModuleId, setActiveModuleId] = useState<string>("command");
  const activeModule = MODULES.find((m) => m.id === activeModuleId) || MODULES[0];

  return (
    <section id="modules" className="relative bg-[#080e1e] py-20 lg:py-28 text-white border-t border-white/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#00c896]/30 bg-[#00c896]/10 px-3.5 py-1 text-[12px] font-semibold text-[#a7f3e0]">
            <Cpu className="h-3.5 w-3.5 text-[#00c896]" />
            <span>Comprehensive Product Capabilities</span>
          </div>
          <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
            Six Specialized Modules. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00c896] via-[#38bdf8] to-[#a78bfa]">
              One Unified Decision Intelligence Platform
            </span>
          </h2>
          <p className="mt-4 text-[16px] text-slate-300 leading-relaxed">
            Designed for conservation planners, state forest departments, and coastal ecologists.
            Explore the core interactive workflows powering EcoConnectAI.
          </p>
        </div>

        {/* Module Navigation Tabs */}
        <div className="mt-12 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 bg-white/[0.03] p-2 rounded-2xl border border-white/10 backdrop-blur-md">
          {MODULES.map((m) => {
            const Icon = m.icon;
            const isCurrent = m.id === activeModuleId;
            return (
              <button
                key={m.id}
                onClick={() => setActiveModuleId(m.id)}
                className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200 text-center ${
                  isCurrent
                    ? "bg-[#00c896] text-[#04231b] font-bold shadow-lg shadow-[#00c896]/20 scale-[1.02]"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className={`h-5 w-5 mb-1.5 ${isCurrent ? "text-[#04231b]" : "text-[#00c896]"}`} />
                <span className="text-[12.5px] font-semibold leading-tight">{m.name}</span>
                <span
                  className={`text-[9.5px] mt-0.5 ${
                    isCurrent ? "text-[#04231b]/80 font-medium" : "text-slate-500"
                  }`}
                >
                  {m.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Module Showcase Card */}
        <div className="mt-8 rounded-3xl border border-white/15 bg-[#0c152a]/95 p-6 lg:p-8 backdrop-blur-2xl shadow-2xl">
          <div className="grid lg:grid-cols-12 gap-8 items-center">
            {/* Left Content */}
            <div className="lg:col-span-5 space-y-5">
              <div className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1 text-[11.5px] font-semibold text-[#00c896]">
                <activeModule.icon className="h-4 w-4" />
                <span>{activeModule.badge}</span>
              </div>

              <h3 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
                {activeModule.headline}
              </h3>

              <p className="text-[14.5px] text-slate-300 leading-relaxed">
                {activeModule.tagline}
              </p>

              {/* Key Features List */}
              <div className="space-y-2.5 pt-2">
                {activeModule.keyFeatures.map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-[13px] text-slate-200">
                    <CheckCircle2 className="h-4.5 w-4.5 text-[#00c896] shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>

              {/* Action Link */}
              <div className="pt-4">
                <Link
                  href={activeModule.href}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#00c896] to-[#10b981] px-5 py-3 text-[14px] font-bold text-[#04231b] shadow-lg shadow-[#00c896]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <span>Open {activeModule.name}</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Right Interactive Mockup / Visualization */}
            <div className="lg:col-span-7">
              <div className="relative rounded-2xl border border-white/15 bg-[#050914] p-5 shadow-2xl overflow-hidden min-h-[340px] flex flex-col justify-between">
                {/* Simulated UI Window Bar */}
                <div className="flex items-center justify-between pb-3 border-b border-white/10 text-[11px] text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#f59e0b]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
                    <span className="ml-2 font-mono text-slate-300">ecoconnect.ai{activeModule.href}</span>
                  </div>
                  <span className="rounded bg-white/10 px-2 py-0.5 font-medium text-slate-300">
                    Live Session
                  </span>
                </div>

                {/* Module-Specific Interactive Mockup Display */}
                <div className="my-4">
                  {activeModuleId === "command" && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-lg bg-white/5 p-3 border border-white/10">
                          <div className="text-[10px] text-slate-400">Active Scene</div>
                          <div className="text-[13px] font-bold text-white mt-0.5">Vembanad–Kol</div>
                          <div className="text-[10px] text-[#00c896]">486 km² · Sentinel-2</div>
                        </div>
                        <div className="rounded-lg bg-white/5 p-3 border border-white/10">
                          <div className="text-[10px] text-slate-400">Habitat Patches</div>
                          <div className="text-[13px] font-bold text-white mt-0.5">18 Detected</div>
                          <div className="text-[10px] text-[#38bdf8]">6,962 Total Ha</div>
                        </div>
                        <div className="rounded-lg bg-white/5 p-3 border border-white/10">
                          <div className="text-[10px] text-slate-400">Connectivity Baseline</div>
                          <div className="text-[13px] font-bold text-[#00c896] mt-0.5">IIC: 5.38 × 10⁻³</div>
                          <div className="text-[10px] text-slate-400">ECA: 59.6%</div>
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-[#091122] p-3 text-[11.5px] space-y-2">
                        <div className="flex justify-between items-center text-slate-300">
                          <span>UNB7 Segmentation Inference</span>
                          <span className="text-[#00c896] font-bold">Completed (100%)</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-[#00c896] w-full" />
                        </div>
                        <div className="flex justify-between text-[10.5px] text-slate-400 pt-1">
                          <span>Graph Topology Built: 18 Nodes, 18 Links</span>
                          <span>Tau: 5.0 km</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeModuleId === "graph" && (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-white/10 bg-[#06101e] p-3 flex items-center justify-between">
                        <div>
                          <div className="text-[11px] text-slate-400">Topological Graph State</div>
                          <div className="text-[13px] font-bold text-white">k=3 Nearest Neighbors · Tau=5km</div>
                        </div>
                        <span className="bg-[#00c896]/20 text-[#00c896] px-2.5 py-1 rounded-lg text-[11px] font-bold">
                          18 Nodes / 18 Edges
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11.5px]">
                        <div className="p-2.5 rounded-lg bg-[#ef4444]/10 border border-[#ef4444]/30">
                          <div className="font-bold text-[#ef4444]">Cut-Vertex Detected: P16</div>
                          <div className="text-slate-300 text-[11px] mt-0.5">
                            Degree: 3 · Delta IIC: -40.8% · Critical Bridge
                          </div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-[#38bdf8]/10 border border-[#38bdf8]/30">
                          <div className="font-bold text-[#38bdf8]">Core Cluster: P14</div>
                          <div className="text-slate-300 text-[11px] mt-0.5">
                            Degree: 3 · Area: 820.6 ha · High Redundancy
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeModuleId === "simulation" && (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-[#ef4444]/40 bg-[#ef4444]/10 p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[12px] text-white flex items-center gap-1.5">
                            <AlertCircle className="h-4 w-4 text-[#ef4444]" />
                            Scenario: Highway Corridor Cutting Through P16
                          </span>
                          <span className="text-[11px] font-mono text-[#ef4444] font-bold">-40.8% Loss</span>
                        </div>
                        <p className="mt-1.5 text-[11.5px] text-slate-300">
                          Severed 3 incident edges. Fragmented main wetland into 3 isolated pockets.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-center text-[11.5px]">
                        <div className="rounded-lg bg-white/5 p-2 border border-white/10">
                          <div className="text-slate-400 text-[10px]">Baseline Components</div>
                          <div className="text-[14px] font-bold text-[#00c896]">3 Clusters</div>
                        </div>
                        <div className="rounded-lg bg-white/5 p-2 border border-white/10">
                          <div className="text-slate-400 text-[10px]">Post-Severance</div>
                          <div className="text-[14px] font-bold text-[#ef4444]">5 Isolated Clusters</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeModuleId === "restoration" && (
                    <div className="space-y-3">
                      <div className="rounded-xl border border-[#00c896]/30 bg-[#00c896]/10 p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[12px] text-white">
                            Optimal Restoration Site: Candidate C1
                          </span>
                          <span className="text-[11px] font-bold text-[#00c896]">Priority: 5.9 × 10⁻³</span>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-300">
                          <span>Area: 101.7 ha · Gain: +2.73%</span>
                          <span>Estimated Cost: INR 466 Lakh</span>
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-400 bg-white/5 p-2.5 rounded-lg border border-white/10">
                        💡 <strong>Economic Insight:</strong> C5 offers slightly higher raw gain (+3.5%), but costs INR 807L. C1 returns 37% more connectivity per lakh rupees.
                      </div>
                    </div>
                  )}

                  {activeModuleId === "reports" && (
                    <div className="space-y-2.5">
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-[12px]">
                        <div className="font-bold text-[#38bdf8] flex items-center gap-1.5">
                          <Bot className="h-4 w-4" /> Explainability Audit Output
                        </div>
                        <p className="mt-1 text-slate-200 text-[11.5px] italic leading-relaxed">
                          &quot;Patch P16 is designated High Priority because it functions as a critical cut-vertex joining 3 disconnected habitat communities. Its loss increases the network component count from 3 to 5 and reduces IIC by 40.8%.&quot;
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <span className="px-2 py-1 rounded bg-[#00c896]/20 text-[#00c896] text-[10px] font-semibold">
                          Deterministic Metric Derivation
                        </span>
                        <span className="px-2 py-1 rounded bg-white/10 text-slate-300 text-[10px]">
                          Zero Black-Box LLM Hallucinations
                        </span>
                      </div>
                    </div>
                  )}

                  {activeModuleId === "field" && (
                    <div className="space-y-2.5">
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-[12px]">
                        <div className="flex items-center justify-between font-bold text-white">
                          <span>Patrol Task #084: Ground Truth P16</span>
                          <span className="text-amber-400 font-normal text-[11px]">Pending Survey</span>
                        </div>
                        <div className="text-slate-400 text-[11px] mt-1">
                          Coordinates: 9.878° N, 76.372° E · Target: Validate canopy density & channel siltation
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-300 bg-white/5 p-2 rounded-lg">
                        <span>Assigned to: Kumarakom Forest Range</span>
                        <span className="text-[#00c896] font-medium">GPS Ready</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Live Sandbox Quick Status */}
                <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#00c896] animate-ping" />
                    <span>Real-time state synced</span>
                  </div>
                  <Link href={activeModule.href} className="text-[#00c896] font-semibold hover:underline flex items-center gap-1">
                    Launch Interactive UI <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
