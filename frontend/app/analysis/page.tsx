"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Columns2,
  Download,
  Flame,
  Layers,
  Loader2,
  Map as MapIcon,
  Network,
  Satellite,
  Sparkles,
} from "lucide-react";

import { AppShell } from "@/components/dashboard/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  CoordinateReadout,
  LayerControl,
  MapLegend,
  MapToolbar,
  MiniMap,
  NorthArrow,
} from "@/components/maps/map-chrome";
import { PixelInspector } from "@/components/maps/pixel-inspector";
import type { LayerState } from "@/components/maps/gis-map";
import { ScoreGauge, CompositionChart, ConnectivityTrendChart } from "@/components/charts";
import { EASE } from "@/components/shared/motion";
import { useAnalysis } from "@/hooks/use-analysis";
import { getConnectivity, getGraph, getHabitatMask, getHeatmap } from "@/lib/data";
import { fetchProbabilityBounds, probabilityPngUrl, registerDetection } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { requestMapFocus, useMapFocus } from "@/lib/map-focus";
import { useSearchParams } from "next/navigation";
import { SensitivityExplorer } from "@/components/analysis/sensitivity-explorer";
import { EvidenceDrawer } from "@/components/analysis/evidence-drawer";
import { SENSITIVITY_META, type BasemapId } from "@/lib/constants";
import { fmtArea, fmtDate, fmtRatio, fmtIndex } from "@/utils/format";
import { cn } from "@/lib/utils";

// Leaflet touches window on import — must not run during SSR.
const GisMap = dynamic(() => import("@/components/maps/gis-map"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center bg-[#04101f]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-[#15803d]" />
        <span className="text-[11px] text-muted-foreground">Loading map tiles…</span>
      </div>
    </div>
  ),
});

type ViewMode = "map" | "split";

export default function AnalysisPage() {
  return <Suspense><AnalysisView /></Suspense>;
}

function AnalysisView() {
  const { sceneId, scene, setSceneId, selectedPatchId, setSelectedPatchId, dataSource, runId, bundleVersion } = useAnalysis();
  const { can } = useAuth();
  const focus = useMapFocus();
  const params = useSearchParams();
  const [reviewMsg, setReviewMsg] = useState<string | null>(null);
  // Deep links: /analysis?scene=<id>&patch=<id>  or  ?scene=<id>&lat=&lon=
  const wantScene = params.get("scene"); const wantPatch = params.get("patch");
  const wantLat = Number(params.get("lat")); const wantLon = Number(params.get("lon"));
  useEffect(() => {
    if (wantScene && wantScene !== sceneId) setSceneId(wantScene);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantScene]);
  useEffect(() => {
    if (wantScene && wantScene !== sceneId) return;
    if (wantPatch) {
      const p = getHabitatMask(sceneId).patches.find((x) => x.id === wantPatch);
      if (p) { setSelectedPatchId(p.id); requestMapFocus(p.center[0], p.center[1], 14); }
    } else if (wantLat && wantLon) requestMapFocus(wantLat, wantLon, 14);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantScene, wantPatch, wantLat, wantLon, sceneId, bundleVersion]);
  // Real runs expose their probability raster as a bounded PNG overlay (tagged by run so it never goes stale).
  const [probRes, setProbRes] = useState<{ key: string; data: { url: string; bounds: [[number, number], [number, number]] } | null } | null>(null);
  const probKey = `${sceneId}|${dataSource.provenance?.runId ?? ""}`;
  const probOverlay = probRes?.key === probKey ? probRes.data : null;
  useEffect(() => {
    let cancelled = false;
    const prov = dataSource.provenance;
    if (dataSource.mode !== "live" || !prov || prov.dataSource.type !== "probability_raster") return;
    const key = probKey;
    fetchProbabilityBounds(sceneId, prov.runId).then((b) => {
      if (!cancelled) setProbRes({ key, data: b ? { url: probabilityPngUrl(sceneId, prov.runId), bounds: b } : null });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneId, runId, dataSource.provenance?.runId, bundleVersion]);

  const mask = getHabitatMask(sceneId);
  const graph = getGraph(sceneId);
  const heatmap = getHeatmap(sceneId);
  const conn = getConnectivity(sceneId);

  const [view, setView] = useState<ViewMode>("split");
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [evidenceFor, setEvidenceFor] = useState<string | null>(null);
  const [layers, setLayers] = useState<LayerState>({
    satellite: true,
    probability: true,
    habitat: true,
    heatmap: true,
    connectivity: true,
    protectedAreas: false,
    labels: true,
  });
  const [basemap, setBasemap] = useState<BasemapId>("satellite");
  const [heatOpacity, setHeatOpacity] = useState(0.68);
  const [layerPanelOpen, setLayerPanelOpen] = useState(false);
  const [cursor, setCursor] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Show the layer panel up front on wide screens, where it doesn't cover the map.
  useEffect(() => {
    const t = window.setTimeout(() => { if (window.innerWidth >= 1280) setLayerPanelOpen(true); }, 0);
    return () => window.clearTimeout(t);
  }, []);

  const selectedPatch = useMemo(
    () => mask.patches.find((p) => p.id === selectedPatchId) ?? null,
    [mask.patches, selectedPatchId],
  );
  const selectedCell = useMemo(
    () => heatmap.cells.find((c) => c.id === selectedCellId) ?? null,
    [heatmap.cells, selectedCellId],
  );

  const critical = mask.patches.filter((p) => p.sensitivity === "critical");
  const high = mask.patches.filter((p) => p.sensitivity === "high");

  const bandCounts = (["critical", "high", "medium", "low"] as const).map((band) => ({
    band,
    count: mask.patches.filter((p) => p.sensitivity === band).length,
  }));

  const mapPane = (
    <div className="relative h-full w-full overflow-hidden">
      <GisMap
        key={`${sceneId}-${mapKey}`}
        scene={scene}
        mask={mask}
        graph={graph}
        heatmap={heatmap}
        layers={view === "split" ? { ...layers, heatmap: false } : layers}
        basemap={basemap}
        heatOpacity={heatOpacity}
        probabilityOverlay={probOverlay}
        selectedPatchId={selectedPatchId}
        onSelectPatch={(id) => {
          setSelectedPatchId(id);
          setSelectedCellId(null);
        }}
        focus={focus}
        onCursorMove={setCursor}
        onCellClick={(id) => {
          setSelectedCellId(id);
          setSelectedPatchId(null);
        }}
        className="h-full w-full"
      />

      {/* chrome */}
      <LayerControl
        layers={layers}
        onChange={setLayers}
        basemap={basemap}
        onBasemapChange={setBasemap}
        heatOpacity={heatOpacity}
        onHeatOpacityChange={setHeatOpacity}
        open={layerPanelOpen}
        onOpenChange={setLayerPanelOpen}
      />

      <MapToolbar
        className="absolute right-3 top-1/2 z-[1000] -translate-y-1/2"
        fullscreen={fullscreen}
        onToggleFullscreen={() => setFullscreen((v) => !v)}
        onResetView={() => setMapKey((k) => k + 1)}
      />

      <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] flex flex-col gap-2">
        <MapLegend mask={mask} />
      </div>

      <div className="pointer-events-none absolute right-3 top-16 z-[999] flex flex-col items-end gap-2">
        <NorthArrow />
        <MiniMap scene={scene} cursor={cursor} />
      </div>

      <div className="pointer-events-none absolute bottom-3 left-1/2 z-[1000] -translate-x-1/2">
        <CoordinateReadout cursor={cursor} zoom={scene.zoom} epsg="EPSG:4326" />
      </div>

      <PixelInspector
        patch={selectedPatch}
        cell={selectedCell}
        graph={graph}
        onClose={() => {
          setSelectedPatchId(null);
          setSelectedCellId(null);
        }}
      />

      {/* evidence chain for the selected patch */}
      {selectedPatchId && dataSource.mode === "live" && !evidenceFor && (
        <div className="absolute bottom-16 right-3 z-[940] flex flex-col items-end gap-1.5">
          <button onClick={() => setEvidenceFor(selectedPatchId)} className="rounded-full bg-[#0f5132] px-3 py-1.5 text-[11px] font-semibold text-white shadow hover:bg-[#0b3d26]">
            Why is {selectedPatchId} ranked here? · Evidence
          </button>
          {can("review_detections") && dataSource.provenance && (
            <button
              onClick={async () => {
                const p = selectedPatch;
                if (!p || !dataSource.provenance) return;
                try {
                  const d = await registerDetection({ study_area_id: sceneId, run_id: dataSource.provenance.runId, object_type: "patch", object_id: p.id, lat: p.center[0], lon: p.center[1], summary: `${p.areaHa} ha · rank #${p.criticalityRank ?? "—"} · confidence ${(p.confidence * 100).toFixed(0)} %` });
                  setReviewMsg(`Registered as detection #${d.id} (${d.status}) — see Field Reports → verification queue.`);
                } catch (e) { setReviewMsg(e instanceof Error ? e.message : String(e)); }
              }}
              className="rounded-full border border-[#0f5132]/40 bg-white px-3 py-1.5 text-[11px] font-semibold text-[#0f5132] shadow hover:bg-[#f0fdf4]"
            >
              Send {selectedPatchId} to verification
            </button>
          )}
          {reviewMsg && <div className="max-w-[260px] rounded-lg bg-white/95 px-2 py-1 text-[10.5px] shadow">{reviewMsg}</div>}
        </div>
      )}
      {evidenceFor && <EvidenceDrawer objectType="patch" objectId={evidenceFor} onClose={() => setEvidenceFor(null)} />}

      {/* τ / k / metric sensitivity explorer (real runs) */}
      <div className="absolute left-3 top-24 z-[900] w-[300px] max-w-[calc(100%-1.5rem)]">
        <button
          onClick={() => setExplorerOpen((o) => !o)}
          className="rounded-full border border-foreground/10 bg-sidebar/90 px-3 py-1.5 text-[11px] font-semibold text-foreground shadow backdrop-blur hover:bg-sidebar"
        >
          {explorerOpen ? "Hide" : "Open"} sensitivity explorer (τ · k · metric)
        </button>
        {explorerOpen && <div className="mt-2 max-h-[70vh] overflow-y-auto scroll-slim"><SensitivityExplorer /></div>}
      </div>
    </div>
  );

  return (
    <AppShell
      title="Analysis"
      subtitle={`${scene.name} · ${mask.totals.patchCount} patches · ${fmtArea(mask.totals.habitatAreaHa)}`}
      bleed
      actions={
        <>
          <Tabs
            className="hidden sm:inline-flex"
            layoutId="analysis-view"
            size="sm"
            value={view}
            onValueChange={(v) => setView(v as ViewMode)}
            items={[
              { value: "split", label: "Split", icon: Columns2 },
              { value: "map", label: "Map", icon: MapIcon },
            ]}
          />
          <Button asChild variant="outline" size="sm" className="hidden md:inline-flex">
            <Link href="/graph">
              <Network className="h-3.5 w-3.5" />
              Graph
            </Link>
          </Button>
          <Button asChild size="sm" className="bg-gradient-eco font-semibold text-[#ffffff]">
            <Link href="/simulation">
              Simulate
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </>
      }
    >
      <div
        ref={containerRef}
        className={cn(
          "flex flex-col",
          fullscreen
            ? "fixed inset-0 z-[70] bg-background"
            : "h-[calc(100vh-4rem)]",
        )}
      >
        {/* ------------------------------------------------ map area */}
        <div className="relative min-h-0 flex-1">
          {view === "map" ? (
            mapPane
          ) : (
            <div className="grid h-full grid-rows-2 lg:grid-cols-2 lg:grid-rows-1">
              {/* left — satellite + habitat */}
              <div className="relative min-h-0 border-b border-foreground/[0.08] lg:border-b-0 lg:border-r">
                <div className="pointer-events-none absolute right-14 top-3 z-[999]">
                  <Badge variant="secondary" className="backdrop-blur">
                    <Satellite className="h-3 w-3" />
                    Satellite · habitat mask
                  </Badge>
                </div>
                {mapPane}
              </div>

              {/* right — heatmap */}
              <div className="relative min-h-0">
                <div className="pointer-events-none absolute right-3 top-3 z-[999]">
                  <Badge variant="danger" className="backdrop-blur">
                    <Flame className="h-3 w-3" />
                    Connectivity sensitivity
                  </Badge>
                </div>
                <GisMap
                  key={`heat-${sceneId}-${mapKey}`}
                  scene={scene}
                  mask={mask}
                  graph={graph}
                  heatmap={heatmap}
                  layers={{
                    satellite: false,
                    probability: false,
                    habitat: false,
                    heatmap: true,
                    connectivity: layers.connectivity,
                    protectedAreas: false,
                    labels: false,
                  }}
                  basemap="dark"
                  heatOpacity={heatOpacity}
                  selectedPatchId={selectedPatchId}
                  onSelectPatch={(id) => {
                    setSelectedPatchId(id);
                    setSelectedCellId(null);
                  }}
                  onCellClick={(id) => {
                    setSelectedCellId(id);
                    setSelectedPatchId(null);
                  }}
                  onCursorMove={setCursor}
                  className="h-full w-full"
                />

                <div className="pointer-events-none absolute bottom-3 right-3 z-[1000] w-[168px] rounded-2xl glass-strong p-3 shadow-xl">
                  <div className="mb-2 text-[9.5px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Sensitivity
                  </div>
                  <div className="mb-2 h-2 rounded-full bg-gradient-to-r from-[#22c55e] via-[#f59e0b] to-[#ef4444]" />
                  <div className="flex justify-between text-[9px] text-muted-foreground">
                    <span>Low</span>
                    <span>Medium</span>
                    <span>High</span>
                    <span>Critical</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* -------------------------------------- analysis summary bar */}
        {!fullscreen && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: EASE }}
            className="scroll-slim shrink-0 overflow-x-auto border-t border-foreground/[0.08] bg-sidebar/85 backdrop-blur-xl"
          >
            <div className="flex min-w-max items-stretch divide-x divide-foreground/[0.08]">
              {/* score */}
              <div className="flex shrink-0 items-center gap-4 px-5 py-4">
                <ScoreGauge score={conn.score} size={92} label="Score" />
                <div>
                  <div className="text-[11px] font-semibold">{conn.grade ?? "Interface score · Eq. (7)"}</div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {conn.previousScore != null
                      ? `${conn.score > conn.previousScore ? "▲" : "▼"} ${Math.abs(conn.score - conn.previousScore).toFixed(1)} since last run`
                      : `IIC ${conn.iicIndex.toExponential(2)} · PC ${conn.pcIndex.toExponential(2)}`}
                  </div>
                  <div className="mt-2 flex gap-3 text-[10px] text-muted-foreground">
                    <span>
                      PC <b className="text-foreground">{fmtIndex(conn.pcIndex)}</b>
                    </span>
                    <span>
                      IIC <b className="text-foreground">{fmtIndex(conn.iicIndex)}</b>
                    </span>
                  </div>
                </div>
              </div>

              {/* bands */}
              <div className="shrink-0 px-5 py-4">
                <div className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Sensitivity distribution
                </div>
                <div className="flex gap-2.5">
                  {bandCounts.map(({ band, count }) => (
                    <button
                      key={band}
                      onClick={() => {
                        const first = mask.patches.find((p) => p.sensitivity === band);
                        if (first) {
                          setSelectedPatchId(first.id);
                          setSelectedCellId(null);
                        }
                      }}
                      className="min-w-[62px] rounded-xl border border-foreground/[0.08] bg-foreground/[0.03] px-2.5 py-2 text-left transition-colors hover:bg-foreground/[0.08]"
                    >
                      <div
                        className="text-[17px] font-bold leading-none tabular"
                        style={{ color: SENSITIVITY_META[band].color }}
                      >
                        {count}
                      </div>
                      <div className="mt-1 text-[9px] uppercase tracking-wider text-muted-foreground">
                        {SENSITIVITY_META[band].label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* stats */}
              <div className="shrink-0 px-5 py-4">
                <div className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Landscape metrics
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[11px]">
                  {[
                    ["Patches", mask.totals.patchCount],
                    ["Links", graph.edges.length],
                    ["Mean patch", `${mask.totals.meanPatchSizeHa} ha`],
                    ["Link density", conn.linkDensity],
                    ["Fragmentation", conn.fragmentationIndex],
                    ["Confidence", fmtRatio(conn.confidence)],
                  ].map(([k, v]) => (
                    <div key={k as string} className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="font-semibold tabular">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* interpretation */}
              <div className="min-w-[320px] max-w-[420px] shrink-0 px-5 py-4">
                <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#15803d]">
                  <Sparkles className="h-3 w-3" />
                  Analysis summary
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {conn.interpretation ??
                    (conn.research
                      ? `${conn.research.nPatches} patches, ${conn.research.nEdges} links in ${conn.research.nComponents} component${conn.research.nComponents === 1 ? "" : "s"} (k = ${conn.research.k}, τ = ${conn.research.tauKm} km). ECA = ${Math.round(conn.research.ecaHa).toLocaleString()} ha (${conn.ecaPctOfHabitat?.toFixed(1)}% of habitat). Spearman ρ(area, criticality) = ${conn.research.spearmanAreaVsCriticality.toFixed(2)}. ${conn.research.interfaceScoreLabel}.`
                      : "")}
                </p>
              </div>

              {/* critical alert */}
              {critical.length > 0 && (
                <div className="min-w-[280px] shrink-0 px-5 py-4">
                  <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#ef4444]">
                    <AlertTriangle className="h-3 w-3" />
                    Critical corridors
                  </div>
                  <div className="space-y-1.5">
                    {critical.slice(0, 2).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSelectedPatchId(p.id);
                          setSelectedCellId(null);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg border border-[#ef4444]/20 bg-[#ef4444]/8 px-2.5 py-2 text-left transition-colors hover:bg-[#ef4444]/14"
                      >
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#ef4444]" />
                        <span className="min-w-0 flex-1 truncate text-[11px]">{p.name}</span>
                        <span className="shrink-0 text-[10px] tabular text-[#ef4444]">
                          {fmtRatio(p.connectivityContribution)}
                        </span>
                      </button>
                    ))}
                    {high.length > 0 && (
                      <div className="pt-0.5 text-[10px] text-muted-foreground">
                        + {high.length} high-sensitivity patches
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </AppShell>
  );
}
