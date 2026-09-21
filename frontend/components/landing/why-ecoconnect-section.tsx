"use client";

import {
  FileCheck,
  GitBranch,
  Network,
  Radio,
  ShieldCheck,
  Sprout,
} from "lucide-react";

const PILLARS = [
  {
    step: "Observe",
    title: "Dual-Sensor Satellite Observation",
    desc: "Seamlessly fuses Sentinel-1 SAR all-weather radar with Sentinel-2 10m multispectral imagery to capture tropical coastlines through cloud cover and darkness.",
    icon: Radio,
  },
  {
    step: "Analyze",
    title: "Graph-Theoretic Landscape Topology",
    desc: "Moves beyond superficial pixel counts to price ecosystem connectivity as a weighted network, uncovering hidden stepping stones that maintain coastal resilience.",
    icon: Network,
  },
  {
    step: "Explain",
    title: "Deterministic Rule-Based Evidence",
    desc: "Reports exact geometric and network evidence behind every criticality score — area, degree, cut-vertex role, and measured loss — with zero black-box hallucination.",
    icon: FileCheck,
  },
  {
    step: "Simulate",
    title: "What-If Stress Testing",
    desc: "Quantifies the downstream network impact of proposed coastal infrastructure, port dredging, or cyclonic breaches before irreversible land-use decisions occur.",
    icon: GitBranch,
  },
  {
    step: "Prioritise",
    title: "Quantitative Restoration Allocation",
    desc: "Inverts sensitivity analysis to prioritize restoration interventions by connectivity returned, maximizing ecological gain under finite municipal budgets.",
    icon: Sprout,
  },
  {
    step: "Verify",
    title: "Frontline Ranger Field Verification",
    desc: "Connects satellite model predictions with GPS patrol tasks, mobile evidence photos, and ground officer sign-off for audit-ready compliance.",
    icon: ShieldCheck,
  },
];

export function WhyEcoConnectSection() {
  return (
    <section id="why-ecoconnect" className="relative bg-[#050c18] py-16 lg:py-20 text-white border-t border-white/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Large Statement Callout Banner */}
        <div className="rounded-2xl border border-white/15 bg-gradient-to-br from-[#0c182e]/90 via-[#071324]/95 to-[#042018]/90 p-6 lg:p-10 backdrop-blur-xl shadow-xl text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#00c896]/30 bg-[#00c896]/10 px-3 py-0.5 text-[11px] font-semibold text-[#a7f3e0]">
            <ShieldCheck className="h-3 w-3 text-[#00c896]" />
            <span>The Decision-Support Philosophy</span>
          </div>

          <h2 className="mt-4 text-xl sm:text-2xl lg:text-[26px] font-extrabold tracking-tight text-white leading-snug">
            &ldquo;AI recommends. Evidence explains. GIS contextualizes. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00c896] via-[#38bdf8] to-[#86efac]">
              Scenarios quantify. Officers decide. Field verification confirms.&rdquo;
            </span>
          </h2>

          <p className="mt-3 text-[13px] text-slate-300 max-w-xl mx-auto leading-relaxed">
            EcoConnectAI equips conservation authorities with structural evidence required for
            defensible, transparent coastal planning.
          </p>
        </div>

        {/* 6 Capability Combination Pillars */}
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.step}
                className="rounded-xl border border-white/10 bg-[#081224]/80 p-4.5 backdrop-blur-xl transition-all duration-200 hover:border-[#00c896]/40 hover:bg-[#0b162a]"
              >
                <div className="flex items-center justify-between">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#00c896]/15 text-[#00c896] border border-[#00c896]/30">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#00c896] bg-[#00c896]/10 px-2 py-0.5 rounded border border-[#00c896]/20">
                    {p.step}
                  </span>
                </div>

                <h3 className="mt-3 text-[15px] font-bold text-white leading-snug">
                  {p.title}
                </h3>

                <p className="mt-1.5 text-[12px] text-slate-300 leading-relaxed">
                  {p.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
