"use client";

import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { SENSITIVITY_META } from "@/lib/constants";
import type { CriticalityRow } from "@/lib/api";
import type { SensitivityBand } from "@/types";

const W = 440, H = 392;
const M = { l: 46, r: 18, t: 18, b: 44 };
const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Area rank (x) against criticality rank (y) for every patch of a run. Rank 1 sits top-left on both axes, so the
 * dashed diagonal is "importance exactly as large as size": points in the shaded upper-right half matter more to
 * the network than their size suggests. Colour = criticality band, dashed ring = cut vertex. Values are the run's
 * stored leave-one-out results; nothing is derived here except ranks → pixels.
 */
export function ImportanceScatter({
  rows, bands, hover, onHover, onPick,
}: {
  rows: CriticalityRow[];
  bands: Map<string, SensitivityBand>;
  hover: string | null;
  onHover: (id: string | null) => void;
  onPick: (id: string) => void;
}) {
  const reduce = useReducedMotion();
  const [focus, setFocus] = useState<string | null>(null);
  const active = hover ?? focus;
  const n = rows.length;
  const pw = W - M.l - M.r, ph = H - M.t - M.b;
  const sx = (rank: number) => M.l + ((rank - 0.5) / n) * pw;
  const sy = (rank: number) => M.t + ((rank - 0.5) / n) * ph;
  const step = n <= 14 ? 1 : n <= 30 ? 5 : 10;
  const ticks = Array.from({ length: n }, (_, i) => i + 1).filter((t) => t === 1 || t % step === 0);
  const maxArea = Math.max(...rows.map((r) => r.area_ha), 1e-9);
  const radius = (a: number) => 5 + 7 * Math.sqrt(a / maxArea);

  // Label the three most critical patches plus any patch that ranks ≥ 2 places higher by importance than by size.
  const labelled = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => { if (r.rank <= 3 || r.rank_by_area - r.rank >= 2) s.add(r.patch_id); });
    return s;
  }, [rows]);

  const x0 = M.l, y0 = M.t, x1 = M.l + pw, y1 = M.t + ph;
  const tip = active ? rows.find((r) => r.patch_id === active) : null;
  // draw the active point last so it sits on top
  const ordered = [...rows].sort((a, b) => (a.patch_id === active ? 1 : 0) - (b.patch_id === active ? 1 : 0) || b.area_ha - a.area_ha);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full select-none" role="img" aria-label="Area rank against criticality rank for every patch">
        <defs>
          <linearGradient id="imp-above" x1="1" y1="0" x2="0.4" y2="0.6">
            <stop offset="0" stopColor="#16a34a" stopOpacity="0.14" />
            <stop offset="1" stopColor="#16a34a" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* plot frame + regions */}
        <rect x={x0} y={y0} width={pw} height={ph} rx={10} fill="#fafcfb" stroke="#0f5132" strokeOpacity={0.08} />
        <path d={`M${x0},${y0} L${x1},${y0} L${x1},${y1} Z`} fill="url(#imp-above)" />

        {/* gridlines */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={sx(t)} x2={sx(t)} y1={y0} y2={y1} stroke="#0f172a" strokeOpacity={0.05} />
            <line x1={x0} x2={x1} y1={sy(t)} y2={sy(t)} stroke="#0f172a" strokeOpacity={0.05} />
            <text x={sx(t)} y={y1 + 15} textAnchor="middle" fontSize="10" fill="#64748b" className="tabular">{t}</text>
            <text x={x0 - 8} y={sy(t) + 3.5} textAnchor="end" fontSize="10" fill="#64748b" className="tabular">{t}</text>
          </g>
        ))}

        {/* region labels */}
        <text x={x1 - 10} y={y0 + 18} textAnchor="end" fontSize="10.5" fontWeight={700} fill="#15803d">Matters more than its size</text>
        <text x={x0 + 10} y={y1 - 10} fontSize="10.5" fontWeight={600} fill="#94a3b8">Matters less than its size</text>

        {/* size = importance reference */}
        <motion.path
          d={`M${x0},${y0} L${x1},${y1}`}
          stroke="#0f5132" strokeOpacity={0.35} strokeWidth={1.4} strokeDasharray="5 5" fill="none"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: EASE }}
        />
        <text
          x={x0 + pw * 0.2} y={y0 + ph * 0.2 + 14} fontSize="10" fontWeight={600} fill="#0f5132" opacity={0.55}
          transform={`rotate(${(Math.atan2(ph, pw) * 180) / Math.PI} ${x0 + pw * 0.2} ${y0 + ph * 0.2 + 14})`}
        >
          size = importance
        </text>

        {/* axis titles */}
        <text x={x0 + pw / 2} y={H - 8} textAnchor="middle" fontSize="11" fontWeight={600} fill="#334155">Size rank · 1 = largest</text>
        <text x={13} y={y0 + ph / 2} textAnchor="middle" fontSize="11" fontWeight={600} fill="#334155" transform={`rotate(-90 13 ${y0 + ph / 2})`}>
          Importance rank · 1 = most critical
        </text>

        {/* points */}
        {ordered.map((r) => {
          const i = r.rank - 1;
          const x = sx(r.rank_by_area), y = sy(r.rank);
          const band = bands.get(r.patch_id) ?? "low";
          const color = SENSITIVITY_META[band].color;
          const rr = radius(r.area_ha);
          const on = active === r.patch_id;
          const dim = !!active && !on;
          return (
            <motion.g
              key={r.patch_id}
              initial={reduce ? false : { opacity: 0, scale: 0.2 }}
              animate={{ opacity: dim ? 0.35 : 1, scale: on ? 1.18 : 1 }}
              transition={{ duration: 0.5, delay: reduce ? 0 : 0.35 + i * 0.05, ease: EASE, opacity: { duration: 0.25 } }}
              style={{ transformOrigin: `${x}px ${y}px`, transformBox: "view-box" }}
              className="cursor-pointer outline-none"
              tabIndex={0}
              role="button"
              aria-label={`${r.patch_id}: size rank ${r.rank_by_area}, importance rank ${r.rank}`}
              onMouseEnter={() => onHover(r.patch_id)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => setFocus(r.patch_id)}
              onBlur={() => setFocus(null)}
              onClick={() => onPick(r.patch_id)}
              onKeyDown={(e) => { if (e.key === "Enter") onPick(r.patch_id); }}
            >
              {r.is_cut_vertex && (
                <circle cx={x} cy={y} r={rr + 4.5} fill="none" stroke="#b91c1c" strokeWidth={1.6} strokeDasharray="3 2.5" />
              )}
              <circle cx={x} cy={y} r={rr} fill={color} fillOpacity={0.9} stroke="#fff" strokeWidth={2} style={{ filter: `drop-shadow(0 2px 4px ${color}66)` }} />
              {(labelled.has(r.patch_id) || on) && (
                <text x={x + rr + (r.is_cut_vertex ? 7 : 4)} y={y + 3.5} fontSize="11" fontWeight={700} fill="#0f172a" paintOrder="stroke" stroke="#fafcfb" strokeWidth={3}>
                  {r.patch_id}
                </text>
              )}
            </motion.g>
          );
        })}
      </svg>

      {/* hover card */}
      {tip && (
        <div
          className="pointer-events-none absolute z-10 w-[188px] rounded-xl border border-black/[0.08] bg-white/95 px-3 py-2.5 text-[11.5px] shadow-[0_12px_32px_-12px_rgba(15,23,42,0.35)] backdrop-blur"
          style={{
            left: `${(Math.min(sx(tip.rank_by_area), W - 120) / W) * 100}%`,
            top: `${(sy(tip.rank) / H) * 100}%`,
            transform: sy(tip.rank) > H * 0.55 ? "translate(-50%, calc(-100% - 16px))" : "translate(-50%, 16px)",
          }}
        >
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: SENSITIVITY_META[bands.get(tip.patch_id) ?? "low"].color }} />
            <b className="text-[13px]">{tip.patch_id}</b>
            {tip.is_cut_vertex && <span className="ml-auto rounded-full bg-[#fee2e2] px-1.5 py-px text-[10px] font-semibold text-[#b91c1c]">splits</span>}
          </div>
          <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5 tabular text-muted-foreground">
            <span>Size</span><span className="text-right font-semibold text-foreground">#{tip.rank_by_area} · {tip.area_ha.toFixed(1)} ha</span>
            <span>Importance</span><span className="text-right font-semibold text-foreground">#{tip.rank}</span>
            <span>If lost</span><span className="text-right font-semibold text-[#b91c1c]">IIC −{tip.delta_pct.toFixed(1)} %</span>
          </div>
        </div>
      )}
    </div>
  );
}
