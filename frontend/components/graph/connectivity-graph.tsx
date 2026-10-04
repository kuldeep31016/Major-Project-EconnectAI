"use client";

import { useCallback, useEffect, useMemo } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from "reactflow";
import "reactflow/dist/style.css";

import { HabitatNode, type HabitatNodeData } from "@/components/graph/habitat-node";
import { pairKey, placeExtra, relaxLayout } from "@/components/graph/layout";
import { HABITAT_META, SENSITIVITY_META } from "@/lib/constants";
import type { HabitatGraph } from "@/types";

const nodeTypes = { habitat: HabitatNode };

/*
 * Stable identity for the optional array props. A `= []` default literal would
 * allocate a fresh array on every render, invalidating the memos below and
 * putting the node/edge sync effects into an infinite update loop.
 */
const NO_IDS: string[] = [];
const NO_MARKS: Record<string, EdgeMark> = {};
const NO_EXTRA: ExtraNode[] = [];

/** What-if marks on links (keyed by `pairKey`): presentation only. */
export type EdgeMark = "lost" | "gained";

/** A node added by a what-if (e.g. a restoration site); `raw` is in the run's own node coordinate space. */
export interface ExtraNode { id: string; label: string; areaHa: number; raw: { x: number; y: number } }

interface Props {
  graph: HabitatGraph;
  selectedPatchId: string | null;
  onSelectPatch: (id: string | null) => void;
  removedPatchIds?: string[];
  degradedPatchIds?: string[];
  /** Patches currently playing the "remove" animation (their links flash red and fade). */
  removingPatchIds?: string[];
  edgeMarks?: Record<string, EdgeMark>;
  extraNodes?: ExtraNode[];
  /** Only show links above this strength — lets the analyst thin a dense graph. */
  minStrength?: number;
  showCriticalOnly?: boolean;
  className?: string;
}

const sizeOf = (areaHa: number, maxArea: number) => Math.round(42 + 34 * Math.sqrt(Math.max(0, areaHa) / Math.max(maxArea, 1e-9)));

// Edge keyframes. CSS animations override the inline stroke styles while they run (and hold the last frame).
const EDGE_CSS = `
.react-flow__edge.ec-cut .react-flow__edge-path{animation:ec-cut 2.1s cubic-bezier(.22,1,.36,1) forwards}
@keyframes ec-cut{0%{stroke:#dc2626;stroke-width:2px;opacity:.9}
18%{stroke:#dc2626;stroke-width:7px;opacity:1;filter:drop-shadow(0 0 6px #ef4444)}
45%{stroke:#dc2626;stroke-width:4px;opacity:.85;stroke-dasharray:6 6}
100%{stroke:#dc2626;stroke-width:1.8px;opacity:.5;stroke-dasharray:5 6}}
.react-flow__edge.ec-gain .react-flow__edge-path{stroke-dasharray:1600;stroke-dashoffset:1600;animation:ec-gain 1.6s cubic-bezier(.22,1,.36,1) .35s forwards}
@keyframes ec-gain{0%{stroke-dashoffset:1600}70%{filter:drop-shadow(0 0 5px #4ade80)}100%{stroke-dashoffset:0;filter:none}}
`;

export function ConnectivityGraph({
  graph,
  selectedPatchId,
  onSelectPatch,
  removedPatchIds = NO_IDS,
  degradedPatchIds = NO_IDS,
  removingPatchIds = NO_IDS,
  edgeMarks = NO_MARKS,
  extraNodes = NO_EXTRA,
  minStrength = 0,
  showCriticalOnly = false,
  className,
}: Props) {
  // Neighbours of the selection stay lit; everything else dims.
  const neighbourIds = useMemo(() => {
    if (!selectedPatchId) return null;
    const set = new Set<string>([selectedPatchId]);
    graph.edges.forEach((e) => {
      if (e.source === selectedPatchId) set.add(e.target);
      if (e.target === selectedPatchId) set.add(e.source);
    });
    return set;
  }, [graph.edges, selectedPatchId]);

  const maxArea = useMemo(() => Math.max(...graph.nodes.map((n) => n.areaHa), 1e-9), [graph.nodes]);
  // overlapping patches are spread apart for legibility (presentation only — see layout.ts)
  const layout = useMemo(
    () => relaxLayout(graph.nodes.map((n) => ({ id: n.id, x: n.position.x, y: n.position.y, r: sizeOf(n.areaHa, maxArea) / 2 }))),
    [graph.nodes, maxArea],
  );

  /*
   * Nodes are created ONCE per graph. Replacing the whole node array on every
   * selection change throws away React Flow's measured handle bounds, and
   * edges are silently skipped while those bounds are missing — which showed
   * up as a graph with nodes but no links. Visual state is pushed into
   * `data` in place instead (see the effect below).
   */
  const baseNodes = useMemo<Node<HabitatNodeData>[]>(
    () =>
      graph.nodes.map((n) => {
        const sizePx = sizeOf(n.areaHa, maxArea);
        const p = layout.pos.get(n.id) ?? n.position;
        return {
          id: n.id,
          type: "habitat",
          position: { x: p.x - sizePx / 2, y: p.y - sizePx / 2 },
          data: {
            label: n.label,
            habitatClass: n.habitatClass,
            areaHa: n.areaHa,
            quality: n.quality,
            connectivity: n.connectivity,
            sensitivity: n.sensitivity,
            importance: n.importance,
            degree: n.degree,
            isHub: n.isHub,
            isCutVertex: !!n.isCutVertex,
            sizePx,
            selected: false,
            removed: false,
            removing: false,
            degraded: false,
            dimmed: false,
          },
        };
      }),
    [graph.nodes, layout, maxArea],
  );

  /** What-if nodes (restoration sites): placed from their centroid, nudged clear of the network. */
  const extra = useMemo<Node<HabitatNodeData>[]>(() => {
    const fixed = graph.nodes.map((n) => ({ ...(layout.pos.get(n.id) ?? n.position), r: sizeOf(n.areaHa, maxArea) / 2 }));
    return extraNodes.map((x) => {
      const sizePx = sizeOf(x.areaHa, maxArea);
      const p = placeExtra(layout.project(x.raw.x, x.raw.y), sizePx / 2, fixed);
      fixed.push({ ...p, r: sizePx / 2 });
      return {
        id: x.id,
        type: "habitat",
        position: { x: p.x - sizePx / 2, y: p.y - sizePx / 2 },
        data: {
          label: x.id, habitatClass: "mangrove", areaHa: x.areaHa, quality: 0, connectivity: 0, sensitivity: "low",
          importance: 0, degree: 0, isHub: false, sizePx, selected: false, removed: false, degraded: false, dimmed: false, candidate: true,
        },
      } satisfies Node<HabitatNodeData>;
    });
  }, [extraNodes, graph.nodes, layout, maxArea]);

  /** Per-node visual state, recomputed as the analyst interacts. */
  const nodeState = useMemo(
    () =>
      new Map(
        graph.nodes.map((n) => [
          n.id,
          {
            selected: n.id === selectedPatchId,
            removed: removedPatchIds.includes(n.id),
            removing: removingPatchIds.includes(n.id),
            degraded: degradedPatchIds.includes(n.id),
            dimmed: !!neighbourIds && !neighbourIds.has(n.id),
          },
        ]),
      ),
    [graph.nodes, selectedPatchId, removedPatchIds, removingPatchIds, degradedPatchIds, neighbourIds],
  );

  const initialEdges = useMemo<Edge[]>(
    () =>
      graph.edges
        .filter((e) => e.strength >= minStrength || !!edgeMarks[pairKey(e.source, e.target)])
        .filter((e) => !showCriticalOnly || e.critical)
        .map((e) => {
          const mark = edgeMarks[pairKey(e.source, e.target)];
          const cutting = removingPatchIds.includes(e.source) || removingPatchIds.includes(e.target);
          const severed =
            mark === "lost" ||
            removedPatchIds.includes(e.source) ||
            removedPatchIds.includes(e.target) ||
            degradedPatchIds.includes(e.source) ||
            degradedPatchIds.includes(e.target);
          const touchesSelection =
            !!neighbourIds && (neighbourIds.has(e.source) && neighbourIds.has(e.target));
          const dimmed = !!neighbourIds && !touchesSelection && !mark && !cutting;
          const gained = mark === "gained";

          return {
            id: e.id,
            source: e.source,
            target: e.target,
            type: "straight",
            className: cutting ? "ec-cut" : gained ? "ec-gain" : undefined,
            animated: !severed && !cutting && !gained && (e.critical || e.strength > 0.55),
            style: {
              stroke: severed ? "#dc2626" : gained ? (e.strength >= 0.5 ? "#16a34a" : "#eab308") : e.critical ? "#f59e0b" : "#1e5f8a",
              strokeWidth: severed ? 1.8 : gained ? 1.6 + e.strength * 3.4 : 1.1 + e.strength * 3.2,
              strokeDasharray: severed ? "5 6" : undefined,
              opacity: dimmed ? 0.12 : severed ? 0.5 : gained ? 0.95 : 0.4 + e.strength * 0.5,
            },
          } satisfies Edge;
        }),
    [graph.edges, minStrength, showCriticalOnly, removedPatchIds, removingPatchIds, degradedPatchIds, neighbourIds, edgeMarks],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(baseNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // The run bundle arrives asynchronously (and can be re-analysed): rebuild the node set whenever the
  // graph itself changes. Selection/dimming changes do NOT go through here (see the effect below).
  useEffect(() => setNodes((cur) => [...baseNodes, ...cur.filter((n) => n.data.candidate)]), [baseNodes, setNodes]);

  // What-if nodes are appended / dropped without touching the measured base nodes.
  useEffect(
    () => setNodes((cur) => [...cur.filter((n) => !n.data.candidate), ...extra]),
    [extra, setNodes],
  );

  // Patch visual state into existing nodes so measured internals survive.
  useEffect(() => {
    setNodes((current) =>
      current.map((n) => {
        const next = nodeState.get(n.id);
        if (!next) return n;
        const d = n.data;
        if (
          d.selected === next.selected &&
          d.removed === next.removed &&
          d.removing === next.removing &&
          d.degraded === next.degraded &&
          d.dimmed === next.dimmed
        ) {
          return n;
        }
        return { ...n, data: { ...d, ...next } };
      }),
    );
  }, [nodeState, setNodes]);

  // Edges carry no measured internals, so replacing them wholesale is safe.
  useEffect(() => setEdges(initialEdges), [initialEdges, setEdges]);

  const onNodeClick = useCallback<NodeMouseHandler>(
    (_, node) => {
      if ((node.data as HabitatNodeData).candidate) return;
      onSelectPatch(node.id === selectedPatchId ? null : node.id);
    },
    [onSelectPatch, selectedPatchId],
  );

  return (
    <div className={className}>
      <style>{EDGE_CSS}</style>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={() => onSelectPatch(null)}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.24 }}
        minZoom={0.25}
        maxZoom={2}
        proOptions={{ hideAttribution: false }}
        className="bg-transparent"
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.3} color="#0f513240" />
        <Controls
          showInteractive={false}
          className="!bottom-4 !left-4 overflow-hidden !rounded-xl !border !border-black/[0.06] !shadow-md"
        />
        <MiniMap
          pannable
          zoomable
          nodeStrokeWidth={3}
          maskColor="rgba(236, 253, 245, 0.65)"
          nodeColor={(n) => {
            const d = n.data as HabitatNodeData;
            return d?.removed ? "#ef4444" : d?.candidate ? "#16a34a" : SENSITIVITY_META[d?.sensitivity ?? "low"].color;
          }}
          style={{ background: "rgba(255,255,255,0.85)" }}
          className="!bottom-4 !right-4 !h-[92px] !w-[132px] overflow-hidden !rounded-xl !border !border-black/[0.06] !shadow-md"
        />
      </ReactFlow>
    </div>
  );
}

/** Colour key shared by the graph page. */
export function GraphLegend() {
  const classes = (["mangrove", "seagrass", "mudflat", "estuary"] as const);
  return (
    <div className="flex items-center gap-x-4 whitespace-nowrap text-[11px] font-medium text-[#334155]">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Ring = importance band</span>
      {(["low", "medium", "high", "critical"] as const).map((b) => (
        <span key={b} className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full border-[3px] bg-white" style={{ borderColor: SENSITIVITY_META[b].color }} />
          {SENSITIVITY_META[b].label}
        </span>
      ))}
      <span className="mx-1 h-4 w-px bg-black/10" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Fill</span>
      {classes.map((c) => (
        <span key={c} className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full" style={{ background: HABITAT_META[c].color }} />
          {HABITAT_META[c].label}
        </span>
      ))}
    </div>
  );
}
