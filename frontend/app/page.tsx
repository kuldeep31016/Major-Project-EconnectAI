"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Cloud,
  Leaf,
  Menu,
  Network,
  Satellite,
  ShieldCheck,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { HeroMap } from "@/components/landing/hero-map";
import { fetchStudyAreas, type StudyAreaInfo } from "@/lib/api";
import { getScenes } from "@/lib/data";
import { HERO, METHOD_EQUATIONS, NAV, PIPELINE, TEAM, WHY } from "@/lib/landing-content";

const ICONS: Record<string, LucideIcon> = { Satellite, Network, Leaf, ShieldCheck, Cloud, Users };

/** Real Esri imagery of a study area's configured extent (min_lat, min_lon, max_lat, max_lon). */
function areaImage(bbox: [number, number, number, number], w = 640, h = 400) {
  const [minLat, minLon, maxLat, maxLon] = bbox;
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${minLon},${minLat},${maxLon},${maxLat}&bboxSR=4326&imageSR=3857&size=${w},${h}&format=jpg&f=image`;
}

export default function LandingPage() {
  const [menu, setMenu] = useState(false);
  const [areas, setAreas] = useState<StudyAreaInfo[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchStudyAreas()
      .then((a) => {
        if (!cancelled) setAreas(a);
      })
      .catch(() => {
        if (!cancelled) setAreas(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const scenes = getScenes();

  return (
    <div id="home" className="landing min-h-screen bg-[#f6f8fb] text-[#0b1120] antialiased">
      {/* ------------------------------------------------------------ nav */}
      <header className="sticky top-0 z-50 border-b border-black/5 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="#home" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#dcfce7] text-[#16a34a]">
              <Leaf className="h-4.5 w-4.5" />
            </span>
            <span className="text-[19px] font-bold tracking-tight">
              Eco<span className="text-[#16a34a]">Connect</span>AI
            </span>
          </Link>
          <nav className="hidden items-center gap-7 text-[14px] font-medium text-[#334155] lg:flex">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="transition-colors hover:text-[#0b1120]">
                {n.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="hidden items-center gap-2 rounded-lg bg-[#0f5132] px-4 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#0b3d26] sm:inline-flex"
            >
              Open Dashboard <ArrowRight className="h-4 w-4" />
            </Link>
            <button className="rounded-lg p-2 lg:hidden" onClick={() => setMenu((m) => !m)} aria-label="Menu">
              {menu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {menu && (
          <nav className="border-t border-black/5 bg-white px-4 py-3 lg:hidden">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} onClick={() => setMenu(false)} className="block py-2 text-[15px] font-medium">
                {n.label}
              </a>
            ))}
            <Link href="/dashboard" className="mt-2 block rounded-lg bg-[#0f5132] px-4 py-2.5 text-center font-semibold text-white">
              Open Dashboard
            </Link>
          </nav>
        )}
      </header>

      {/* ------------------------------------------------------------ hero */}
      <section className="relative overflow-hidden text-white">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url(/hero-vembanad.jpg)" }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#062a1c]/90 via-[#0a3d2a]/70 to-[#0b1120]/40" aria-hidden />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:py-24">
          <div>
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.22em] text-white/80">{HERO.eyebrow}</div>
            <h1 className="mt-4 text-[44px] font-extrabold leading-[1.05] tracking-tight sm:text-[60px]">
              {HERO.title[0]}
              <br />
              <span className="text-[#4ade80]">{HERO.title[1]}</span>
            </h1>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-white/90">{HERO.body}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-lg bg-[#22c55e] px-6 py-3.5 text-[15px] font-semibold text-[#052e16] shadow-lg transition hover:bg-[#4ade80]"
              >
                Explore the Dashboard <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#about"
                className="inline-flex items-center rounded-lg border border-white/50 px-6 py-3.5 text-[15px] font-semibold text-white transition hover:bg-white/10"
              >
                Learn More
              </a>
            </div>
            <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
              {HERO.features.map((f) => {
                const Icon = ICONS[f.icon];
                return (
                  <div key={f.label} className="flex items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/10 ring-1 ring-white/20">
                      <Icon className="h-5 w-5 text-[#86efac]" />
                    </span>
                    <span className="whitespace-pre-line text-[13px] font-medium leading-snug">{f.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <HeroMap />
        </div>
        <div className="absolute bottom-1 right-2 text-[9px] text-white/60">Background: Esri World Imagery, Vembanad–Kol AOI</div>
      </section>

      {/* ------------------------------------------------------------ stats band */}
      <section className="border-b border-black/5 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 divide-black/10 px-4 py-8 sm:px-6 md:grid-cols-4 md:divide-x">
          {[
            [String(scenes.length), "Study Areas", "Across Indian coasts"],
            ["Satellite-Driven", "Sentinel-1 & Sentinel-2", ""],
            ["Graph-Based", "Connectivity Analysis", ""],
            ["Real-World Impact", "For Conservation Planning", ""],
          ].map(([a, b, c]) => (
            <div key={a} className="px-4 py-3 text-center">
              <div className="text-[24px] font-bold tracking-tight">{a}</div>
              <div className="text-[14px] text-[#334155]">{b}</div>
              {c && <div className="text-[11.5px] text-[#64748b]">{c}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ why it matters */}
      <section id="about" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <div className="text-[11.5px] font-semibold uppercase tracking-[0.2em] text-[#16a34a]">A healthier coastline, a stronger tomorrow</div>
            <h2 className="mt-2 text-[34px] font-bold tracking-tight">Why It Matters</h2>
          </div>
          <p className="text-[16px] leading-relaxed text-[#334155]">
            Mangroves and coastal ecosystems protect communities, support biodiversity and store vast amounts of carbon.
            EcoConnectAI provides data-driven insights to help conserve and restore these vital ecosystems — and, unlike a
            habitat map alone, it tells a planner <em>which patches hold the landscape together</em>.
          </p>
        </div>
        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {WHY.map((w) => {
            const Icon = ICONS[w.icon];
            return (
              <div key={w.title} className="flex items-start gap-4">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#dcfce7] text-[#16a34a]">
                  <Icon className="h-7 w-7" />
                </span>
                <div>
                  <div className="text-[16px] font-semibold">{w.title}</div>
                  <div className="mt-1 text-[13.5px] text-[#64748b]">{w.text}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ------------------------------------------------------------ how it works */}
      <section id="explore" className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <div className="text-[11.5px] font-semibold uppercase tracking-[0.2em] text-[#16a34a]">From satellites to solutions</div>
              <h2 className="mt-2 text-[34px] font-bold tracking-tight">How EcoConnectAI Works</h2>
            </div>
            <p className="text-[16px] leading-relaxed text-[#334155]">
              An integrated eleven-stage pipeline that turns satellite data into actionable conservation insights: remote sensing
              → habitat mapping → patch extraction → connectivity graph → criticality → what-if → explainability → restoration
              prioritisation → decision support.
            </p>
          </div>
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {PIPELINE.map((s) => (
              <li key={s.n} className="rounded-2xl border border-black/[0.06] bg-[#f6f8fb] p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-[#0f5132] text-[13px] font-bold text-white">{s.n}</span>
                  <div className="text-[15px] font-semibold">{s.title}</div>
                </div>
                <p className="mt-3 text-[13px] leading-relaxed text-[#475569]">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------------ methodology */}
      <section id="methodology" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="text-[11.5px] font-semibold uppercase tracking-[0.2em] text-[#16a34a]">Transparent by construction</div>
        <h2 className="mt-2 text-[34px] font-bold tracking-tight">Methodology</h2>
        <p className="mt-3 max-w-3xl text-[16px] leading-relaxed text-[#334155]">
          Every score in the dashboard traces back to one of these definitions. Connectivity indices are computed from their
          published formulas; criticality and restoration gains are exact recomputations, not learned approximations. Results are
          labelled by provenance: published baseline, prototype/synthetic, development-subset, or our experimental result.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {METHOD_EQUATIONS.map((m) => (
            <div key={m.label} className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm">
              <div className="text-[12px] font-semibold uppercase tracking-wider text-[#16a34a]">{m.label}</div>
              <div className="mt-2 font-mono text-[15px] text-[#0b1120]">{m.eq}</div>
              <div className="mt-2 text-[12.5px] text-[#64748b]">{m.note}</div>
            </div>
          ))}
          <div className="rounded-2xl border border-[#fde68a] bg-[#fffbeb] p-5 text-[13px] leading-relaxed text-[#78350f]">
            <b>Honesty note.</b> Segmentation labels come from Global Mangrove Watch, an existing map — accuracy against it is
            agreement with that map, not field truth. The dispersal threshold τ is species-relevant, so rankings are reported
            across τ = 3, 5 and 8 km rather than from one assumed value.
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ study areas */}
      <section id="study-areas" className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.2em] text-[#16a34a]">Four Indian coastal landscapes</div>
          <h2 className="mt-2 text-[34px] font-bold tracking-tight">Study Areas</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {scenes.map((s) => {
              const info = areas?.find((a) => a.id === s.id);
              const run = info?.latestRun ?? null;
              const bbox = [s.bounds[0][0], s.bounds[0][1], s.bounds[1][0], s.bounds[1][1]] as [number, number, number, number];
              return (
                <Link
                  key={s.id}
                  href={`/analysis?scene=${s.id}`}
                  className="group overflow-hidden rounded-2xl border border-black/[0.06] bg-[#f6f8fb] shadow-sm transition hover:shadow-md"
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-[#0b1120]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={areaImage(bbox)} alt={`${s.shortName} satellite imagery (Esri)`} className="h-full w-full object-cover transition group-hover:scale-[1.03]" loading="lazy" />
                    <div className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] text-white">
                      {run
                        ? run.resultKind === "synthetic"
                          ? "exact analysis · synthetic geometry"
                          : run.resultKind === "development"
                            ? "real pipeline run · dev · not final"
                            : "our experimental result"
                        : areas
                          ? "no pipeline run yet"
                          : "imagery: Esri"}
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="text-[15px] font-semibold">{s.shortName}</div>
                    <div className="text-[12.5px] text-[#64748b]">{s.region}, {s.state}</div>
                    <div className="mt-2 text-[12px] text-[#475569]">
                      {s.protectedAreas?.[0] ?? s.tags[0]} · configured footprint {s.areaKm2} km²
                    </div>
                    {run && (
                      <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[11px]">
                        <div className="rounded-md bg-white px-1 py-1"><div className="font-semibold">{run.nPatches}</div><div className="text-[#64748b]">patches</div></div>
                        <div className="rounded-md bg-white px-1 py-1"><div className="font-semibold">{run.nEdges}</div><div className="text-[#64748b]">links</div></div>
                        <div className="rounded-md bg-white px-1 py-1"><div className="font-semibold">{run.ecaPctOfHabitat != null ? `${run.ecaPctOfHabitat.toFixed(0)}%` : "—"}</div><div className="text-[#64748b]">ECA/habitat</div></div>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ insights */}
      <section id="insights" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="text-[11.5px] font-semibold uppercase tracking-[0.2em] text-[#16a34a]">What the graph reveals</div>
        <h2 className="mt-2 text-[34px] font-bold tracking-tight">Insights</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-[#0f5132] p-6 text-white">
            <div className="text-[12px] font-semibold uppercase tracking-wider text-[#86efac]">Size is not importance</div>
            <p className="mt-2 text-[14px] leading-relaxed text-white/90">
              A small patch sitting between two groups can carry more connectivity than the largest patch in the landscape. The
              dashboard ranks patches by what their loss actually costs, computed by removing each one in turn.
            </p>
          </div>
          <div className="rounded-2xl border border-black/[0.06] bg-white p-6 shadow-sm">
            <div className="text-[12px] font-semibold uppercase tracking-wider text-[#16a34a]">What-if, exactly</div>
            <p className="mt-2 text-[14px] leading-relaxed text-[#334155]">
              Click a patch or draw a polygon: the network is rebuilt without it and the connectivity index recomputed — the
              answer is a measurement of the graph, not a narrative.
            </p>
          </div>
          <div className="rounded-2xl border border-black/[0.06] bg-white p-6 shadow-sm">
            <div className="text-[12px] font-semibold uppercase tracking-wider text-[#16a34a]">Restoration that pays back</div>
            <p className="mt-2 text-[14px] leading-relaxed text-[#334155]">
              Candidate sites are ranked by the connectivity they would add when inserted into the graph; cost-aware ranking
              switches on only when real cost data is supplied.
            </p>
          </div>
        </div>
        {areas && areas.some((a) => a.latestRun && a.latestRun.resultKind !== "synthetic") && (
          <div className="mt-6 rounded-2xl border border-black/[0.06] bg-white p-5 text-[13px] text-[#334155] shadow-sm">
            <b>Latest real runs:</b>{" "}
            {areas
              .filter((a) => a.latestRun && a.latestRun.resultKind !== "synthetic")
              .map((a) => `${a.short_name}: ${a.latestRun!.nPatches} patches, ${a.latestRun!.nComponents} components, ECA ${a.latestRun!.ecaPctOfHabitat?.toFixed(1)} % of habitat (${a.latestRun!.resultKind})`)
              .join(" · ")}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------ team */}
      <section id="team" className="bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.2em] text-[#16a34a]">{TEAM.project}</div>
          <h2 className="mt-2 text-[34px] font-bold tracking-tight">Team</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TEAM.members.map((m) => (
              <div key={m.name} className="rounded-2xl border border-black/[0.06] bg-[#f6f8fb] p-5">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-[#dcfce7] text-[#16a34a]">
                  <Users className="h-6 w-6" />
                </div>
                <div className="mt-3 text-[15px] font-semibold">{m.name}</div>
                <div className="text-[12.5px] text-[#64748b]">{m.role}</div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[12px] text-[#94a3b8]">{TEAM.note}</p>
        </div>
      </section>

      {/* ------------------------------------------------------------ cta + footer */}
      <section className="bg-[#0b1120] text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center">
          <div>
            <h3 className="text-[28px] font-bold tracking-tight">See the connectivity of a coast in minutes.</h3>
            <p className="mt-2 text-[15px] text-white/75">Open the dashboard, pick a study area and run the pipeline.</p>
          </div>
          <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-lg bg-[#22c55e] px-6 py-3.5 text-[15px] font-semibold text-[#052e16] hover:bg-[#4ade80]">
            Open Dashboard <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-[12px] text-white/60 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>© {new Date().getFullYear()} EcoConnectAI — A Satellite-Driven Framework for Coastal Ecosystem Connectivity and Conservation Decision Support</div>
            <div>Imagery: Esri World Imagery · Copernicus Sentinel-1/2 · Labels: Global Mangrove Watch v3 (CC-BY-4.0)</div>
          </div>
        </div>
      </section>
    </div>
  );
}
