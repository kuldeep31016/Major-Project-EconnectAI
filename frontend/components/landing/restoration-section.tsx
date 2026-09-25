"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Sprout,
} from "lucide-react";

interface RestorationCandidate {
  id: string;
  name: string;
  areaHa: number;
  gainPct: string;
  affectedPatches: string;
  confidence: string;
  priorityLevel: "High" | "Medium" | "Strategic";
  rationale: string;
}

const CANDIDATES: RestorationCandidate[] = [
  // Real candidates from the Kerala 2025 analysis run (kerala-coast_20260920T182222Z) — development model, not final.
  {
    id: "C1",
    name: "Candidate C1 — marginal-habitat site",
    areaHa: 1.6,
    gainPct: "+1.29% IIC",
    affectedPatches: "3 new links: P01, P06, P13",
    confidence: "model probability 0.3–0.5 (marginal)",
    priorityLevel: "High",
    rationale: "Largest connectivity gain of the four candidates; nearest existing habitat 0.58 km away.",
  },
  {
    id: "C2",
    name: "Candidate C2 — marginal-habitat site",
    areaHa: 1.3,
    gainPct: "+1.04% IIC",
    affectedPatches: "3 new links: P02, P06, P12",
    confidence: "model probability 0.3–0.5 (marginal)",
    priorityLevel: "High",
    rationale: "Second-ranked by gain; links the central group of patches.",
  },
  {
    id: "C3",
    name: "Candidate C3 — marginal-habitat site",
    areaHa: 1.1,
    gainPct: "+0.83% IIC",
    affectedPatches: "3 new links: P01, P11, P13",
    confidence: "model probability 0.3–0.5 (marginal)",
    priorityLevel: "Medium",
    rationale: "Adjacent to existing habitat (0.09 km); smaller gain.",
  },
];

export function RestorationSection() {
  const [selectedCandidate, setSelectedCandidate] = useState<string>("C1");
  const active = CANDIDATES.find((c) => c.id === selectedCandidate) || CANDIDATES[0];

  return (
    <section id="restoration" className="relative bg-[#060e1d] py-16 lg:py-20 text-white border-t border-white/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#00c896]/30 bg-[#00c896]/10 px-3 py-0.5 text-[11px] font-semibold text-[#a7f3e0]">
            <Sprout className="h-3 w-3 text-[#00c896]" />
            <span>Targeted Habitat Reconnection</span>
          </div>

          <h2 className="mt-3 text-2xl sm:text-3xl lg:text-[32px] font-extrabold tracking-tight">
            From Analysis to Restoration
          </h2>

          <p className="mt-2 text-[13.5px] text-slate-300 leading-relaxed">
            Prioritize conservation interventions based on connectivity gained rather than simple
            land size. Candidates are ranked by connectivity gain; cost-aware ranking only when validated cost data is supplied.
          </p>
        </div>

        {/* 5-Step Strategic Restoration Workflow Bar */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
          {[
            { step: "01", name: "Candidate Area", desc: "Marginal model probability" },
            { step: "02", name: "Connectivity Gain", desc: "Simulate graph addition" },
            { step: "03", name: "Feasibility", desc: "Rules over available layers" },
            { step: "04", name: "Priority Ranking", desc: "Ranked by connectivity gain" },
            { step: "05", name: "Field Verification", desc: "Field assessment task" },
          ].map((s) => (
            <div
              key={s.step}
              className="rounded-lg border border-white/10 bg-[#081224] p-2.5 flex flex-col justify-between"
            >
              <span className="font-mono text-[10px] font-bold text-[#00c896]">{s.step}</span>
              <div className="font-bold text-white text-[12px] mt-0.5">{s.name}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{s.desc}</div>
            </div>
          ))}
        </div>

        {/* Map Overlay & Opportunity Card */}
        <div className="mt-8 grid lg:grid-cols-12 gap-6 items-stretch">
          {/* Left: Satellite Map with Restoration Polygon Highlights */}
          <div className="lg:col-span-7 relative rounded-2xl border border-white/15 bg-[#040914] overflow-hidden min-h-[340px] p-3.5 flex flex-col justify-between">
            <div
              className="absolute inset-0 bg-cover bg-center opacity-60"
              style={{ backgroundImage: "url(/hero-vembanad.jpg)" }}
            />
            <div className="absolute inset-0 bg-[#050c18]/40" />

            {/* Top Bar */}
            <div className="relative z-10 flex justify-between items-center text-[10.5px]">
              <span className="bg-black/70 text-white px-2.5 py-0.5 rounded backdrop-blur border border-white/10">
                Kerala Backwaters · Candidate Layer
              </span>
              <span className="bg-[#00c896]/20 text-[#00c896] px-2 py-0.5 rounded backdrop-blur font-bold border border-[#00c896]/30">
                Top 3 of 4 candidates · schematic
              </span>
            </div>

            {/* SVG Visual Polygon Overlay */}
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 280">
              {/* Existing Mangroves (Green) */}
              <polygon points="60,60 120,50 140,110 80,120" fill="#22c55e" fillOpacity="0.3" stroke="#22c55e" strokeWidth="1.5" />
              <polygon points="260,70 340,60 360,130 290,140" fill="#22c55e" fillOpacity="0.3" stroke="#22c55e" strokeWidth="1.5" />
              <polygon points="170,190 240,180 260,240 190,250" fill="#22c55e" fillOpacity="0.3" stroke="#22c55e" strokeWidth="1.5" />

              {/* Restoration Candidate C1 */}
              <g className="cursor-pointer" onClick={() => setSelectedCandidate("C1")}>
                <polygon
                  points="145,85 245,80 255,120 155,125"
                  fill={selectedCandidate === "C1" ? "#00c896" : "#f59e0b"}
                  fillOpacity="0.55"
                  stroke={selectedCandidate === "C1" ? "#00c896" : "#f59e0b"}
                  strokeWidth="2.5"
                  strokeDasharray="4 2"
                />
                <circle cx="200" cy="102" r="5" fill="#00c896" stroke="#ffffff" strokeWidth="1.5" />
                <text x="200" y="93" fill="#ffffff" fontSize="9" fontWeight="bold" textAnchor="middle">
                  Candidate C1
                </text>
              </g>

              {/* Restoration Candidate C2 */}
              <g className="cursor-pointer" onClick={() => setSelectedCandidate("C2")}>
                <polygon
                  points="210,140 280,135 290,175 220,180"
                  fill={selectedCandidate === "C2" ? "#00c896" : "#f59e0b"}
                  fillOpacity="0.45"
                  stroke={selectedCandidate === "C2" ? "#00c896" : "#f59e0b"}
                  strokeWidth="2"
                  strokeDasharray="4 2"
                />
                <circle cx="250" cy="158" r="4.5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" />
              </g>

              {/* Proposed Corridor Edge Lines */}
              <line x1="140" y1="110" x2="200" y2="102" stroke="#00c896" strokeWidth="2" strokeDasharray="3 3" />
              <line x1="200" y1="102" x2="260" y2="70" stroke="#00c896" strokeWidth="2" strokeDasharray="3 3" />
            </svg>

            {/* Bottom Status */}
            <div className="relative z-10 bg-black/80 p-2 rounded-lg backdrop-blur border border-white/10 text-[10px] text-slate-300 flex justify-between items-center">
              <span>Click polygon to inspect opportunity</span>
              <span className="font-mono text-[#00c896] font-bold">Gain: {active.gainPct} · no cost data</span>
            </div>
          </div>

          {/* Right: Restoration Opportunity Card */}
          <div className="lg:col-span-5 rounded-2xl border border-white/15 bg-[#081224]/95 p-5 backdrop-blur-xl shadow-xl flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#00c896]">
                  RESTORATION OPPORTUNITY
                </span>
                <span className="px-2 py-0.2 rounded-full text-[9.5px] font-bold bg-[#00c896]/20 text-[#00c896] border border-[#00c896]/30">
                  {active.priorityLevel} Priority
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white">{active.name}</h3>
                <p className="text-[12px] text-slate-300 mt-0.5 leading-relaxed">{active.rationale}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-white/5 p-2.5 rounded-lg border border-white/5">
                  <div className="text-[9px] uppercase font-semibold text-slate-400">
                    Candidate Area
                  </div>
                  <div className="text-base font-bold text-white mt-0.5">{active.areaHa} ha</div>
                </div>

                <div className="bg-[#00c896]/10 p-2.5 rounded-lg border border-[#00c896]/25">
                  <div className="text-[9px] uppercase font-semibold text-[#00c896]">
                    Connectivity Gain
                  </div>
                  <div className="text-base font-bold text-[#00c896] mt-0.5">{active.gainPct}</div>
                </div>
              </div>

              <div className="space-y-1.5 text-[11px]">
                <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                  <div className="text-[9px] text-slate-400">Affected Patches Reconnected</div>
                  <div className="font-semibold text-white mt-0.2">{active.affectedPatches}</div>
                </div>

                <div className="bg-white/5 p-2 rounded-lg border border-white/5">
                  <div className="text-[9px] text-slate-400">Candidate source</div>
                  <div className="font-semibold text-[#38bdf8] mt-0.2">{active.confidence}</div>
                </div>
              </div>
            </div>

            <div className="pt-3 mt-3 border-t border-white/10">
              <Link
                href="/restoration"
                className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-lg bg-gradient-to-r from-[#00c896] to-[#10b981] font-bold text-[12.5px] text-[#04231b] hover:scale-[1.01] active:scale-[0.98] transition-all shadow-md shadow-[#00c896]/20"
              >
                <span>Open Restoration Planner</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
