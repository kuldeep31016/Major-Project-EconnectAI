"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface TabItem {
  value: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: string | number;
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  /** Unique id so multiple tab bars don't share one animated indicator. */
  layoutId?: string;
  size?: "sm" | "default";
}

/**
 * Segmented control with a shared-layout indicator that slides between tabs.
 */
export function Tabs({
  items,
  value,
  onValueChange,
  className,
  layoutId = "tab-indicator",
  size = "default",
}: TabsProps) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-center gap-1 rounded-xl border border-foreground/[0.08] bg-foreground/[0.04] p-1",
        className,
      )}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(item.value)}
            className={cn(
              "relative flex items-center gap-1.5 rounded-lg font-medium transition-colors outline-none",
              size === "sm" ? "px-2.5 py-1.5 text-[11px]" : "px-3.5 py-2 text-[13px]",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-lg bg-foreground/[0.08] ring-1 ring-foreground/10"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            {item.icon && <item.icon className="relative h-3.5 w-3.5" />}
            <span className="relative">{item.label}</span>
            {item.badge !== undefined && (
              <span className="relative rounded-full bg-[#15803d]/15 px-1.5 text-[9px] font-bold text-[#15803d]">
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
