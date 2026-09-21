"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronRight,
  MapPin,
} from "lucide-react";

interface LandscapeDetail {
  id: string;
  name: string;
  region: string;
  state: string;
  protection: string;
  sensor: string;
  footprint: string;
  patches: number;
  ecaPct: string;
  description: string;
  satelliteUrl: string;
}

const LANDSCAPES: LandscapeDetail[] = [
  {
    id: "kerala-coast",
    name: "Vembanad–Kol Wetland",
    region: "Kochi & Alappuzha Backwaters",
    state: "Kerala",
    protection: "Ramsar Site",
    sensor: "Sentinel-2 MSI (10m)",
    footprint: "486 km²",
    patches: 18,
    ecaPct: "59.6%",
    description: "Backwater system where mangrove fringes meet the Arabian Sea. Bridge patch P16 holds 40.8% of connectivity.",
    satelliteUrl:
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=76.272,9.778,76.472,9.978&bboxSR=4326&imageSR=3857&size=640,420&format=jpg&f=image",
  },
  {
    id: "sundarbans",
    name: "Sundarbans Western Delta",
    region: "Sundarban Biosphere Reserve",
    state: "West Bengal",
    protection: "UNESCO World Heritage",
    sensor: "Sentinel-2 MSI (10m)",
    footprint: "1,284 km²",
    patches: 20,
    ecaPct: "53.7%",
    description: "World's largest contiguous tidal mangrove forest, fragmented into 12 island components across wide tidal rivers.",
    satelliteUrl:
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=88.6,21.8,88.9,22.1&bboxSR=4326&imageSR=3857&size=640,420&format=jpg&f=image",
  },
  {
    id: "gulf-of-mannar",
    name: "Gulf of Mannar Reefs",
    region: "Mannar Biosphere Reserve",
    state: "Tamil Nadu",
    protection: "Marine National Park",
    sensor: "Landsat-9 OLI-2 (30m)",
    footprint: "826 km²",
    patches: 17,
    ecaPct: "55.1%",
    description: "Chain of 21 islands with coral reefs, seagrass beds, and island mangroves anchored by a dominant coastal shelf.",
    satelliteUrl:
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=79.1,9.1,79.4,9.35&bboxSR=4326&imageSR=3857&size=640,420&format=jpg&f=image",
  },
  {
    id: "bhitarkanika",
    name: "Bhitarkanika Mangroves",
    region: "Brahmani–Baitarani Estuary",
    state: "Odisha",
    protection: "Ramsar Site & NP",
    sensor: "Sentinel-2 MSI (10m)",
    footprint: "672 km²",
    patches: 16,
    ecaPct: "54.7%",
    description: "India's second largest mangrove ecosystem, acting as a crucial cyclonic storm surge attenuation buffer.",
    satelliteUrl:
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=86.8,20.6,87.1,20.85&bboxSR=4326&imageSR=3857&size=640,420&format=jpg&f=image",
  },
];

export function StudyAreasSection() {
  const [selectedId, setSelectedId] = useState<string>("kerala-coast");

  return (
    <section id="study-areas" className="relative bg-[#050c18] py-16 lg:py-20 text-white border-t border-white/10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[#00c896]/30 bg-[#00c896]/10 px-3 py-0.5 text-[11px] font-semibold text-[#a7f3e0]">
              <MapPin className="h-3 w-3 text-[#00c896]" />
              <span>Configured Landscapes</span>
            </div>
            <h2 className="mt-2.5 text-2xl sm:text-3xl lg:text-[32px] font-extrabold tracking-tight">
              Four Iconic Coastal Landscapes
            </h2>
            <p className="mt-2 max-w-xl text-[13.5px] text-slate-300">
              Evaluation across high-biodiversity Indian estuaries, Ramsar wetlands, and UNESCO
              Biosphere Reserves.
            </p>
          </div>

          <Link
            href="/command"
            className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#00c896] hover:underline"
          >
            <span>Explore All in Command</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* 4-Card Landscape Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {LANDSCAPES.map((site) => {
            const isSelected = site.id === selectedId;

            return (
              <div
                key={site.id}
                onClick={() => setSelectedId(site.id)}
                className={`group cursor-pointer overflow-hidden rounded-xl border transition-all duration-200 ${
                  isSelected
                    ? "border-[#00c896] bg-[#0c182a] shadow-lg shadow-[#00c896]/15 scale-[1.01]"
                    : "border-white/10 bg-[#080f1d] hover:border-white/20 hover:bg-[#0c1424]"
                }`}
              >
                {/* Satellite Imagery Thumbnail */}
                <div className="relative aspect-[16/10] overflow-hidden bg-[#050914]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={site.satelliteUrl}
                    alt={`${site.name} satellite imagery`}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-85"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#080f1d] via-transparent to-transparent" />

                  {/* Protection Pill */}
                  <div className="absolute top-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold text-slate-200 backdrop-blur border border-white/15">
                    {site.protection}
                  </div>

                  {/* Sensor Badge */}
                  <div className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[8.5px] font-mono text-[#00c896] backdrop-blur border border-[#00c896]/30">
                    {site.sensor}
                  </div>
                </div>

                {/* Content */}
                <div className="p-3.5 space-y-2">
                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-[14px] font-bold text-white group-hover:text-[#00c896] transition-colors leading-snug">
                        {site.name}
                      </h3>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-white transition-colors" />
                    </div>
                    <div className="text-[10.5px] text-slate-400">{site.state} · {site.footprint}</div>
                  </div>

                  {/* Metrics Row */}
                  <div className="grid grid-cols-2 gap-1 text-center bg-black/30 p-1.5 rounded-lg border border-white/5 text-[11px]">
                    <div>
                      <div className="text-[8.5px] uppercase text-slate-400">Patches</div>
                      <div className="font-bold text-white text-[12px]">{site.patches}</div>
                    </div>
                    <div>
                      <div className="text-[8.5px] uppercase text-slate-400">ECA / Hab</div>
                      <div className="font-bold text-[#00c896] text-[12px]">{site.ecaPct}</div>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                    {site.description}
                  </p>

                  <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
                    <span className="font-mono text-slate-400 text-[9.5px]">Scene {site.id}</span>
                    <Link
                      href={`/analysis?scene=${site.id}`}
                      className="font-bold text-[#00c896] hover:underline flex items-center gap-0.5"
                    >
                      Analyse <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
