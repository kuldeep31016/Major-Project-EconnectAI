"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Compass,
  GitBranch,
  Layers,
  Leaf,
  MapPin,
  Maximize2,
  Minus,
  Network,
  Pause,
  Play,
  Plus,
  Radio,
  Satellite,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface StageInfo {
  id: number;
  stageNum: string;
  pillLabel: string;
  title: string;
  desc: string;
  tagTitle: string;
  tagSubtitle: string;
  icon: any;
}

const STAGES: StageInfo[] = [
  {
    id: 0,
    stageNum: "01",
    pillLabel: "01  OBSERVE",
    title: "Observe the Real Landscape",
    desc: "Start with trusted satellite observations to understand the coastal ecosystem as it exists today.",
    tagTitle: "Satellite Observation",
    tagSubtitle: "Sentinel-2 · 10m resolution",
    icon: Satellite,
  },
  {
    id: 1,
    stageNum: "02",
    pillLabel: "02  DETECT",
    title: "Detect Habitats from Space",
    desc: "Use AI to map and classify mangroves and coastal habitats across the landscape.",
    tagTitle: "Habitat Detection",
    tagSubtitle: "AI segmentation · Multi-spectral",
    icon: Leaf,
  },
  {
    id: 2,
    stageNum: "03",
    pillLabel: "03  TOPOLOGY",
    title: "Understand Connectivity",
    desc: "Convert habitat patches into a graph to reveal how the ecosystem is connected.",
    tagTitle: "Connectivity Topology",
    tagSubtitle: "Patches + Links + Network Graph",
    icon: Network,
  },
  {
    id: 3,
    stageNum: "04",
    pillLabel: "04  CRITICALITY",
    title: "Identify Critical Areas",
    desc: "Analyze network vulnerability to find stepping-stone patches that hold the ecosystem together.",
    tagTitle: "Criticality Analysis",
    tagSubtitle: "Network metrics + Vulnerability",
    icon: Zap,
  },
  {
    id: 4,
    stageNum: "05",
    pillLabel: "05  SIMULATE",
    title: "Test What-If Scenarios",
    desc: "Simulate patch removal or restoration to see how connectivity and resilience change.",
    tagTitle: "Scenario Simulation",
    tagSubtitle: "Before / After + Impact analysis",
    icon: GitBranch,
  },
  {
    id: 5,
    stageNum: "06",
    pillLabel: "06  ACT",
    title: "Turn Insight into Action",
    desc: "Prioritize restoration areas, plan interventions and enable field implementation.",
    tagTitle: "Prioritised Action",
    tagSubtitle: "Restoration + Field deployment",
    icon: MapPin,
  },
];

export function CoreInsightSection() {
  const [activeStage, setActiveStage] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  // Auto-advance every 3.2 seconds
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setActiveStage((prev) => (prev + 1) % STAGES.length);
    }, 3200);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const current = STAGES[activeStage];
  const TagIcon = current.icon;

  return (
    <section id="insight" className="relative bg-[#040b14] py-12 lg:py-16 text-white border-t border-white/10 overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-[#00c896]/10 blur-[130px] pointer-events-none rounded-full" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-2.5">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#00c896]/30 bg-[#00c896]/10 px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[#00c896] backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-[#00c896]" />
            <span>THE ECOCONNECTAI INTELLIGENCE FLOW</span>
          </div>

          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight">
            &ldquo;Knowing where habitat exists is only the beginning.&rdquo;
          </h2>
        </div>

        {/* 6 Stage Horizontal Progress Indicator */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2.5">
          {STAGES.map((s, idx) => {
            const isActive = activeStage === idx;
            return (
              <button
                key={s.id}
                onClick={() => {
                  setActiveStage(idx);
                }}
                className={`group relative flex items-center gap-1.5 rounded-full px-3 sm:px-4 py-1.5 text-[11px] sm:text-[12px] font-bold tracking-wide transition-all duration-300 ${
                  isActive
                    ? "bg-[#00c896] text-[#04231b] shadow-lg shadow-[#00c896]/30 scale-105"
                    : "border border-white/10 bg-[#071324]/80 text-slate-300 hover:border-white/25 hover:text-white"
                }`}
              >
                <span>{s.pillLabel}</span>
              </button>
            );
          })}

          {/* Pause / Play Auto-advance Toggle */}
          <button
            onClick={() => setIsPlaying((p) => !p)}
            className="ml-2 grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-[#071324] text-slate-400 hover:text-white hover:border-white/30 transition-colors"
            title={isPlaying ? "Pause autoplay" : "Play autoplay"}
            aria-label="Toggle autoplay"
          >
            {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-current ml-0.5" />}
          </button>
        </div>

        {/* One Large Unified Interactive Intelligence Stage matching Reference Design */}
        <div className="mt-6 rounded-2xl border border-white/15 bg-[#061222]/90 p-4 sm:p-5 backdrop-blur-2xl shadow-2xl">
          <div className="grid lg:grid-cols-12 gap-5 items-center">
            {/* Left Column: Context Card */}
            <div className="lg:col-span-4 flex flex-col justify-between space-y-4 h-full p-1">
              <div className="space-y-3">
                {/* Stage Big Number */}
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-black text-[#00c896] font-mono leading-none">
                    {current.stageNum}
                  </span>
                  <span className="text-[10.5px] font-bold uppercase tracking-widest text-slate-400">
                    STAGE {current.stageNum} / 06
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-xl sm:text-2xl font-extrabold text-white leading-tight">
                  {current.title}
                </h3>

                {/* Short punchy description */}
                <p className="text-[12.5px] text-slate-300 leading-relaxed">
                  {current.desc}
                </p>
              </div>

              {/* Bottom Tag Capsule */}
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2.5 flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-[#00c896]/15 text-[#00c896] border border-[#00c896]/30 shrink-0">
                  <TagIcon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[11.5px] font-bold text-white leading-snug">
                    {current.tagTitle}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {current.tagSubtitle}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: One Big Visual Map with Live Animated Morphing Overlays */}
            <div className="lg:col-span-8">
              <div className="relative h-[270px] sm:h-[310px] lg:h-[340px] w-full rounded-xl overflow-hidden bg-[#030914] border border-white/10 shadow-inner">
                {/* Fixed High-Resolution Satellite Map Layer */}
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-1000"
                  style={{
                    backgroundImage: "url(/hero-vembanad.jpg)",
                    filter: "saturate(1.4) contrast(1.15) brightness(0.95)",
                  }}
                />

                {/* Map Controls */}
                <div className="absolute top-3 left-3 z-30 flex flex-col gap-0.5 rounded-md bg-black/75 p-0.5 border border-white/15 backdrop-blur-md">
                  <button className="p-1 hover:bg-white/10 rounded text-white" aria-label="Zoom in">
                    <Plus className="h-3 w-3" />
                  </button>
                  <button className="p-1 hover:bg-white/10 rounded text-white" aria-label="Zoom out">
                    <Minus className="h-3 w-3" />
                  </button>
                </div>

                {/* Scale & Compass Bar on Bottom-Left */}
                <div className="absolute bottom-3 left-3 z-30 flex items-center gap-2.5 rounded-md bg-black/80 px-2.5 py-1 text-[9.5px] text-slate-300 backdrop-blur-md border border-white/15 font-mono">
                  <span className="font-bold text-[#00c896]">N ↑</span>
                  <span>0 2.5 5 10 km</span>
                </div>

                {/* ----------------- STAGE 01: OBSERVE ----------------- */}
                {activeStage === 0 && (
                  <motion.div
                    key="stage-01"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6 }}
                    className="absolute inset-0 z-20 pointer-events-none"
                  >
                    {/* Top Right True Color Label */}
                    <div className="absolute top-3 right-3 rounded-lg bg-black/80 px-3 py-1.5 backdrop-blur border border-white/15 text-[11px] font-mono text-slate-200">
                      <div>True Color (Sentinel-2)</div>
                      <div className="text-[9.5px] text-[#00c896]">Jan 2024 · 10m GSD</div>
                    </div>
                  </motion.div>
                )}

                {/* ----------------- STAGE 02: DETECT ----------------- */}
                {activeStage === 1 && (
                  <motion.div
                    key="stage-02"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6 }}
                    className="absolute inset-0 z-20"
                  >
                    {/* Top Right Habitat Legend Card */}
                    <div className="absolute top-3 right-3 rounded-xl bg-black/85 p-2.5 backdrop-blur border border-white/15 text-[10px] space-y-1 shadow-xl">
                      <div className="font-bold text-white text-[11px] pb-1 border-b border-white/10">
                        Habitat Classification
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#10b981]" />
                        <span className="text-slate-200">Mangrove (High confidence)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#34d399]" />
                        <span className="text-slate-300">Mangrove (Medium)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#86efac]" />
                        <span className="text-slate-400">Mangrove (Low)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#059669]" />
                        <span className="text-slate-400">Other vegetation</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#0284c7]" />
                        <span className="text-slate-400">Water / Non-habitat</span>
                      </div>
                    </div>

                    {/* Detected Polygons Drawing onto Map */}
                    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 500 320">
                      <g fill="#10b981" fillOpacity="0.45" stroke="#34d399" strokeWidth="1.2">
                        <polygon points="100,55 125,48 138,72 115,85 95,70" className="animate-in fade-in duration-500" />
                        <polygon points="150,58 180,50 192,78 168,90 142,75" className="animate-in fade-in duration-600" />
                        <polygon points="210,50 242,42 258,70 230,82 205,68" className="animate-in fade-in duration-700" />
                        <polygon points="320,55 355,48 370,75 342,88 315,72" className="animate-in fade-in duration-800" />
                        <polygon points="390,60 425,52 440,80 412,92 385,78" className="animate-in fade-in duration-900" />

                        <polygon points="80,125 112,115 128,142 102,158 75,142" className="animate-in fade-in duration-600" />
                        <polygon points="135,130 168,120 185,150 155,165 128,148" className="animate-in fade-in duration-700" />
                        <polygon points="330,125 365,115 382,145 352,160 325,145" className="animate-in fade-in duration-800" />
                        <polygon points="395,130 430,122 448,152 418,168 390,150" className="animate-in fade-in duration-900" />

                        <polygon points="90,205 125,195 142,225 112,240 85,225" className="animate-in fade-in duration-700" />
                        <polygon points="145,210 180,198 198,230 168,245 138,228" className="animate-in fade-in duration-800" />
                        <polygon points="315,205 350,195 368,228 338,242 310,225" className="animate-in fade-in duration-800" />
                        <polygon points="380,210 415,198 435,230 402,245 375,228" className="animate-in fade-in duration-900" />

                        <polygon points="110,270 142,260 158,288 130,302 105,288" className="animate-in fade-in duration-700" />
                        <polygon points="295,268 330,258 348,290 318,305 290,290" className="animate-in fade-in duration-900" />
                        <polygon points="245,135 285,128 300,162 268,178 240,158" className="animate-in fade-in duration-1000" />
                      </g>
                    </svg>
                  </motion.div>
                )}

                {/* ----------------- STAGE 03: TOPOLOGY ----------------- */}
                {activeStage === 2 && (
                  <motion.div
                    key="stage-03"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6 }}
                    className="absolute inset-0 z-20"
                  >
                    {/* Top Right Network Legend Card */}
                    <div className="absolute top-3 right-3 rounded-xl bg-black/85 p-2.5 backdrop-blur border border-white/15 text-[10px] space-y-1 shadow-xl">
                      <div className="font-bold text-white text-[11px] pb-1 border-b border-white/10">
                        Network Components
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded bg-[#10b981]" />
                        <span className="text-slate-200">Habitat patch</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-0.5 w-3 bg-[#38bdf8]" />
                        <span className="text-slate-200">Connectivity link</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full border border-black bg-white" />
                        <span className="text-slate-200">Graph node</span>
                      </div>
                    </div>

                    {/* Patches + Connectivity Lines + Nodes */}
                    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 500 320">
                      {/* Habitat Polygons */}
                      <g fill="#10b981" fillOpacity="0.4" stroke="#34d399" strokeWidth="1.2">
                        <polygon points="100,55 125,48 138,72 115,85 95,70" />
                        <polygon points="150,58 180,50 192,78 168,90 142,75" />
                        <polygon points="210,50 242,42 258,70 230,82 205,68" />
                        <polygon points="320,55 355,48 370,75 342,88 315,72" />
                        <polygon points="390,60 425,52 440,80 412,92 385,78" />
                        <polygon points="80,125 112,115 128,142 102,158 75,142" />
                        <polygon points="135,130 168,120 185,150 155,165 128,148" />
                        <polygon points="330,125 365,115 382,145 352,160 325,145" />
                        <polygon points="395,130 430,122 448,152 418,168 390,150" />
                        <polygon points="90,205 125,195 142,225 112,240 85,225" />
                        <polygon points="145,210 180,198 198,230 168,245 138,228" />
                        <polygon points="315,205 350,195 368,228 338,242 310,225" />
                        <polygon points="380,210 415,198 435,230 402,245 375,228" />
                        <polygon points="245,135 285,128 300,162 268,178 240,158" />
                      </g>

                      {/* Cyan Corridors */}
                      <g stroke="#38bdf8" strokeWidth="1.6" opacity="0.9">
                        <line x1="115" y1="65" x2="165" y2="70" />
                        <line x1="165" y1="70" x2="230" y2="62" />
                        <line x1="230" y1="62" x2="340" y2="68" />
                        <line x1="340" y1="68" x2="410" y2="72" />
                        <line x1="100" y1="135" x2="155" y2="142" />
                        <line x1="155" y1="142" x2="270" y2="148" />
                        <line x1="270" y1="148" x2="350" y2="138" />
                        <line x1="350" y1="138" x2="415" y2="145" />
                        <line x1="110" y1="218" x2="165" y2="222" />
                        <line x1="165" y1="222" x2="270" y2="148" />
                        <line x1="270" y1="148" x2="335" y2="218" />
                        <line x1="335" y1="218" x2="400" y2="222" />
                      </g>

                      {/* White Nodes */}
                      <g fill="#ffffff" stroke="#040b14" strokeWidth="1.5">
                        <circle cx="115" cy="65" r="3.5" />
                        <circle cx="165" cy="70" r="3.5" />
                        <circle cx="230" cy="62" r="3.5" />
                        <circle cx="340" cy="68" r="3.5" />
                        <circle cx="410" cy="72" r="3.5" />
                        <circle cx="100" cy="135" r="3.5" />
                        <circle cx="155" cy="142" r="3.5" />
                        <circle cx="270" cy="148" r="4.5" fill="#38bdf8" stroke="#ffffff" />
                        <circle cx="350" cy="138" r="3.5" />
                        <circle cx="415" cy="145" r="3.5" />
                        <circle cx="110" cy="218" r="3.5" />
                        <circle cx="165" cy="222" r="3.5" />
                        <circle cx="335" cy="218" r="3.5" />
                        <circle cx="400" cy="222" r="3.5" />
                      </g>
                    </svg>
                  </motion.div>
                )}

                {/* ----------------- STAGE 04: CRITICALITY ----------------- */}
                {activeStage === 3 && (
                  <motion.div
                    key="stage-04"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6 }}
                    className="absolute inset-0 z-20"
                  >
                    {/* Top Right Criticality Legend Card */}
                    <div className="absolute top-3 right-3 rounded-xl bg-black/85 p-2.5 backdrop-blur border border-white/15 text-[10px] space-y-1 shadow-xl">
                      <div className="font-bold text-white text-[11px] pb-1 border-b border-white/10">
                        Patch Criticality
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" />
                        <span className="text-slate-200">Critical (highest)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#f97316]" />
                        <span className="text-slate-300">High</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#eab308]" />
                        <span className="text-slate-300">Medium</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
                        <span className="text-slate-400">Low</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-0.5 w-3 bg-[#38bdf8]" />
                        <span className="text-slate-400">Connectivity link</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full border border-black bg-white" />
                        <span className="text-slate-400">Graph node</span>
                      </div>
                    </div>

                    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 500 320">
                      {/* Polygons color-coded by criticality */}
                      <polygon points="100,55 125,48 138,72 115,85 95,70" fill="#22c55e" fillOpacity="0.4" stroke="#4ade80" strokeWidth="1.2" />
                      <polygon points="150,58 180,50 192,78 168,90 142,75" fill="#eab308" fillOpacity="0.5" stroke="#facc15" strokeWidth="1.2" />
                      <polygon points="210,50 242,42 258,70 230,82 205,68" fill="#22c55e" fillOpacity="0.4" stroke="#4ade80" strokeWidth="1.2" />
                      <polygon points="320,55 355,48 370,75 342,88 315,72" fill="#22c55e" fillOpacity="0.4" stroke="#4ade80" strokeWidth="1.2" />
                      <polygon points="390,60 425,52 440,80 412,92 385,78" fill="#22c55e" fillOpacity="0.4" stroke="#4ade80" strokeWidth="1.2" />

                      <polygon points="80,125 112,115 128,142 102,158 75,142" fill="#f97316" fillOpacity="0.55" stroke="#fb923c" strokeWidth="1.2" />
                      <polygon points="135,130 168,120 185,150 155,165 128,148" fill="#f97316" fillOpacity="0.55" stroke="#fb923c" strokeWidth="1.2" />
                      <polygon points="330,125 365,115 382,145 352,160 325,145" fill="#eab308" fillOpacity="0.5" stroke="#facc15" strokeWidth="1.2" />
                      <polygon points="395,130 430,122 448,152 418,168 390,150" fill="#22c55e" fillOpacity="0.4" stroke="#4ade80" strokeWidth="1.2" />

                      <polygon points="90,205 125,195 142,225 112,240 85,225" fill="#22c55e" fillOpacity="0.4" stroke="#4ade80" strokeWidth="1.2" />
                      <polygon points="145,210 180,198 198,230 168,245 138,228" fill="#eab308" fillOpacity="0.5" stroke="#facc15" strokeWidth="1.2" />
                      <polygon points="315,205 350,195 368,228 338,242 310,225" fill="#22c55e" fillOpacity="0.4" stroke="#4ade80" strokeWidth="1.2" />
                      <polygon points="380,210 415,198 435,230 402,245 375,228" fill="#22c55e" fillOpacity="0.4" stroke="#4ade80" strokeWidth="1.2" />

                      {/* Critical patch P17 (Glowing Red) */}
                      <polygon points="245,135 285,128 300,162 268,178 240,158" fill="#ef4444" fillOpacity="0.75" stroke="#f87171" strokeWidth="1.8" />

                      {/* Links */}
                      <g stroke="#38bdf8" strokeWidth="1.5" opacity="0.8">
                        <line x1="115" y1="65" x2="165" y2="70" />
                        <line x1="165" y1="70" x2="230" y2="62" />
                        <line x1="230" y1="62" x2="340" y2="68" />
                        <line x1="340" y1="68" x2="410" y2="72" />

                        <line x1="100" y1="135" x2="155" y2="142" />
                        <line x1="155" y1="142" x2="270" y2="148" stroke="#ef4444" strokeWidth="2.2" />
                        <line x1="270" y1="148" x2="350" y2="138" stroke="#ef4444" strokeWidth="2.2" />
                        <line x1="350" y1="138" x2="415" y2="145" />

                        <line x1="110" y1="218" x2="165" y2="222" />
                        <line x1="165" y1="222" x2="270" y2="148" stroke="#ef4444" strokeWidth="2.2" />
                        <line x1="270" y1="148" x2="335" y2="218" stroke="#ef4444" strokeWidth="2.2" />
                        <line x1="335" y1="218" x2="400" y2="222" />
                      </g>

                      {/* Nodes */}
                      <g fill="#ffffff" stroke="#040b14" strokeWidth="1.5">
                        <circle cx="115" cy="65" r="3.5" />
                        <circle cx="165" cy="70" r="3.5" />
                        <circle cx="230" cy="62" r="3.5" />
                        <circle cx="340" cy="68" r="3.5" />
                        <circle cx="410" cy="72" r="3.5" />
                        <circle cx="100" cy="135" r="3.5" />
                        <circle cx="155" cy="142" r="3.5" />
                        <circle cx="350" cy="138" r="3.5" />
                        <circle cx="415" cy="145" r="3.5" />
                        <circle cx="110" cy="218" r="3.5" />
                        <circle cx="165" cy="222" r="3.5" />
                        <circle cx="335" cy="218" r="3.5" />
                        <circle cx="400" cy="222" r="3.5" />
                      </g>

                      {/* P17 callout pill */}
                      <g>
                        <circle cx="270" cy="148" r="10" fill="#ef4444" fillOpacity="0.3" className="animate-ping" />
                        <circle cx="270" cy="148" r="5.5" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                        <rect x="284" y="140" width="38" height="16" rx="3" fill="#040b14" stroke="#ef4444" strokeWidth="1.2" />
                        <text x="303" y="151" fill="#ffffff" fontSize="8.5" fontWeight="bold" textAnchor="middle">P17</text>
                      </g>
                    </svg>
                  </motion.div>
                )}

                {/* ----------------- STAGE 05: SIMULATE ----------------- */}
                {activeStage === 4 && (
                  <motion.div
                    key="stage-05"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6 }}
                    className="absolute inset-0 z-20 p-2 sm:p-3 flex items-center justify-center gap-2 sm:gap-3 bg-black/60"
                  >
                    {/* Before Card */}
                    <div className="flex-1 h-full rounded-xl border border-white/15 bg-[#050c18]/90 p-2.5 flex flex-col justify-between backdrop-blur">
                      <div className="flex items-center justify-between pb-1 border-b border-white/10 text-[10px]">
                        <span className="font-bold text-white">Before (Current)</span>
                        <span className="text-[#00c896] font-mono">P17 selected</span>
                      </div>

                      <div className="relative h-24 w-full">
                        <svg className="h-full w-full" viewBox="0 0 200 120">
                          {/* 3 Clusters Connected */}
                          <g fill="#10b981" fillOpacity="0.4" stroke="#34d399" strokeWidth="1">
                            <polygon points="25,30 45,25 55,45 35,55 20,45" />
                            <polygon points="145,30 165,25 175,45 155,55 140,45" />
                            <polygon points="45,85 70,80 80,105 60,115 35,100" />
                            <polygon points="135,85 160,80 170,105 150,115 125,100" />
                          </g>
                          {/* Bridge P17 */}
                          <polygon points="85,55 115,50 125,75 105,85 80,70" fill="#ef4444" fillOpacity="0.65" stroke="#f87171" strokeWidth="1.2" />
                          <line x1="40" y1="40" x2="100" y2="65" stroke="#ef4444" strokeWidth="1.2" />
                          <line x1="100" y1="65" x2="155" y2="40" stroke="#ef4444" strokeWidth="1.2" />
                          <circle cx="100" cy="65" r="3.5" fill="#ef4444" stroke="#ffffff" />
                        </svg>
                      </div>

                      <div className="flex items-center justify-between text-[9.5px] pt-1 border-t border-white/10">
                        <span className="text-slate-300">2 components</span>
                        <span className="text-[#00c896] font-bold">IIC baseline</span>
                      </div>
                    </div>

                    {/* Transition Arrow */}
                    <div className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-white font-bold text-xs shrink-0">
                      →
                    </div>

                    {/* After Card */}
                    <div className="flex-1 h-full rounded-xl border border-[#ef4444]/40 bg-[#160608]/90 p-2.5 flex flex-col justify-between backdrop-blur">
                      <div className="flex items-center justify-between pb-1 border-b border-white/10 text-[10.5px]">
                        <span className="font-bold text-[#ef4444]">After (remove P17, 3.1 ha)</span>
                        <span className="text-slate-400 font-mono">Fragmented</span>
                      </div>

                      <div className="relative h-24 w-full">
                        <svg className="h-full w-full" viewBox="0 0 200 120">
                          {/* 5 Isolated Clusters */}
                          <g fill="#10b981" fillOpacity="0.3" stroke="#34d399" strokeWidth="1">
                            <polygon points="25,30 45,25 55,45 35,55 20,45" />
                            <polygon points="145,30 165,25 175,45 155,55 140,45" />
                            <polygon points="45,85 70,80 80,105 60,115 35,100" />
                            <polygon points="135,85 160,80 170,105 150,115 125,100" />
                          </g>
                          {/* Severed Disconnected P17 outline */}
                          <polygon points="85,55 115,50 125,75 105,85 80,70" fill="none" stroke="#ef4444" strokeWidth="1.2" strokeDasharray="3 3" opacity="0.6" />
                          <circle cx="100" cy="65" r="2.5" fill="#64748b" />
                          <text x="100" y="68" fill="#ef4444" fontSize="7" fontWeight="bold" textAnchor="middle">✕</text>
                        </svg>
                      </div>

                      <div className="flex items-center justify-between text-[9.5px] pt-1 border-t border-white/10">
                        <span className="text-[#ef4444] font-bold">3 components</span>
                        <span className="text-[#ef4444] font-bold">IIC −27.0%</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ----------------- STAGE 06: ACT ----------------- */}
                {activeStage === 5 && (
                  <motion.div
                    key="stage-06"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6 }}
                    className="absolute inset-0 z-20"
                  >
                    {/* Top Right Action Details Card */}
                    <div className="absolute top-3 right-3 rounded-xl bg-black/90 p-2.5 backdrop-blur border border-[#eab308]/40 text-[10px] space-y-1.5 shadow-2xl max-w-[170px]">
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-white text-[10.5px]">Action Details</div>
                        <span className="rounded bg-[#eab308]/20 text-[#eab308] px-1.5 py-0.2 text-[8px] font-bold border border-[#eab308]/30">
                          High Priority
                        </span>
                      </div>

                      <div>
                        <div className="text-[12px] font-bold text-white font-mono">C1</div>
                        <div className="text-[9px] text-slate-400">Restoration candidate</div>
                      </div>

                      <div className="space-y-0.5 bg-white/5 p-1 rounded text-[9.5px]">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Area:</span>
                          <span className="font-bold text-white">1.6 ha</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Expected Gain:</span>
                          <span className="font-bold text-[#00c896]">+1.29% IIC</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">New links:</span>
                          <span className="font-bold text-white">P01 · P06 · P13</span>
                        </div>
                      </div>

                      <Link
                        href="/restoration"
                        className="flex items-center justify-center gap-1 w-full py-1 rounded-lg bg-[#00c896] text-[#04231b] text-[9.5px] font-bold hover:bg-[#10b981] transition-colors"
                      >
                        <span>Add to Plan</span>
                        <ArrowRight className="h-2.5 w-2.5" />
                      </Link>
                    </div>

                    {/* Bottom Right Legend */}
                    <div className="absolute bottom-3 right-3 rounded-xl bg-black/85 p-2 backdrop-blur border border-white/15 text-[9px] space-y-1 shadow-xl">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded bg-[#eab308]" />
                        <span className="text-slate-200">Restoration candidate</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded bg-[#10b981]" />
                        <span className="text-slate-300">Habitat patch</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="h-0.5 w-2.5 bg-[#38bdf8]" />
                        <span className="text-slate-400">Connectivity link</span>
                      </div>
                    </div>

                    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 500 320">
                      {/* Habitat Polygons */}
                      <g fill="#10b981" fillOpacity="0.4" stroke="#34d399" strokeWidth="1.2">
                        <polygon points="100,55 125,48 138,72 115,85 95,70" />
                        <polygon points="320,55 355,48 370,75 342,88 315,72" />
                        <polygon points="80,125 112,115 128,142 102,158 75,142" />
                        <polygon points="395,130 430,122 448,152 418,168 390,150" />
                        <polygon points="90,205 125,195 142,225 112,240 85,225" />
                        <polygon points="380,210 415,198 435,230 402,245 375,228" />
                      </g>

                      {/* Restoration Candidate Polygon R-003 (Highlighted in Gold) */}
                      <polygon points="190,95 270,85 290,145 235,165 175,135" fill="#eab308" fillOpacity="0.6" stroke="#facc15" strokeWidth="1.8" strokeDasharray="4 2" />

                      {/* Corridor Reconnection Lines */}
                      <g stroke="#eab308" strokeWidth="2" strokeDasharray="3 3">
                        <line x1="115" y1="65" x2="230" y2="125" />
                        <line x1="230" y1="125" x2="340" y2="68" />
                      </g>

                      {/* Normal Corridors */}
                      <g stroke="#38bdf8" strokeWidth="1.5" opacity="0.7">
                        <line x1="100" y1="135" x2="110" y2="218" />
                        <line x1="340" y1="68" x2="415" y2="145" />
                        <line x1="415" y1="145" x2="400" y2="222" />
                      </g>

                      {/* R-003 Pin Label */}
                      <g>
                        <rect x="200" y="105" width="95" height="16" rx="3" fill="#eab308" />
                        <text x="247" y="116" fill="#040b14" fontSize="8" fontWeight="bold" textAnchor="middle">
                          Restoration candidate
                        </text>
                      </g>
                    </svg>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
