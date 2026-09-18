"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SliderProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onValueChange?: (value: number) => void;
  /** Accent colour for the filled track and thumb. */
  accent?: string;
}

/**
 * Range input styled to match the product. Native input keeps keyboard and
 * touch behaviour correct for free; the fill is painted with a gradient so it
 * tracks the value without an extra element.
 */
export function Slider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onValueChange,
  className,
  accent = "#15803d",
  ...props
}: SliderProps) {
  const pct = ((value - min) / (max - min || 1)) * 100;

  return (
    <input
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onValueChange?.(Number(e.target.value))}
      className={cn("ec-slider w-full cursor-pointer", className)}
      style={
        {
          "--pct": `${pct}%`,
          "--accent": accent,
        } as React.CSSProperties
      }
      {...props}
    />
  );
}
