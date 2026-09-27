"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { CriticalityRow, GraphEdge, GraphNode, RestorationCandidateRow } from "@/lib/api";

/** Story stages drive what the canvas shows; each stage adds one idea. */
export type Stage = 0 | 1 | 2 | 3 | 4 | 5 | 6;

interface Props {
  stage: Stage;
  nodes: GraphNode[];
  edges: GraphEdge[];
  crit: Record<string, CriticalityRow>;
  focusId: string | null;
  severed: Set<string>;                       // "a|b" keys of links lost when the focus patch is removed
  candidate: RestorationCandidateRow | null;
  image: { url: string; bounds: [[number, number], [number, number]] } | null;
}

const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
export const edgeKey = key;

/** Equirectangular projection around the patch cluster (km-true at this latitude); SVG units = metres/10. */
function makeProjection(nodes: GraphNode[], extra: [number, number][]) {
  const pts = [...nodes.flatMap((n) => (n.geometry?.coordinates[0] ?? []).map(([lon, lat]) => [lat, lon] as [number, number])), ...extra];
  const lats = pts.map((p) => p[0]); const lons = pts.map((p) => p[1]);
  const lat0 = (Math.min(...lats) + Math.max(...lats)) / 2;
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180) / 10, ky = 110540 / 10;
  const minLon = Math.min(...lons), maxLat = Math.max(...lats);
  const p = (lat: number, lon: number) => [(lon - minLon) * kx, (maxLat - lat) * ky] as const;
  const w = (Math.max(...lons) - minLon) * kx, h = (maxLat - Math.min(...lats)) * ky;
  const pad = Math.max(w, h) * 0.08;
  return { p, viewBox: `${-pad} ${-pad} ${w + 2 * pad} ${h + 2 * pad}`, unit: Math.max(w, h) / 400 };
}

/** S → colour on the theme-green ramp (low = pale, high = deep); critical cut vertices get the accent ring. */
const sColor = (s: number) => (s >= 0.25 ? "#4ade80" : s >= 0.1 ? "#22c55e" : s >= 0.03 ? "#15803d" : "#166534");

export function NetworkCanvas({ stage, nodes, edges, crit, focusId, severed, candidate, image }: Props) {
  const reduce = useReducedMotion();
  const extra: [number, number][] = candidate ? [candidate.centroid] : [];
  const { p, viewBox, unit } = makeProjection(nodes, extra);
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const removed = stage === 4 && focusId ? focusId : null;
  const dur = reduce ? 0 : 1;

  return (
    <svg viewBox={viewBox} className="h-full w-full" role="img" aria-label="Habitat patches and connectivity links of the selected run">
      {image && (() => {
        const [[minLat, minLon], [maxLat, maxLon]] = image.bounds;
        const [x0, y0] = p(maxLat, minLon); const [x1, y1] = p(minLat, maxLon);
        return <motion.image href={image.url} x={x0} y={y0} width={x1 - x0} height={y1 - y0} preserveAspectRatio="none"
          initial={{ opacity: 0 }} animate={{ opacity: stage === 0 ? 0.9 : 0.45 }} transition={{ duration: dur * 1.2 }} />;
      })()}

      {/* links */}
      {edges.map((e, i) => {
        const a = byId[e.source], b = byId[e.target];
        if (!a || !b) return null;
        const [x1, y1] = p(...a.centroid); const [x2, y2] = p(...b.centroid);
        const lost = removed && severed.has(key(e.source, e.target));
        return (
          <motion.line key={key(e.source, e.target)} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={lost ? "#f87171" : "#e2e8f0"} strokeLinecap="round"
            strokeWidth={unit * (lost ? 2.2 : 0.6 + 1.6 * e.weight)} strokeDasharray={lost ? `${unit * 4} ${unit * 3}` : undefined}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: stage >= 2 ? 1 : 0, opacity: stage >= 2 ? (lost ? 0.95 : removed ? 0.35 : 0.7) : 0 }}
            transition={{ duration: dur * 0.9, delay: stage === 2 && !reduce ? i * 0.025 : 0 }} />
        );
      })}

      {/* patches (real polygons) */}
      {nodes.map((n, i) => {
        const r = crit[n.id]; const s = r?.criticality_score ?? 0;
        const ring = n.geometry?.coordinates[0] ?? [];
        const d = ring.map(([lon, lat], j) => `${j ? "L" : "M"}${p(lat, lon).join(",")}`).join("") + "Z";
        const isFocus = n.id === focusId;
        const fill = stage >= 3 ? sColor(s) : "#4ade80";
        const gone = removed === n.id;
        return (
          <motion.path key={n.id} d={d} fill={fill} stroke={isFocus && stage >= 3 ? "#fef08a" : "#052e16"} strokeWidth={unit * (isFocus && stage >= 3 ? 2.5 : 0.4)}
            initial={{ opacity: 0 }}
            animate={{ opacity: stage >= 1 ? (gone ? 0.08 : stage >= 3 && !isFocus && stage < 6 ? 0.55 + 0.45 * Math.min(1, s / 0.3) : 0.9) : 0 }}
            transition={{ duration: dur * 0.6, delay: stage === 1 && !reduce ? i * 0.03 : 0 }} />
        );
      })}

      {/* focus marker */}
      {focusId && byId[focusId] && stage >= 3 && (() => {
        const [cx, cy] = p(...byId[focusId].centroid);
        return (
          <g>
            <motion.circle cx={cx} cy={cy} r={unit * 14} fill="none" stroke="#fef08a" strokeWidth={unit * 1.2}
              initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 0.9 }} transition={{ duration: dur * 0.6 }}
              style={{ transformOrigin: `${cx}px ${cy}px` }} />
            <text x={cx + unit * 17} y={cy - unit * 10} fill="#fef9c3" fontSize={unit * 14} fontWeight={600}>{focusId}</text>
          </g>
        );
      })()}

      {/* restoration candidate + its new links */}
      {candidate && stage >= 5 && (() => {
        const [cx, cy] = p(...candidate.centroid);
        return (
          <g>
            {candidate.linked_patch_ids.map((pid) => byId[pid] && (() => {
              const [x2, y2] = p(...byId[pid].centroid);
              return <motion.line key={pid} x1={cx} y1={cy} x2={x2} y2={y2} stroke="#4ade80" strokeWidth={unit * 1.8} strokeDasharray={`${unit * 5} ${unit * 3}`}
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: dur * 0.9, delay: reduce ? 0 : 0.3 }} />;
            })())}
            <motion.circle cx={cx} cy={cy} r={unit * 7} fill="#4ade80" stroke="#f0fdf4" strokeWidth={unit * 1.2}
              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: dur * 0.5 }} style={{ transformOrigin: `${cx}px ${cy}px` }} />
            <text x={cx + unit * 10} y={cy + unit * 18} fill="#dcfce7" fontSize={unit * 14} fontWeight={600}>{candidate.candidate_id}</text>
          </g>
        );
      })()}
    </svg>
  );
}
