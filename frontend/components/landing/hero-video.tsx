"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Hero background: real aerial drone footage (Pexels, Sundarbans delta) with a looping overlay
 * sequence — nature → satellite grid → habitat boundaries → connectivity nodes — so the viewer reads
 * "Nature → Satellite → AI → Connectivity" without a paragraph. The overlay is illustrative artwork,
 * not analysis output (the real map sits in the card next to it).
 */
const PHASES = ["nature", "satellite", "habitat", "connectivity"] as const;
type Phase = (typeof PHASES)[number];
const PHASE_MS = 4000;

// illustrative habitat outlines (relative coordinates in a 100 x 56 box)
const PATCHES = [
  "M12,30 C14,22 24,20 28,26 C31,31 26,38 19,38 C13,38 10,35 12,30 Z",
  "M34,18 C40,12 52,14 54,21 C55,27 46,31 39,29 C33,27 31,22 34,18 Z",
  "M58,30 C63,25 74,26 76,33 C77,40 68,44 61,41 C56,39 55,34 58,30 Z",
  "M80,14 C85,10 94,13 93,20 C92,26 84,27 80,23 C77,20 77,17 80,14 Z",
  "M44,40 C48,36 56,38 56,44 C56,49 48,51 44,48 C41,46 41,43 44,40 Z",
];
const NODES: [number, number][] = [[20, 31], [44, 22], [66, 35], [86, 19], [50, 44]];
const LINKS: [number, number][] = [[0, 1], [1, 2], [1, 3], [2, 4], [0, 4]];

export function HeroVideo() {
  const [phase, setPhase] = useState<Phase>("nature");
  useEffect(() => {
    let i = 0;
    const t = window.setInterval(() => {
      i = (i + 1) % PHASES.length;
      setPhase(PHASES[i]);
    }, PHASE_MS);
    return () => window.clearInterval(t);
  }, []);
  const idx = PHASES.indexOf(phase);

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src="/hero.mp4"
        poster="/hero-poster.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      />
      {/* atmosphere: dark-green gradient so text stays legible */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#052e16]/85 via-[#0a3d2a]/60 to-[#0b1120]/35" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#052e16]/70 via-transparent to-transparent" />

      {/* satellite grid */}
      <AnimatePresence>
        {idx >= 1 && (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.35 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(rgba(134,239,172,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(134,239,172,0.35) 1px, transparent 1px)",
              backgroundSize: "72px 72px",
            }}
          />
        )}
      </AnimatePresence>

      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 56" preserveAspectRatio="xMidYMid slice">
        {/* habitat boundaries */}
        <AnimatePresence>
          {idx >= 2 &&
            PATCHES.map((d, i) => (
              <motion.path
                key={`p${i}`}
                d={d}
                fill="rgba(74,222,128,0.18)"
                stroke="#4ade80"
                strokeWidth={0.35}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.4, delay: i * 0.2 }}
              />
            ))}
        </AnimatePresence>
        {/* connectivity links + nodes */}
        <AnimatePresence>
          {idx >= 3 &&
            LINKS.map(([a, b], i) => (
              <motion.line
                key={`l${i}`}
                x1={NODES[a][0]} y1={NODES[a][1]} x2={NODES[b][0]} y2={NODES[b][1]}
                stroke="#7dd3fc" strokeWidth={0.3} strokeDasharray="1 0.8"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.9 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.9, delay: 0.3 + i * 0.15 }}
              />
            ))}
          {idx >= 3 &&
            NODES.map(([x, y], i) => (
              <motion.circle
                key={`n${i}`}
                cx={x} cy={y} r={0.9}
                fill="#38bdf8" stroke="#ffffff" strokeWidth={0.25}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, delay: 0.2 + i * 0.12 }}
              />
            ))}
        </AnimatePresence>
      </svg>

      {/* phase caption */}
      <div className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full bg-black/40 px-3 py-1 text-[10.5px] font-medium uppercase tracking-[0.18em] text-white/85 backdrop-blur">
        {PHASES.map((p, i) => (
          <span key={p} className={i === idx ? "text-[#86efac]" : "text-white/45"}>
            {p === "nature" ? "Nature" : p === "satellite" ? "Satellite" : p === "habitat" ? "AI habitat map" : "Connectivity"}
            {i < PHASES.length - 1 ? " →" : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
