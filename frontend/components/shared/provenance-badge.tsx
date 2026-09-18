"use client";

import { Database, FlaskConical, Beaker, ShieldCheck, WifiOff } from "lucide-react";
import { useAnalysis } from "@/hooks/use-analysis";
import { Tooltip } from "@/components/ui/tooltip";

/**
 * Tells the viewer where the numbers on screen come from. Shown in the app header on every page.
 *   mock          -> PROTOTYPE / SYNTHETIC (prepared JSON)            grey
 *   synthetic run -> computed exactly over synthetic geometry          violet
 *   development   -> real pipeline, small subset — NOT FINAL           amber
 *   experiment    -> OUR EXPERIMENTAL RESULT                          green
 */
export function ProvenanceBadge({ compact = false }: { compact?: boolean }) {
  const { dataSource, apiOnline, bundleLoading } = useAnalysis();
  const kind = dataSource.provenance?.resultKind ?? "mock";
  const meta = {
    mock: { label: "Prototype · synthetic", color: "#94a3b8", Icon: Database },
    synthetic: { label: "Exact computation · synthetic geometry", color: "#6d5bd0", Icon: Beaker },
    development: { label: "Real pipeline · dev subset · not final", color: "#f59e0b", Icon: FlaskConical },
    experiment: { label: "Our experimental result", color: "#22c55e", Icon: ShieldCheck },
    external: { label: "External patch geometry", color: "#1e5f8a", Icon: Database },
  }[kind];
  const Icon = meta.Icon;
  const p = dataSource.provenance;
  const content = (
    <div className="max-w-[260px] text-[11px] leading-relaxed">
      <div className="font-semibold">{dataSource.label}</div>
      {p ? (
        <div className="mt-1 space-y-0.5 text-muted-foreground">
          <div>run {p.runId}</div>
          <div>
            source: {String(p.dataSource.type ?? "?")} · model: {String(p.dataSource.model ?? "n/a")}
          </div>
          <div>
            k = {p.parameters.k}, τ = {p.parameters.tauKm} km, C(G) = {p.parameters.metric.toUpperCase()}
            {p.parameters.threshold != null && `, threshold ${p.parameters.threshold}`}
          </div>
          <div>{new Date(p.timestamp).toLocaleString()}</div>
        </div>
      ) : (
        <div className="mt-1 text-muted-foreground">
          {apiOnline === false
            ? "Backend offline — showing the prototype's prepared datasets."
            : "No pipeline run for this study area yet — showing the prototype's prepared datasets."}
        </div>
      )}
    </div>
  );
  return (
    <Tooltip content={content} side="bottom">
      <span
        className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider"
        style={{ borderColor: `${meta.color}55`, color: meta.color, background: `${meta.color}14` }}
      >
        {bundleLoading ? (
          <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: meta.color }} />
        ) : (
          <Icon className="h-3 w-3" />
        )}
        {!compact && <span className="hidden sm:inline">{meta.label}</span>}
        {apiOnline === false && <WifiOff className="h-3 w-3 opacity-70" aria-label="backend offline" />}
      </span>
    </Tooltip>
  );
}
