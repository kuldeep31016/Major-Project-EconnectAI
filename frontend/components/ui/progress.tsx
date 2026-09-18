"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ProgressProps {
  /** 0–100 */
  value: number;
  className?: string;
  /** Solid colour, or omit for the brand gradient. */
  color?: string;
  /** Animated diagonal stripes — signals work in progress. */
  striped?: boolean;
  height?: number;
}

export function Progress({ value, className, color, striped, height = 6 }: ProgressProps) {
  const pct = Math.min(100, Math.max(0, value));

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("w-full overflow-hidden rounded-full bg-foreground/[0.08]", className)}
      style={{ height }}
    >
      <motion.div
        className="h-full rounded-full"
        style={{
          background: color ?? "linear-gradient(90deg, #00c896, #38bdf8)",
          backgroundImage: striped
            ? "repeating-linear-gradient(45deg, rgba(255,255,255,0.16) 0 8px, transparent 8px 16px), linear-gradient(90deg, #00c896, #38bdf8)"
            : undefined,
          backgroundSize: striped ? "32px 32px, 100% 100%" : undefined,
        }}
        initial={{ width: 0 }}
        animate={{
          width: `${pct}%`,
          backgroundPosition: striped ? ["0 0", "32px 0"] : undefined,
        }}
        transition={{
          width: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
          backgroundPosition: striped
            ? { duration: 0.8, repeat: Infinity, ease: "linear" }
            : undefined,
        }}
      />
    </div>
  );
}
