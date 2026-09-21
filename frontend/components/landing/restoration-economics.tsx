"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Coins,
  DollarSign,
  HelpCircle,
  Info,
  Scale,
  Sliders,
  Sparkles,
  Sprout,
  TrendingUp,
} from "lucide-react";

interface Candidate {
  id: string;
  name: string;
  areaHa: number;
  gainPct: number;
  costLakh: number;
  priorityScore: number;
  rankByCost: number;
  rankByGain: number;
  rationale: string;
}

const CANDIDATES: Candidate[] = [
  {
    id: "C1",
    name: "Candidate C1 (Perumpalam Strait)",
    areaHa: 101.7,
    gainPct: 2.73,
    costLakh: 466,
    priorityScore: 5.9,
    rankByCost: 1,
    rankByGain: 2,
    rationale: "Creates optimal dual-corridor bridge with modest channel dredging costs.",
  },
  {
    id: "C2",
    name: "Candidate C2 (Vaikom South Edge)",
    areaHa: 69.0,
    gainPct: 1.83,
    costLakh: 332,
    priorityScore: 5.5,
    rankByCost: 2,
    rankByGain: 3,
    rationale: "High connectivity return reconnecting isolated fishing cove.",
  },
  {
    id: "C3",
    name: "Candidate C3 (Kumarakom Extension)",
    areaHa: 23.8,
    gainPct: 0.56,
    costLakh: 119,
    priorityScore: 4.7,
    rankByCost: 3,
    rankByGain: 6,
    rationale: "Low absolute cost stepping stone.",
  },
  {
    id: "C4",
    name: "Candidate C4 (Muhamma Shallows)",
    areaHa: 53.4,
    gainPct: 1.36,
    costLakh: 302,
    priorityScore: 4.5,
    rankByCost: 4,
    rankByGain: 4,
    rationale: "Solid stepping stone bridging north-central subnets.",
  },
  {
    id: "C5",
    name: "Candidate C5 (Aroor Mudflats)",
    areaHa: 143.0,
    gainPct: 3.50,
    costLakh: 807,
    priorityScore: 4.3,
    rankByCost: 5,
    rankByGain: 1,
    rationale: "Highest raw gain (+3.50%), but extremely expensive (INR 807 Lakh).",
  },
  {
    id: "C6",
    name: "Candidate C6 (Thanneermukkom Basin)",
    areaHa: 34.6,
    gainPct: 0.84,
    costLakh: 195,
    priorityScore: 4.3,
    rankByCost: 6,
    rankByGain: 5,
    rationale: "Moderate cost peripheral reinforcement.",
  },
  {
    id: "C7",
    name: "Candidate C7 (Nettoor Channel)",
    areaHa: 78.3,
    gainPct: 0.50,
    costLakh: 200,
    priorityScore: 2.5,
    rankByCost: 7,
    rankByGain: 7,
    rationale: "Poor topology placement yielding low global connectivity impact.",
  },
  {
    id: "C8",
    name: "Candidate C8 (Chellanam Marsh)",
    areaHa: 69.5,
    gainPct: 0.07,
    costLakh: 233,
    priorityScore: 0.3,
    rankByCost: 8,
    rankByGain: 8,
    rationale: "Only forms 1 peripheral edge. Low ecological utility.",
  },
];

export function RestorationEconomics() {
  const [budgetLakh, setBudgetLakh] = useState<number>(1000);
  const [rankingMode, setRankingMode] = useState<"roi" | "raw">("roi");

  const sortedCandidates = [...CANDIDATES].sort((a, b) =>
    rankingMode === "roi" ? a.rankByCost - b.rankByCost : a.rankByGain - b.rankByGain
  );

  // Calculate cumulative budget allocation
  let runningCost = 0;
  let totalGain = 0;
  const fundedCount = sortedCandidates.filter((c) => {
    if (runningCost + c.costLakh <= budgetLakh) {
      runningCost += c.costLakh;
      totalGain += c.gainPct;
      return true;
    }
    return false;
  }).length;

  return (
    <section id="economics" className="relative bg-[#080d1e] py-20 lg:py-28 text-white border-t border-white/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#00c896]/30 bg-[#00c896]/10 px-3.5 py-1 text-[12px] font-semibold text-[#a7f3e0]">
            <Coins className="h-3.5 w-3.5 text-[#00c896]" />
            <span>Quantitative Restoration Decision Support</span>
          </div>
          <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
            Restoration Economics: <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00c896] via-[#38bdf8] to-[#a78bfa]">
              Gain Per Rupee vs. Raw Hectares
            </span>
          </h2>
          <p className="mt-4 text-[16px] text-slate-300 leading-relaxed">
            Planners frequently face limited budgets. EcoConnectAI inverts the sensitivity engine to
            simulate node addition ($R_i$), pricing connectivity return per unit of public expenditure.
          </p>
        </div>

        {/* Interactive Budget Simulator Box */}
        <div className="mt-12 rounded-3xl border border-white/15 bg-[#0c1529]/95 p-6 lg:p-8 backdrop-blur-2xl shadow-2xl">
          {/* Controls Bar */}
          <div className="grid md:grid-cols-12 gap-6 items-center pb-6 border-b border-white/10">
            {/* Slider */}
            <div className="md:col-span-7 space-y-2">
              <div className="flex items-center justify-between text-[13px]">
                <span className="font-semibold text-slate-300 flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-[#00c896]" />
                  Simulate Available Restoration Budget:
                </span>
                <span className="font-mono font-bold text-lg text-[#00c896]">
                  ₹ {budgetLakh.toLocaleString()} Lakh (₹ {(budgetLakh / 100).toFixed(2)} Cr)
                </span>
              </div>
              <input
                type="range"
                min="200"
                max="2500"
                step="50"
                value={budgetLakh}
                onChange={(e) => setBudgetLakh(Number(e.target.value))}
                className="w-full accent-[#00c896] cursor-pointer"
              />
              <div className="flex justify-between text-[10.5px] text-slate-400">
                <span>₹ 200 Lakh (Pilot)</span>
                <span>₹ 1,000 Lakh (District Plan)</span>
                <span>₹ 2,500 Lakh (State Masterplan)</span>
              </div>
            </div>

            {/* Ranking Mode Toggle */}
            <div className="md:col-span-5 flex flex-col sm:flex-row md:justify-end gap-2">
              <button
                onClick={() => setRankingMode("roi")}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[12.5px] font-bold transition-all ${
                  rankingMode === "roi"
                    ? "bg-[#00c896] text-[#04231b] shadow-lg shadow-[#00c896]/20"
                    : "bg-white/5 text-slate-300 hover:bg-white/10"
                }`}
              >
                <TrendingUp className="h-4 w-4" />
                <span>EcoConnectAI (Ri / Cost)</span>
              </button>
              <button
                onClick={() => setRankingMode("raw")}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[12.5px] font-bold transition-all ${
                  rankingMode === "raw"
                    ? "bg-[#38bdf8] text-[#04231b] shadow-lg shadow-[#38bdf8]/20"
                    : "bg-white/5 text-slate-300 hover:bg-white/10"
                }`}
              >
                <Scale className="h-4 w-4" />
                <span>Raw Area / Gain Only</span>
              </button>
            </div>
          </div>

          {/* Aggregate Outcomes Summary Banner */}
          <div className="my-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white/5 p-3 rounded-xl border border-white/10">
              <div className="text-[11px] text-slate-400">Funded Sites</div>
              <div className="text-xl font-extrabold text-white mt-0.5">
                {fundedCount} of {CANDIDATES.length}
              </div>
            </div>
            <div className="bg-white/5 p-3 rounded-xl border border-white/10">
              <div className="text-[11px] text-slate-400">Total Capital Committed</div>
              <div className="text-xl font-extrabold text-[#00c896] mt-0.5">
                ₹ {runningCost.toLocaleString()} Lakh
              </div>
            </div>
            <div className="bg-white/5 p-3 rounded-xl border border-white/10">
              <div className="text-[11px] text-slate-400">Cumulative Connectivity Won</div>
              <div className="text-xl font-extrabold text-[#38bdf8] mt-0.5">
                +{totalGain.toFixed(2)}%
              </div>
            </div>
            <div className="bg-white/5 p-3 rounded-xl border border-white/10">
              <div className="text-[11px] text-slate-400">Unallocated Reserves</div>
              <div className="text-xl font-extrabold text-slate-300 mt-0.5">
                ₹ {(budgetLakh - runningCost).toLocaleString()} Lakh
              </div>
            </div>
          </div>

          {/* Candidates Comparison Table */}
          <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#060c18]">
            <table className="w-full text-left text-[12.5px]">
              <thead className="bg-white/5 text-[11px] uppercase tracking-wider text-slate-400 border-b border-white/10">
                <tr>
                  <th className="py-3 px-4">Rank</th>
                  <th className="py-3 px-4">Candidate Site</th>
                  <th className="py-3 px-4">Area (ha)</th>
                  <th className="py-3 px-4">Network Gain (Ri)</th>
                  <th className="py-3 px-4">Est. Cost</th>
                  <th className="py-3 px-4">Priority Score (Ri / Cost)</th>
                  <th className="py-3 px-4">Budget Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-medium">
                {sortedCandidates.map((c, index) => {
                  // check if funded
                  let costSumBefore = 0;
                  for (let i = 0; i < index; i++) {
                    costSumBefore += sortedCandidates[i].costLakh;
                  }
                  const isFunded = costSumBefore + c.costLakh <= budgetLakh;

                  return (
                    <tr
                      key={c.id}
                      className={`transition-colors ${
                        isFunded ? "bg-[#00c896]/[0.04] text-white" : "opacity-40 text-slate-400"
                      }`}
                    >
                      <td className="py-3 px-4 font-bold text-center">
                        <span
                          className={`inline-grid h-6 w-6 place-items-center rounded-full text-[11px] ${
                            isFunded
                              ? "bg-[#00c896] text-[#04231b]"
                              : "bg-white/10 text-slate-400"
                          }`}
                        >
                          #{index + 1}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{c.name}</div>
                        <div className="text-[11px] text-slate-400">{c.rationale}</div>
                      </td>
                      <td className="py-3 px-4">{c.areaHa} ha</td>
                      <td className="py-3 px-4 font-bold text-[#38bdf8]">+{c.gainPct.toFixed(2)}%</td>
                      <td className="py-3 px-4">₹ {c.costLakh} Lakh</td>
                      <td className="py-3 px-4 font-mono font-bold text-[#00c896]">
                        {c.priorityScore.toFixed(1)} × 10⁻³
                      </td>
                      <td className="py-3 px-4">
                        {isFunded ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#00c896]/20 px-2.5 py-0.5 text-[11px] font-bold text-[#00c896] border border-[#00c896]/30">
                            <CheckCircle2 className="h-3 w-3" /> Funded
                          </span>
                        ) : (
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10.5px] text-slate-400">
                            Above Budget
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Key Insight Box */}
          <div className="mt-5 p-4 rounded-xl bg-[#00c896]/10 border border-[#00c896]/25 text-[12.5px] text-slate-200 flex items-start gap-3">
            <Info className="h-5 w-5 text-[#00c896] shrink-0 mt-0.5" />
            <div>
              <strong>Key Demonstration (Section VI-E of Foundation Paper):</strong> Candidate C5
              buys the single largest raw gain (+3.50%), but costs INR 807 Lakh and drops to 5th place
              once cost is accounted for. Candidate C1 (+2.73% at INR 466 Lakh) takes 1st rank.
              Ranking solely by restored hectares would fail to deliver maximum network connectivity per rupee.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
