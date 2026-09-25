"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Compass,
  Cpu,
  Filter,
  GitBranch,
  Layers,
  Leaf,
  Minus,
  Navigation,
  Network,
  Plus,
  Radio,
  Satellite,
  ShieldCheck,
  Sparkles,
  Sprout,
  Video,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface PipelineStep {
  stepNum: string;
  stepName: string;
  shortTitle: string;
  description: string;
  activeRadioIdx: number;
  badgeLabel: string;
  icon: any;
}

const PIPELINE_STEPS: PipelineStep[] = [
  {
    stepNum: "01",
    stepName: "OBSERVATION",
    shortTitle: "See the landscape.",
    description:
      "High-resolution satellite imagery reveals the coastal ecosystem in its full context.",
    activeRadioIdx: 0,
    badgeLabel: "Live Satellite View",
    icon: Satellite,
  },
  {
    stepNum: "02",
    stepName: "RADIOMETRY",
    shortTitle: "Calibrate raw spectral bands.",
    description:
      "Cloud masking, terrain normalization, and multi-spectral calibration produce 10m analysis-ready rasters.",
    activeRadioIdx: 0,
    badgeLabel: "Radiometric Correction",
    icon: Filter,
  },
  {
    stepNum: "03",
    stepName: "INFERENCE",
    shortTitle: "Map habitats with deep learning.",
    description:
      "Weakly-supervised convolutional neural networks extract precise mangrove canopy boundaries from SAR & optical data.",
    activeRadioIdx: 1,
    badgeLabel: "AI Boundary Segmentation",
    icon: Cpu,
  },
  {
    stepNum: "04",
    stepName: "MORPHOLOGY",
    shortTitle: "Extract discrete habitat patches.",
    description:
      "Connected components analysis separates contiguous mangrove stands with precise area, perimeter, and centroid metrics.",
    activeRadioIdx: 1,
    badgeLabel: "24 Patches Identified",
    icon: Leaf,
  },
  {
    stepNum: "05",
    stepName: "TOPOLOGY",
    shortTitle: "Construct spatial connectivity graph.",
    description:
      "Patches become network nodes wired together by resistance-weighted ecological dispersal corridors.",
    activeRadioIdx: 2,
    badgeLabel: "45 Corridor Links",
    icon: Network,
  },
  {
    stepNum: "06",
    stepName: "SENSITIVITY",
    shortTitle: "Identify critical stepping stones.",
    description:
      "Leave-one-out network perturbation discovers vulnerable cut-vertices whose loss severs the entire landscape.",
    activeRadioIdx: 3,
    badgeLabel: "P17 cut vertex (−27.0% IIC)",
    icon: Zap,
  },
  {
    stepNum: "07",
    stepName: "SIMULATION",
    shortTitle: "Test hypothetical stress scenarios.",
    description:
      "Simulate cyclonic landfalls, road severance, or port development to project post-disturbance network fragmentation.",
    activeRadioIdx: 4,
    badgeLabel: "3 → 5 Fragmented Clusters",
    icon: GitBranch,
  },
  {
    stepNum: "08",
    stepName: "ACTION",
    shortTitle: "Prioritise restoration & field patrols.",
    description:
      "Rank restoration sites by global connectivity returned and dispatch verified patrol tasks to frontline forest rangers.",
    activeRadioIdx: 5,
    badgeLabel: "C1 restoration candidate (+1.29% IIC)",
    icon: Sprout,
  },
];

const RADIO_LAYERS = [
  "Satellite basemap",
  "Detecting habitats",
  "Building connections",
  "Identifying critical areas",
  "Simulating scenarios",
  "Prioritising restoration",
];

export function PipelineFlowSection() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);

  // Smooth automatic timeline advance every 3.5s
  useEffect(() => {
    if (!autoPlay) return;
    const timer = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % PIPELINE_STEPS.length);
    }, 3500);
    return () => clearInterval(timer);
  }, [autoPlay]);

  const current = PIPELINE_STEPS[activeIdx];

  return (
    <section
      id="how-it-works"
      className="relative bg-[#040c16] py-8 sm:py-12 text-white border-t border-white/10 overflow-hidden"
    >
      {/* Subtle radial background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-[#00c896]/10 blur-[130px] pointer-events-none rounded-full" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ----------------- Section Header ----------------- */}
        <div className="text-center max-w-2xl mx-auto space-y-2 relative">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#00c896]/30 bg-[#00c896]/10 px-3 py-0.5 text-[10.5px] font-bold uppercase tracking-widest text-[#00c896] backdrop-blur-md">
            <Network className="h-3 w-3 text-[#00c896]" />
            <span>8-Stage Intelligence Pipeline</span>
          </div>

          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight">
            From Satellite Observation{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00c896] via-[#22c55e] to-[#4ade80]">
              to Decision
            </span>
          </h2>

          <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
            An automated end-to-end workflow transforming raw earth observation into actionable conservation intelligence.
          </p>
        </div>

        {/* ----------------- 8-Stage Connected Horizontal Progress Bar ----------------- */}
        <div className="mt-5 overflow-x-auto pb-2 scroll-slim">
          <div className="min-w-[800px] relative px-3">
            {/* Horizontal Connecting Line */}
            <div className="absolute top-3.5 left-8 right-8 h-0.5 bg-white/10 z-0" />

            <div className="relative z-10 flex items-center justify-between">
              {PIPELINE_STEPS.map((step, idx) => {
                const isActive = activeIdx === idx;
                const isPast = activeIdx > idx;

                return (
                  <button
                    key={step.stepNum}
                    onClick={() => {
                      setActiveIdx(idx);
                      setAutoPlay(false);
                    }}
                    className="group flex flex-col items-center gap-1.5 cursor-pointer transition-all"
                  >
                    {/* Circle Node */}
                    <div
                      className={`grid h-7 w-7 place-items-center rounded-full text-[10px] font-bold font-mono transition-all duration-300 ${
                        isActive
                          ? "bg-[#00c896] text-[#04231b] shadow-md shadow-[#00c896]/40 scale-110 ring-4 ring-[#00c896]/20"
                          : isPast
                          ? "bg-[#0c2420] text-[#00c896] border border-[#00c896]/40"
                          : "bg-[#071324] text-slate-400 border border-white/15 group-hover:border-white/30 group-hover:text-white"
                      }`}
                    >
                      {step.stepNum}
                    </div>

                    {/* Step Label */}
                    <div
                      className={`text-[9.5px] font-extrabold uppercase tracking-wider transition-colors duration-200 ${
                        isActive
                          ? "text-[#00c896] border-b border-[#00c896] pb-0.5"
                          : "text-slate-400 group-hover:text-slate-200"
                      }`}
                    >
                      {step.stepName}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ----------------- Central Interactive Map Console (Zoomed Out & Sleek) ----------------- */}
        <div className="mt-4 rounded-xl border border-white/15 bg-[#05111c] overflow-hidden shadow-2xl relative">
          <div className="relative h-[220px] sm:h-[260px] lg:h-[290px] w-full">
            {/* Satellite Background Image */}
            <div
              className="absolute inset-0 bg-cover bg-center transition-all duration-700"
              style={{
                backgroundImage: "url(/hero-vembanad.jpg)",
                filter: "saturate(1.3) contrast(1.1) brightness(0.9)",
              }}
            />

            {/* Dark vignette to focus overlays */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/35 to-black/70 pointer-events-none" />

            {/* ----------------- Left Content Overlay ----------------- */}
            <div className="absolute top-3.5 left-4 sm:left-5 z-20 max-w-[240px] sm:max-w-xs space-y-1.5 pointer-events-none">
              <div className="flex items-center gap-2">
                <span className="text-2xl sm:text-3xl font-black text-white font-mono leading-none">
                  {current.stepNum}
                </span>
                <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                  {current.stepName}
                </span>
              </div>

              <div className="h-0.5 w-8 bg-[#00c896]" />

              <div className="text-xs sm:text-[13px] font-bold text-white leading-tight">
                {current.shortTitle}
              </div>

              <p className="text-[11px] text-slate-300 leading-snug line-clamp-2">
                {current.description}
              </p>

              <div className="pt-0.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-black/80 px-2.5 py-0.5 text-[9.5px] font-bold text-[#00c896] backdrop-blur border border-[#00c896]/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#00c896] animate-pulse" />
                  <Video className="h-2.5 w-2.5" />
                  <span>{current.badgeLabel}</span>
                </span>
              </div>
            </div>

            {/* ----------------- Right Radio Layer Checklist ----------------- */}
            <div className="absolute top-3.5 right-4 sm:right-5 z-20 rounded-lg bg-black/85 p-2 sm:p-2.5 backdrop-blur-md border border-white/15 space-y-1 text-[10px] shadow-2xl max-w-[175px] hidden sm:block">
              {RADIO_LAYERS.map((layer, idx) => {
                const isSelected = current.activeRadioIdx === idx;
                return (
                  <div
                    key={layer}
                    className={`flex items-center gap-1.5 transition-colors ${
                      isSelected ? "text-white font-bold" : "text-slate-400"
                    }`}
                  >
                    <div
                      className={`grid h-3 w-3 place-items-center rounded-full border transition-all ${
                        isSelected
                          ? "border-[#00c896] bg-[#00c896]/20"
                          : "border-slate-500 bg-transparent"
                      }`}
                    >
                      {isSelected && (
                        <div className="h-1 w-1 rounded-full bg-[#00c896]" />
                      )}
                    </div>
                    <span>{layer}</span>
                  </div>
                );
              })}
            </div>

            {/* ----------------- SVG Analytical Overlay Canvas (Zoomed Out Small Patches) ----------------- */}
            <svg className="absolute inset-0 h-full w-full z-10" viewBox="0 0 500 280">
              {/* Stage 02: Radiometry / Grid lines */}
              {activeIdx === 1 && (
                <g stroke="#38bdf8" strokeWidth="0.7" strokeDasharray="3 3" opacity="0.5">
                  <line x1="100" y1="0" x2="100" y2="280" />
                  <line x1="250" y1="0" x2="250" y2="280" />
                  <line x1="400" y1="0" x2="400" y2="280" />
                  <line x1="0" y1="90" x2="500" y2="90" />
                  <line x1="0" y1="180" x2="500" y2="180" />
                </g>
              )}

              {/* Stage 03 - 08: Zoomed-out Habitat Polygons */}
              {activeIdx >= 2 && (
                <g
                  fill="#10b981"
                  fillOpacity={activeIdx === 5 ? 0.35 : 0.45}
                  stroke="#34d399"
                  strokeWidth="1.2"
                >
                  <polygon points="125,55 145,50 155,70 135,80 120,70" />
                  <polygon points="210,60 235,55 245,78 225,85 205,72" />
                  <polygon points="325,55 350,50 365,72 340,82 320,68" />
                  <polygon points="135,145 160,138 172,162 152,175 130,160" />
                  <polygon points="350,145 375,135 390,162 365,172 345,158" />
                  <polygon points="160,225 185,218 198,242 175,252 152,240" />
                  <polygon points="315,220 340,212 355,238 332,248 310,235" />
                </g>
              )}

              {/* Stage 05 - 08: Connectivity Graph Network Corridors */}
              {activeIdx >= 4 && (
                <g stroke="#38bdf8" strokeWidth="1.6" opacity="0.8">
                  <line x1="140" y1="65" x2="225" y2="70" />
                  <line x1="225" y1="70" x2="345" y2="65" />
                  <line x1="140" y1="65" x2="152" y2="155" />
                  <line x1="152" y1="155" x2="250" y2="145" />
                  <line x1="250" y1="145" x2="365" y2="152" />
                  <line x1="345" y1="65" x2="365" y2="152" />
                  <line x1="152" y1="155" x2="175" y2="235" />
                  <line x1="250" y1="145" x2="332" y2="230" />
                </g>
              )}

              {/* Stage 06: SENSITIVITY - Highlight critical cut vertex P17 */}
              {activeIdx === 5 && (
                <g>
                  {/* Glowing Red Patch */}
                  <polygon
                    points="238,132 262,128 270,150 252,160 234,148"
                    fill="#ef4444"
                    fillOpacity="0.75"
                    stroke="#f87171"
                    strokeWidth="1.8"
                  />
                  <line x1="152" y1="155" x2="250" y2="145" stroke="#ef4444" strokeWidth="2" />
                  <line x1="250" y1="145" x2="365" y2="152" stroke="#ef4444" strokeWidth="2" />
                  <circle cx="250" cy="145" r="10" fill="#ef4444" fillOpacity="0.3" className="animate-ping" />
                  <circle cx="250" cy="145" r="5" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                  <rect x="262" y="137" width="38" height="15" rx="3" fill="#040b14" stroke="#ef4444" strokeWidth="1" />
                  <text x="281" y="148" fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle">P17</text>
                </g>
              )}

              {/* Stage 07: SIMULATION - Fragmented network */}
              {activeIdx === 6 && (
                <g>
                  <polygon
                    points="238,132 262,128 270,150 252,160 234,148"
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="1.5"
                    strokeDasharray="3 2"
                    opacity="0.7"
                  />
                  <text x="250" y="149" fill="#ef4444" fontSize="11" fontWeight="bold" textAnchor="middle">✕</text>
                </g>
              )}

              {/* Stage 08: ACTION - Restoration Corridor Candidate R-003 */}
              {activeIdx === 7 && (
                <g>
                  <polygon
                    points="230,110 265,102 278,132 245,142 225,125"
                    fill="#eab308"
                    fillOpacity="0.65"
                    stroke="#facc15"
                    strokeWidth="1.8"
                    strokeDasharray="3 2"
                  />
                  <line x1="140" y1="65" x2="245" y2="120" stroke="#eab308" strokeWidth="1.8" strokeDasharray="3 2" />
                  <line x1="245" y1="120" x2="345" y2="65" stroke="#eab308" strokeWidth="1.8" strokeDasharray="3 2" />
                  <rect x="220" y="94" width="90" height="14" rx="3" fill="#eab308" />
                  <text x="265" y="104" fill="#040b14" fontSize="7.5" fontWeight="bold" textAnchor="middle">
                    Restoration candidate
                  </text>
                </g>
              )}

              {/* Graph Nodes */}
              {activeIdx >= 4 && (
                <g fill="#ffffff" stroke="#040c16" strokeWidth="1.5">
                  <circle cx="140" cy="65" r="3.5" />
                  <circle cx="225" cy="70" r="3.5" />
                  <circle cx="345" cy="65" r="3.5" />
                  <circle cx="152" cy="155" r="3.5" />
                  <circle cx="365" cy="152" r="3.5" />
                  <circle cx="175" cy="235" r="3.5" />
                  <circle cx="332" cy="230" r="3.5" />
                </g>
              )}
            </svg>

            {/* ----------------- Bottom Right Map Controls ----------------- */}
            <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1 rounded bg-black/80 p-0.5 backdrop-blur border border-white/15">
              <button className="grid h-6 w-6 place-items-center rounded text-white hover:bg-white/10" aria-label="Zoom in">
                <Plus className="h-3 w-3" />
              </button>
              <button className="grid h-6 w-6 place-items-center rounded text-white hover:bg-white/10" aria-label="Zoom out">
                <Minus className="h-3 w-3" />
              </button>
              <button className="grid h-6 w-6 place-items-center rounded text-[#00c896] hover:bg-white/10" aria-label="Navigation compass">
                <Navigation className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>

        {/* ----------------- Bottom Metrics & CTA Strip ----------------- */}
        <div className="mt-3 rounded-xl border border-white/15 bg-[#061220]/90 p-2.5 sm:p-3 backdrop-blur-xl shadow-lg">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* 4 Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full sm:w-auto flex-1">
              <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] p-1.5 border border-white/5">
                <div className="grid h-7 w-7 place-items-center rounded-md bg-[#38bdf8]/15 text-[#38bdf8] border border-[#38bdf8]/30 shrink-0">
                  <Satellite className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-white leading-tight">Sentinel-1/2</div>
                  <div className="text-[9px] text-slate-400">10m GSD Data</div>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] p-1.5 border border-white/5">
                <div className="grid h-7 w-7 place-items-center rounded-md bg-[#00c896]/15 text-[#00c896] border border-[#00c896]/30 shrink-0">
                  <Leaf className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="text-[11.5px] font-bold text-white leading-tight">382 ha</div>
                  <div className="text-[9px] text-slate-400">Study Area</div>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] p-1.5 border border-white/5">
                <div className="grid h-7 w-7 place-items-center rounded-md bg-[#a78bfa]/15 text-[#a78bfa] border border-[#a78bfa]/30 shrink-0">
                  <Layers className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="text-[11.5px] font-bold text-white leading-tight">24 Patches</div>
                  <div className="text-[9px] text-slate-400">AI Detected</div>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] p-1.5 border border-white/5">
                <div className="grid h-7 w-7 place-items-center rounded-md bg-[#22c55e]/15 text-[#22c55e] border border-[#22c55e]/30 shrink-0">
                  <Network className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="text-[11.5px] font-bold text-white leading-tight">45 Links</div>
                  <div className="text-[9px] text-slate-400">Corridors</div>
                </div>
              </div>
            </div>

            {/* Right CTA Button */}
            <div className="shrink-0 w-full sm:w-auto">
              <Link
                href="/command"
                className="group flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[#00c896] via-[#10b981] to-[#22c55e] px-4 py-2 text-xs font-bold text-[#04231b] shadow-md shadow-[#00c896]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                <span>Explore This Stage</span>
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
