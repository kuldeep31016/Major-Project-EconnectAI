"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Compass,
  Database,
  FileBarChart,
  FlaskConical,
  GitBranch,
  Globe2,
  Layers,
  LineChart,
  Map as MapIcon,
  Network,
  Play,
  Satellite,
  ShieldCheck,
  Sparkles,
  Waves,
  Workflow,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { EarthVisual } from "@/components/landing/earth-visual";
import { Starfield } from "@/components/landing/starfield";
import { AnimatedNumber } from "@/components/shared/animated-number";
import { Reveal } from "@/components/shared/motion";
import { BRAND } from "@/lib/constants";

const STATS = [
  { label: "Hectares analysed", value: 33752, suffix: "", decimals: 0, thousands: true },
  { label: "Habitat patches mapped", value: 71, suffix: "", decimals: 0 },
  { label: "Segmentation accuracy", value: 91.4, suffix: "%", decimals: 1 },
  { label: "Analysis time", value: 3.1, suffix: " min", decimals: 1 },
];

const FEATURES = [
  {
    icon: Satellite,
    title: "Automated habitat segmentation",
    body: "Upload a Sentinel-2 or Landsat scene and a Swin-UNet model resolves mangrove, seagrass, reef, salt marsh and mudflat classes into discrete, vectorised habitat patches — no manual digitising.",
    accent: "#00c896",
  },
  {
    icon: Network,
    title: "Graph-theoretic connectivity",
    body: "Patches become nodes in a resistance-weighted network. PC and IIC indices quantify landscape connectivity; betweenness centrality identifies which patches are load-bearing.",
    accent: "#38bdf8",
  },
  {
    icon: Layers,
    title: "Sensitivity heatmaps",
    body: "Leave-one-out recomputation across a 100 m grid surfaces marginal importance — highlighting narrow corridors rather than simply the densest habitat.",
    accent: "#f59e0b",
  },
  {
    icon: FlaskConical,
    title: "What-if simulation",
    body: "Draw a polygon over any area and watch the graph re-solve. Six pressure scenarios — cyclone, sea level rise, aquaculture, roads, urban growth, encroachment — run in seconds.",
    accent: "#a78bfa",
  },
  {
    icon: Compass,
    title: "Restoration prioritisation",
    body: "Set a budget from ₹10 lakh to ₹5 crore and the optimiser ranks interventions by marginal connectivity gain per rupee, with cost, confidence and time-to-impact.",
    accent: "#22c55e",
  },
  {
    icon: Brain,
    title: "Explainable by design",
    body: "Every score carries a plain-language rationale, a bridge score, alternative-route count and a confidence value. Analysts can defend each number to a review committee.",
    accent: "#ef4444",
  },
];

const PIPELINE = [
  { icon: Satellite, label: "Ingest", detail: "GeoTIFF / Sentinel / Landsat" },
  { icon: Layers, label: "Segment", detail: "EcoSeg v3.2 · 12-band" },
  { icon: Network, label: "Graph", detail: "Resistance-weighted topology" },
  { icon: LineChart, label: "Analyse", detail: "PC · IIC · betweenness" },
  { icon: FileBarChart, label: "Report", detail: "Decision-ready output" },
];

const RESEARCH = [
  {
    title: "Connectivity over area",
    body: "Conventional habitat accounting tracks hectares under notification. This work demonstrates that landscape connectivity diverges from area — a landscape can hold stable extent while losing structural coherence — and that connectivity is the better predictor of ecological function.",
    metric: "38%",
    metricLabel: "of connectivity carried by 11.8% of habitat area",
  },
  {
    title: "Disproportionate infrastructure impact",
    body: "Scenario modelling quantifies a ratio that policy rarely captures: linear infrastructure removes little habitat area but severs network structure. A road alignment producing 4.1% area loss drives a 9.3-point connectivity fall.",
    metric: "2.3×",
    metricLabel: "connectivity points lost per % of habitat removed",
  },
  {
    title: "Protection–importance mismatch",
    body: "Across all four monitored landscapes, the patches with the highest bridging importance frequently fall outside notified protected-area boundaries — a systematic gap between where protection exists and where it would matter most.",
    metric: "2 of 2",
    metricLabel: "critical patches unprotected in the Kerala landscape",
  },
];

const TECH = [
  { name: "Next.js 15", role: "App Router, RSC" },
  { name: "React 19", role: "Concurrent UI" },
  { name: "TypeScript", role: "End-to-end types" },
  { name: "Tailwind CSS", role: "Design system" },
  { name: "shadcn/ui", role: "Component primitives" },
  { name: "Framer Motion", role: "Motion layer" },
  { name: "Leaflet", role: "GIS mapping" },
  { name: "React Flow", role: "Network graph" },
  { name: "Recharts", role: "Data visualisation" },
  { name: "Lucide", role: "Iconography" },
];

const DATASETS = [
  { name: "Kerala Coast", detail: "Vembanad — Ramsar", score: 74.6, color: "#00c896" },
  { name: "Sundarbans", detail: "UNESCO · Tiger Reserve", score: 81.3, color: "#22c55e" },
  { name: "Gulf of Mannar", detail: "Marine National Park", score: 68.2, color: "#f59e0b" },
  { name: "Odisha Coast", detail: "Bhitarkanika Delta", score: 71.9, color: "#38bdf8" },
];

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-background">
      {/* ---------------------------------------------------------- nav */}
      <header className="fixed inset-x-0 top-0 z-50">
        <div className="mx-auto mt-4 flex max-w-7xl items-center justify-between gap-4 rounded-2xl glass px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-eco">
              <Waves className="h-5 w-5 text-[#04231b]" strokeWidth={2.4} />
            </div>
            <div className="leading-none">
              <div className="text-[15px] font-semibold tracking-tight">
                Eco<span className="text-[#00c896]">Connect</span>AI
              </div>
              <div className="mt-1 hidden text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground sm:block">
                Conservation Intelligence
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {[
              ["Features", "#features"],
              ["Research", "#research"],
              ["Technology", "#technology"],
              ["Datasets", "#datasets"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="rounded-lg px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <Button asChild size="sm" className="rounded-xl bg-gradient-eco font-semibold text-[#04231b] hover:opacity-90">
              <Link href="/upload">
                Start Analysis
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* -------------------------------------------------------- hero */}
      <section className="relative isolate overflow-hidden px-4 pb-24 pt-36 sm:px-6 sm:pt-44">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-aurora" />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-grid opacity-[0.55]" />
        <Starfield className="pointer-events-none absolute inset-0 -z-10" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-64 bg-gradient-to-t from-background to-transparent" />

        <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <Reveal>
              <div className="inline-flex items-center gap-2 rounded-full glass px-3.5 py-1.5 text-xs font-medium text-muted-foreground">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00c896] opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#00c896]" />
                </span>
                EcoSeg v3.2 · four coastal landscapes under active monitoring
              </div>
            </Reveal>

            <Reveal delay={0.08}>
              <h1 className="mt-6 text-balance text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                <span className="text-gradient">Coastal habitat</span>
                <br />
                <span className="text-gradient-eco">connectivity</span>
                <span className="text-gradient">, solved</span>
                <br />
                <span className="text-gradient">in minutes.</span>
              </h1>
            </Reveal>

            <Reveal delay={0.16}>
              <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-muted-foreground sm:text-base">
                Upload a satellite scene. EcoConnectAI segments habitat, builds the
                ecological network, finds the corridors holding it together, simulates
                what happens when they fail — and tells you where to spend first.
              </p>
            </Reveal>

            <Reveal delay={0.24}>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Button
                  asChild
                  size="lg"
                  className="group h-12 rounded-xl bg-gradient-eco px-6 font-semibold text-[#04231b] shadow-lg shadow-[#00c896]/20 hover:opacity-90"
                >
                  <Link href="/upload">
                    <Zap className="mr-1 h-4 w-4" />
                    Start Analysis
                    <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 rounded-xl border-foreground/12 bg-foreground/[0.05] px-6 font-medium backdrop-blur hover:bg-foreground/10"
                >
                  <Link href="/analysis">
                    <Play className="mr-1 h-4 w-4" />
                    Explore Demo
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="ghost"
                  className="h-12 rounded-xl px-5 font-medium text-muted-foreground hover:text-foreground"
                >
                  <Link href="/reports">
                    <BookOpen className="mr-1 h-4 w-4" />
                    View Documentation
                  </Link>
                </Button>
              </div>
            </Reveal>

            {/* animated stats */}
            <Reveal delay={0.32}>
              <div className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-foreground/[0.08] bg-foreground/[0.05] sm:grid-cols-4">
                {STATS.map((s) => (
                  <div key={s.label} className="bg-sidebar/85 px-4 py-5 backdrop-blur">
                    <div className="text-2xl font-bold tracking-tight text-foreground sm:text-[26px]">
                      <AnimatedNumber
                        value={s.value}
                        decimals={s.decimals}
                        suffix={s.suffix}
                        thousands={s.thousands}
                      />
                    </div>
                    <div className="mt-1.5 text-[11px] font-medium leading-tight text-muted-foreground">
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>

          {/* globe */}
          <Reveal delay={0.2} y={0}>
            <div className="relative mx-auto w-full max-w-[520px]">
              <div className="absolute inset-0 -z-10 rounded-full bg-[#00c896]/10 blur-3xl" />
              <EarthVisual className="aspect-square w-full animate-float" />

              {/* floating telemetry chips */}
              <div className="absolute -left-2 top-[18%] rounded-xl glass-strong px-3 py-2 shadow-xl sm:left-0">
                <div className="text-[9px] font-medium uppercase tracking-widest text-muted-foreground">
                  Connectivity
                </div>
                <div className="mt-0.5 text-lg font-bold text-[#00c896]">74.6</div>
              </div>
              <div className="absolute -right-1 top-[58%] rounded-xl glass-strong px-3 py-2 shadow-xl sm:right-2">
                <div className="text-[9px] font-medium uppercase tracking-widest text-muted-foreground">
                  Critical corridors
                </div>
                <div className="mt-0.5 text-lg font-bold text-[#ef4444]">2</div>
              </div>
              <div className="absolute bottom-[10%] left-[12%] rounded-xl glass-strong px-3 py-2 shadow-xl">
                <div className="text-[9px] font-medium uppercase tracking-widest text-muted-foreground">
                  Patches
                </div>
                <div className="mt-0.5 text-lg font-bold text-[#38bdf8]">18</div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------------- pipeline */}
      <section className="relative px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <Reveal>
            <div className="rounded-3xl glass p-6 sm:p-8">
              <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#00c896]">
                    The pipeline
                  </div>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
                    Scene in, decision out
                  </h2>
                </div>
                <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                  Five stages, fully automated. What takes a GIS analyst several days of
                  manual digitising and network analysis completes in about three minutes.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {PIPELINE.map((s, i) => (
                  <div
                    key={s.label}
                    className="group relative overflow-hidden rounded-2xl border border-foreground/[0.08] bg-sidebar/60 p-4 transition-colors hover:border-[#00c896]/30"
                  >
                    <div className="absolute right-3 top-3 text-[10px] font-semibold tabular text-white/15">
                      0{i + 1}
                    </div>
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#00c896]/12 text-[#00c896] transition-transform group-hover:scale-105">
                      <s.icon className="h-5 w-5" />
                    </div>
                    <div className="mt-3.5 text-sm font-semibold">{s.label}</div>
                    <div className="mt-1 text-[11px] leading-snug text-muted-foreground">
                      {s.detail}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------------- features */}
      <section id="features" className="relative scroll-mt-24 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#00c896]">
                Capabilities
              </div>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Everything a conservation decision needs
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
                Not a map viewer with statistics bolted on. Each capability feeds the next,
                so the recommendation at the end is traceable to the pixels at the start.
              </p>
            </div>
          </Reveal>

          <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.06}>
                <div className="group relative h-full overflow-hidden rounded-2xl border border-foreground/[0.08] bg-card/80 p-6 backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-foreground/15">
                  <div
                    className="pointer-events-none absolute -right-14 -top-14 h-36 w-36 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
                    style={{ background: f.accent }}
                  />
                  <div
                    className="grid h-11 w-11 place-items-center rounded-xl transition-transform duration-300 group-hover:scale-105"
                    style={{ background: `${f.accent}1f`, color: f.accent }}
                  >
                    <f.icon className="h-[22px] w-[22px]" />
                  </div>
                  <h3 className="mt-5 text-[15px] font-semibold tracking-tight">{f.title}</h3>
                  <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">
                    {f.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- datasets */}
      <section id="datasets" className="relative scroll-mt-24 px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#38bdf8]">
                  Monitored landscapes
                </div>
                <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
                  Four Indian coastal systems, continuously assessed
                </h2>
              </div>
              <Button asChild variant="outline" className="rounded-xl border-foreground/12 bg-foreground/[0.05]">
                <Link href="/upload">
                  Load a dataset
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </Reveal>

          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {DATASETS.map((d, i) => (
              <Reveal key={d.name} delay={i * 0.07}>
                <Link
                  href="/upload"
                  className="group block overflow-hidden rounded-2xl border border-foreground/[0.08] bg-card/80 backdrop-blur transition-all hover:-translate-y-1 hover:border-foreground/15"
                >
                  <div
                    className="relative h-24 overflow-hidden"
                    style={{
                      background: `linear-gradient(135deg, ${d.color}44, ${d.color}11)`,
                    }}
                  >
                    <div className="absolute inset-0 bg-grid opacity-40" />
                    <Globe2
                      className="absolute -bottom-3 -right-3 h-20 w-20 opacity-15 transition-transform duration-500 group-hover:rotate-12"
                      style={{ color: d.color }}
                    />
                  </div>
                  <div className="p-4">
                    <div className="text-sm font-semibold tracking-tight">{d.name}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{d.detail}</div>
                    <div className="mt-3.5 flex items-end justify-between">
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        Connectivity
                      </div>
                      <div className="text-xl font-bold tabular" style={{ color: d.color }}>
                        {d.score}
                      </div>
                    </div>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-foreground/[0.08]">
                      <div
                        className="h-full rounded-full transition-all duration-700 group-hover:opacity-90"
                        style={{ width: `${d.score}%`, background: d.color }}
                      />
                    </div>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- research */}
      <section id="research" className="relative scroll-mt-24 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#a78bfa]">
                Research contribution
              </div>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                What this work establishes
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
                Three findings that change how coastal habitat is prioritised — each
                reproducible across all four monitored landscapes.
              </p>
            </div>
          </Reveal>

          <div className="mt-14 grid gap-4 lg:grid-cols-3">
            {RESEARCH.map((r, i) => (
              <Reveal key={r.title} delay={i * 0.08}>
                <div className="relative h-full overflow-hidden rounded-2xl border border-foreground/[0.08] bg-gradient-to-b from-[#111827]/90 to-[#0b1120]/90 p-6 backdrop-blur">
                  <div className="text-3xl font-bold tracking-tight text-gradient-eco">
                    {r.metric}
                  </div>
                  <div className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                    {r.metricLabel}
                  </div>
                  <div className="my-5 h-px bg-foreground/[0.08]" />
                  <h3 className="text-[15px] font-semibold tracking-tight">{r.title}</h3>
                  <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">
                    {r.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.2}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 rounded-2xl glass px-6 py-5 text-center">
              {[
                ["Saura & Pascual-Hortal", "PC index, 2007"],
                ["Bunn, Urban & Keitt", "Graph theory in conservation, 2000"],
                ["Liu et al.", "Swin Transformer, 2021"],
                ["MoEFCC", "Mangrove restoration guidelines, 2023"],
              ].map(([a, b]) => (
                <div key={a} className="text-left">
                  <div className="text-xs font-medium">{a}</div>
                  <div className="text-[10px] text-muted-foreground">{b}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* -------------------------------------------------- technology */}
      <section id="technology" className="relative scroll-mt-24 px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <Reveal>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#38bdf8]">
                  Technology
                </div>
                <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                  Built like a product, not a notebook
                </h2>
                <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
                  A typed React architecture with a single data-access layer, so the
                  interface that runs on mock analysis output today runs on live model
                  output tomorrow without a rewrite.
                </p>

                <div className="mt-7 space-y-3">
                  {[
                    [ShieldCheck, "Typed end to end — one domain model shared by every page"],
                    [Workflow, "Single data layer — swap mock JSON for an API in one file"],
                    [Sparkles, "Motion as feedback, not decoration — state changes are visible"],
                  ].map(([Icon, text]) => {
                    const I = Icon as typeof ShieldCheck;
                    return (
                      <div key={text as string} className="flex items-start gap-3">
                        <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#38bdf8]/12 text-[#38bdf8]">
                          <I className="h-4 w-4" />
                        </div>
                        <p className="text-[13px] leading-relaxed text-muted-foreground">
                          {text as string}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {TECH.map((t, i) => (
                  <div
                    key={t.name}
                    className="group rounded-xl border border-foreground/[0.08] bg-card/80 p-4 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-[#38bdf8]/25"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <div className="text-[13px] font-semibold tracking-tight">{t.name}</div>
                    <div className="mt-1 text-[10px] leading-snug text-muted-foreground">
                      {t.role}
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- cta */}
      <section className="relative px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl border border-foreground/10 bg-gradient-to-br from-[#00c896]/12 via-[#111827]/90 to-[#38bdf8]/10 px-6 py-14 text-center backdrop-blur sm:px-12">
              <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
              <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-[#00c896]/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-[#38bdf8]/20 blur-3xl" />

              <div className="relative">
                <MapIcon className="mx-auto h-9 w-9 text-[#00c896]" />
                <h2 className="mt-5 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
                  Run your first analysis
                </h2>
                <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
                  Load one of four prepared coastal datasets, or upload your own scene.
                  Full results — map, network, simulation and report — in about three minutes.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <Button
                    asChild
                    size="lg"
                    className="h-12 rounded-xl bg-gradient-eco px-7 font-semibold text-[#04231b] shadow-lg shadow-[#00c896]/20 hover:opacity-90"
                  >
                    <Link href="/upload">
                      Start Analysis
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="h-12 rounded-xl border-foreground/12 bg-foreground/[0.05] px-7"
                  >
                    <Link href="/dashboard">Open Dashboard</Link>
                  </Button>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------ footer */}
      <footer className="relative border-t border-foreground/[0.08] px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-eco">
                  <Waves className="h-5 w-5 text-[#04231b]" strokeWidth={2.4} />
                </div>
                <div className="text-[15px] font-semibold tracking-tight">
                  Eco<span className="text-[#00c896]">Connect</span>AI
                </div>
              </div>
              <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
                {BRAND.tagline}
              </p>
              <div className="mt-5 flex items-center gap-2 text-[11px] text-muted-foreground">
                <Database className="h-3.5 w-3.5" />
                Research prototype — analysis outputs are simulated
              </div>
            </div>

            {[
              {
                title: "Platform",
                links: [
                  ["Dashboard", "/dashboard"],
                  ["Upload Scene", "/upload"],
                  ["Analysis", "/analysis"],
                  ["Simulation", "/simulation"],
                ],
              },
              {
                title: "Outputs",
                links: [
                  ["Reports", "/reports"],
                  ["History", "/history"],
                  ["Settings", "/settings"],
                ],
              },
              {
                title: "Resources",
                links: [
                  ["Methodology", "/reports"],
                  ["Research", "#research"],
                  ["Technology", "#technology"],
                ],
              },
            ].map((col) => (
              <div key={col.title}>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground">
                  {col.title}
                </div>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map(([label, href]) => (
                    <li key={label}>
                      <Link
                        href={href}
                        className="text-[13px] text-muted-foreground transition-colors hover:text-[#00c896]"
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-11 flex flex-col items-center justify-between gap-4 border-t border-foreground/[0.08] pt-6 sm:flex-row">
            <div className="text-[11px] text-muted-foreground">
              © 2026 EcoConnectAI · Coastal Conservation Decision Support
            </div>
            <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" />
                All systems operational
              </span>
              <span className="flex items-center gap-1.5">
                <GitBranch className="h-3.5 w-3.5" />
                v1.3.0
              </span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
