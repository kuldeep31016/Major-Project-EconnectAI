"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { motion } from "framer-motion";
import { AlertTriangle, Star } from "lucide-react";

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
  selected: boolean;
  removed: boolean;
  degraded: boolean;
  dimmed: boolean;
}

/**
 * A habitat patch rendered as a graph node. Size encodes area, ring colour
 * encodes sensitivity, and the pulse marks critical bridges.
 */
function HabitatNodeInner({ data }: NodeProps<HabitatNodeData>) {
  const meta = HABITAT_META[data.habitatClass];
  const sens = SENSITIVITY_META[data.sensitivity];

  // Area → diameter, clamped so the graph stays legible.
  const size = Math.round(46 + Math.min(1, data.areaHa / 900) * 40);
  const critical = data.sensitivity === "critical";

  return (
    <div
      className={cn(
        "group relative transition-opacity duration-300",
        data.dimmed && "opacity-25",
      )}
    >
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <Handle type="source" position={Position.Right} className="!opacity-0" />

      {/* pulse for critical bridges */}
      {critical && !data.removed && (
        <motion.span
          className="absolute left-1/2 top-1/2 rounded-full border-2 border-[#ef4444]"
          style={{ width: size, height: size, x: "-50%", y: "-50%" }}
          animate={{ scale: [1, 1.55], opacity: [0.55, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
        />
      )}

      <motion.div
        whileHover={{ scale: 1.07 }}
        transition={{ type: "spring", stiffness: 380, damping: 22 }}
        className={cn(
          "relative grid place-items-center rounded-full border-2 transition-all duration-300",
          data.removed && "opacity-40 grayscale",
        )}
        style={{
          width: size,
          height: size,
          background: data.removed
            ? "#ef444422"
            : `radial-gradient(circle at 35% 30%, ${meta.color}55, ${meta.color}18)`,
          borderColor: data.removed
            ? "#ef4444"
            : data.selected
              ? "#f8fafc"
              : sens.color,
          borderStyle: data.removed || data.degraded ? "dashed" : "solid",
          boxShadow: data.selected
            ? `0 0 0 4px ${sens.color}33, 0 8px 30px -8px ${sens.color}`
            : `0 4px 20px -6px ${meta.color}88`,
        }}
      >
        <div
          className="text-[13px] font-bold tabular"
          style={{ color: data.removed ? "#ef4444" : "#f8fafc" }}
        >
          {Math.round(data.importance * 100)}
        </div>

        {data.isHub && !data.removed && (
          <span className="absolute -right-1 -top-1 grid h-4.5 w-4.5 place-items-center rounded-full bg-[#f59e0b] p-0.5">
            <Star className="h-2.5 w-2.5 text-[#050816]" fill="#050816" />
          </span>
        )}
        {critical && !data.removed && (
          <span className="absolute -bottom-1 -right-1 grid h-4.5 w-4.5 place-items-center rounded-full bg-[#ef4444] p-0.5">
            <AlertTriangle className="h-2.5 w-2.5 text-[#050816]" />
          </span>
        )}
      </motion.div>

      {/* label */}
      <div
        className="pointer-events-none absolute left-1/2 top-full mt-1.5 w-[124px] -translate-x-1/2 text-center"
        style={{ opacity: data.dimmed ? 0.4 : 1 }}
      >
        <div className="truncate text-[10px] font-medium leading-tight text-foreground">
          {data.label}
        </div>
        <div className="truncate text-[9px] text-muted-foreground">
          {data.areaHa.toLocaleString("en-IN")} ha · {data.degree} links
        </div>
      </div>
    </div>
  );
}

export const HabitatNode = memo(HabitatNodeInner);
