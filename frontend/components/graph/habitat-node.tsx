"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { motion, useReducedMotion } from "framer-motion";
import { Plus, Star } from "lucide-react";

import { HABITAT_META, SENSITIVITY_META } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { HabitatClass, SensitivityBand } from "@/types";

export interface HabitatNodeData {
  label: string;
  habitatClass: HabitatClass;
  areaHa: number;
  quality: number;
  connectivity: number;
  sensitivity: SensitivityBand;
  importance: number;
  degree: number;
  isHub: boolean;
  isCutVertex?: boolean;
  /** diameter in px (area-scaled by the graph) */
  sizePx?: number;
  selected: boolean;
  removed: boolean;
  /** mid "remove" animation (what-if): pulse red, then shrink and fade */
  removing?: boolean;
  degraded: boolean;
  dimmed: boolean;
  /** a restoration site added by a what-if (not part of the mapped network) */
  candidate?: boolean;
}

const EASE = [0.22, 1, 0.36, 1] as const;
const REMOVED = { scale: 0.7, opacity: 0.9 };

/**
 * A habitat patch as a graph node: size = area, fill = habitat type, ring = criticality band, number = importance
 * (0–100). Cut vertices get a dashed red halo; hubs a star. Removal / restoration what-ifs animate in place.
 */
function HabitatNodeInner({ data }: NodeProps<HabitatNodeData>) {
  const reduce = useReducedMotion();
  const meta = HABITAT_META[data.habitatClass] ?? HABITAT_META.mangrove;
  const sens = SENSITIVITY_META[data.sensitivity] ?? SENSITIVITY_META.low;
  const size = data.sizePx ?? Math.round(46 + Math.min(1, data.areaHa / 900) * 40);
  const gone = data.removed || data.removing;

  const body = data.removing
    ? { scale: [1, 1.16, 1, REMOVED.scale], opacity: [1, 1, 1, REMOVED.opacity] }
    : data.removed
      ? REMOVED
      : { scale: 1, opacity: 1 };
  const bodyT = data.removing
    ? { duration: reduce ? 0 : 2.1, times: [0, 0.2, 0.5, 1], ease: EASE }
    : { type: "spring" as const, stiffness: 260, damping: 20 };

  const ring = gone ? "#dc2626" : data.candidate ? "#16a34a" : sens.color;

  return (
    <div className={cn("group relative transition-opacity duration-300", data.dimmed && !gone && "opacity-30")}>
      <Handle type="target" position={Position.Left} className="!opacity-0" style={{ left: size / 2, top: size / 2, transform: "translate(-50%, -50%)" }} />
      <Handle type="source" position={Position.Right} className="!opacity-0" style={{ left: size / 2, top: size / 2, transform: "translate(-50%, -50%)" }} />

      {/* removal shock-waves */}
      {data.removing && !reduce && [0, 0.45].map((d) => (
        <motion.span
          key={d}
          className="pointer-events-none absolute rounded-full border-[3px] border-[#dc2626]"
          style={{ width: size, height: size, left: 0, top: 0 }}
          initial={{ scale: 1, opacity: 0.9 }}
          animate={{ scale: 2.5, opacity: 0 }}
          transition={{ duration: 1.4, delay: d, ease: "easeOut" }}
        />
      ))}

      {/* steady pulse for cut vertices (removing one splits the network) */}
      {data.isCutVertex && !gone && !reduce && (
        <motion.span
          className="pointer-events-none absolute rounded-full border-2 border-[#dc2626]"
          style={{ width: size, height: size, left: 0, top: 0 }}
          animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
        />
      )}

      <motion.div
        initial={data.candidate && !reduce ? { scale: 0, opacity: 0 } : false}
        animate={body}
        transition={data.candidate ? { type: "spring", stiffness: 220, damping: 14, delay: 0.1 } : bodyT}
        whileHover={gone ? undefined : { scale: 1.08 }}
        className="relative grid place-items-center rounded-full"
        style={{
          width: size,
          height: size,
          background: gone
            ? "radial-gradient(circle at 35% 30%, #fff1f2, #fecaca)"
            : data.candidate
              ? "radial-gradient(circle at 35% 30%, #dcfce7, #86efac)"
              : `radial-gradient(circle at 32% 28%, color-mix(in srgb, ${meta.color} 62%, white), ${meta.color})`,
          border: `3px ${gone || data.degraded || data.candidate ? "dashed" : "solid"} ${ring}`,
          boxShadow: data.selected
            ? `0 0 0 4px #ffffff, 0 0 0 7px ${sens.color}, 0 12px 28px -8px ${sens.color}`
            : gone
              ? "none"
              : `0 0 0 2px #ffffffcc, 0 8px 18px -8px ${data.candidate ? "#16a34a" : meta.color}`,
        }}
      >
        {/* red flash while being removed */}
        {data.removing && (
          <motion.span
            className="absolute inset-0 rounded-full bg-[#dc2626]"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.9, 0.7, 0] }}
            transition={{ duration: reduce ? 0 : 2.1, times: [0, 0.2, 0.5, 1] }}
          />
        )}
        <span
          className="relative text-[13px] font-extrabold tabular leading-none"
          style={{ color: gone ? "#b91c1c" : data.candidate ? "#14532d" : "#ffffff", textShadow: gone || data.candidate ? "none" : "0 1px 2px rgba(0,0,0,0.25)" }}
        >
          {data.candidate ? <Plus className="h-4 w-4" strokeWidth={3} /> : gone ? "✕" : Math.round(data.importance * 100)}
        </span>

        {data.isHub && !gone && (
          <span className="absolute -right-1 -top-1 grid h-[18px] w-[18px] place-items-center rounded-full border-2 border-white bg-[#f59e0b] shadow">
            <Star className="h-2.5 w-2.5 text-white" fill="#ffffff" />
          </span>
        )}
      </motion.div>

      {/* label */}
      <div
        className="pointer-events-none absolute left-1/2 top-full mt-1.5 flex w-[120px] -translate-x-1/2 flex-col items-center text-center"
        style={{ opacity: data.dimmed && !gone ? 0.45 : 1 }}
      >
        <span
          className={cn(
            "rounded-full px-1.5 py-px text-[10.5px] font-bold leading-tight shadow-sm",
            gone ? "bg-[#fee2e2] text-[#b91c1c] line-through" : data.candidate ? "bg-[#16a34a] text-white" : "bg-white/90 text-[#0f172a]",
          )}
        >
          {data.label}
        </span>
        <span className="mt-0.5 truncate text-[9.5px] font-medium text-[#475569]">
          {data.candidate ? `new site · ${data.areaHa.toFixed(1)} ha` : gone ? "removed (what-if)" : `${data.areaHa.toLocaleString("en-IN")} ha · ${data.degree} links`}
        </span>
      </div>
    </div>
  );
}

export const HabitatNode = memo(HabitatNodeInner);
