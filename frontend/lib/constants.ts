import type { HabitatClass, SensitivityBand } from "@/types";

export const BRAND = {
  name: "EcoConnectAI",
  tagline: "AI-powered Coastal Habitat Connectivity Analysis & Conservation Decision Support",
  short: "Coastal habitat connectivity, decided in minutes — not months.",
} as const;

export const COLORS = {
  eco: "#15803d",
  sky: "#1e5f8a",
  danger: "#ef4444",
  warning: "#f59e0b",
  success: "#22c55e",
  violet: "#6d5bd0",
  muted: "#94a3b8",
  panel: "#111827",
  bg: "#050816",
} as const;

export const SENSITIVITY_META: Record<
  SensitivityBand,
  { label: string; color: string; text: string; ring: string; bg: string }
> = {
  low: {
    label: "Low",
    color: "#22c55e",
    text: "text-[#22c55e]",
    ring: "ring-[#22c55e]/30",
    bg: "bg-[#22c55e]/12",
  },
  medium: {
    label: "Medium",
    color: "#f59e0b",
    text: "text-[#f59e0b]",
    ring: "ring-[#f59e0b]/30",
    bg: "bg-[#f59e0b]/12",
  },
  high: {
    label: "High",
    color: "#f97316",
    text: "text-[#f97316]",
    ring: "ring-[#f97316]/30",
    bg: "bg-[#f97316]/12",
  },
  critical: {
    label: "Critical",
    color: "#ef4444",
    text: "text-[#ef4444]",
    ring: "ring-[#ef4444]/30",
    bg: "bg-[#ef4444]/12",
  },
};

export const HABITAT_META: Record<HabitatClass, { label: string; color: string }> = {
  mangrove: { label: "Mangrove Forest", color: "#15803d" },
  seagrass: { label: "Seagrass Meadow", color: "#1e5f8a" },
  coral: { label: "Coral Reef", color: "#f472b6" },
  saltmarsh: { label: "Salt Marsh", color: "#a3e635" },
  mudflat: { label: "Intertidal Mudflat", color: "#f59e0b" },
  estuary: { label: "Estuarine Channel", color: "#818cf8" },
  dune: { label: "Coastal Dune", color: "#fbbf24" },
  water: { label: "Open Water", color: "#0ea5e9" },
  urban: { label: "Built-up / Aquaculture", color: "#94a3b8" },
};

export const BASEMAPS = [
  {
    id: "satellite",
    label: "Satellite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Esri, Maxar, Earthstar Geographics",
  },
  {
    id: "terrain",
    label: "Terrain",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}",
    attribution: "Esri, USGS, NOAA",
  },
  {
    id: "dark",
    label: "Dark",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    attribution: "Esri, HERE, Garmin",
  },
  {
    id: "hybrid",
    label: "Hybrid",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Esri, Maxar",
    overlay:
      "https://stamen-tiles.a.ssl.fastly.net/toner-labels/{z}/{x}/{y}.png",
  },
] as const;

export type BasemapId = (typeof BASEMAPS)[number]["id"];

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: "LayoutDashboard" },
  { href: "/analysis", label: "Analysis", icon: "Map" },
  { href: "/simulation", label: "Simulation", icon: "FlaskConical" },
  { href: "/experiments", label: "Experiments", icon: "Cpu" },
  { href: "/reports", label: "Reports", icon: "FileText" },
  { href: "/history", label: "History", icon: "History" },
  { href: "/settings", label: "Settings", icon: "Settings" },
] as const;
