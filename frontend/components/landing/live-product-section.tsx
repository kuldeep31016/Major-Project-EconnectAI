"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Maximize2,
  Minus,
  Plus,
  Radio,
} from "lucide-react";

export function LiveProductSection() {
  const [selectedPatch, setSelectedPatch] = useState<"p16" | "p14">("p16");
  const [simulatingLoss, setSimulatingLoss] = useState(false);

  return (
    <section className="relative bg-[#050c18] py-10 lg:py-14 text-white border-t border-white/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto space-y-1.5">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#00c896]/30 bg-[#00c896]/10 px-3 py-0.5 text-[10.5px] font-semibold text-[#a7f3e0]">
            <Radio className="h-3 w-3 text-[#00c896]" />
            <span>OPERATIONAL WORKSPACE</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            From Satellite Observation to Conservation Decision
          </h2>

          <p className="text-xs sm:text-sm text-slate-300">
            Query individual patches, inspect connectivity metrics, and test what happens when a patch is lost.
          </p>
          <p className="text-[11px] text-slate-400">
            Figures: Kerala 2025 analysis run (development model — not final). The map here is a schematic; the Command Center shows the real geometry.
          </p>
        </div>

        {/* Command Center GIS Cockpit Layout */}
        <div className="mt-6 rounded-2xl border border-white/15 bg-[#081224]/95 p-4 sm:p-5 backdrop-blur-xl shadow-xl">
          <div className="grid lg:grid-cols-12 gap-5 items-start">
            {/* Left: Satellite GIS Map (Zoomed Out) */}
            <div className="lg:col-span-8 space-y-2.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-white/10 text-[11px]">
                <div className="flex items-center gap-1.5 font-bold text-white">
                  <span className="h-2 w-2 rounded-full bg-[#00c896] animate-pulse" />
                  <span>Vembanad–Kol Wetland (Kerala) · schematic view</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <span className="bg-white/5 px-2 py-0.5 rounded border border-white/10 text-[10px]">
                    24 patches
                  </span>
                  <span className="bg-[#00c896]/10 text-[#00c896] px-2 py-0.5 rounded border border-[#00c896]/20 text-[10px] font-bold">
                    Sentinel-2 10m
                  </span>
                </div>
              </div>

              {/* Map Canvas (Zoomed Out Height) */}
              <div className="relative h-[250px] sm:h-[290px] lg:h-[310px] w-full rounded-xl border border-white/10 bg-[#040a14] overflow-hidden">
                {/* Satellite Background */}
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: "url(/hero-vembanad.jpg)", opacity: 0.65 }}
                />
                <div className="absolute inset-0 bg-[#050c18]/30" />

                {/* Map Controls */}
                <div className="absolute top-2.5 left-2.5 z-10 flex flex-col gap-0.5 rounded-md bg-black/70 p-0.5 border border-white/15 backdrop-blur-md">
                  <button className="p-1 hover:bg-white/10 rounded text-white" aria-label="Zoom in">
                    <Plus className="h-3 w-3" />
                  </button>
                  <button className="p-1 hover:bg-white/10 rounded text-white" aria-label="Zoom out">
                    <Minus className="h-3 w-3" />
                  </button>
                  <button className="p-1 hover:bg-white/10 rounded text-white" aria-label="Reset zoom">
                    <Maximize2 className="h-3 w-3" />
                  </button>
                </div>

                {/* SVG Graph & Zoomed-out Polygons */}
                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 500 280">
                  {/* Zoomed Out Mangrove Habitat Polygons */}
                  <g fill="#22c55e" fillOpacity="0.35" stroke="#22c55e" strokeWidth="1.2">
                    <polygon points="105,52 125,47 134,68 116,77 98,66" />
                    <polygon points="195,58 220,50 232,74 210,82 190,70" />
                    <polygon points="310,54 336,48 348,72 326,82 305,70" />
                    <polygon points="115,138 140,130 152,154 132,166 112,152" />
                    <polygon points="335,140 360,132 372,156 350,166 330,152" />
                    <polygon points="145,216 170,210 182,232 162,242 142,230" />
                    <polygon points="285,212 310,204 322,226 302,236 282,224" />
                  </g>

                  {/* Selected Patch Highlights */}
                  {selectedPatch === "p16" && (
                    <polygon
                      points="238,132 265,126 275,150 252,162 232,148"
                      fill={simulatingLoss ? "none" : "#ef4444"}
                      fillOpacity={simulatingLoss ? "0" : "0.65"}
                      stroke="#ef4444"
                      strokeWidth="2"
                      strokeDasharray={simulatingLoss ? "3 3" : undefined}
                    />
                  )}
                  {selectedPatch === "p14" && (
                    <polygon
                      points="310,54 336,48 348,72 326,82 305,70"
                      fill={simulatingLoss ? "none" : "#38bdf8"}
                      fillOpacity={simulatingLoss ? "0" : "0.65"}
                      stroke="#38bdf8"
                      strokeWidth="2"
                      strokeDasharray={simulatingLoss ? "3 3" : undefined}
                    />
                  )}

                  {/* Network Graph Edges */}
                  <g
                    stroke="#38bdf8"
                    strokeWidth="1.6"
                    opacity={simulatingLoss && selectedPatch === "p16" ? 0.25 : 0.8}
                  >
                    <line x1="116" y1="62" x2="210" y2="66" />
                    <line x1="210" y1="66" x2="326" y2="65" />
                    <line x1="116" y1="62" x2="132" y2="148" />
                    <line x1="132" y1="148" x2="252" y2="144" />
                    <line x1="252" y1="144" x2="350" y2="149" />
                    <line x1="326" y1="65" x2="350" y2="149" />
                    <line x1="132" y1="148" x2="162" y2="226" />
                    <line x1="252" y1="144" x2="302" y2="220" />
                  </g>

                  {/* Nodes */}
                  <g fill="#ffffff" stroke="#050c18" strokeWidth="1.5">
                    <circle cx="116" cy="62" r="3.5" />
                    <circle cx="210" cy="66" r="3.5" />
                    <circle cx="326" cy="65" r="4" />
                    <circle cx="132" cy="148" r="3.5" />
                    <circle cx="350" cy="149" r="3.5" />
                    <circle cx="162" cy="226" r="3.5" />
                    <circle cx="302" cy="220" r="3.5" />
                  </g>

                  {/* Active Selected Node */}
                  {selectedPatch === "p16" && (
                    <g>
                      {!simulatingLoss && (
                        <circle cx="252" cy="144" r="8" fill="#ef4444" fillOpacity="0.3" className="animate-ping" />
                      )}
                      <circle
                        cx="252"
                        cy="144"
                        r="5.5"
                        fill={simulatingLoss ? "#64748b" : "#ef4444"}
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                      <text x="252" y="147" fill="#ffffff" fontSize="7" fontWeight="bold" textAnchor="middle">
                        {simulatingLoss ? "X" : "16"}
                      </text>
                    </g>
                  )}
                </svg>

                {/* Interactive Patch Switcher Tabs */}
                <div className="absolute bottom-2.5 left-2.5 z-10 flex items-center gap-1.5 rounded-lg bg-black/80 p-1 backdrop-blur-md border border-white/15 text-[10px]">
                  <span className="text-slate-400 px-1">Select:</span>
                  <button
                    onClick={() => {
                      setSelectedPatch("p16");
                      setSimulatingLoss(false);
                    }}
                    className={`px-2 py-0.5 rounded font-bold transition-all ${
                      selectedPatch === "p16"
                        ? "bg-[#ef4444] text-white shadow"
                        : "bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    P17 (cut vertex)
                  </button>
                  <button
                    onClick={() => {
                      setSelectedPatch("p14");
                      setSimulatingLoss(false);
                    }}
                    className={`px-2 py-0.5 rounded font-bold transition-all ${
                      selectedPatch === "p14"
                        ? "bg-[#38bdf8] text-[#04231b] shadow"
                        : "bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    P01 (largest patch)
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Selected Patch Inspector & Scenario Simulation */}
            <div className="lg:col-span-4 space-y-2.5">
              {/* Selected Patch Panel */}
              <div className="rounded-xl border border-white/10 bg-[#0c162e] p-3.5 space-y-2.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
                  <div>
                    <div className="text-[9px] uppercase font-bold text-slate-400">Patch ID</div>
                    <div className="text-base font-mono font-bold text-white">
                      {selectedPatch === "p16" ? "P17" : "P01"}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9.5px] font-bold border ${
                      selectedPatch === "p16"
                        ? "bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/30"
                        : "bg-[#38bdf8]/20 text-[#38bdf8] border-[#38bdf8]/30"
                    }`}
                  >
                    {selectedPatch === "p16" ? "Critical · cut vertex" : "Critical · largest patch"}
                  </span>
                </div>

                {/* Attributes Grid */}
                <div className="grid grid-cols-2 gap-1.5 text-[10.5px]">
                  <div className="bg-white/5 p-1.5 rounded-lg border border-white/5">
                    <div className="text-slate-400 text-[8.5px]">Habitat Area</div>
                    <div className="text-[12px] font-bold text-white mt-0.5">
                      {selectedPatch === "p16" ? "3.13 ha" : "35.1 ha"}
                    </div>
                    <div className="text-[8.5px] text-slate-400">
                      {selectedPatch === "p16" ? "1.4% of habitat" : "16.0% of habitat"}
                    </div>
                  </div>

                  <div className="bg-white/5 p-1.5 rounded-lg border border-white/5">
                    <div className="text-slate-400 text-[8.5px]">Connectivity Loss</div>
                    <div
                      className={`text-[12px] font-bold mt-0.5 ${
                        selectedPatch === "p16" ? "text-[#ef4444]" : "text-slate-200"
                      }`}
                    >
                      {selectedPatch === "p16" ? "-27.0% IIC" : "-30.7% IIC"}
                    </div>
                    <div className="text-[8.5px] text-slate-400">
                      {selectedPatch === "p16" ? "Rank #3 of 24" : "Rank #1 of 24"}
                    </div>
                  </div>

                  <div className="bg-white/5 p-1.5 rounded-lg border border-white/5">
                    <div className="text-slate-400 text-[8.5px]">Confidence</div>
                    <div className="text-[12px] font-bold text-[#00c896] mt-0.5">
                      {selectedPatch === "p16" ? "0.84" : "0.88"}
                    </div>
                  </div>

                  <div className="bg-white/5 p-1.5 rounded-lg border border-white/5">
                    <div className="text-slate-400 text-[8.5px]">Corridors</div>
                    <div className="text-[12px] font-bold text-white mt-0.5">
                      {selectedPatch === "p16" ? "4 links" : "5 links"}
                    </div>
                  </div>
                </div>

                <Link
                  href="/analysis?scene=kerala-coast"
                  className="flex items-center justify-center w-full py-1.5 rounded-lg bg-[#00c896] font-bold text-[11.5px] text-[#04231b] hover:bg-[#10b981] transition-colors"
                >
                  View Full GIS Analysis
                </Link>
              </div>

              {/* “What happens if this patch is removed?” */}
              <div className="rounded-xl border border-[#ef4444]/30 bg-[#ef4444]/10 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11.5px] font-bold text-white flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-[#ef4444]" />
                    What happens if this patch is removed?
                  </h4>
                  <button
                    onClick={() => setSimulatingLoss((s) => !s)}
                    className="text-[9.5px] font-bold bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded text-white transition-colors"
                  >
                    {simulatingLoss ? "Reset" : "Test Loss"}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-1 text-center text-[10px] bg-black/40 p-1.5 rounded-lg border border-white/5">
                  <div>
                    <div className="text-[8px] text-slate-400">Before</div>
                    <div className="font-bold text-[#00c896] mt-0.5">2 components</div>
                  </div>
                  <div className="flex items-center justify-center text-slate-500 font-bold text-[10px]">
                    →
                  </div>
                  <div>
                    <div className="text-[8px] text-slate-400">After Loss</div>
                    <div
                      className={`font-bold mt-0.5 ${
                        selectedPatch === "p16" ? "text-[#ef4444]" : "text-[#00c896]"
                      }`}
                    >
                      {selectedPatch === "p16" ? "3 components" : "2 components"}
                    </div>
                  </div>
                </div>

                <p className="text-[10.5px] text-slate-300 leading-snug">
                  {selectedPatch === "p16"
                    ? "Removing P17 (1.4% of habitat) cuts IIC by 27.0% and splits the network into 3 components."
                    : "Removing P01 cuts IIC by 30.7% but costs 16% of habitat; alternative routes keep 2 components."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
