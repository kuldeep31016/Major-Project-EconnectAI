"use client";

import {
  CloudLightning,
  Coins,
  Cpu,
  Eye,
  FileCheck,
  GitBranch,
  Layers,
  Network,
  Radio,
  Scale,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

const PILLARS = [
  {
    icon: Radio,
    title: "All-Weather SAR Radar Penetration",
    desc: "Tropical mangrove belts frequently lose weeks to dense monsoonal cloud cover. EcoConnectAI incorporates Sentinel-1 SAR radar backscatter that ignores cloud cover and darkness.",
    tag: "Dual-Sensor Architecture",
  },
  {
    icon: Network,
    title: "Graph-Theoretic Landscape Connectivity",
    desc: "Moves beyond pixel counts to model ecosystems as weighted spatial networks G(V, E). Calculates Integral Index of Connectivity (IIC) and Equivalent Connected Area (ECA).",
    tag: "Ecological Network Science",
  },
  {
    icon: Zap,
    title: "Exact Leave-One-Out Criticality (Si)",
    desc: "Identifies stepping-stone bridge patches that hold fragmented landscapes together, uncovering high-risk bottlenecks that traditional area-based ranking overlooks.",
    tag: "Sensitivity Analysis",
  },
  {
    icon: FileCheck,
    title: "Zero-Hallucination Rule-Based XAI",
    desc: "Reports exact mathematical graph evidence behind every score — degree, cut-vertex role, neighbor distances, and ΔCi — providing trustworthy audit trails for forest officers.",
    tag: "Explainable AI (XAI)",
  },
  {
    icon: Coins,
    title: "Cost-Aware Restoration Prioritization",
    desc: "Inverts sensitivity analysis to calculate connectivity gain per INR lakh invested (Ri / Costi), maximizing ecological resilience under real-world municipal budgets.",
    tag: "Capital Efficiency",
  },
  {
    icon: ShieldCheck,
    title: "Frontline Ranger Field Verification",
    desc: "Seamlessly dispatches patrol tasks to forest rangers with GPS waypoints, bridging satellite AI predictions with ground truth vegetation surveys.",
    tag: "Ground-Truth Loop",
  },
];

export function DifferentiatorsSection() {
  return (
    <section id="science" className="relative bg-[#050816] py-20 lg:py-28 text-white border-t border-white/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#38bdf8]/30 bg-[#38bdf8]/10 px-3.5 py-1 text-[12px] font-semibold text-[#7dd3fc]">
            <ShieldCheck className="h-3.5 w-3.5 text-[#38bdf8]" />
            <span>Scientific & Enterprise Advantages</span>
          </div>
          <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
            Engineered for Real-World <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#38bdf8] via-[#00c896] to-[#86efac]">
              Conservation Impact
            </span>
          </h2>
          <p className="mt-4 text-[16px] text-slate-300 leading-relaxed">
            EcoConnectAI bridges the gap between remote sensing imagery, graph network algorithms,
            and operational conservation planning.
          </p>
        </div>

        {/* 6-Pillar Grid */}
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((p, idx) => {
            const Icon = p.icon;
            return (
              <div
                key={idx}
                className="group relative rounded-2xl border border-white/10 bg-[#0a1224]/80 p-6 backdrop-blur-xl transition-all duration-300 hover:border-[#00c896]/50 hover:bg-[#0e1933] hover:shadow-xl hover:shadow-[#00c896]/5"
              >
                <div className="flex items-center justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#00c896]/15 text-[#00c896] border border-[#00c896]/30 group-hover:scale-110 transition-transform">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
                    {p.tag}
                  </span>
                </div>

                <h3 className="mt-5 text-[17px] font-bold text-white group-hover:text-[#00c896] transition-colors leading-snug">
                  {p.title}
                </h3>

                <p className="mt-2.5 text-[13.5px] text-slate-300 leading-relaxed">
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
