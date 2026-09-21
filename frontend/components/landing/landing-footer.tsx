"use client";

import Link from "next/link";
import { BookOpen, Code2, ExternalLink, Globe, Heart, Leaf, Mail, Shield } from "lucide-react";

export function LandingFooter() {
  return (
    <footer className="bg-[#030712] text-slate-400 border-t border-white/10 text-[13px]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
          {/* Column 1: Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="#home" className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#00c896] to-[#0f766e] text-[#04231b] shadow-md">
                <Leaf className="h-5 w-5 fill-current" />
              </div>
              <div className="flex items-center gap-0.5 text-[20px] font-extrabold text-white tracking-tight">
                <span>EcoConnect</span>
                <span className="text-[#00c896]">AI</span>
              </div>
            </Link>
            <p className="text-[13.5px] text-slate-400 leading-relaxed max-w-sm">
              Coastal ecosystem intelligence for evidence-based conservation planning, network
              sensitivity modeling, and prioritized habitat restoration across India&apos;s marine
              landscapes.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <a
                href="https://github.com/kuldeep31016"
                target="_blank"
                rel="noreferrer"
                className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="GitHub Source Code"
              >
                <Code2 className="h-4 w-4" />
              </a>
              <a
                href="mailto:contact@ecoconnect.ai"
                className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Email Contact"
              >
                <Mail className="h-4 w-4" />
              </a>
              <a
                href="https://copernicus.eu"
                target="_blank"
                rel="noreferrer"
                className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Copernicus Data"
              >
                <Globe className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Column 2: Platform Modules */}
          <div className="space-y-3">
            <div className="text-[12px] font-bold uppercase tracking-wider text-white">
              Platform Modules
            </div>
            <ul className="space-y-2 text-[13px]">
              <li>
                <Link href="/command" className="hover:text-[#00c896] transition-colors">
                  Command Center
                </Link>
              </li>
              <li>
                <Link href="/analysis?scene=kerala-coast" className="hover:text-[#00c896] transition-colors">
                  Interactive Coastal Map
                </Link>
              </li>
              <li>
                <Link href="/graph" className="hover:text-[#00c896] transition-colors">
                  Topology Network Graph
                </Link>
              </li>
              <li>
                <Link href="/simulation" className="hover:text-[#00c896] transition-colors">
                  Scenario Lab (Stress Testing)
                </Link>
              </li>
              <li>
                <Link href="/restoration" className="hover:text-[#00c896] transition-colors">
                  Restoration Planner
                </Link>
              </li>
              <li>
                <Link href="/reports" className="hover:text-[#00c896] transition-colors">
                  Explainable AI Reports
                </Link>
              </li>
              <li>
                <Link href="/field" className="hover:text-[#00c896] transition-colors">
                  Field Verification Patrols
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Study Areas */}
          <div className="space-y-3">
            <div className="text-[12px] font-bold uppercase tracking-wider text-white">
              Study Areas (India)
            </div>
            <ul className="space-y-2 text-[13px]">
              <li>
                <Link href="/analysis?scene=kerala-coast" className="hover:text-[#00c896] transition-colors">
                  Vembanad–Kol, Kerala
                </Link>
              </li>
              <li>
                <Link href="/analysis?scene=sundarbans" className="hover:text-[#00c896] transition-colors">
                  Sundarbans Delta, W.B.
                </Link>
              </li>
              <li>
                <Link href="/analysis?scene=gulf-of-mannar" className="hover:text-[#00c896] transition-colors">
                  Gulf of Mannar, T.N.
                </Link>
              </li>
              <li>
                <Link href="/analysis?scene=bhitarkanika" className="hover:text-[#00c896] transition-colors">
                  Bhitarkanika, Odisha
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Foundation Literature & Institutional Context */}
          <div className="space-y-3">
            <div className="text-[12px] font-bold uppercase tracking-wider text-white">
              Institutional Context
            </div>
            <ul className="space-y-2 text-[12px] text-slate-400">
              <li className="leading-snug">
                <span className="text-slate-300 font-semibold">MoEFCC & IFS Guidelines</span>
                <div className="text-[11px] text-slate-400">National Coastal Wetland Framework</div>
              </li>
              <li className="leading-snug">
                <span className="text-slate-300 font-semibold">ISRO SAC & Copernicus</span>
                <div className="text-[11px] text-slate-400">Sentinel-1/2 Earth Observation Data</div>
              </li>
              <li className="leading-snug">
                <span className="text-slate-300 font-semibold">Landscape Connectivity</span>
                <div className="text-[11px] text-slate-400">Graph Theory & Ecological Corridors</div>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar with Copyright & Provenance Notice */}
        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 text-[11.5px] text-slate-400">
          <p>
            © {new Date().getFullYear()} EcoConnectAI Framework. Data sources: ESA Copernicus Sentinel-1/2 ·
            Global Mangrove Watch v3 · Esri World Imagery. Visibly labeled for operational planning.
          </p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="h-2 w-2 rounded-full bg-[#00c896]" />
              Government Decision-Support System
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
