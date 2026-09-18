"""Graph construction  G = (V, E)   (paper Section IV-B, Eqs. 3-6).

* V  = habitat patches
* E  = k-nearest-neighbour links subject to d_ij <= tau        (Eq. 4 with k-NN sparsification)
* w_ij = sqrt(q_i q_j) * exp(-d_ij / tau)                        (Eq. 6)

Distance d_ij is centroid-to-centroid.  In the default ``"haversine"`` mode the
centroids are (lat, lon) and d_ij is the great-circle distance in km (identical
to the offline experiment behind the paper's tables).  In ``"euclidean"`` mode
centroids are planar (x, y) already expressed in km.

Every parameter (k, tau, distance mode) is an explicit argument; nothing is
hard-coded.  Defaults come from ``configs/graph.yaml`` at the call site.
"""
from __future__ import annotations

import math
from collections import deque
from typing import Iterable, Literal, Optional

from .types import Edge, Patch

DistanceMode = Literal["haversine", "euclidean"]

EARTH_RADIUS_KM = 6371.0088


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    """Great-circle distance between two (lat, lon) points in kilometres."""
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(h))


def euclidean_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def distance_fn(mode: DistanceMode):
    if mode == "haversine":
        return haversine_km
    if mode == "euclidean":
        return euclidean_km
    raise ValueError(f"unknown distance mode {mode!r}")


def edge_weight(q_i: float, q_j: float, d_km: float, tau_km: float) -> float:
    """Eq. (6):  w_ij = q_ij * exp(-d_ij / tau),  q_ij = sqrt(q_i q_j)."""
    return math.sqrt(max(q_i, 0.0) * max(q_j, 0.0)) * math.exp(-d_km / tau_km)


class HabitatGraph:
    """Undirected weighted graph over habitat patches.

    The object is immutable in spirit: ``without(patch_id)`` and
    ``with_patch(patch)`` return *new* graphs, which is what leave-one-out
    criticality (Eq. 8) and restoration gain (Eq. 11) need.
    """

    def __init__(
        self,
        patches: Iterable[Patch],
        edges: Iterable[Edge],
        *,
        k: int,
        tau_km: float,
        distance_mode: DistanceMode = "haversine",
    ) -> None:
        self.patches: dict[str, Patch] = {p.id: p for p in patches}
        self.k = k
        self.tau_km = tau_km
        self.distance_mode: DistanceMode = distance_mode
        self.edges: dict[tuple[str, str], Edge] = {}
        for e in edges:
            if e.source in self.patches and e.target in self.patches:
                self.edges[e.key] = e
        self.adj: dict[str, set[str]] = {pid: set() for pid in self.patches}
        for (u, v) in self.edges:
            self.adj[u].add(v)
            self.adj[v].add(u)

    # ------------------------------------------------------------ basics
    @property
    def node_ids(self) -> list[str]:
        return list(self.patches.keys())

    @property
    def n_nodes(self) -> int:
        return len(self.patches)

    @property
    def n_edges(self) -> int:
        return len(self.edges)

    def degree(self, pid: str) -> int:
        return len(self.adj[pid])

    def habitat_area_ha(self) -> float:
        return sum(p.area_ha for p in self.patches.values())

    def distance(self, a: str, b: str) -> float:
        return distance_fn(self.distance_mode)(self.patches[a].centroid, self.patches[b].centroid)

    def neighbours(self, pid: str) -> list[tuple[str, float, float]]:
        """(neighbour_id, distance_km, weight) sorted by distance."""
        out = []
        for nb in self.adj[pid]:
            e = self.edges[(pid, nb) if pid < nb else (nb, pid)]
            out.append((nb, e.distance_km, e.weight))
        return sorted(out, key=lambda t: t[1])

    # ------------------------------------------------------------ topology
    def topological_distances(self, src: str) -> dict[str, int]:
        """BFS link counts from ``src`` (nl_ij in IIC); unreachable nodes absent."""
        dist = {src: 0}
        q: deque[str] = deque([src])
        while q:
            u = q.popleft()
            for v in self.adj[u]:
                if v not in dist:
                    dist[v] = dist[u] + 1
                    q.append(v)
        return dist

    def components(self) -> list[set[str]]:
        seen: set[str] = set()
        comps: list[set[str]] = []
        for pid in self.patches:
            if pid in seen:
                continue
            comp = set(self.topological_distances(pid).keys())
            seen |= comp
            comps.append(comp)
        return comps

    def n_components(self) -> int:
        return len(self.components())

    def largest_component_area_ha(self) -> float:
        return max((sum(self.patches[p].area_ha for p in c) for c in self.components()), default=0.0)

    def is_cut_vertex(self, pid: str) -> bool:
        """True if deleting ``pid`` increases the component count (articulation point)."""
        return self.without(pid).n_components() > self.n_components()

    def is_bridge_edge(self, u: str, v: str) -> bool:
        g = HabitatGraph(
            self.patches.values(),
            [e for key, e in self.edges.items() if key != ((u, v) if u < v else (v, u))],
            k=self.k, tau_km=self.tau_km, distance_mode=self.distance_mode,
        )
        return g.n_components() > self.n_components()

    # ------------------------------------------------------------ derivations
    def without(self, *patch_ids: str) -> "HabitatGraph":
        """G - v_i  (delete node(s) and incident edges).  Eq. (8)."""
        drop = set(patch_ids)
        return HabitatGraph(
            (p for pid, p in self.patches.items() if pid not in drop),
            (e for e in self.edges.values() if e.source not in drop and e.target not in drop),
            k=self.k, tau_km=self.tau_km, distance_mode=self.distance_mode,
        )

    def with_patch(self, patch: Patch, *, rebuild: bool = False) -> "HabitatGraph":
        """G + v_i  (Eq. 11).

        ``rebuild=False`` (default, matches the offline experiment): the new
        node links to its k nearest existing patches within tau; existing edges
        are untouched.  ``rebuild=True`` re-runs the full k-NN rule over all
        nodes, which can also rewire existing patches.
        """
        patches = list(self.patches.values()) + [patch]
        if rebuild:
            return build_graph(patches, k=self.k, tau_km=self.tau_km, distance_mode=self.distance_mode)
        dist = distance_fn(self.distance_mode)
        cand = sorted((dist(patch.centroid, p.centroid), p.id) for p in self.patches.values())
        new_edges = [
            Edge(patch.id, j, d, edge_weight(patch.quality, self.patches[j].quality, d, self.tau_km))
            for d, j in cand[: self.k] if d <= self.tau_km
        ]
        return HabitatGraph(
            patches, list(self.edges.values()) + new_edges,
            k=self.k, tau_km=self.tau_km, distance_mode=self.distance_mode,
        )

    # ------------------------------------------------------------ export
    def to_dict(self) -> dict:
        return {
            "parameters": {"k": self.k, "tau_km": self.tau_km, "distance_mode": self.distance_mode,
                           "edge_weight": "w_ij = sqrt(q_i*q_j) * exp(-d_ij/tau)  [paper Eq. 6]"},
            "nodes": [
                {**p.to_dict(), "degree": self.degree(p.id)} for p in self.patches.values()
            ],
            "edges": [e.to_dict() for e in self.edges.values()],
            "n_components": self.n_components(),
        }


def build_edges(
    patches: list[Patch],
    *,
    k: int,
    tau_km: float,
    distance_mode: DistanceMode = "haversine",
) -> list[Edge]:
    """k nearest neighbours subject to d_ij <= tau, symmetrised by union.

    Identical rule to the offline experiment (``build_edges`` there), plus the
    Eq. (6) weight on each edge.
    """
    dist = distance_fn(distance_mode)
    by_id = {p.id: p for p in patches}
    edges: dict[tuple[str, str], Edge] = {}
    for p in patches:
        cand = sorted((dist(p.centroid, q.centroid), q.id) for q in patches if q.id != p.id)
        for d, j in cand[:k]:
            if d <= tau_km:
                key = (p.id, j) if p.id < j else (j, p.id)
                if key not in edges:
                    edges[key] = Edge(key[0], key[1], d, edge_weight(p.quality, by_id[j].quality, d, tau_km))
    return list(edges.values())


def build_graph(
    patches: list[Patch],
    *,
    k: int,
    tau_km: float,
    distance_mode: DistanceMode = "haversine",
) -> HabitatGraph:
    """Convenience: patches -> HabitatGraph under the paper's k-NN / tau rule."""
    return HabitatGraph(
        patches,
        build_edges(patches, k=k, tau_km=tau_km, distance_mode=distance_mode),
        k=k, tau_km=tau_km, distance_mode=distance_mode,
    )
