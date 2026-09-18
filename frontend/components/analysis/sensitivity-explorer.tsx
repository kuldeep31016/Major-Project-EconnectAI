"use client";

import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, RotateCcw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { useAnalysis } from "@/hooks/use-analysis";
import { postReanalyse, type ReanalyseResult } from "@/lib/api";
import { applyReanalysis, getLiveBundle } from "@/lib/data";
import { fmtIndex } from "@/utils/format";

/**
 * Parameter sensitivity explorer (paper Sections VI-F, VII): change the dispersal threshold τ, the
 * neighbour count k or the connectivity metric and the backend rebuilds the graph of the current run
 * and recomputes IIC/PC/ECA, components and the exact leave-one-out criticality. Map, graph and
 * panels update from the same result. Patches never change — only the graph over them.
 */
export function SensitivityExplorer() {
  const { sceneId, runId, dataSource, bump } = useAnalysis();
  const live = dataSource.mode === "live";
  const base = dataSource.provenance?.parameters;
  const [tau, setTau] = useState(base?.tauKm ?? 5);
  const [k, setK] = useState(base?.k ?? 3);
  const [metric, setMetric] = useState(base?.metric ?? "iic");
  const [result, setResult] = useState<ReanalyseResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const original = useRef<string | null>(null);

  // Snapshot the original bundle so "reset" restores it without a refetch.
  useEffect(() => {
    const b = getLiveBundle(sceneId);
    original.current = b ? JSON.stringify(b) : null;
     
  }, [sceneId, runId, dataSource.provenance?.runId]);

  const run = (t: number, kk: number, m: string) => {
    if (!live) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setBusy(true);
      postReanalyse(sceneId, runId, { tau_km: t, k: kk, metric: m })
        .then((r) => {
          applyReanalysis(sceneId, r);
          setResult(r);
          setError(null);
          bump();
        })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setBusy(false));
    }, 250);
  };

  const reset = () => {
    const b = getLiveBundle(sceneId);
    if (b && original.current) Object.assign(b, JSON.parse(original.current));
    setResult(null);
    setTau(base?.tauKm ?? 5);
    setK(base?.k ?? 3);
    setMetric(base?.metric ?? "iic");
    bump();
  };

  if (!live) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-[#6d5bd0]" />
            Sensitivity explorer
          </CardTitle>
          <CardDescription>Available on real pipeline runs — recomputes the graph exactly for any τ / k / metric.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const s = result?.summary;
  const cells: [string, string | number][] = [
    ["links", s ? s.n_edges : "—"],
    ["components", s ? s.n_components : "—"],
    ["ECA / habitat", s ? `${s.eca_pct_of_habitat.toFixed(1)}%` : "—"],
    ["IIC", s ? fmtIndex(s.iic) : "—"],
    ["PC", s ? fmtIndex(s.pc) : "—"],
    ["mean degree", s ? s.mean_degree.toFixed(2) : "—"],
  ];
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-[#6d5bd0]" />
              Sensitivity explorer
            </CardTitle>
            <CardDescription>Exact recomputation over the same patches (paper §VI-F). Nothing is retrained.</CardDescription>
          </div>
          <button
            onClick={reset}
            className="flex items-center gap-1 rounded-lg border border-foreground/10 px-2 py-1 text-[10.5px] text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" /> reset
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-[11px]">
            <span className="text-muted-foreground">Dispersal threshold τ</span>
            <span className="font-semibold tabular">{tau.toFixed(1)} km</span>
          </div>
          <Slider
            value={tau}
            min={1}
            max={12}
            step={0.5}
            onValueChange={(v: number) => {
              setTau(v);
              run(v, k, metric);
            }}
            aria-label="tau"
          />
          <div className="mt-1 flex justify-between text-[9.5px] text-muted-foreground">
            <span>1 km</span>
            <span>paper: 3 / 5 / 8 km</span>
            <span>12 km</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px] text-muted-foreground">
            k neighbours
            <select
              value={k}
              onChange={(e) => {
                const kk = Number(e.target.value);
                setK(kk);
                run(tau, kk, metric);
              }}
              className="mt-1 w-full rounded-lg border border-foreground/10 bg-foreground/[0.04] px-2 py-1.5 text-[12px] text-foreground"
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] text-muted-foreground">
            C(G) metric
            <select
              value={metric}
              onChange={(e) => {
                setMetric(e.target.value);
                run(tau, k, e.target.value);
              }}
              className="mt-1 w-full rounded-lg border border-foreground/10 bg-foreground/[0.04] px-2 py-1.5 text-[12px] text-foreground"
            >
              <option value="iic">IIC</option>
              <option value="pc">PC</option>
              <option value="largest_component">largest component</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {cells.map(([l, v]) => (
            <div key={l} className="rounded-lg bg-foreground/[0.04] px-2 py-1.5">
              <div className="text-[8.5px] uppercase tracking-wider text-muted-foreground">{l}</div>
              <div className="text-[12.5px] font-semibold tabular">{busy ? "…" : v}</div>
            </div>
          ))}
        </div>
        {result && (
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Top criticality at τ = {tau} km</div>
            {result.criticality.slice(0, 5).map((c) => (
              <div key={c.patch_id} className="flex items-center justify-between border-t border-foreground/[0.06] py-1 text-[11.5px]">
                <span>
                  #{c.rank} {c.patch_id}
                  {c.is_cut_vertex ? <span className="ml-1 text-[#ef4444]">· cut vertex</span> : null}
                </span>
                <span className="tabular text-muted-foreground">
                  S = {c.criticality_score.toFixed(3)} · area #{c.rank_by_area}
                </span>
              </div>
            ))}
          </div>
        )}
        {error && <div className="text-[11px] text-[#ef4444]">{error}</div>}
        <p className="text-[10.5px] leading-relaxed text-muted-foreground">
          τ is species-relevant and uncalibrated; if the ranking changes materially between τ values, the paper says it should
          not inform planning on its own.
        </p>
      </CardContent>
    </Card>
  );
}
