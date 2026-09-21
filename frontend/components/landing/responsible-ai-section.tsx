"use client";

import {
  CheckCircle2,
  Clock,
  Cpu,
  FileCheck,
  Layers,
  Radio,
  Satellite,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

export function ResponsibleAISection() {
  const steps = [
    {
      label: "Satellite Evidence",
      desc: "Copernicus S-1/2 raw granules with radiometric provenance",
      icon: Satellite,
    },
    {
      label: "Model Prediction",
      desc: "Weakly supervised UNB7 architecture with versioned weights",
      icon: Cpu,
    },
    {
      label: "Calibrated Confidence",
      desc: "Pixel-level continuous probabilities and uncertainty bounds",
      icon: Layers,
    },
    {
      label: "Human Officer Review",
      desc: "Forest department decision-makers inspect graph justification",
      icon: Users,
    },
    {
      label: "Field Verification",
      desc: "Ground ranger surveys confirm canopy cover and GPS coordinates",
      icon: ShieldCheck,
    },
  ];

  return (
    <section className="relative bg-[#060e1d] py-16 lg:py-20 text-white border-t border-white/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-white/10 bg-[#081224]/80 p-6 lg:p-8 backdrop-blur-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#00c896]/10 px-3 py-0.5 text-[11.5px] font-bold text-[#00c896] border border-[#00c896]/20">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Governance & Provenance Integrity</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white mt-2">
                Responsible AI: Zero Black-Box Decisions
              </h3>
            </div>
            <div className="text-[12px] text-slate-400 max-w-md">
              Every metric, score, and ranking carries its full metadata provenance, timestamp, and
              uncertainty confidence for total government audit readiness.
            </div>
          </div>

          {/* 5-Step Pipeline Flow */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-5 gap-3">
            {steps.map((s, idx) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.label}
                  className="rounded-xl border border-white/5 bg-white/[0.03] p-3.5 flex flex-col justify-between space-y-2 relative"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-bold text-slate-500">0{idx + 1}</span>
                    <span className="grid h-6 w-6 place-items-center rounded bg-[#00c896]/15 text-[#00c896]">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  <div>
                    <div className="text-[13px] font-bold text-white leading-snug">{s.label}</div>
                    <div className="text-[11px] text-slate-400 mt-1 leading-relaxed">{s.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
