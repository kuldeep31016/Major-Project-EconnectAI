"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, BarChart3, ChevronRight, ClipboardCheck, Cloud, FileText, FlaskConical, Globe, Leaf, Code2, Mail,
  Map as MapIcon, Menu, PlayCircle, ShieldCheck, Sprout, Users, X,
} from "lucide-react";
import { HeroMap } from "@/components/landing/hero-map";
import { HeroVideo } from "@/components/landing/hero-video";
import { PipelineFlow } from "@/components/landing/pipeline-flow";
import { useAnalysis } from "@/hooks/use-analysis";
import { fetchStudyAreas, type StudyAreaInfo } from "@/lib/api";
import { getHabitatMask, getScenes } from "@/lib/data";

const NAV = [["#home", "Home"], ["#about", "About"], ["#features", "Features"], ["#study-areas", "Study Areas"], ["#impact", "Impact"], ["#team", "Team"]] as const;

function areaImage(bbox: [number, number, number, number], w = 640, h = 400) {
  const [minLat, minLon, maxLat, maxLon] = bbox;
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${minLon},${minLat},${maxLon},${maxLat}&bboxSR=4326&imageSR=3857&size=${w},${h}&format=jpg&f=image`;
}

const WHY = [
  { icon: Leaf, title: "Biodiversity Protection", text: "Supports marine life and coastal ecosystems" },
  { icon: Cloud, title: "Carbon Storage", text: "Helps mitigate climate change" },
  { icon: ShieldCheck, title: "Disaster Resilience", text: "Reduces the impact of storm surges" },
  { icon: Users, title: "Informed Decisions", text: "Data-driven insights for conservation" },
];
const FEATURES = [
  { icon: MapIcon, title: "Interactive Map", text: "Explore habitat maps, patches and connectivity graphs" },
  { icon: BarChart3, title: "Change Detection", text: "Compare observation dates and identify emerging risks" },
  { icon: FlaskConical, title: "Scenario Analysis", text: "Simulate habitat loss or restoration and see the impact on connectivity" },
  { icon: Sprout, title: "Restoration Planner", text: "Find and rank candidate sites for maximum ecological benefit" },
  { icon: ClipboardCheck, title: "Field Verification", text: "Assign field tasks, collect evidence and track progress" },
  { icon: FileText, title: "Reports & Insights", text: "Generate detailed reports for planning and policy" },
];
const TEAM = [
  { initial: "R", name: "Ruhinaaz", role: "Remote Sensing & AI" },
  { initial: "K", name: "Kuldeep Raj", role: "Graph Analysis & Backend" },
  { initial: "S", name: "Team Member", role: "Frontend & Visualisation" },
  { initial: "P", name: "Project Guide", role: "Supervision & Support" },
];

export default function LandingPage() {
  const [menu, setMenu] = useState(false);
  const [areas, setAreas] = useState<StudyAreaInfo[] | null>(null);
  const { dataSource } = useAnalysis();
  useEffect(() => {
    let cancelled = false;
    fetchStudyAreas().then((a) => { if (!cancelled) setAreas(a); }).catch(() => { if (!cancelled) setAreas(null); });
    return () => { cancelled = true; };
  }, []);
  const scenes = getScenes();

  // Real totals over the latest real (non-synthetic) run of each landscape.
  const totals = useMemo(() => {
    const real = (areas ?? []).map((a) => a.latestRun).filter((r): r is NonNullable<typeof r> => !!r && r.resultKind !== "synthetic");
    return { ha: real.reduce((s, r) => s + (r.habitatAreaHa ?? 0), 0), patches: real.reduce((s, r) => s + r.nPatches, 0), n: real.length };
  }, [areas]);

  // Top critical patch of the Kerala run for the "impact" section (real values only).
  const kerala = getHabitatMask("kerala-coast");
  const keralaLive = dataSource.mode === "live" && dataSource.provenance?.studyAreaId === "kerala-coast";
  const top = keralaLive ? [...kerala.patches].filter((p) => p.criticalityRank != null).sort((a, b) => (a.criticalityRank ?? 99) - (b.criticalityRank ?? 99))[0] : null;

  return (
    <div id="home" className="landing min-h-screen bg-white text-[#0b1120] antialiased">
      {/* ------------------------------------------------------------ nav */}
      <header className="sticky top-0 z-[1100] border-b border-black/5 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="#home" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#dcfce7] text-[#16a34a]"><Leaf className="h-4.5 w-4.5" /></span>
            <span className="text-[19px] font-bold tracking-tight">EcoConnect<span className="text-[#16a34a]">AI</span></span>
          </Link>
          <nav className="hidden items-center gap-7 text-[14px] font-medium text-[#334155] lg:flex">
            {NAV.map(([h, l]) => <a key={h} href={h} className="hover:text-[#0b1120]">{l}</a>)}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/command" className="hidden items-center gap-2 rounded-lg bg-[#0f5132] px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-[#0b3d26] sm:inline-flex">Open Dashboard <ArrowRight className="h-4 w-4" /></Link>
            <button className="rounded-lg p-2 lg:hidden" onClick={() => setMenu((m) => !m)} aria-label="Menu">{menu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
          </div>
        </div>
        {menu && <nav className="border-t border-black/5 bg-white px-4 py-3 lg:hidden">{NAV.map(([h, l]) => <a key={h} href={h} onClick={() => setMenu(false)} className="block py-2 text-[15px] font-medium">{l}</a>)}<Link href="/command" className="mt-2 block rounded-lg bg-[#0f5132] px-4 py-2.5 text-center font-semibold text-white">Open Dashboard</Link></nav>}
      </header>

      {/* ------------------------------------------------------------ 1 · hero (video) */}
      <section className="relative overflow-hidden text-white">
        <HeroVideo />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-14 pt-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pb-20 lg:pt-24">
          <div>
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.22em] text-white/85">Satellite insights. Healthy coastlines. Brighter tomorrow.</div>
            <h1 className="mt-4 text-[52px] font-extrabold leading-[1.0] tracking-tight sm:text-[64px]">EcoConnect<span className="text-[#4ade80]">AI</span></h1>
            <h2 className="mt-2 text-[26px] font-semibold leading-tight sm:text-[32px]">Coastal Ecosystem Intelligence<br />for a Sustainable Future</h2>
            <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-white/90">Transforming satellite data into actionable insights to conserve mangroves, strengthen coastal resilience and support nature-positive decisions.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/command" className="inline-flex items-center gap-2 rounded-lg bg-[#22c55e] px-6 py-3.5 text-[15px] font-semibold text-[#052e16] shadow-lg hover:bg-[#4ade80]">Explore the Platform <ArrowRight className="h-4 w-4" /></Link>
              <a href="#how" className="inline-flex items-center gap-2 rounded-lg border border-white/50 px-6 py-3.5 text-[15px] font-semibold text-white hover:bg-white/10"><PlayCircle className="h-4 w-4" /> See how it works</a>
            </div>
            <div className="mt-9 grid grid-cols-2 gap-5 sm:grid-cols-4">
              {[
                [String(scenes.length), "Study Areas"],
                [totals.n ? `${Math.round(totals.ha).toLocaleString()} ha` : "—", totals.n ? "Mapped habitat (real runs)" : "Mapped habitat (pending)"],
                [totals.n ? String(totals.patches) : "—", "Detected patches"],
                ["95.56%", "Reference accuracy*"],
              ].map(([v, l]) => (
                <div key={l} className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/15 ring-1 ring-white/25"><Leaf className="h-4.5 w-4.5 text-[#86efac]" /></span><div><div className="whitespace-nowrap text-[18px] font-bold leading-none">{v}</div><div className="mt-1 text-[11px] text-white/80">{l}</div></div></div>
              ))}
            </div>
            <div className="mt-3 text-[10px] text-white/60">*Reference accuracy is the foundation study&apos;s published UNB7 result (Ghorbanian et al. 2025), not a measurement of this platform. Habitat and patch totals come from our development-model runs and are not final.</div>
          </div>
          <HeroMap />
        </div>
        <div className="absolute bottom-1 left-3 text-[9px] text-white/55">Footage: Pexels (free licence), Sundarbans delta · Map: Esri World Imagery</div>
      </section>

      {/* ------------------------------------------------------------ 2 · why it matters */}
      <section id="about" className="bg-[#f6fbf7]">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2">
          <div>
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.2em] text-[#16a34a]">Why it matters</div>
            <h2 className="mt-2 text-[38px] font-bold leading-tight tracking-tight">Healthy Coasts,<br />Stronger Communities</h2>
            <p className="mt-4 max-w-lg text-[16px] leading-relaxed text-[#475569]">Mangroves protect our coasts, support rich biodiversity, store carbon and reduce the impact of natural disasters. EcoConnectAI helps identify what to protect, where to restore and how to make informed decisions for a more resilient coastline.</p>
            <a href="#how" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#0f5132] px-5 py-3 text-[14px] font-semibold text-white hover:bg-[#0b3d26]">Learn More <ArrowRight className="h-4 w-4" /></a>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {WHY.map((w) => { const Icon = w.icon; return (
              <div key={w.title} className="flex items-start gap-4 rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#dcfce7] text-[#16a34a]"><Icon className="h-6 w-6" /></span>
                <div><div className="text-[15px] font-semibold">{w.title}</div><div className="mt-1 text-[13px] text-[#64748b]">{w.text}</div></div>
              </div>); })}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ 3 · how it works (animated flow) */}
      <section id="how" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_auto]">
          <div>
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.2em] text-[#16a34a]">How EcoConnectAI works</div>
            <h2 className="mt-2 text-[38px] font-bold leading-tight tracking-tight">From Satellite Data to<br />Real-World Impact</h2>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[#475569]">An integrated pipeline that combines remote sensing, AI and graph-based analysis to deliver actionable conservation insights.</p>
          </div>
          <div className="hidden rotate-[-4deg] text-[22px] leading-tight text-[#15803d] lg:block" style={{ fontFamily: "'Segoe Script','Bradley Hand',cursive" }}>Data → Insight → Action<br />for healthier coastlines</div>
        </div>
        <div className="mt-12"><PipelineFlow /></div>
      </section>

      {/* ------------------------------------------------------------ 4 · study areas */}
      <section id="study-areas" className="bg-[#f6fbf7]">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-[11.5px] font-semibold uppercase tracking-[0.2em] text-[#16a34a]">Our study areas</div>
              <h2 className="mt-2 text-[38px] font-bold tracking-tight">Four Iconic Coastal Landscapes</h2>
              <p className="mt-2 text-[15px] text-[#475569]">Real-world analysis across diverse mangrove ecosystems in India.</p>
            </div>
            <Link href="/command" className="text-[14px] font-semibold text-[#0f5132] hover:underline">View All Areas →</Link>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {scenes.map((s) => {
              const run = areas?.find((a) => a.id === s.id)?.latestRun ?? null;
              const real = run && run.resultKind !== "synthetic";
              const bbox = [s.bounds[0][0], s.bounds[0][1], s.bounds[1][0], s.bounds[1][1]] as [number, number, number, number];
              return (
                <Link key={s.id} href={`/analysis?scene=${s.id}`} className="group overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-sm transition hover:shadow-md">
                  <div className="relative aspect-[16/11] overflow-hidden bg-[#0b1120]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={areaImage(bbox)} alt={`${s.shortName} satellite imagery`} className="h-full w-full object-cover transition group-hover:scale-[1.04]" loading="lazy" />
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between"><div className="text-[15px] font-semibold">{s.region.split(",")[0]}</div><ChevronRight className="h-4 w-4 text-[#94a3b8]" /></div>
                    <div className="text-[12.5px] text-[#64748b]">{s.state}</div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                      <div className="rounded-lg bg-[#f6fbf7] px-2 py-1.5"><div className="text-[16px] font-bold">{real ? run.nPatches : "—"}</div><div className="text-[10.5px] text-[#64748b]">Patches</div></div>
                      <div className="rounded-lg bg-[#f6fbf7] px-2 py-1.5"><div className="text-[16px] font-bold">{real && run.ecaPctOfHabitat != null ? `${run.ecaPctOfHabitat.toFixed(0)}%` : "—"}</div><div className="text-[10.5px] text-[#64748b]">ECA / Habitat</div></div>
                    </div>
                    <div className="mt-2 text-[10.5px] text-[#94a3b8]">{real ? (run.resultKind === "development" ? "development model · not final" : "experimental result") : "analysis pending"}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ 5 · features */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.2em] text-[#16a34a]">Key features</div>
            <h2 className="mt-2 text-[38px] font-bold tracking-tight">A Complete Decision-Support Platform</h2>
            <p className="mt-2 text-[15px] text-[#475569]">Built for conservation planners, forest departments and researchers.</p>
          </div>
          <Link href="/command" className="text-[14px] font-semibold text-[#0f5132] hover:underline">Explore All Features →</Link>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => { const Icon = f.icon; return (
            <div key={f.title} className="flex items-start gap-4 rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#dcfce7] text-[#16a34a]"><Icon className="h-5.5 w-5.5" /></span>
              <div><div className="text-[15px] font-semibold">{f.title}</div><div className="mt-1 text-[13px] leading-relaxed text-[#64748b]">{f.text}</div></div>
            </div>); })}
        </div>
      </section>

      {/* ------------------------------------------------------------ 6 · impact */}
      <section id="impact" className="bg-[#f6fbf7]">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-[11.5px] font-semibold uppercase tracking-[0.2em] text-[#16a34a]">Real impact in action</div>
              <h2 className="mt-2 text-[38px] font-bold tracking-tight">From Analysis to Conservation</h2>
              <p className="mt-2 max-w-xl text-[15px] text-[#475569]">See how EcoConnectAI turns satellite data into simple, meaningful insights for real-world decision making.</p>
            </div>
            <Link href="/analysis?scene=kerala-coast" className="text-[14px] font-semibold text-[#0f5132] hover:underline">View Demo →</Link>
          </div>
          <div className="mt-8 grid gap-4 overflow-hidden rounded-3xl border border-black/[0.06] bg-white p-3 shadow-sm lg:grid-cols-[1fr_320px]">
            <HeroMap />
            <div className="rounded-2xl bg-[#f6fbf7] p-5">
              {top ? (
                <>
                  <div className="flex items-center justify-between"><div className="text-[16px] font-bold">Patch {top.id}</div><span className="rounded-full bg-[#fee2e2] px-2.5 py-1 text-[11px] font-semibold text-[#b91c1c]">{String(top.sensitivity).replace(/^\w/, (c) => c.toUpperCase())} priority</span></div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-[12.5px]">
                    <div><div className="text-[10px] uppercase tracking-wider text-[#64748b]">Area</div><div className="font-semibold">{top.areaHa} ha</div></div>
                    <div><div className="text-[10px] uppercase tracking-wider text-[#64748b]">Connectivity loss</div><div className="font-semibold">{top.deltaPct?.toFixed(1)} %</div></div>
                    <div><div className="text-[10px] uppercase tracking-wider text-[#64748b]">Neighbours</div><div className="font-semibold">{top.degree}</div></div>
                    <div><div className="text-[10px] uppercase tracking-wider text-[#64748b]">Confidence</div><div className="font-semibold">{Math.round(top.confidence * 100)} %</div></div>
                  </div>
                  <p className="mt-3 text-[11.5px] leading-relaxed text-[#64748b]">{top.notes}</p>
                  <div className="mt-2 text-[10px] text-[#94a3b8]">Real run · development model · not final</div>
                  <Link href="/analysis?scene=kerala-coast" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0f5132] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#0b3d26]">View Full Analysis <ArrowRight className="h-4 w-4" /></Link>
                </>
              ) : (
                <div className="text-[13px] text-[#64748b]">Start the backend and run an analysis to see the most critical patch of Vembanad–Kol here, with its real connectivity loss and neighbours.</div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ 7 · team */}
      <section id="team" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
          <div>
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.2em] text-[#16a34a]">People behind the mission</div>
            <h2 className="mt-2 text-[38px] font-bold tracking-tight">A Shared Vision for Resilient Coasts</h2>
            <p className="mt-2 text-[15px] text-[#475569]">We are a team of final-year students building technology for a healthier, more sustainable future.</p>
            <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
              {TEAM.map((m) => (
                <div key={m.name} className="text-center">
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#dcfce7] text-[22px] font-bold text-[#15803d]">{m.initial}</div>
                  <div className="mt-3 text-[15px] font-semibold">{m.name}</div>
                  <div className="text-[12.5px] text-[#64748b]">{m.role}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="hidden rotate-[-6deg] text-[22px] leading-tight text-[#15803d] lg:block" style={{ fontFamily: "'Segoe Script','Bradley Hand',cursive" }}>“Technology<br />for People,<br />Nature and<br />Future Generations”</div>
        </div>
      </section>

      {/* ------------------------------------------------------------ 8 · CTA + footer */}
      <section className="relative overflow-hidden text-white">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url(/hero-poster.jpg)" }} aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-r from-[#052e16]/95 via-[#0a3d2a]/80 to-[#0b1120]/40" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <h3 className="text-[34px] font-bold tracking-tight">Join Us for a Greener, Safer Tomorrow</h3>
          <p className="mt-2 max-w-xl text-[15px] text-white/85">Explore the dashboard, analyse real landscapes and be part of the movement to conserve India&apos;s coastal ecosystems.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/command" className="inline-flex items-center gap-2 rounded-lg bg-[#22c55e] px-6 py-3 text-[14px] font-semibold text-[#052e16] hover:bg-[#4ade80]">Open Dashboard <ArrowRight className="h-4 w-4" /></Link>
            <a href="mailto:contact@example.org" className="inline-flex items-center rounded-lg border border-white/50 px-6 py-3 text-[14px] font-semibold text-white hover:bg-white/10">Contact Us</a>
          </div>
        </div>
      </section>
      <footer className="bg-[#f6fbf7]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2.5"><span className="grid h-8 w-8 place-items-center rounded-full bg-[#dcfce7] text-[#16a34a]"><Leaf className="h-4 w-4" /></span><div><div className="text-[15px] font-bold">EcoConnectAI</div><div className="text-[11px] text-[#64748b]">Coastal Ecosystem Intelligence</div></div></div>
          <nav className="flex flex-wrap gap-5 text-[13px] text-[#334155]">{NAV.map(([h, l]) => <a key={h} href={h}>{l}</a>)}<Link href="/reports">Insights</Link></nav>
          <div className="flex gap-3 text-[#334155]"><a aria-label="Documentation" href="https://github.com/kuldeep31016"><Globe className="h-4 w-4" /></a><a aria-label="Source code" href="https://github.com/kuldeep31016"><Code2 className="h-4 w-4" /></a><a aria-label="Email" href="mailto:contact@example.org"><Mail className="h-4 w-4" /></a></div>
        </div>
        <div className="mx-auto max-w-7xl px-4 pb-6 text-[11px] text-[#94a3b8] sm:px-6">© {new Date().getFullYear()} EcoConnectAI. Built for a more resilient coastal India. Data: Copernicus Sentinel-1/2 · Global Mangrove Watch v3 (CC-BY-4.0) · Esri World Imagery · footage Pexels. Every figure in the platform carries its provenance label; AI recommends, officers decide, field verification confirms.</div>
      </footer>
    </div>
  );
}
