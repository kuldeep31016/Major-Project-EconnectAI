"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useAnalysis } from "@/hooks/use-analysis";
import { getGraph, getHabitatMask, getScene } from "@/lib/data";
import type { LatLngBoundsExpression } from "leaflet";
import "leaflet/dist/leaflet.css";

const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const Polygon = dynamic(() => import("react-leaflet").then((m) => m.Polygon), { ssr: false });
const Polyline = dynamic(() => import("react-leaflet").then((m) => m.Polyline), { ssr: false });

type Layer = "satellite" | "mangroves" | "patches" | "graph";
const SCENE_ID = "kerala-coast";

/**
 * Hero map card: real Esri imagery of Vembanad–Kol with the patches/graph of the latest pipeline run
 * when the backend is online. Numbers shown are the run's own values with their provenance label.
 */
export function HeroMap() {
  const { dataSource, apiOnline } = useAnalysis();
  const [layer, setLayer] = useState<Layer>("mangroves");

  const scene = getScene(SCENE_ID);
  const live = dataSource.mode === "live" && dataSource.provenance?.studyAreaId === SCENE_ID;
  const mask = live ? getHabitatMask(SCENE_ID) : null;
  const graph = live ? getGraph(SCENE_ID) : null;
  const patchById = useMemo(
    () => Object.fromEntries((mask?.patches ?? []).map((p) => [p.id, p])),
    [mask],
  );
  const bounds = scene.bounds as LatLngBoundsExpression;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-[#0b1120] shadow-2xl">
      <div className="relative aspect-[4/3] w-full sm:aspect-[16/11]">
        {(
          <MapContainer
            bounds={bounds}
            center={scene.center as [number, number]}
            zoom={11}
            scrollWheelZoom={false}
            zoomControl={false}
            attributionControl
            dragging={false}
            doubleClickZoom={false}
            className="h-full w-full"
          >
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="Esri, Maxar, Earthstar Geographics"
            />
            {layer !== "satellite" &&
              mask?.patches.map((p) => (
                <Polygon
                  key={p.id}
                  positions={p.polygon as [number, number][]}
                  pathOptions={{
                    color: layer === "patches" ? "#f8fafc" : "#22c55e",
                    weight: layer === "patches" ? 1.4 : 1,
                    fillColor: "#22c55e",
                    fillOpacity: layer === "mangroves" ? 0.55 : layer === "patches" ? 0.25 : 0.15,
                  }}
                />
              ))}
            {layer === "graph" &&
              graph?.edges.map((e) => {
                const a = patchById[e.source];
                const b = patchById[e.target];
                return a && b ? (
                  <Polyline
                    key={e.id}
                    positions={[a.center as [number, number], b.center as [number, number]]}
                    pathOptions={{ color: "#38bdf8", weight: 1.6, opacity: 0.9 }}
                  />
                ) : null;
              })}
          </MapContainer>
        )}

        {/* location chip */}
        <div className="absolute left-3 top-3 z-[500] flex items-center gap-2 rounded-xl bg-[#0b1120]/80 px-3 py-2 text-white backdrop-blur">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-[13px]">📍</span>
          <div>
            <div className="text-[12px] font-semibold leading-tight">Vembanad – Kol Wetland</div>
            <div className="text-[10.5px] text-white/70">Kerala, India</div>
          </div>
        </div>

        {/* layer toggles */}
        <div className="absolute right-3 top-3 z-[500] rounded-xl bg-[#0b1120]/80 p-2 text-white backdrop-blur">
          {(
            [
              ["satellite", "Satellite Image"],
              ["mangroves", "Detected Mangroves"],
              ["patches", "Patches"],
              ["graph", "Connectivity Graph"],
            ] as [Layer, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setLayer(id)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-[11px] hover:bg-white/10"
            >
              <span
                className={
                  "h-3 w-3 rounded-full border " +
                  (layer === id ? "border-[#22c55e] bg-[#22c55e]" : "border-white/60")
                }
              />
              {label}
            </button>
          ))}
        </div>

        {/* stats */}
        <div className="absolute bottom-3 left-3 z-[500] flex overflow-hidden rounded-xl bg-[#0b1120]/85 text-white backdrop-blur">
          <div className="px-3.5 py-2">
            <div className="text-[10px] text-white/70">Mangrove coverage</div>
            <div className="text-[15px] font-bold tabular">
              {mask ? `${Math.round(mask.totals.habitatAreaHa).toLocaleString()} ha` : "—"}
            </div>
          </div>
          <div className="border-l border-white/10 px-3.5 py-2">
            <div className="text-[10px] text-white/70">Detected patches</div>
            <div className="text-[15px] font-bold tabular">{mask ? mask.totals.patchCount : "—"}</div>
          </div>
        </div>
        <div className="absolute bottom-3 right-3 z-[500] rounded-lg bg-[#0b1120]/70 px-2 py-1 text-[9.5px] text-white/80 backdrop-blur">
          {live
            ? dataSource.provenance?.resultKind === "development"
              ? "Real pipeline run · dev model · not final"
              : dataSource.label
            : apiOnline === false
              ? "Backend offline — imagery only"
              : "No pipeline run yet — imagery only"}
        </div>
      </div>
    </div>
  );
}
