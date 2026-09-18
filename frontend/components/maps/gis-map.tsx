"use client";

import { useEffect, useMemo } from "react";
import {
  CircleMarker,
  ImageOverlay,
  MapContainer,
  Polygon,
  Polyline,
  Rectangle,
  TileLayer,
  Tooltip as LTooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { control } from "leaflet";
import type { LatLngBoundsExpression } from "leaflet";
import "leaflet/dist/leaflet.css";

import { BASEMAPS, HABITAT_META, SENSITIVITY_META, type BasemapId } from "@/lib/constants";
import { sensitivityColor } from "@/utils/format";
import type { HabitatGraph, HabitatMask, HeatmapData, LatLng, SatelliteScene } from "@/types";

/** Stable identity so optional array props don't churn memo dependencies. */
const NO_IDS: string[] = [];

export interface LayerState {
  satellite: boolean;
  /** Model habitat-probability raster (real runs only). */
  probability: boolean;
  habitat: boolean;
  heatmap: boolean;
  connectivity: boolean;
  protectedAreas: boolean;
  labels: boolean;
}

interface Props {
  scene: SatelliteScene;
  mask: HabitatMask;
  graph: HabitatGraph;
  heatmap: HeatmapData;
  layers: LayerState;
  basemap: BasemapId;
  heatOpacity: number;
  selectedPatchId: string | null;
  onSelectPatch: (id: string | null) => void;
  /** Patches removed by the what-if simulator — drawn as voids. */
  removedPatchIds?: string[];
  /** Patches degraded in the active scenario or timeline year. */
  degradedPatchIds?: string[];
  onCursorMove?: (pos: { lat: number; lng: number } | null) => void;
  onCellClick?: (cellId: string) => void;
  /** Polygon the user is drawing in the what-if simulator. */
  drawing?: boolean;
  drawnPolygon?: LatLng[];
  onDrawPoint?: (point: LatLng) => void;
  className?: string;
  /** Habitat-probability overlay of a real run: PNG url + WGS84 bounds. */
  probabilityOverlay?: { url: string; bounds: [[number, number], [number, number]] } | null;
  /** Point layers (alerts, field tasks/observations, candidates). */
  markers?: MapMarker[];
  /** Measure mode: clicks add vertices; the distance along the line is shown. */
  measuring?: boolean;
  measurePoints?: LatLng[];
  onMeasurePoint?: (p: LatLng) => void;
}

export interface MapMarker {
  id: string;
  lat: number;
  lon: number;
  color: string;
  label: string;
  kind?: "alert" | "task" | "observation" | "candidate";
  onClick?: () => void;
}

const R_EARTH_KM = 6371.0088;
export function haversineKm(a: LatLng, b: LatLng) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH_KM * Math.asin(Math.sqrt(h));
}

/* ------------------------------------------------------------------ */
/* map event bridges                                                   */
/* ------------------------------------------------------------------ */

function CursorTracker({
  onMove,
  onClick,
}: {
  onMove?: (p: { lat: number; lng: number } | null) => void;
  onClick?: (p: LatLng) => void;
}) {
  useMapEvents({
    mousemove: (e) => onMove?.({ lat: e.latlng.lat, lng: e.latlng.lng }),
    mouseout: () => onMove?.(null),
    click: (e) => onClick?.([e.latlng.lat, e.latlng.lng]),
  });
  return null;
}

/** Re-fit the viewport when the scene changes. */
function SceneFitter({ bounds, sceneId }: { bounds: LatLngBoundsExpression; sceneId: string }) {
  const map = useMap();
  useEffect(() => {
    // The container may not be laid out yet (grid pages); defer and guard so Leaflet never sees a 0x0 map.
    const t = window.setTimeout(() => {
      map.invalidateSize();
      const size = map.getSize();
      if (size.x > 0 && size.y > 0) {
        try {
          map.flyToBounds(bounds, { padding: [28, 28], duration: 0.9 });
        } catch {
          map.fitBounds(bounds);
        }
      }
    }, 60);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneId]);
  return null;
}

/** Adds the metric scale bar once per map instance. */
function ScaleBar() {
  const map = useMap();
  useEffect(() => {
    const ctrl = control.scale({ position: "bottomleft", imperial: false, maxWidth: 130 });
    ctrl.addTo(map);
    return () => {
      ctrl.remove();
    };
  }, [map]);
  return null;
}

/* ------------------------------------------------------------------ */
/* map                                                                 */
/* ------------------------------------------------------------------ */

export default function GisMap({
  scene,
  mask,
  graph,
  heatmap,
  layers,
  basemap,
  heatOpacity,
  selectedPatchId,
  onSelectPatch,
  removedPatchIds = NO_IDS,
  degradedPatchIds = NO_IDS,
  onCursorMove,
  onCellClick,
  drawing = false,
  drawnPolygon = [],
  onDrawPoint,
  className,
  probabilityOverlay = null,
  markers = [],
  measuring = false,
  measurePoints = [],
  onMeasurePoint,
}: Props) {
  const measureKm = measurePoints.reduce((acc, p, i) => (i ? acc + haversineKm(measurePoints[i - 1], p) : 0), 0);
  const base = BASEMAPS.find((b) => b.id === basemap) ?? BASEMAPS[0];
  const bounds = scene.bounds as LatLngBoundsExpression;

  const patchById = useMemo(
    () => Object.fromEntries(mask.patches.map((p) => [p.id, p])),
    [mask.patches],
  );

  // Only render meaningful heat cells — the low band is visual noise at scale.
  const visibleCells = useMemo(
    () => heatmap.cells.filter((c) => c.sensitivity >= 0.18),
    [heatmap.cells],
  );

  return (
    <div className={className}>
      <MapContainer
        center={scene.center as [number, number]}
        zoom={scene.zoom}
        bounds={bounds}
        scrollWheelZoom
        zoomControl
        className="h-full w-full"
        attributionControl
      >
        <SceneFitter bounds={bounds} sceneId={scene.id} />
        <CursorTracker
          onMove={onCursorMove}
          onClick={(p) => {
            if (measuring) onMeasurePoint?.(p);
            else if (drawing) onDrawPoint?.(p);
          }}
        />

        {/* ------------------------------------------------ measure */}
        {measurePoints.length > 0 && (
          <Polyline positions={measurePoints as [number, number][]} pathOptions={{ color: "#0b1120", weight: 2, dashArray: "6 4" }}>
            <LTooltip permanent direction="top">{measureKm >= 1 ? `${measureKm.toFixed(2)} km` : `${(measureKm * 1000).toFixed(0)} m`}</LTooltip>
          </Polyline>
        )}

        {/* ------------------------------------------------ point layers */}
        {markers.map((mk) => (
          <CircleMarker
            key={mk.id}
            center={[mk.lat, mk.lon]}
            radius={mk.kind === "task" || mk.kind === "observation" ? 6 : 7}
            pathOptions={{ color: "#ffffff", weight: 1.5, fillColor: mk.color, fillOpacity: 0.95 }}
            eventHandlers={{ click: () => mk.onClick?.() }}
          >
            <LTooltip direction="top">{mk.label}</LTooltip>
          </CircleMarker>
        ))}

        {/* ------------------------------------------------ basemap */}
        {layers.satellite && (
          <TileLayer key={base.id} url={base.url} attribution={base.attribution} maxZoom={19} />
        )}
        {!layers.satellite && (
          <TileLayer
            key="dark-fallback"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
            attribution="Esri, HERE, Garmin"
            maxZoom={19}
          />
        )}
        {basemap === "hybrid" && layers.labels && (
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
            attribution=""
            maxZoom={19}
          />
        )}

        {/* ------------------------------------ model probability raster */}
        {layers.probability && probabilityOverlay && (
          <ImageOverlay url={probabilityOverlay.url} bounds={probabilityOverlay.bounds} opacity={0.9} zIndex={350} />
        )}

        {/* ------------------------------------------------ heatmap */}
        {layers.heatmap &&
          visibleCells.map((c) => (
            <Rectangle
              key={c.id}
              bounds={c.bounds as LatLngBoundsExpression}
              pathOptions={{
                color: sensitivityColor(c.sensitivity),
                weight: 0,
                fillColor: sensitivityColor(c.sensitivity),
                fillOpacity: c.sensitivity * heatOpacity * 0.85,
              }}
              eventHandlers={{
                click: () => onCellClick?.(c.id),
              }}
            />
          ))}

        {/* ------------------------------- connectivity graph edges */}
        {layers.connectivity &&
          graph.edges.map((e) => {
            const a = patchById[e.source];
            const b = patchById[e.target];
            if (!a || !b) return null;
            const severed =
              removedPatchIds.includes(e.source) ||
              removedPatchIds.includes(e.target) ||
              degradedPatchIds.includes(e.source) ||
              degradedPatchIds.includes(e.target);

            return (
              <Polyline
                key={e.id}
                positions={[a.center as [number, number], b.center as [number, number]]}
                pathOptions={{
                  color: severed ? "#ef4444" : e.critical ? "#f59e0b" : "#1e5f8a",
                  weight: severed ? 1.2 : 1 + e.strength * 2.6,
                  opacity: severed ? 0.4 : 0.32 + e.strength * 0.5,
                  dashArray: severed ? "4 6" : e.critical ? "7 4" : undefined,
                }}
              >
                <LTooltip sticky>
                  <div className="space-y-0.5">
                    <div className="font-semibold">
                      {a.name} ↔ {b.name}
                    </div>
                    <div className="text-muted-foreground">
                      {e.distanceKm} km · strength {(e.strength * 100).toFixed(0)}%
                      {e.critical && " · critical link"}
                    </div>
                    {severed && <div className="text-[#ef4444]">Severed in current scenario</div>}
                  </div>
                </LTooltip>
              </Polyline>
            );
          })}

        {/* ------------------------------------------ habitat patches */}
        {layers.habitat &&
          mask.patches.map((p) => {
            const removed = removedPatchIds.includes(p.id);
            const degraded = degradedPatchIds.includes(p.id);
            const selected = selectedPatchId === p.id;
            const meta = HABITAT_META[p.habitatClass];
            const sens = SENSITIVITY_META[p.sensitivity];

            return (
              <Polygon
                key={p.id}
                positions={p.polygon as [number, number][]}
                pathOptions={{
                  color: removed ? "#ef4444" : selected ? "#f8fafc" : meta.color,
                  weight: selected ? 2.6 : removed ? 1.6 : 1.4,
                  opacity: removed ? 0.85 : 0.9,
                  dashArray: removed || degraded ? "5 4" : undefined,
                  fillColor: removed ? "#ef4444" : degraded ? "#f59e0b" : meta.color,
                  fillOpacity: removed ? 0.1 : degraded ? 0.18 : selected ? 0.44 : 0.28,
                }}
                eventHandlers={{
                  click: () => {
                    if (!drawing) onSelectPatch(selected ? null : p.id);
                  },
                  mouseover: (e) => e.target.setStyle({ fillOpacity: 0.5 }),
                  mouseout: (e) =>
                    e.target.setStyle({
                      fillOpacity: removed ? 0.1 : degraded ? 0.18 : selected ? 0.44 : 0.28,
                    }),
                }}
              >
                <LTooltip direction="top" offset={[0, -4]} opacity={1}>
                  <div className="space-y-1">
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-muted-foreground">
                      {meta.label} · {p.areaHa.toLocaleString("en-IN")} ha
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ background: sens.color }}
                      />
                      <span style={{ color: sens.color }}>{sens.label} sensitivity</span>
                    </div>
                    {removed && <div className="text-[#ef4444]">Removed in simulation</div>}
                  </div>
                </LTooltip>
              </Polygon>
            );
          })}

        {/* --------------------------------------- protected areas */}
        {layers.protectedAreas &&
          mask.patches
            .filter((p) => p.protected)
            .map((p) => (
              <Polygon
                key={`pa-${p.id}`}
                positions={p.polygon as [number, number][]}
                pathOptions={{
                  color: "#22c55e",
                  weight: 2,
                  opacity: 0.7,
                  dashArray: "3 5",
                  fill: false,
                }}
                interactive={false}
              />
            ))}

        {/* -------------------------------------- user-drawn polygon */}
        {drawnPolygon.length > 1 && (
          <Polygon
            positions={drawnPolygon as [number, number][]}
            pathOptions={{
              color: "#ef4444",
              weight: 2,
              fillColor: "#ef4444",
              fillOpacity: 0.18,
              dashArray: "6 4",
            }}
            interactive={false}
          />
        )}
        {drawnPolygon.length === 1 && (
          <Rectangle
            bounds={[
              [drawnPolygon[0][0] - 0.001, drawnPolygon[0][1] - 0.001],
              [drawnPolygon[0][0] + 0.001, drawnPolygon[0][1] + 0.001],
            ]}
            pathOptions={{ color: "#ef4444", weight: 2 }}
            interactive={false}
          />
        )}

        <ScaleBar />
      </MapContainer>
    </div>
  );
}

