"use client";

import { useEffect, useMemo } from "react";
import { GeoJSON, ImageOverlay, MapContainer, TileLayer, useMap } from "react-leaflet";
import { geoJSON, type LatLngBoundsExpression, type PathOptions } from "leaflet";
import "leaflet/dist/leaflet.css";

import { BASEMAPS } from "@/lib/constants";

export type SatLayer = "footprint" | "scene" | "mask" | "patches" | "critical";
type Overlay = { url: string; bounds: [[number, number], [number, number]] } | null;

/**
 * Satellite Monitor map (separate from the dashboard map, which is unchanged): study-area box, the observation's
 * catalogue footprint, the retrieved Sentinel-1 VV backscatter, the predicted habitat mask and the run's patches
 * coloured by their stored criticality level. Every layer is real data from the backend or absent.
 */
export default function SatelliteMap({
  aoi, footprint, scene, mask, patches, layers, focusFootprint = 0,
}: {
  aoi: GeoJSON.Polygon | null;
  footprint: GeoJSON.Geometry | null;
  scene: Overlay;
  mask: Overlay;
  patches: GeoJSON.FeatureCollection | null;
  layers: Record<SatLayer, boolean>;
  /** increment to zoom to the observation footprint ("View observation") */
  focusFootprint?: number;
}) {
  const base = BASEMAPS[0];
  const critical = useMemo<GeoJSON.FeatureCollection | null>(() => patches && ({
    ...patches, features: patches.features.filter((f) => {
      const p = f.properties as { criticality_level?: string; is_cut_vertex?: boolean } | null;
      return p?.criticality_level === "critical" || p?.is_cut_vertex;
    }),
  }), [patches]);

  return (
    <MapContainer center={[20, 82]} zoom={5} className="h-full w-full" scrollWheelZoom attributionControl zoomControl>
      <TileLayer url={base.url} attribution={base.attribution} maxZoom={19} />
      <Fit aoi={aoi} />
      <FitFootprint footprint={footprint} tick={focusFootprint} />
      {aoi && <GeoJSON key={`aoi-${JSON.stringify(aoi.coordinates[0][0])}`} data={aoi}
        style={{ color: "#fbbf24", weight: 2, dashArray: "6 4", fill: false }} />}
      {layers.footprint && footprint && <GeoJSON key={`fp-${JSON.stringify(footprint).slice(0, 80)}`} data={footprint}
        style={{ color: "#38bdf8", weight: 2.5, fillColor: "#38bdf8", fillOpacity: 0.16 }} />}
      {layers.scene && scene && <ImageOverlay key={scene.url} url={scene.url} bounds={scene.bounds} opacity={0.95} zIndex={340} />}
      {layers.mask && mask && <ImageOverlay key={mask.url} url={mask.url} bounds={mask.bounds} opacity={0.9} zIndex={350} />}
      {layers.patches && patches && <GeoJSON key={`p-${patches.features.length}`} data={patches}
        style={() => ({ color: "#22c55e", weight: 1.2, fillColor: "#22c55e", fillOpacity: 0.25 } as PathOptions)}
        onEachFeature={(f, l) => {
          const p = f.properties as { id?: string; area_ha?: number; criticality_rank?: number } | null;
          if (p?.id) l.bindTooltip(`${p.id} · ${p.area_ha?.toFixed(1)} ha · criticality #${p.criticality_rank}`);
        }} />}
      {layers.critical && critical && <GeoJSON key={`c-${critical.features.length}`} data={critical}
        style={() => ({ color: "#ef4444", weight: 2.2, fillColor: "#ef4444", fillOpacity: 0.35 } as PathOptions)} />}
    </MapContainer>
  );
}

function FitFootprint({ footprint, tick }: { footprint: GeoJSON.Geometry | null; tick: number }) {
  const map = useMap();
  useEffect(() => {
    if (!tick || !footprint) return;
    const b = geoJSON(footprint).getBounds();
    if (b.isValid()) map.flyToBounds(b.pad(0.05), { duration: 0.8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, map]);
  return null;
}

function Fit({ aoi }: { aoi: GeoJSON.Polygon | null }) {
  const map = useMap();
  const key = aoi ? JSON.stringify(aoi.coordinates[0]) : "";
  useEffect(() => {
    if (!aoi) return;
    const b = geoJSON(aoi).getBounds();
    if (b.isValid()) map.fitBounds(b.pad(0.15) as LatLngBoundsExpression, { animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}
