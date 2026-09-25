"use client";

import Link from "next/link";
import { ArrowRight, Compass, Layers, Leaf, Sparkles } from "lucide-react";

export function CTASection() {
  return (
    <section className="relative overflow-hidden bg-[#050c18] py-20 lg:py-28 text-white border-t border-white/10">
      {/* Background Aerial Drone / Coastal Imagery */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-30 pointer-events-none"
        style={{ backgroundImage: "url(/images/coastal-mangrove-hero.jpg)" }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#050c18]/95 via-[#050c18]/85 to-[#041d13]/80" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(0,200,150,0.16),transparent_60%)]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-white/15 bg-gradient-to-br from-[#081326]/90 via-[#071424]/95 to-[#042018]/90 p-8 lg:p-14 backdrop-blur-2xl shadow-2xl">
          <div className="grid lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8 space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#00c896]/30 bg-[#00c896]/10 px-3.5 py-1 text-[12px] font-semibold text-[#a7f3e0]">
                <Leaf className="h-3.5 w-3.5 text-[#00c896]" />
                <span>Evidence-Based Coastal Conservation</span>
              </div>

              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight text-white">
                See What Holds <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00c896] via-[#38bdf8] to-[#86efac]">
                  the Landscape Together.
                </span>
              </h2>

              <p className="max-w-2xl text-[16px] text-slate-300 leading-relaxed">
                Explore EcoConnectAI&apos;s coastal intelligence workflow. Quantify bottleneck patch
                criticality, stress-test disaster scenarios, and prioritize restoration investments
                across India&apos;s most vital marine ecosystems.
              </p>

              <div className="pt-4 flex flex-wrap items-center gap-3.5">
                <Link
                  href="/command"
                  className="group inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-[#00c896] via-[#10b981] to-[#22c55e] px-6 py-3.5 text-[15px] font-bold text-[#04231b] shadow-xl shadow-[#00c896]/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  <Compass className="h-4.5 w-4.5" />
                  <span>Launch Command Center</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>

                <a
                  href="#how-it-works"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3.5 text-[14.5px] font-semibold text-slate-200 backdrop-blur-md hover:bg-white/10 transition-all"
                >
                  <Layers className="h-4 w-4 text-[#38bdf8]" />
                  <span>Explore Methodology</span>
                </a>

                <Link
                  href="/analysis?scene=kerala-coast"
                  className="inline-flex items-center gap-2 rounded-xl border border-transparent px-4 py-3.5 text-[14px] font-medium text-slate-300 hover:text-[#00c896] transition-colors"
                >
                  <span>Live Kerala Demo</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Right Operational Summary Widget */}
            <div className="lg:col-span-4 rounded-2xl border border-white/10 bg-[#050914]/80 p-5 backdrop-blur-xl space-y-3.5">
              <div className="text-[12px] font-bold uppercase tracking-wider text-[#00c896]">
                Operational Highlights
              </div>
              <div className="space-y-2.5 text-[13px] text-slate-200">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-slate-400">Supported Sensors</span>
                  <span className="font-semibold text-white">Sentinel-1 (model) · Sentinel-2 (context)</span>
                </div>
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-slate-400">Connectivity Engine</span>
                  <span className="font-semibold text-[#38bdf8]">Spatial Graph Networks</span>
                </div>
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-slate-400">Criticality Method</span>
                  <span className="font-semibold text-white">Leave-One-Out Sensitivity</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Decision Output</span>
                  <span className="font-semibold text-[#00c896]">Audit-Ready GIS Export</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
