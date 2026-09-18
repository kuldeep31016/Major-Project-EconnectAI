"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Satellite, Settings2, Layers, Grid2x2, Network, Leaf, ArrowRight, type LucideIcon } from "lucide-react";

const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Satellite, title: "Satellite Data", text: "Sentinel-1 & Sentinel-2" },
  { icon: Settings2, title: "Preprocess", text: "Clean, align and prepare" },
  { icon: Layers, title: "AI Segmentation", text: "Detect mangroves using deep learning" },
  { icon: Grid2x2, title: "Patch Extraction", text: "Identify habitat patches" },
  { icon: Network, title: "Connectivity Analysis", text: "Analyse ecosystem connectivity" },
  { icon: Leaf, title: "Prioritisation & Action", text: "Recommend restoration and support decisions" },
];

/** Animated pipeline: steps light up in sequence and a signal dot travels along the arrows. */
export function PipelineFlow() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setActive((a) => (a + 1) % STEPS.length), 1400);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="relative">
      <div className="grid grid-cols-2 gap-y-8 sm:grid-cols-3 lg:grid-cols-6 lg:gap-x-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const on = i === active;
          const done = i < active;
          return (
            <div key={s.title} className="relative flex flex-col items-center text-center">
              <motion.div
                animate={{ scale: on ? 1.08 : 1, boxShadow: on ? "0 0 0 10px rgba(22,163,74,0.12)" : "0 0 0 0px rgba(22,163,74,0)" }}
                transition={{ duration: 0.5 }}
                className={`grid h-20 w-20 place-items-center rounded-full border-2 transition-colors ${on ? "border-[#16a34a] bg-[#16a34a] text-white" : done ? "border-[#16a34a]/60 bg-[#dcfce7] text-[#15803d]" : "border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]"}`}
              >
                <Icon className="h-8 w-8" />
              </motion.div>
              <div className="mt-3 text-[14px] font-semibold text-[#0b1120]">{s.title}</div>
              <div className="mt-1 max-w-[150px] text-[12px] leading-snug text-[#64748b]">{s.text}</div>
              {i < STEPS.length - 1 && (
                <div className="absolute right-[-14px] top-8 hidden lg:block">
                  <ArrowRight className={`h-5 w-5 ${done || on ? "text-[#16a34a]" : "text-[#cbd5e1]"}`} />
                  {on && (
                    <motion.span
                      key={active}
                      initial={{ x: -10, opacity: 0 }}
                      animate={{ x: 14, opacity: [0, 1, 0] }}
                      transition={{ duration: 1.2, ease: "easeInOut" }}
                      className="absolute left-0 top-2 h-1.5 w-1.5 rounded-full bg-[#16a34a]"
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-[#dcfce7]">
        <motion.div className="h-full bg-[#16a34a]" animate={{ width: `${((active + 1) / STEPS.length) * 100}%` }} transition={{ duration: 0.6 }} />
      </div>
    </div>
  );
}
