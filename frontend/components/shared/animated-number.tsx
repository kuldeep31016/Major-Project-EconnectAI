"use client";

import { useCountUp } from "@/hooks/use-count-up";
import { cn } from "@/lib/utils";

interface Props {
  value: number;
  decimals?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  /** Serializable alternative to `format` — safe to set from a server component. */
  thousands?: boolean;
  /** Custom formatter. Client components only (functions can't cross the RSC boundary). */
  format?: (n: number) => string;
}

export function AnimatedNumber({
  value,
  decimals = 0,
  duration = 1400,
  prefix,
  suffix,
  className,
  thousands,
  format,
}: Props) {
  const { ref, value: current } = useCountUp(value, duration, decimals);
  const display = format
    ? format(current)
    : thousands
      ? current.toLocaleString("en-IN", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      : current.toFixed(decimals);

  return (
    <span ref={ref} className={cn("tabular", className)}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}
