"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

/**
 * Pure-SVG animated globe: rotating graticule, habitat patches, orbiting
 * satellite and a scanning sweep. No textures or WebGL — it stays crisp at any
 * size and costs nothing to load.
 */
export function EarthVisual({ className }: { className?: string }) {
  // Habitat "hot spots" laid out on the visible hemisphere.
  const nodes = useMemo(
    () => [
      { x: 168, y: 128, r: 5.5, delay: 0 },
      { x: 205, y: 168, r: 4, delay: 0.4 },
      { x: 142, y: 186, r: 6.5, delay: 0.8 },
      { x: 232, y: 118, r: 3.5, delay: 1.2 },
      { x: 118, y: 148, r: 4.5, delay: 1.6 },
      { x: 190, y: 218, r: 5, delay: 2.0 },
      { x: 248, y: 190, r: 3.8, delay: 2.4 },
    ],
    [],
  );

  const links: [number, number][] = [
    [0, 1],
    [0, 4],
    [1, 2],
    [1, 5],
    [0, 3],
    [5, 6],
    [1, 6],
  ];

  return (
    <div className={className}>
      <svg viewBox="0 0 380 380" className="h-full w-full" role="img" aria-label="Animated globe showing coastal habitat connectivity network">
        <defs>
          <radialGradient id="ocean" cx="38%" cy="32%">
            <stop offset="0%" stopColor="#0e7490" stopOpacity="0.95" />
            <stop offset="55%" stopColor="#0c4a6e" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#04101f" stopOpacity="1" />
          </radialGradient>
          <radialGradient id="rim" cx="50%" cy="50%">
            <stop offset="78%" stopColor="#00c896" stopOpacity="0" />
            <stop offset="96%" stopColor="#00c896" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.1" />
          </radialGradient>
          <radialGradient id="haze" cx="50%" cy="50%">
            <stop offset="60%" stopColor="#00c896" stopOpacity="0" />
            <stop offset="100%" stopColor="#00c896" stopOpacity="0.22" />
          </radialGradient>
          <linearGradient id="sweep" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00c896" stopOpacity="0" />
            <stop offset="50%" stopColor="#00c896" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#00c896" stopOpacity="0" />
          </linearGradient>
          <clipPath id="globeClip">
            <circle cx="190" cy="190" r="130" />
          </clipPath>
        </defs>

        {/* atmospheric haze */}
        <circle cx="190" cy="190" r="168" fill="url(#haze)" />

        {/* orbit rings */}
        {[152, 168].map((r, i) => (
          <motion.ellipse
            key={r}
            cx="190"
            cy="190"
            rx={r}
            ry={r * 0.34}
            fill="none"
            stroke={i === 0 ? "#00c896" : "#38bdf8"}
            strokeOpacity={0.22}
            strokeWidth="1"
            style={{ transformOrigin: "190px 190px" }}
            animate={{ rotate: i === 0 ? [0, 360] : [360, 0] }}
            transition={{ duration: i === 0 ? 36 : 48, repeat: Infinity, ease: "linear" }}
          />
        ))}

        {/* globe body */}
        <circle cx="190" cy="190" r="130" fill="url(#ocean)" />

        <g clipPath="url(#globeClip)">
          {/* graticule — drifts to imply rotation */}
          <motion.g
            animate={{ x: [-60, 0] }}
            transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
          >
            {Array.from({ length: 11 }).map((_, i) => (
              <ellipse
                key={`m${i}`}
                cx={70 + i * 30}
                cy="190"
                rx="18"
                ry="130"
                fill="none"
                stroke="#7dd3fc"
                strokeOpacity="0.13"
                strokeWidth="0.9"
              />
            ))}
          </motion.g>
          {Array.from({ length: 7 }).map((_, i) => {
            const y = 82 + i * 36;
            const dy = Math.abs(y - 190);
            const rx = Math.sqrt(Math.max(0, 130 * 130 - dy * dy));
            return (
              <line
                key={`p${i}`}
                x1={190 - rx}
                y1={y}
                x2={190 + rx}
                y2={y}
                stroke="#7dd3fc"
                strokeOpacity="0.13"
                strokeWidth="0.9"
              />
            );
          })}

          {/* stylised coastal landmass */}
          <motion.path
            d="M118 132 q28 -16 54 -6 t46 4 q22 6 34 26 t-6 40 q-14 22 -42 24 t-56 -10 q-24 -12 -30 -34 t0 -44 z"
            fill="#00c896"
            fillOpacity="0.16"
            stroke="#00c896"
            strokeOpacity="0.4"
            strokeWidth="1.1"
            animate={{ fillOpacity: [0.12, 0.22, 0.12] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          />
          <path
            d="M132 216 q30 18 62 14 t58 -18"
            fill="none"
            stroke="#38bdf8"
            strokeOpacity="0.32"
            strokeWidth="1.4"
          />

          {/* connectivity links */}
          {links.map(([a, b], i) => (
            <motion.line
              key={i}
              x1={nodes[a].x}
              y1={nodes[a].y}
              x2={nodes[b].x}
              y2={nodes[b].y}
              stroke="#00c896"
              strokeWidth="1.1"
              strokeDasharray="3 5"
              initial={{ opacity: 0.25 }}
              animate={{ opacity: [0.2, 0.75, 0.2], strokeDashoffset: [0, -24] }}
              transition={{
                opacity: { duration: 3.4, repeat: Infinity, delay: i * 0.3 },
                strokeDashoffset: { duration: 1.6, repeat: Infinity, ease: "linear" },
              }}
            />
          ))}

          {/* habitat nodes */}
          {nodes.map((n, i) => (
            <g key={i}>
              <motion.circle
                cx={n.x}
                cy={n.y}
                r={n.r + 6}
                fill="#00c896"
                fillOpacity="0.18"
                animate={{ scale: [0.7, 1.5], opacity: [0.5, 0] }}
                transition={{ duration: 2.6, repeat: Infinity, delay: n.delay }}
                style={{ transformOrigin: `${n.x}px ${n.y}px` }}
              />
              <circle cx={n.x} cy={n.y} r={n.r} fill="#00c896" />
              <circle cx={n.x} cy={n.y} r={n.r * 0.4} fill="#ecfdf5" fillOpacity="0.9" />
            </g>
          ))}

          {/* scanning sweep */}
          <motion.rect
            x="60"
            width="260"
            height="70"
            fill="url(#sweep)"
            animate={{ y: [60, 320] }}
            transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
          />
        </g>

        {/* rim light */}
        <circle cx="190" cy="190" r="130" fill="url(#rim)" />
        <circle
          cx="190"
          cy="190"
          r="130"
          fill="none"
          stroke="#00c896"
          strokeOpacity="0.35"
          strokeWidth="1.2"
        />

        {/* orbiting satellite */}
        <motion.g
          style={{ transformOrigin: "190px 190px" }}
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
        >
          <g transform="translate(190, 32)">
            <rect x="-4" y="-4" width="8" height="8" rx="1.5" fill="#f8fafc" />
            <rect x="-15" y="-2.5" width="9" height="5" rx="1" fill="#38bdf8" />
            <rect x="6" y="-2.5" width="9" height="5" rx="1" fill="#38bdf8" />
            <motion.circle
              r="9"
              fill="#38bdf8"
              fillOpacity="0.25"
              animate={{ scale: [0.6, 1.7], opacity: [0.6, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </g>
        </motion.g>
      </svg>
    </div>
  );
}
