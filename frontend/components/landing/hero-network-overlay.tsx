"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Animated layer drawn exactly over the hero artwork (public/images/hero-habitat-network.webp, 1555×1011).
 * Coordinates are in image pixels (node dots and the red hub were measured from the artwork itself), and the
 * SVG is laid out with the same "cover" maths as the CSS background (position 72% center), so it stays aligned at
 * every viewport size. Purely decorative: aria-hidden, pointer-events none, nothing rendered with reduced motion.
 */
const IMG_W = 1555;
const IMG_H = 1011;
const POS_X = 0.72; // must match backgroundPosition in hero-section.tsx
const POS_Y = 0.5;

const HUB = [1135, 466] as const;
type P = readonly [number, number];
// patch nodes (white dots in the artwork)
const N = {
  A: [976, 293], B: [1000, 425], C: [1149, 373], D1: [1224, 409], D2: [1232, 434], E: [1341, 467],
  F1: [953, 560], F2: [990, 543], G: [1158, 597], H: [1262, 590], I1: [1344, 584], I2: [1391, 576], J: [1278, 696],
} satisfies Record<string, P>;

// links from the critical hub (red), the restoration corridor (yellow) and the patch-to-patch network (cyan)
const RED: P[] = [N.A, N.C, N.D2, N.F2, N.G];
const CYAN: [P, P][] = [
  [N.A, N.C], [N.A, N.B], [N.B, N.C], [N.B, N.F2], [N.C, N.D1], [N.D1, N.E], [N.E, N.I2], [N.H, N.I1], [N.G, N.H], [N.H, N.J],
];
// patch glow centres (approximate centroid, radius) — I is the yellow restoration candidate
const PATCHES: { c: P; r: number; tone: "green" | "yellow" }[] = [
  { c: [935, 255], r: 85, tone: "green" }, { c: [978, 400], r: 60, tone: "green" }, { c: [1152, 358], r: 55, tone: "green" },
  { c: [1228, 424], r: 35, tone: "green" }, { c: [1340, 462], r: 55, tone: "green" }, { c: [950, 555], r: 85, tone: "green" },
  { c: [1152, 595], r: 55, tone: "green" }, { c: [1260, 585], r: 45, tone: "green" }, { c: [1388, 578], r: 70, tone: "yellow" },
  { c: [1283, 688], r: 45, tone: "green" },
];

const CSS = `
.hn-flow { stroke-dasharray: 7 11; animation: hn-dash 1.6s linear infinite; }
.hn-flow-slow { stroke-dasharray: 5 12; animation: hn-dash 2.8s linear infinite; }
@keyframes hn-dash { to { stroke-dashoffset: -36; } }
.hn-glow { animation: hn-breathe 3.6s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
@keyframes hn-breathe { 0%, 100% { opacity: .08; transform: scale(.92); } 50% { opacity: .55; transform: scale(1.06); } }
.hn-core { animation: hn-blink 1.4s ease-in-out infinite; }
@keyframes hn-blink { 0%, 100% { opacity: .25; } 50% { opacity: 1; } }
.hn-ring { animation: hn-ring 2.4s ease-out infinite; transform-box: fill-box; transform-origin: center; }
@keyframes hn-ring { 0% { opacity: .9; transform: scale(.4); } 100% { opacity: 0; transform: scale(2.6); } }
.hn-node { animation: hn-node 2.2s ease-in-out infinite; }
@keyframes hn-node { 0%, 100% { opacity: .35; } 50% { opacity: 1; } }
`;

function useCoverBox(ref: React.RefObject<HTMLDivElement | null>) {
  const [box, setBox] = useState<{ l: number; t: number; w: number; h: number } | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const W = el.clientWidth, H = el.clientHeight;
      const s = Math.max(W / IMG_W, H / IMG_H);
      const w = IMG_W * s, h = IMG_H * s;
      setBox({ l: (W - w) * POS_X, t: (H - h) * POS_Y, w, h });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return box;
}

export function HeroNetworkOverlay() {
  const reduce = useReducedMotion();
  const host = useRef<HTMLDivElement>(null);
  const box = useCoverBox(host);
  const line = ([x1, y1]: P, [x2, y2]: P) => ({ x1, y1, x2, y2 });

  return (
    <div ref={host} className="pointer-events-none absolute inset-0" aria-hidden="true">
      {box && !reduce && (
        <svg
          viewBox={`0 0 ${IMG_W} ${IMG_H}`}
          className="absolute"
          style={{ left: box.l, top: box.t, width: box.w, height: box.h }}
        >
          <style>{CSS}</style>
          <defs>
            <radialGradient id="hn-g-green">
              <stop offset="0" stopColor="#5dffb0" stopOpacity=".9" />
              <stop offset=".55" stopColor="#00e599" stopOpacity=".35" />
              <stop offset="1" stopColor="#00e599" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="hn-g-yellow">
              <stop offset="0" stopColor="#fff27a" stopOpacity=".9" />
              <stop offset=".55" stopColor="#facc15" stopOpacity=".35" />
              <stop offset="1" stopColor="#facc15" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="hn-g-red">
              <stop offset="0" stopColor="#ff6b6b" stopOpacity="1" />
              <stop offset=".5" stopColor="#ef4444" stopOpacity=".45" />
              <stop offset="1" stopColor="#ef4444" stopOpacity="0" />
            </radialGradient>
            <filter id="hn-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" /></filter>
          </defs>

          {/* patches breathe, staggered */}
          <g style={{ mixBlendMode: "screen" }}>
            {PATCHES.map((p, i) => (
              <circle key={i} className="hn-glow" cx={p.c[0]} cy={p.c[1]} r={p.r}
                fill={`url(#hn-g-${p.tone})`} style={{ animationDelay: `${(i * 0.37) % 3.6}s` }} />
            ))}
          </g>

          {/* patch-to-patch links: dotted pulses travelling along each line */}
          <g fill="none" strokeLinecap="round">
            {CYAN.map(([a, b], i) => (
              <g key={i}>
                <line {...line(a, b)} stroke="#7dd3fc" strokeWidth={4} opacity={0.35} filter="url(#hn-soft)" className="hn-flow-slow" />
                <line {...line(a, b)} stroke="#bff0ff" strokeWidth={2} className="hn-flow-slow" style={{ animationDelay: `${-i * 0.3}s` }} />
              </g>
            ))}
            {/* critical links: red flow outward from the hub */}
            {RED.map((b, i) => (
              <g key={i}>
                <line {...line(HUB, b)} stroke="#ff4d4d" strokeWidth={5} opacity={0.4} filter="url(#hn-soft)" className="hn-flow" />
                <line {...line(HUB, b)} stroke="#ffd0d0" strokeWidth={2.4} className="hn-flow" style={{ animationDelay: `${-i * 0.2}s` }} />
              </g>
            ))}
            {/* restoration corridor: yellow */}
            <line {...line(HUB, N.I1)} stroke="#facc15" strokeWidth={5} opacity={0.4} filter="url(#hn-soft)" className="hn-flow" />
            <line {...line(HUB, N.I1)} stroke="#fff3a6" strokeWidth={2.4} className="hn-flow" />
          </g>

          {/* bright packets riding the critical links */}
          {[...RED, N.I1].map((b, i) => (
            <circle key={i} r={4.5} fill={i === RED.length ? "#fde047" : "#ffffff"} filter="url(#hn-soft)">
              <animateMotion dur={`${2.2 + (i % 3) * 0.4}s`} repeatCount="indefinite" begin={`${-i * 0.45}s`}
                path={`M${HUB[0]},${HUB[1]} L${b[0]},${b[1]}`} />
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.8;1" dur={`${2.2 + (i % 3) * 0.4}s`}
                repeatCount="indefinite" begin={`${-i * 0.45}s`} />
            </circle>
          ))}

          {/* node dots twinkle */}
          {Object.values(N).map(([x, y], i) => (
            <circle key={i} className="hn-node" cx={x} cy={y} r={9} fill="#ffffff" opacity={0.5} filter="url(#hn-soft)"
              style={{ animationDelay: `${(i * 0.29) % 2.2}s` }} />
          ))}

          {/* critical hub: expanding rings + blinking glow */}
          <circle className="hn-ring" cx={HUB[0]} cy={HUB[1]} r={26} fill="none" stroke="#ff5a5a" strokeWidth={3} />
          <circle className="hn-ring" cx={HUB[0]} cy={HUB[1]} r={26} fill="none" stroke="#ff5a5a" strokeWidth={3} style={{ animationDelay: "1.2s" }} />
          <circle className="hn-core" cx={HUB[0]} cy={HUB[1]} r={58} fill="url(#hn-g-red)" style={{ mixBlendMode: "screen" }} />
        </svg>
      )}
    </div>
  );
}
