"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Leaf } from "lucide-react";
import {
  fetchRegistryModels, fetchRunCriticality, fetchRunGraph, fetchRunManifest, fetchRunMetrics, fetchRunRestoration,
  fetchSceneQuicklook, postScenario, postWhatIf,
  type CriticalityRow, type RegistryModel, type RestorationCandidateRow, type RunGraph, type ScenarioResult,
} from "@/lib/api";
import { NetworkCanvas, edgeKey, type Stage } from "@/components/demo/network-canvas";
import type { WhatIfResult } from "@/types";
import { Term } from "@/components/shared/term";

/**
 * Guided story: satellite image → habitat → patches → network → which patch matters → what if it is lost →
 * where restoration helps → what the evidence does and does not show. Every number is fetched live from the
 * stored run and the what-if / restoration engines; nothing on this page is typed in by hand.
 */
const SA = "kerala-coast";

type Data = {
  manifest: Awaited<ReturnType<typeof fetchRunManifest>>;
  metrics: Awaited<ReturnType<typeof fetchRunMetrics>>["research_metrics"];
  graph: RunGraph; crit: CriticalityRow[]; cands: RestorationCandidateRow[];
  model: RegistryModel | null; image: { url: string; bounds: [[number, number], [number, number]] } | null;
};

const fmt = (x: number, d = 1) => x.toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: d });

function Chapter({ n, stage, kicker, title, children }: { n: Stage; stage: Stage; kicker: string; title: string; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      data-chapter={n} viewport={{ amount: 0.2, once: true }}
      initial={reduce ? false : { opacity: 0.25, y: 24 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
      className="flex min-h-[88vh] flex-col justify-center py-16 lg:min-h-screen"
      aria-current={stage === n ? "step" : undefined}>
      <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#4ade80]">{String(n + 1).padStart(2, "0")} · {kicker}</div>
      <h2 className="mt-3 text-[30px] font-semibold leading-[1.08] tracking-[-0.02em] text-white sm:text-[40px]">{title}</h2>
      <div className="mt-5 space-y-4 text-[17px] leading-[1.5] text-slate-300">{children}</div>
    </motion.section>
  );
}

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="border-l border-white/15 pl-4">
      <div className="text-[12px] uppercase tracking-[0.12em] text-slate-400"><Term>{label}</Term></div>
      <div className="mt-1 text-[26px] font-semibold tracking-[-0.02em] text-white tabular-nums">{value}</div>
      {note && <div className="text-[13px] text-slate-400">{note}</div>}
    </div>
  );
}

export default function DemoPage() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>(0);
  const [whatIf, setWhatIf] = useState<WhatIfResult | null>(null);
  const [restore, setRestore] = useState<ScenarioResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [manifest, metrics, graph, crit, rest, models, image] = await Promise.all([
          fetchRunManifest(SA), fetchRunMetrics(SA), fetchRunGraph(SA), fetchRunCriticality(SA), fetchRunRestoration(SA),
          fetchRegistryModels().catch(() => [] as RegistryModel[]), fetchSceneQuicklook(SA, "s1"),
        ]);
        const modelId = (manifest.data_source.model ?? "").split("/").slice(-2, -1)[0];
        if (!cancelled) setData({ manifest, metrics: metrics.research_metrics, graph, crit, cands: rest.candidates,
          model: models.find((m) => m.id === modelId) ?? null, image });
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Worked example chosen from the data: the cut vertex whose criticality rank most exceeds its size rank.
  const focus = useMemo(() => {
    if (!data) return null;
    const cuts = data.crit.filter((r) => r.is_cut_vertex);
    return (cuts.length ? cuts : data.crit).reduce((a, b) => (b.rank_by_area - b.rank > a.rank_by_area - a.rank ? b : a));
  }, [data]);
  // headline only a restoration-sized candidate; large marginal areas are "uncertain habitat" (backend rule)
  const cand = data?.cands.find((c) => c.category !== "uncertain_habitat") ?? null;
  const uncertain = data?.cands.filter((c) => c.category === "uncertain_habitat") ?? [];

  // live engine calls for the two simulation chapters
  useEffect(() => {
    if (!focus || whatIf) return;
    postWhatIf(SA, [focus.patch_id]).then(setWhatIf).catch(() => undefined);
  }, [focus, whatIf]);
  useEffect(() => {
    if (!cand || restore) return;
    postScenario(SA, "latest", { type: "restore", candidate_ids: [cand.candidate_id] }).then(setRestore).catch(() => undefined);
  }, [cand, restore]);

  // Active chapter = the last one whose top has crossed 60 % of the viewport (robust when several are visible).
  useEffect(() => {
    if (!data) return;
    const onScroll = () => {
      const line = window.innerHeight * 0.6;
      let s = 0;
      document.querySelectorAll<HTMLElement>("[data-chapter]").forEach((el) => {
        if (el.getBoundingClientRect().top < line) s = Number(el.dataset.chapter);
      });
      setStage(s as Stage);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, [data]);

  const critMap = useMemo(() => Object.fromEntries((data?.crit ?? []).map((r) => [r.patch_id, r])), [data]);
  const severed = useMemo(() => new Set((whatIf?.severed_edges ?? []).map((e) => edgeKey(e.source, e.target))), [whatIf]);
  const m = data?.metrics;
  const topBySize = data ? [...data.crit].sort((a, b) => a.rank_by_area - b.rank_by_area).slice(0, 1)[0] : null;

  return (
    <div className="min-h-screen bg-[#050c18] text-slate-100 antialiased">
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-[#050c18]/80 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-[1400px] items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-[14px] font-semibold">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-[#15803d] to-[#0f5132] text-white"><Leaf className="h-4 w-4" /></span>
            EcoConnect<span className="text-[#4ade80]">AI</span>
          </Link>
          <div className="hidden text-[12px] text-slate-400 sm:block">Guided demo · live data from the stored Kerala development run</div>
          <Link href="/analysis?scene=kerala-coast" className="rounded-full bg-[#15803d] px-4 py-1.5 text-[13px] font-semibold text-white transition-transform active:scale-95">Open the platform</Link>
        </div>
        <div className="h-[2px] bg-white/[0.04]"><motion.div className="h-full bg-[#4ade80]" animate={{ width: `${((stage + 1) / 7) * 100}%` }} transition={{ duration: 0.4 }} /></div>
      </header>

      {err && <div className="mx-auto max-w-[980px] px-6 py-24 text-center text-slate-300">The demo reads live results from the API, which is not reachable right now ({err}). Start the backend and reload — nothing here is shown from a cached or invented copy.</div>}
      {!data && !err && <div className="mx-auto max-w-[980px] px-6 py-24 text-center text-slate-400">Loading the stored run…</div>}

      {data && m && focus && (
        <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-0 px-4 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
          {/* sticky map (top on mobile, right on desktop) */}
          <div className="sticky top-12 z-10 -mx-4 h-[42vh] bg-[#050c18] sm:-mx-6 lg:order-2 lg:mx-0 lg:h-[calc(100vh-3rem)] lg:py-6">
            <div className="relative h-full overflow-hidden rounded-none border-white/10 bg-[#020617] lg:rounded-2xl lg:border">
              <NetworkCanvas stage={stage} nodes={data.graph.nodes} edges={data.graph.edges} crit={critMap} focusId={focus.patch_id}
                severed={severed} candidate={cand} image={data.image} />
              <div className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-slate-400">
                {data.image ? "Sentinel-1 VV backscatter composite · " : ""}patch outlines from the model · links k = {data.manifest.config.graph.k_neighbors}, τ = {data.manifest.config.graph.tau_km} km
              </div>
              {stage >= 4 && stage < 6 && <div className="absolute right-3 top-3 rounded-full bg-[#c2410c]/90 px-3 py-1 text-[11px] font-semibold text-white">SIMULATION</div>}
            </div>
          </div>

          <div className="lg:order-1">
            <Chapter n={0} stage={stage} kicker="The landscape" title={`${data.manifest.study_area.name ?? "Vembanad–Kol wetland"}, seen from orbit`}>
              <p>Coastal mangroves in {data.manifest.study_area.state ?? "Kerala"} survive as small, scattered fragments along backwaters and islands. Whether those fragments still function as one network matters as much as how much of them is left.</p>
              <p className="text-slate-400">The image is a Sentinel-1 radar composite of the study area{data.manifest.data_source.scene_year ? ` (${data.manifest.data_source.scene_year})` : ""}. Radar sees through the monsoon cloud that hides this coast from optical satellites for much of the year.</p>
            </Chapter>

            <Chapter n={1} stage={stage} kicker="What the model detected" title={`${m.n_patches} habitat patches, ${fmt(m.habitat_area_ha)} ha`}>
              <p>A U-Net segmentation model classifies every 10 m pixel, and connected pixels above the probability threshold ({data.manifest.data_source.threshold ?? "—"}) become patches of at least 2 ha.</p>
              {data.model && (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-[14px] text-slate-300">
                  Model <b className="text-white">{data.model.display_name}</b> · status <b className="text-[#fbbf24]">{data.model.status}</b>
                  {data.model.test.iou != null && <> · test IoU {fmt(data.model.test.iou, 3)} against Global Mangrove Watch reference labels</>}.
                  {" "}These are agreement scores with a reference map, not field accuracy, and this Kerala model is a weak development model.
                </div>
              )}
            </Chapter>

            <Chapter n={2} stage={stage} kicker="From patches to a network" title="Habitat becomes a graph">
              <p>Each patch is linked to its {data.manifest.config.graph.k_neighbors} nearest neighbours within {data.manifest.config.graph.tau_km} km. Connectivity is then measured with the Integral Index of Connectivity (IIC).</p>
              <div className="grid grid-cols-3 gap-4 pt-2">
                <Figure label="Links" value={String(m.n_edges)} />
                <Figure label="Components" value={String(m.n_components)} />
                <Figure label="Effective area" value={`${fmt(m.eca_pct_of_habitat)} %`} note="ECA, share of habitat" />
              </div>
            </Chapter>

            <Chapter n={3} stage={stage} kicker="Which patch matters" title={`${focus.patch_id} is small — and ranks #${focus.rank} of ${data.crit.length}`}>
              <p>Every patch is removed in turn and connectivity recomputed exactly. <b className="text-white">{focus.patch_id}</b> holds {fmt(focus.area_ha, 2)} ha ({fmt(focus.area_pct)} % of habitat, #{focus.rank_by_area} by size) yet ranks <b className="text-white">#{focus.rank}</b> by criticality{focus.is_cut_vertex ? ": it is a cut vertex, the only bridge between parts of the network" : ""}.</p>
              {topBySize && (
                <div className="space-y-2 pt-1 text-[14px]">
                  {[topBySize, focus].map((r) => (
                    <div key={r.patch_id}>
                      <div className="flex justify-between text-slate-300"><span>{r.patch_id} · {fmt(r.area_ha, 1)} ha</span><span className="tabular-nums">−{fmt(r.delta_pct)} % IIC if lost</span></div>
                      <div className="mt-1 h-2 rounded-full bg-white/[0.06]"><motion.div className="h-full rounded-full bg-[#4ade80]" initial={{ width: 0 }} whileInView={{ width: `${Math.min(100, r.delta_pct * 2.5)}%` }} transition={{ duration: 0.8 }} /></div>
                    </div>
                  ))}
                  <div className="text-[12.5px] text-slate-400">Size alone would rank {focus.patch_id} near the bottom; the network says otherwise.</div>
                </div>
              )}
            </Chapter>

            <Chapter n={4} stage={stage} kicker="What if it is lost" title={whatIf ? `Connectivity falls ${fmt(whatIf.loss_pct)} %` : "Recomputing…"}>
              {whatIf ? (
                <>
                  <p>Removing {focus.patch_id} ({fmt(whatIf.habitat_area_removed_pct)} % of the habitat) severs {whatIf.severed_edges.length} links and splits the network from {whatIf.components_before} into {whatIf.components_after} components. This result was just recomputed by the what-if engine.</p>
                  <div className="grid grid-cols-3 gap-4 pt-2">
                    <Figure label="IIC" value={`−${fmt(whatIf.loss_pct)} %`} />
                    <Figure label="Components" value={`${whatIf.components_before} → ${whatIf.components_after}`} />
                    <Figure label="Links" value={`${whatIf.edges_before} → ${whatIf.edges_after}`} />
                  </div>
                  <p className="text-[14px] text-slate-400">A simulation over the modelled network, not a forecast. Across other radius and neighbour settings this patch&apos;s rank moves; the Scenario Lab&apos;s sensitivity grid shows by how much.</p>
                </>
              ) : <p>Waiting for the what-if engine.</p>}
            </Chapter>

            <Chapter n={5} stage={stage} kicker="Where restoration could help" title={cand ? (restore?.difference ? `${cand.candidate_id}: +${fmt(restore.difference.c_pct ?? cand.gain_pct, 2)} % connectivity` : "Ranking candidates…") : "Where the model is unsure"}>
              {cand && (
                <>
                  <p>Sites with a weaker habitat signal just below the threshold are tested as restoration candidates. The top one, <b className="text-white">{cand.candidate_id}</b> ({fmt(cand.area_ha, 1)} ha), would add {cand.new_links} links to {cand.linked_patch_ids.join(", ")}.</p>
                  <p className="text-[14px] text-slate-400">This is a model recommendation. Ownership, legal status, water regime and cost are not assessed. The platform routes it through GIS review, field verification and a human decision before anything is approved.</p>
                </>
              )}
              {uncertain.length > 0 && (
                <p className={cand ? "text-[14px] text-slate-400" : ""}>
                  {uncertain.length} larger area{uncertain.length > 1 ? "s" : ""} ({uncertain.slice(0, 3).map((c) => `${c.candidate_id} ${fmt(c.area_ha, 0)} ha`).join(", ")}) sit just below the habitat threshold.
                  They are more likely existing mangrove the model was unsure about than restoration sites, so the platform
                  flags them for a field check instead of claiming a restoration gain.
                </p>
              )}
            </Chapter>

            <Chapter n={6} stage={stage} kicker="What the evidence shows — and doesn't" title="Every number here is traceable">
              <ul className="list-disc space-y-2 pl-5 text-[16px]">
                <li>Run <span className="font-mono text-[14px] text-slate-200">{data.manifest.run_id}</span> · {data.manifest.result_label}.</li>
                <li>Segmentation is scored against Global Mangrove Watch reference labels, not field surveys. Nothing shown here has been field-validated.</li>
                <li>Connectivity is structural (patch geometry), not observed animal movement. What-if and restoration results are simulations.</li>
                <li>Each result links to its full provenance chain and can be recomputed on demand with “Reproduce this analysis”.</li>
              </ul>
              <div className="flex flex-wrap gap-3 pt-4">
                <Link href={`/analysis?scene=${SA}&patch=${focus.patch_id}`} className="inline-flex items-center gap-1.5 rounded-full bg-[#15803d] px-5 py-2.5 text-[14px] font-semibold text-white transition-transform active:scale-95">See the evidence for {focus.patch_id} <ArrowRight className="h-4 w-4" /></Link>
                <Link href="/scenario?type=sensitivity" className="rounded-full border border-[#4ade80]/40 px-5 py-2.5 text-[14px] font-semibold text-[#4ade80] transition-transform active:scale-95">Test the assumptions</Link>
              </div>
            </Chapter>
          </div>
        </div>
      )}
    </div>
  );
}
