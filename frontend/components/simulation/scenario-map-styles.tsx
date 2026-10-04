import { SIG } from "@/components/simulation/scenario-map";

/**
 * Page-scoped map animation for the Scenario Lab run. Targets the unique dash / fill signatures in SIG
 * (CSS properties beat Leaflet's SVG presentation attributes), only inside `.scn-map`.
 * Removed patches and cut links use the shared `eco-patch-removed` / `eco-edge-severed` animations.
 */
const css = `
.scn-map path[stroke-dasharray="${SIG.removeSelected}"] { stroke-width: 2.5px; }
.scn-map path.eco-edge-severed { stroke-width: 2.5px; stroke-opacity: .95; }
.scn-map path[stroke-dasharray="${SIG.newLink}"] { stroke: #00e599; stroke-dasharray: none; stroke-width: 3px; stroke-opacity: .95; filter: drop-shadow(0 0 3px rgba(0,229,153,.85)); }
.scn-map path[stroke-dasharray="${SIG.added}"] { stroke-dasharray: none; stroke-width: 2.5px; filter: drop-shadow(0 0 6px rgba(0,229,153,.95)); }
.scn-map path[stroke-dasharray="${SIG.shrink}"] { stroke-dasharray: none; stroke-width: 2.5px; }
.scn-map path[fill="${SIG.rippleCut}"], .scn-map path[fill="${SIG.rippleGrow}"] { fill-opacity: 0; stroke-width: 3px; pointer-events: none; opacity: 0; }
.scn-map path[fill="${SIG.rippleCut}"] { stroke: #ef4444; }
.scn-map path[fill="${SIG.rippleGrow}"] { stroke: #00e599; }
@media (prefers-reduced-motion: no-preference) {
  .scn-map path[stroke-dasharray="${SIG.removeSelected}"] { animation: scn-march 0.9s linear infinite; }
  .scn-map.scn-play path[stroke-dasharray="${SIG.newLink}"] { stroke-dasharray: 1600; stroke-dashoffset: 1600; animation: scn-draw 1.5s cubic-bezier(.25,.8,.25,1) .75s forwards; }
  .scn-map.scn-play path[stroke-dasharray="${SIG.added}"] { animation: scn-grow 1.1s ease-out both; }
  .scn-map.scn-play path[stroke-dasharray="${SIG.shrink}"] { animation: scn-shrink 1.4s ease-in-out 2; }
  .scn-map.scn-play path[fill="${SIG.rippleCut}"], .scn-map.scn-play path[fill="${SIG.rippleGrow}"] { transform-box: fill-box; transform-origin: center; animation: scn-ripple 1.3s ease-out 3; }
}
@keyframes scn-march { to { stroke-dashoffset: -18; } }
@keyframes scn-draw { to { stroke-dashoffset: 0; } }
@keyframes scn-grow { 0% { fill-opacity: 0; stroke-opacity: 0; stroke-width: 16px; } 45% { fill-opacity: .9; stroke-opacity: 1; } 100% { fill-opacity: .55; stroke-width: 2.5px; } }
@keyframes scn-shrink { 0%,100% { fill-opacity: .3; } 50% { fill-opacity: .75; stroke-width: 6px; } }
@keyframes scn-ripple { 0% { transform: scale(.8); opacity: 1; } 100% { transform: scale(7); opacity: 0; } }
`;

export function ScenarioMapStyles() {
  return <style>{css}</style>;
}
