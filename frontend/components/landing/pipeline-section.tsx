"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Calculator,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Database,
  FileCheck,
  Filter,
  Flame,
  GitBranch,
  Layers,
  Leaf,
  Network,
  Radio,
  Satellite,
  Search,
  Sparkles,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Stage {
  number: number;
  tier: "satellite" | "graph" | "decision";
  title: string;
  subtitle: string;
  formula?: string;
  inputs: string;
  outputs: string;
  description: string;
  statusBadge: string;
}

const STAGES: Stage[] = [
  {
    number: 1,
    tier: "satellite",
    title: "Satellite Acquisition",
    subtitle: "Sentinel-1 SAR + Sentinel-2 MSI",
    inputs: "Copernicus Open Access Hub (VV/VH & Optical Bands)",
    outputs: "Multi-temporal Level-1C/2A Raster Scenes",
    description:
      "Dual-sensor acquisition pairing all-weather Sentinel-1 SAR radar backscatter (penetrating tropical monsoon clouds) with Sentinel-2 10m multispectral imagery.",
    statusBadge: "Configured Scene Footprint",
  },
  {
    number: 2,
    tier: "satellite",
    title: "Image Preprocessing",
    subtitle: "Calibration, Cloud Masking & Tiling",
    inputs: "Raw Sentinel-1/2 granules",
    outputs: "Standardized 512×512 analysis tiles",
    description:
      "Radiometric calibration, terrain geometric correction, SCL cloud-masking, normalization, and tile grid partitioning for deep learning inference.",
    statusBadge: "Pipeline Staged Progress",
  },
  {
    number: 3,
    tier: "satellite",
    title: "Habitat Segmentation (UNB7)",
    subtitle: "EfficientNet-B7 Encoder + U-Net Decoder",
    formula: "P_i(c) = P(y_i = c | X; \\theta)",
    inputs: "14,000+ Preprocessed training tiles",
    outputs: "Pixel-wise feature representations",
    description:
      "Weakly supervised deep convolutional architecture inherited from Ghorbanian et al. 2025, extracting multi-level hierarchical features with skip-connections.",
    statusBadge: "95.56% Baseline Accuracy",
  },
  {
    number: 4,
    tier: "satellite",
    title: "Probability Map Generation",
    subtitle: "Continuous Confidence Surface",
    formula: "P_i(c) \\in [0, 1]",
    inputs: "UNB7 Softmax logits",
    outputs: "Calibrated habitat probability raster",
    description:
      "Preserves soft probabilities rather than hard thresholding, allowing downstream graph components to inherit pixel-level classification confidence.",
    statusBadge: "Continuous Uncertainty",
  },
  {
    number: 5,
    tier: "graph",
    title: "Patch Extraction",
    subtitle: "Connected-Component Morphology",
    formula: "\\text{Patch}_i = \\{A_i, (x_i, y_i), C_i, H_i\\}",
    inputs: "Probability map threshold (p ≥ 0.5)",
    outputs: "Discrete habitat polygons (Area ≥ 2 ha)",
    description:
      "Groups contiguous above-threshold pixels into discrete patches characterized by area $A_i$, spatial centroid $(x_i, y_i)$, mean confidence $C_i$, and habitat class $H_i$.",
    statusBadge: "16–20 Patches / Landscape",
  },
  {
    number: 6,
    tier: "graph",
    title: "Graph Construction",
    subtitle: "Weighted Topology Modeling G = (V, E)",
    formula: "w_{ij} = q_{ij} \\cdot \\exp(-d_{ij} / \\tau)",
    inputs: "Patch centroids, distances, quality scores",
    outputs: "Sparse connectivity graph G(V, E)",
    description:
      "Wired graph where patches are nodes and edges represent ecological dispersal. Restricts edges to k=3 nearest neighbours with distance within species threshold $\\tau=5\\text{km}$.",
    statusBadge: "30–39 Weighted Edges",
  },
  {
    number: 7,
    tier: "graph",
    title: "Sensitivity & Criticality Analysis",
    subtitle: "Exact Leave-One-Out Perturbation",
    formula: "S_i = \\frac{C(G) - C(G - v_i)}{C(G)}",
    inputs: "Graph G and scalar index C(G) (IIC, PC, ECA)",
    outputs: "Patch criticality scores Si sorted descending",
    description:
      "Systematically deletes each node $v_i$ and recomputes the landscape connectivity index to quantify the structural cost of patch loss, identifying bridge bottlenecks.",
    statusBadge: "Exact Graph Recomputation",
  },
  {
    number: 8,
    tier: "decision",
    title: "What-If Simulation",
    subtitle: "Disaster & Infrastructure Loss Modeling",
    formula: "\\Delta C = C_{\\text{base}} - C_{\\text{after}}",
    inputs: "User-selected patch or corridor severance",
    outputs: "Severed edges, isolated components, delta index",
    description:
      "Simulates catastrophic loss (cyclones, coastal highways, port dredging) on any chosen subset of patches, providing immediate damage and fragmentation projections.",
    statusBadge: "Interactive Scenario Engine",
  },
  {
    number: 9,
    tier: "decision",
    title: "Rule-Based Explainable AI (XAI)",
    subtitle: "Transparent Structural Evidence",
    inputs: "Degree, cut-vertex status, area, neighbor distances",
    outputs: "Plain-language natural audit justifications",
    description:
      "Generates clear, fact-based justifications for every patch score without black-box opacity. Explains why a patch matters based on graph degree, cut-vertex role, and $\\Delta C_i$.",
    statusBadge: "Zero Hallucination Audit",
  },
  {
    number: 10,
    tier: "decision",
    title: "Cost-Aware Restoration Prioritization",
    subtitle: "Greedy Capital Allocation Optimization",
    formula: "\\text{Priority}_i = \\frac{R_i}{\\text{Cost}_i} = \\frac{C(G + v_i) - C(G)}{\\text{Cost}_i}",
    inputs: "Candidate sites, indicative INR budget bands",
    outputs: "Ranked restoration plan by connectivity gain / cost",
    description:
      "Inverts the sensitivity engine by inserting candidate restoration sites. Ranks sites by connectivity returned per lakh rupees invested, avoiding the 'restore the biggest site' fallacy.",
    statusBadge: "Budget-Constrained ROI",
  },
  {
    number: 11,
    tier: "decision",
    title: "Decision Support & Export",
    subtitle: "Actionable Policy Reports & GIS Layer",
    inputs: "Integrated map, graph, rankings, and XAI sentences",
    outputs: "Interactive reports, GeoJSON export, field tasks",
    description:
      "Synthesizes scientific graph analysis into formal, downloadable policy reports and field patrol coordinates for forest departments and conservation planners.",
    statusBadge: "Full Report Generation",
  },
];

const TIERS = [
  {
    id: "satellite",
    name: "Tier 1: Satellite & Deep Learning",
    stages: "Stages 1 – 4",
    desc: "Sentinel radar & optical fusion, UNB7 segmentation, probability rasters",
    color: "#38bdf8",
    bg: "rgba(56, 189, 248, 0.1)",
  },
  {
    id: "graph",
    name: "Tier 2: Graph Ecology & Sensitivity",
    stages: "Stages 5 – 7",
    desc: "Patch extraction, topology graphs, leave-one-out criticality",
    color: "#00c896",
    bg: "rgba(0, 200, 150, 0.1)",
  },
  {
    id: "decision",
    name: "Tier 3: Decision Support & Planning",
    stages: "Stages 8 – 11",
    desc: "What-if simulation, rule-based XAI, budget restoration rankings",
    color: "#a78bfa",
    bg: "rgba(167, 139, 250, 0.1)",
  },
] as const;

export function PipelineSection() {
  const [selectedTier, setSelectedTier] = useState<"all" | "satellite" | "graph" | "decision">("all");
  const [activeStage, setActiveStage] = useState<number>(7); // Default to sensitivity stage

  const filteredStages =
    selectedTier === "all" ? STAGES : STAGES.filter((s) => s.tier === selectedTier);

  const currentStage = STAGES.find((s) => s.number === activeStage) || STAGES[6];

  return (
    <section id="pipeline" className="relative bg-[#050816] py-20 lg:py-28 text-white border-t border-white/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#38bdf8]/30 bg-[#38bdf8]/10 px-3.5 py-1 text-[12px] font-semibold text-[#7dd3fc]">
            <Layers className="h-3.5 w-3.5 text-[#38bdf8]" />
            <span>End-to-End Architectural Pipeline</span>
          </div>
          <h2 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
            11 Stages: From Orbit to <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#38bdf8] via-[#00c896] to-[#a78bfa]">
              Targeted Conservation Action
            </span>
          </h2>
          <p className="mt-4 text-[16px] text-slate-300 leading-relaxed">
            EcoConnectAI integrates remote sensing, graph ecology, sensitivity modeling, and decision
            support into a single reproducible pipeline.
          </p>
        </div>

        {/* Tier Selector Filter */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-2.5">
          <button
            onClick={() => setSelectedTier("all")}
            className={`px-4 py-2 rounded-xl text-[13px] font-semibold transition-all ${
              selectedTier === "all"
                ? "bg-white text-[#050816] shadow-lg"
                : "bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10"
            }`}
          >
            All 11 Stages
          </button>
          {TIERS.map((tier) => (
            <button
              key={tier.id}
              onClick={() => setSelectedTier(tier.id)}
              className={`px-4 py-2 rounded-xl text-[13px] font-semibold transition-all border ${
                selectedTier === tier.id
                  ? "bg-white/15 text-white border-white/30 shadow-lg"
                  : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
              }`}
              style={{
                borderColor: selectedTier === tier.id ? tier.color : undefined,
                color: selectedTier === tier.id ? tier.color : undefined,
              }}
            >
              {tier.name}
            </button>
          ))}
        </div>

        {/* Pipeline Flow & Stage Inspector Layout */}
        <div className="mt-12 grid lg:grid-cols-12 gap-8 items-start">
          {/* Left: Interactive 11-Stage Step Rail */}
          <div className="lg:col-span-6 space-y-2.5 max-h-[680px] overflow-y-auto pr-2 scroll-slim">
            {filteredStages.map((stage) => {
              const isActive = stage.number === activeStage;
              const tierInfo = TIERS.find((t) => t.id === stage.tier)!;

              return (
                <div
                  key={stage.number}
                  onClick={() => setActiveStage(stage.number)}
                  className={`cursor-pointer rounded-xl border p-4 transition-all duration-200 ${
                    isActive
                      ? "border-[#00c896] bg-[#0c192d] shadow-lg shadow-[#00c896]/10 scale-[1.01]"
                      : "border-white/10 bg-[#080e1c] hover:border-white/20 hover:bg-[#0c1424]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className={`grid h-7 w-7 place-items-center rounded-lg text-[12px] font-bold ${
                          isActive
                            ? "bg-[#00c896] text-[#04231b]"
                            : "bg-white/10 text-slate-300"
                        }`}
                      >
                        {stage.number}
                      </span>
                      <div>
                        <h4 className="text-[14.5px] font-bold text-white leading-snug">
                          {stage.title}
                        </h4>
                        <p className="text-[11.5px] text-slate-400">{stage.subtitle}</p>
                      </div>
                    </div>

                    <span
                      className="text-[10.5px] font-medium px-2 py-0.5 rounded-full border"
                      style={{
                        backgroundColor: tierInfo.bg,
                        borderColor: `${tierInfo.color}40`,
                        color: tierInfo.color,
                      }}
                    >
                      {stage.statusBadge}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Deep Stage Inspector Card */}
          <div className="lg:col-span-6 sticky top-28">
            <div className="rounded-2xl border border-white/15 bg-[#0c1529]/95 p-6 backdrop-blur-2xl shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#00c896]/20 text-[#00c896] font-extrabold text-lg border border-[#00c896]/30">
                    {currentStage.number}
                  </span>
                  <div>
                    <span className="text-[11px] uppercase font-bold tracking-wider text-[#38bdf8]">
                      Stage {currentStage.number} · {currentStage.tier.toUpperCase()} LAYER
                    </span>
                    <h3 className="text-xl font-bold text-white leading-tight">
                      {currentStage.title}
                    </h3>
                  </div>
                </div>
                <span className="rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-medium text-slate-300">
                  {currentStage.statusBadge}
                </span>
              </div>

              {/* Description */}
              <p className="mt-4 text-[14px] text-slate-200 leading-relaxed">
                {currentStage.description}
              </p>

              {/* Mathematical Formula if available */}
              {currentStage.formula && (
                <div className="mt-4 rounded-xl border border-[#00c896]/30 bg-[#00c896]/5 p-3.5">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-[#00c896] uppercase tracking-wider">
                    <Calculator className="h-3.5 w-3.5" />
                    <span>Mathematical Formulation</span>
                  </div>
                  <div className="mt-1 font-mono text-[13.5px] font-semibold text-white bg-black/40 px-3 py-2 rounded-lg border border-white/10 overflow-x-auto">
                    {currentStage.formula}
                  </div>
                </div>
              )}

              {/* Inputs & Outputs Grid */}
              <div className="mt-5 grid grid-cols-2 gap-3 text-[12px]">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[10.5px] uppercase font-bold text-slate-400 tracking-wider">
                    Inputs
                  </div>
                  <div className="mt-1 font-medium text-slate-200">{currentStage.inputs}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[10.5px] uppercase font-bold text-[#00c896] tracking-wider">
                    Outputs / Deliverables
                  </div>
                  <div className="mt-1 font-medium text-white">{currentStage.outputs}</div>
                </div>
              </div>

              {/* Bottom Quick Action */}
              <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-[12px]">
                <span className="text-slate-400">Integrated in EcoConnectAI runtime</span>
                <Link
                  href="/command"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#00c896] px-3.5 py-2 font-bold text-[#04231b] hover:bg-[#10b981] transition-colors"
                >
                  <span>Execute in Command</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
