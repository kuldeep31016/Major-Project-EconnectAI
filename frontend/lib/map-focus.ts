"use client";

import { useEffect, useState } from "react";

/** Tiny event bus so the header search box (or an alert row) can ask whichever map is on screen to fly somewhere. */
export interface MapFocus { lat: number; lon: number; zoom?: number; nonce: number }
const EVENT = "eco:map-focus";
let nonce = 0;

export function requestMapFocus(lat: number, lon: number, zoom?: number) {
  nonce += 1;
  window.dispatchEvent(new CustomEvent<MapFocus>(EVENT, { detail: { lat, lon, zoom, nonce } }));
}

export function useMapFocus(): MapFocus | null {
  const [focus, setFocus] = useState<MapFocus | null>(null);
  useEffect(() => {
    const h = (e: Event) => setFocus((e as CustomEvent<MapFocus>).detail);
    window.addEventListener(EVENT, h);
    return () => window.removeEventListener(EVENT, h);
  }, []);
  return focus;
}
