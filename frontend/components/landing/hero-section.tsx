"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Layers,
  Leaf,
  MapPin,
  Minus,
  Network,
  Play,
  Plus,
} from "lucide-react";
import { motion } from "framer-motion";

export function HeroSection() {
  const [timeSec, setTimeSec] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Snappy intelligence sequence: all layers appear in ~1.0s, loop smoothly
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeSec((prev) => (prev >= 6 ? 0 : Number((prev + 0.1).toFixed(2))));
    }, 100);
    return () => clearInterval(timer);
  }, []);

  const showHabitat = timeSec >= 0.2;
  const showNodes = timeSec >= 0.4;
  const showPerimeterLines = timeSec >= 0.6;
  const showCriticalRed = timeSec >= 0.8;
  const showRestoration = timeSec >= 1.0;

  return (
    <section className="relative pt-20 pb-0 lg:pt-24 bg-[#020b14] text-[#F5F7F8] overflow-hidden min-h-[92vh] flex flex-col justify-between">
      {/* -------------------------------------------------------------
          FULL-BLEED BACKGROUND SATELLITE IMAGE ACROSS ENTIRE PAGE
          ------------------------------------------------------------- */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Real coastal landscape on the right side */}
        <div
          className="absolute top-0 right-0 bottom-0 w-full lg:w-[68%] bg-cover transition-transform duration-700 ease-out"
          style={{
            backgroundImage: "url(/hero-vembanad.jpg)",
            backgroundPosition: "center center",
            transform: `scale(${1 + (timeSec / 6) * 0.015 * zoomLevel})`,
            filter: "saturate(1.4) contrast(1.15) brightness(0.92)",
          }}
        />

        {/* Smooth gradient blend: pure solid deep navy on the left, fading cleanly over the land on the right */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, #020b14 0%, #020b14 34%, rgba(2, 11, 20, 0.90) 48%, rgba(2, 11, 20, 0.35) 70%, rgba(2, 11, 20, 0.05) 100%)",
          }}
        />

        {/* Top and bottom subtle edge fades */}
        <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-[#020b14] to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-[#020b14] to-transparent" />
      </div>

      {/* -------------------------------------------------------------
          MAIN HERO CONTENT (FULL WIDTH CONTAINER WITH GENEROUS PADDING)
          ------------------------------------------------------------- */}
      <div className="relative z-10 w-full max-w-[1700px] mx-auto px-6 sm:px-10 lg:px-16 flex-1 flex items-center">
        <div className="w-full grid lg:grid-cols-12 gap-8 items-center py-8 sm:py-12 min-h-[580px] lg:min-h-[640px]">
            {/* ================= LEFT COLUMN: TYPOGRAPHY (OVER PURE SEA) ================= */}
            <div className="lg:col-span-5 xl:col-span-5 space-y-5 max-w-xl">
              {/* Eyebrow */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="text-[11px] sm:text-xs font-bold tracking-[0.2em] uppercase text-[#00e599]"
              >
                HEALTHY COASTS &nbsp;•&nbsp; STRONGER COMMUNITIES
              </motion.div>

              {/* Headline with Increased Font Size (50-54px) & Exact Line Breaks */}
              <motion.h1
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-3xl sm:text-4xl lg:text-[48px] xl:text-[52px] font-black tracking-tight leading-[1.06] text-white"
              >
                Beyond Habitat Maps. <br />
                Understand What <br />
                Holds the{" "}
                <span className="text-[#00e599]">
                  Landscape <br className="hidden sm:inline" />
                  Together.
                </span>
              </motion.h1>

              {/* Supporting Copy */}
              <motion.p
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-md font-normal"
              >
                Satellite intelligence. Ecological connectivity. <br />
                Real-world conservation impact.
              </motion.p>

              {/* Action Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.25 }}
                className="pt-2 space-y-3"
              >
                <div className="flex flex-wrap items-center gap-3.5">
                  {/* Primary CTA */}
                  <Link
                    href="/command"
                    className="group inline-flex items-center gap-2 rounded-full bg-[#00e599] px-6 py-3.5 text-sm font-extrabold text-[#02151d] shadow-xl shadow-[#00e599]/30 transition-all duration-300 hover:bg-[#00c896] hover:shadow-[#00c896]/45 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <span>Explore Command Center</span>
                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                  </Link>

                  {/* Secondary 'See How It Works' */}
                  <a
                    href="#how-it-works"
                    className="inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-white/[0.06] px-5 py-3.5 text-sm font-semibold text-white backdrop-blur-md transition-all duration-200 hover:bg-white/15 hover:border-white/35"
                  >
                    <div className="grid h-5 w-5 place-items-center rounded-full bg-white/20 text-white">
                      <Play className="h-2 w-2 fill-current ml-0.5" />
                    </div>
                    <span>See How It Works</span>
                  </a>
                </div>

                {/* Sub-link */}
                <div className="pt-0.5">
                  <Link
                    href="/analysis?scene=kerala-coast"
                    className="group inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-[#00e599] font-medium transition-colors"
                  >
                    <span>Live Kerala Coast Demo</span>
                    <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-1" />
                  </Link>
                </div>
              </motion.div>
            </div>

            {/* ================= RIGHT COLUMN: SATELLITE GIS INTELLIGENCE ================= */}
            <div className="lg:col-span-7 xl:col-span-7 relative h-[380px] sm:h-[460px] lg:h-[520px] w-full">
              {/* Floating Top-Right Live Status Pill */}
              <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-20 flex items-center justify-between gap-3.5 rounded-xl bg-black/80 px-3.5 py-2 backdrop-blur-md border border-white/15 shadow-xl">
                <div>
                  <div className="text-[11.5px] font-bold text-white leading-tight">
                    Vembanad-Kol Wetland
                  </div>
                  <div className="text-[9.5px] text-slate-400 mt-0.5">Kerala, India</div>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-[#00e599]/15 px-2 py-0.5 border border-[#00e599]/30 text-[9.5px] font-bold text-[#00e599]">
                  <span>Schematic</span>
                </div>
              </div>

              {/* Minimal Zoom Controls (Top Left of Map) */}
              <div className="absolute top-3 left-2 sm:left-4 z-20 flex flex-col gap-0.5 rounded-lg bg-black/80 p-1 backdrop-blur-md border border-white/15 shadow-lg">
                <button
                  onClick={() => setZoomLevel((z) => Math.min(z + 0.1, 1.25))}
                  className="grid h-6 w-6 place-items-center rounded hover:bg-white/15 text-white transition-colors"
                  aria-label="Zoom in"
                >
                  <Plus className="h-3 w-3" />
                </button>
                <div className="h-px w-3.5 bg-white/15 mx-auto" />
                <button
                  onClick={() => setZoomLevel((z) => Math.max(z - 0.1, 0.95))}
                  className="grid h-6 w-6 place-items-center rounded hover:bg-white/15 text-white transition-colors"
                  aria-label="Zoom out"
                >
                  <Minus className="h-3 w-3" />
                </button>
              </div>

              {/* =========================================================================
                  SVG ANALYTICAL GIS OVERLAY:
                  - Joined / random angular green polygons
                  - Central red node with NO polygon
                  - All lines from center red node are RED LINES
                  - Outer perimeter lines are CYAN LINES
                  - One yellow dashed restoration candidate
                  ========================================================================= */}
              <svg
                className="absolute inset-0 h-full w-full z-10 pointer-events-none"
                viewBox="0 0 1000 550"
                preserveAspectRatio="xMidYMid slice"
              >
                <defs>
                  <radialGradient id="hubRedGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity="0.85" />
                    <stop offset="45%" stopColor="#ef4444" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                  </radialGradient>
                </defs>

                {/* -------------------------------------------------------------
                    JOINED RANDOM ANGULAR GREEN HABITAT SHAPES (AS IN GPT REFERENCE)
                    ------------------------------------------------------------- */}
                <g
                  className="transition-opacity duration-300 ease-out"
                  style={{ opacity: showHabitat ? 1 : 0 }}
                  fill="#00c896"
                  fillOpacity="0.36"
                  stroke="#00e599"
                  strokeWidth="1.5"
                >
                  {/* Patch 1: Top-Left Stand */}
                  <polygon points="545,145 615,128 635,182 565,202 525,170" />

                  {/* Patch 2: Top-Center Stand (Joined to Patch 1) */}
                  <polygon points="615,128 678,112 702,165 635,182" />

                  {/* Patch 3: Top-Right Stand (Joined to Patch 2) */}
                  <polygon points="678,112 752,128 768,182 702,165" />

                  {/* Patch 4: Mid-Right Stand */}
                  <polygon points="742,192 815,208 830,268 758,252" />

                  {/* Patch 6: Bottom-Right Stand */}
                  <polygon points="685,325 765,308 780,375 700,392" />

                  {/* Patch 7: Bottom-Left Stand (Joined to Patch 6) */}
                  <polygon points="612,308 685,325 700,392 628,375" />

                  {/* Patch 8: Mid-Left Stand */}
                  <polygon points="522,242 595,228 610,295 538,308" />
                </g>

                {/* -------------------------------------------------------------
                    RESTORATION CANDIDATE PATCH (YELLOW ANGLED SHAPE WITH DASHES)
                    ------------------------------------------------------------- */}
                <g
                  className="transition-opacity duration-300 ease-out"
                  style={{ opacity: showRestoration ? 1 : 0 }}
                >
                  <polygon
                    points="778,272 848,288 858,348 788,332"
                    fill="#eab308"
                    fillOpacity="0.32"
                    stroke="#facc15"
                    strokeWidth="1.8"
                    strokeDasharray="4 3"
                  />
                </g>

                {/* -------------------------------------------------------------
                    OUTER PERIMETER CYAN CONNECTIVITY LINES
                    ------------------------------------------------------------- */}
                <g
                  className="transition-opacity duration-300 ease-out"
                  style={{ opacity: showPerimeterLines ? 1 : 0 }}
                  stroke="#38bdf8"
                  strokeWidth="1.6"
                  opacity="0.85"
                >
                  {/* Patch 1 -> Patch 2 */}
                  <line x1="575" y1="168" x2="658" y2="148" />
                  {/* Patch 2 -> Patch 3 */}
                  <line x1="658" y1="148" x2="725" y2="148" />
                  {/* Patch 3 -> Patch 4 */}
                  <line x1="725" y1="148" x2="788" y2="230" />
                  {/* Patch 4 -> Patch 5 (Restoration) */}
                  <line x1="788" y1="230" x2="820" y2="310" strokeDasharray={showRestoration ? "4 3" : undefined} />
                  {/* Patch 5 -> Patch 6 */}
                  <line x1="820" y1="310" x2="732" y2="350" strokeDasharray={showRestoration ? "4 3" : undefined} />
                  {/* Patch 6 -> Patch 7 */}
                  <line x1="732" y1="350" x2="656" y2="350" />
                  {/* Patch 7 -> Patch 8 */}
                  <line x1="656" y1="350" x2="568" y2="268" />
                  {/* Patch 8 -> Patch 1 */}
                  <line x1="568" y1="268" x2="575" y2="168" />
                </g>

                {/* -------------------------------------------------------------
                    ALL LINES FROM THE CENTRAL RED HUB ARE RED LINES!
                    (Radiating outward from Hub (680, 240) to each surrounding patch)
                    ------------------------------------------------------------- */}
                <g
                  className="transition-opacity duration-300 ease-out"
                  style={{ opacity: showCriticalRed ? 1 : 0 }}
                  stroke="#ef4444"
                  strokeWidth="2"
                  opacity="0.9"
                >
                  {/* Hub -> Patch 1 */}
                  <line x1="680" y1="240" x2="575" y2="168" />
                  {/* Hub -> Patch 2 */}
                  <line x1="680" y1="240" x2="658" y2="148" />
                  {/* Hub -> Patch 3 */}
                  <line x1="680" y1="240" x2="725" y2="148" />
                  {/* Hub -> Patch 4 */}
                  <line x1="680" y1="240" x2="788" y2="230" />
                  {/* Hub -> Patch 5 (Restoration Corridor) */}
                  <line
                    x1="680"
                    y1="240"
                    x2="820"
                    y2="310"
                    stroke={showRestoration ? "#facc15" : "#ef4444"}
                    strokeDasharray={showRestoration ? "4 3" : undefined}
                  />
                  {/* Hub -> Patch 6 */}
                  <line x1="680" y1="240" x2="732" y2="350" />
                  {/* Hub -> Patch 7 */}
                  <line x1="680" y1="240" x2="656" y2="350" />
                  {/* Hub -> Patch 8 */}
                  <line x1="680" y1="240" x2="568" y2="268" />
                </g>

                {/* -------------------------------------------------------------
                    PERIMETER CENTROID WHITE NODES
                    ------------------------------------------------------------- */}
                <g
                  className="transition-opacity duration-300 ease-out"
                  style={{ opacity: showNodes ? 1 : 0 }}
                  fill="#ffffff"
                  stroke="#020d18"
                  strokeWidth="1.8"
                >
                  <circle cx="575" cy="168" r="3.5" />
                  <circle cx="658" cy="148" r="3.5" />
                  <circle cx="725" cy="148" r="3.5" />
                  <circle cx="788" cy="230" r="3.5" />
                  <circle cx="820" cy="310" r="3.5" />
                  <circle cx="732" cy="350" r="3.5" />
                  <circle cx="656" cy="350" r="3.5" />
                  <circle cx="568" cy="268" r="3.5" />
                </g>

                {/* -------------------------------------------------------------
                    CENTRAL RED CRITICAL HUB (NO SHAPE OF ITS OWN, JUST GLOWING NODE)
                    ------------------------------------------------------------- */}
                <g
                  className="transition-opacity duration-300 ease-out"
                  style={{ opacity: showCriticalRed ? 1 : 0 }}
                >
                  {/* Outer Radial Glow */}
                  <circle cx="680" cy="240" r="28" fill="url(#hubRedGlow)" />
                  {/* Subtle Alert Ping Ring */}
                  <circle
                    cx="680"
                    cy="240"
                    r="15"
                    fill="#ef4444"
                    fillOpacity="0.3"
                    className="animate-ping"
                    style={{ transformOrigin: "680px 240px" }}
                  />
                  {/* Center Red Node with White Ring */}
                  <circle
                    cx="680"
                    cy="240"
                    r="8.5"
                    fill="#ef4444"
                    stroke="#ffffff"
                    strokeWidth="2.2"
                  />
                  <circle cx="680" cy="240" r="3" fill="#ffffff" />
                </g>
              </svg>

              {/* Bottom Compass & Scale Bar */}
              <div className="absolute bottom-3 left-4 z-20 flex items-center gap-3 text-[10px] text-slate-300 select-none">
                <div className="flex flex-col items-center">
                  <span className="font-bold text-white text-[10px] leading-none">N</span>
                  <span className="text-[11px] leading-none text-[#00e599]">↑</span>
                </div>
                <div className="flex flex-col">
                  <div className="flex justify-between w-20 text-[8px] text-slate-300 font-mono">
                    <span>0</span>
                    <span>2.5</span>
                    <span>5</span>
                    <span>10 km</span>
                  </div>
                  <div className="h-1 w-20 border-b border-l border-r border-white/60 relative">
                    <div className="absolute top-0 bottom-0 left-1/4 w-px bg-white/40" />
                    <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/40" />
                  </div>
                </div>
              </div>

              {/* Floating Legend (Bottom Right) matching reference image */}
              <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-20 rounded-xl bg-black/85 p-2.5 sm:p-3 backdrop-blur-md border border-white/15 space-y-1.5 text-[10px] shadow-2xl min-w-[145px]">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#00e599]" />
                  <span className="text-slate-200">Habitat patch</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#38bdf8]" />
                  <span className="text-slate-200">Connectivity link</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" />
                  <span className="text-slate-200">Critical patch</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#eab308]" />
                  <span className="text-slate-200">Restoration candidate</span>
                </div>
              </div>
            </div>
          </div>
      </div>

      {/* =========================================================================
          BOTTOM 4 FEATURE HIGHLIGHTS STRIP
          ========================================================================= */}
      <div className="relative z-10 w-full border-t border-white/10 bg-[#020a14]/90 backdrop-blur-md px-6 py-4 sm:px-10 lg:px-16">
        <div className="max-w-[1700px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-5 items-center">
          {/* Item 01 */}
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#00e599]/15 text-[#00e599] border border-[#00e599]/25">
              <MapPin className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="text-[13px] sm:text-sm font-bold text-white leading-tight">
                4 Study Areas
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Across Indian coasts</div>
            </div>
          </div>

          {/* Item 02 */}
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#00e599]/15 text-[#00e599] border border-[#00e599]/25">
              <Layers className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="text-[13px] sm:text-sm font-bold text-white leading-tight">
                Satellite-Driven
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Sentinel-1 & Sentinel-2</div>
            </div>
          </div>

          {/* Item 03 */}
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#00e599]/15 text-[#00e599] border border-[#00e599]/25">
              <Network className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="text-[13px] sm:text-sm font-bold text-white leading-tight">
                Graph-Based
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Connectivity Analysis</div>
            </div>
          </div>

          {/* Item 04 */}
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#00e599]/15 text-[#00e599] border border-[#00e599]/25">
              <Leaf className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="text-[13px] sm:text-sm font-bold text-white leading-tight">
                Real-World Impact
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">For People and Nature</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
