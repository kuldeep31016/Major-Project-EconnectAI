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
import { HABITAT_META, SENSITIVITY_META } from "@/lib/constants";
import type { HabitatGraph } from "@/types";

const nodeTypes = { habitat: HabitatNode };

/*
 * Stable identity for the optional array props. A `= []` default literal would
 * allocate a fresh array on every render, invalidating the memos below and
 * putting the node/edge sync effects into an infinite update loop.
 */
const NO_IDS: string[] = [];

interface Props {
  graph: HabitatGraph;
  selectedPatchId: string | null;
  onSelectPatch: (id: string | null) => void;
  removedPatchIds?: string[];
  degradedPatchIds?: string[];
  /** Only show links above this strength — lets the analyst thin a dense graph. */
  minStrength?: number;
  showCriticalOnly?: boolean;
  className?: string;
}

export function ConnectivityGraph({
  graph,
  selectedPatchId,
  onSelectPatch,
  removedPatchIds = NO_IDS,
  degradedPatchIds = NO_IDS,
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

  /*
   * Nodes are created ONCE per graph. Replacing the whole node array on every
   * selection change throws away React Flow's measured handle bounds, and
   * edges are silently skipped while those bounds are missing — which showed
   * up as a graph with nodes but no links. Visual state is pushed into
   * `data` in place instead (see the effect below).
   */
  const baseNodes = useMemo<Node<HabitatNodeData>[]>(
    () =>
      graph.nodes.map((n) => ({
        id: n.id,
        type: "habitat",
        position: n.position,
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
          selected: false,
          removed: false,
          degraded: false,
          dimmed: false,
        },
      })),
    [graph.nodes],
  );

  /** Per-node visual state, recomputed as the analyst interacts. */
  const nodeState = useMemo(
    () =>
      new Map(
        graph.nodes.map((n) => [
          n.id,
          {
            selected: n.id === selectedPatchId,
            removed: removedPatchIds.includes(n.id),
            degraded: degradedPatchIds.includes(n.id),
            dimmed: !!neighbourIds && !neighbourIds.has(n.id),
          },
        ]),
      ),
    [graph.nodes, selectedPatchId, removedPatchIds, degradedPatchIds, neighbourIds],
  );

  const initialEdges = useMemo<Edge[]>(
    () =>
      graph.edges
        .filter((e) => e.strength >= minStrength)
        .filter((e) => !showCriticalOnly || e.critical)
        .map((e) => {
          const severed =
            removedPatchIds.includes(e.source) ||
            removedPatchIds.includes(e.target) ||
            degradedPatchIds.includes(e.source) ||
            degradedPatchIds.includes(e.target);
          const touchesSelection =
            !!neighbourIds && (neighbourIds.has(e.source) && neighbourIds.has(e.target));
          const dimmed = !!neighbourIds && !touchesSelection;

          return {
            id: e.id,
            source: e.source,
            target: e.target,
            type: "straight",
            animated: !severed && (e.critical || e.strength > 0.55),
            style: {
              stroke: severed ? "#ef4444" : e.critical ? "#f59e0b" : "#1e5f8a",
              strokeWidth: severed ? 1 : 0.9 + e.strength * 3.2,
              strokeDasharray: severed ? "5 5" : undefined,
              opacity: dimmed ? 0.1 : severed ? 0.45 : 0.3 + e.strength * 0.55,
            },
          } satisfies Edge;
        }),
    [graph.edges, minStrength, showCriticalOnly, removedPatchIds, degradedPatchIds, neighbourIds],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(baseNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

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
    (_, node) => onSelectPatch(node.id === selectedPatchId ? null : node.id),
    [onSelectPatch, selectedPatchId],
  );

  return (
    <div className={className}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={() => onSelectPatch(null)}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.22 }}
        minZoom={0.25}
        maxZoom={2}
        proOptions={{ hideAttribution: false }}
        className="bg-transparent"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={26}
          size={1}
          color="#ffffff14"
        />
        <Controls
          showInteractive={false}
          className="!bottom-4 !left-4"
        />
        <MiniMap
          pannable
          zoomable
          nodeStrokeWidth={3}
          maskColor="#05081699"
          nodeColor={(n) => {
            const d = n.data as HabitatNodeData;
            return d?.removed ? "#ef4444" : SENSITIVITY_META[d?.sensitivity ?? "low"].color;
          }}
          className="!bottom-4 !right-4 !h-[92px] !w-[132px]"
        />
      </ReactFlow>
    </div>
  );
}

/** Colour key shared by the graph page. */
export function GraphLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-muted-foreground">
      <span className="font-semibold uppercase tracking-widest">Node ring</span>
      {(["low", "medium", "high", "critical"] as const).map((b) => (
        <span key={b} className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full border-2"
            style={{ borderColor: SENSITIVITY_META[b].color }}
          />
          {SENSITIVITY_META[b].label}
        </span>
      ))}
      <span className="ml-2 font-semibold uppercase tracking-widest">Fill</span>
      {(["mangrove", "seagrass", "mudflat", "estuary"] as const).map((c) => (
        <span key={c} className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: HABITAT_META[c].color }}
          />
          {HABITAT_META[c].label}
        </span>
      ))}
    </div>
  );
}
