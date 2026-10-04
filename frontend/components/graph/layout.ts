/**
 * Presentation-only layout helpers for the connectivity graph. Node positions come from the run (projected patch
 * centroids); nearby patches overlap on screen, so they are spread apart just enough to read, while each node stays
 * close to its geographic spot. Nothing here changes the network itself.
 */

export interface LayoutIn { id: string; x: number; y: number; r: number }
export interface Placed { x: number; y: number }
export interface Layout {
  pos: Map<string, Placed>;
  /** maps a raw (run-space) position into the layout space — used to place nodes added later (e.g. restoration sites) */
  project: (x: number, y: number) => Placed;
}

const SPAN = 920; // layout width/height (flow units) the network is scaled to before spreading
const GAP = 84; // clear space kept between two node rims (room for the label under each node)

export function relaxLayout(nodes: LayoutIn[]): Layout {
  if (!nodes.length) return { pos: new Map(), project: (x, y) => ({ x, y }) };
  const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const span = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY, 1e-9);
  const s = SPAN / span;
  const project = (x: number, y: number) => ({ x: (x - minX) * s, y: (y - minY) * s });

  const home = nodes.map((n) => project(n.x, n.y));
  const p = home.map((h) => ({ ...h }));
  for (let it = 0; it < 260; it++) {
    for (let i = 0; i < p.length; i++) {
      for (let j = i + 1; j < p.length; j++) {
        let dx = p[j].x - p[i].x, dy = p[j].y - p[i].y;
        let d = Math.hypot(dx, dy);
        if (d < 1e-6) { const a = (i * 2.399 + j) % (2 * Math.PI); dx = Math.cos(a); dy = Math.sin(a); d = 1; }
        const min = nodes[i].r + nodes[j].r + GAP;
        if (d < min) {
          const push = ((min - d) / 2) * 0.6;
          const ux = dx / d, uy = dy / d;
          p[i].x -= ux * push; p[i].y -= uy * push;
          p[j].x += ux * push; p[j].y += uy * push;
        }
      }
    }
    // weak pull back to the geographic spot keeps the overall shape of the coast
    for (let i = 0; i < p.length; i++) { p[i].x += (home[i].x - p[i].x) * 0.015; p[i].y += (home[i].y - p[i].y) * 0.015; }
  }
  return { pos: new Map(nodes.map((n, i) => [n.id, p[i]])), project };
}

/** Place one extra node at `at` and push it (only it) clear of already placed nodes. */
export function placeExtra(at: Placed, r: number, fixed: { x: number; y: number; r: number }[]): Placed {
  const p = { ...at };
  for (let it = 0; it < 120; it++) {
    let moved = false;
    for (const f of fixed) {
      let dx = p.x - f.x, dy = p.y - f.y;
      let d = Math.hypot(dx, dy);
      if (d < 1e-6) { dx = 1; dy = 0.4; d = Math.hypot(dx, dy); }
      const min = r + f.r + GAP;
      if (d < min) { p.x += (dx / d) * (min - d) * 0.7; p.y += (dy / d) * (min - d) * 0.7; moved = true; }
    }
    if (!moved) break;
  }
  return p;
}

/** Undirected key for a link between two patches. */
export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
