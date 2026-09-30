"""Patch tracking between two runs (model-estimated change, never "confirmed loss").

Patch ids are assigned per run (by area), so identity across runs must come from geometry. Two patches are linked
when their polygons overlap by at least ``min_overlap`` of the SMALLER polygon's area (areas in an equal-area
projection, EPSG:6933). The links form a bipartite graph between run A and run B patches; each connected group is
classified:

    1 A ↔ 0 B      disappeared           0 A ↔ 1 B       new
    1 A ↔ 1 B      stable | grown | shrunk (area change beyond ±``area_tol``)
    1 A ↔ n B      split                 n A ↔ 1 B       merged
    n A ↔ m B      reorganised (both split and merge in one group)

A comparison is only "comparable" when both runs used the same model checkpoint and threshold; otherwise the
differences mix model differences with landscape change and the result says so.
"""
from __future__ import annotations

from collections import defaultdict
from typing import Optional

from pyproj import Transformer
from shapely.geometry import shape
from shapely.ops import transform

_TO_EQUAL_AREA = Transformer.from_crs("EPSG:4326", "EPSG:6933", always_xy=True).transform


def _polys(fc: dict) -> dict:
    out = {}
    for f in fc["features"]:
        g = shape(f["geometry"])
        if not g.is_valid:
            g = g.buffer(0)
        out[f["properties"]["id"]] = transform(_TO_EQUAL_AREA, g)
    return out


def _model_key(path: Optional[str]) -> Optional[str]:
    """Checkpoint identity independent of where the run was produced: older manifests store repo-relative paths,
    newer ones absolute paths - compare the part from 'outputs/' onwards (else the last two components)."""
    if not path:
        return None
    parts = str(path).replace("\\", "/").split("/")
    return "/".join(parts[parts.index("outputs"):]) if "outputs" in parts else "/".join(parts[-2:])


def comparability(manifest_a: dict, manifest_b: dict) -> dict:
    da, db = manifest_a.get("data_source", {}), manifest_b.get("data_source", {})
    reasons = []
    if _model_key(da.get("model")) != _model_key(db.get("model")):
        reasons.append("different model checkpoints")
    if da.get("threshold") != db.get("threshold"):
        reasons.append(f"different thresholds ({da.get('threshold')} vs {db.get('threshold')})")
    if da.get("mmu_ha") != db.get("mmu_ha"):
        reasons.append("different minimum patch size")
    return {"comparable": not reasons, "reasons": reasons,
            "note": ("Same model, threshold and patch rules: differences are model-estimated change."
                     if not reasons else "Not like-for-like (" + "; ".join(reasons) + "): differences mix model/setting "
                     "differences with landscape change and must not be read as habitat change.")}


def track_patches(fc_a: dict, fc_b: dict, min_overlap: float = 0.1, area_tol: float = 0.10) -> dict:
    pa, pb = _polys(fc_a), _polys(fc_b)
    links: list[tuple[str, str, float]] = []
    for ia, ga in pa.items():
        for ib, gb in pb.items():
            if not ga.envelope.intersects(gb.envelope):
                continue
            inter = ga.intersection(gb).area
            if inter > 0 and inter / min(ga.area, gb.area) >= min_overlap:
                links.append((ia, ib, inter / 1e4))

    # connected groups of the bipartite overlap graph (union-find over "A:id" / "B:id")
    parent: dict[str, str] = {}

    def find(x: str) -> str:
        parent.setdefault(x, x)
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for k in [f"A:{i}" for i in pa] + [f"B:{i}" for i in pb]:
        find(k)
    for ia, ib, _ in links:
        parent[find(f"A:{ia}")] = find(f"B:{ib}")
    groups: dict[str, list[str]] = defaultdict(list)
    for k in parent:
        groups[find(k)].append(k)

    ha = lambda g: g.area / 1e4  # noqa: E731  m² -> ha
    events = []
    for members in groups.values():
        a_ids = sorted(m[2:] for m in members if m.startswith("A:"))
        b_ids = sorted(m[2:] for m in members if m.startswith("B:"))
        area_a = sum(ha(pa[i]) for i in a_ids)
        area_b = sum(ha(pb[i]) for i in b_ids)
        if not b_ids:
            kind = "disappeared"
        elif not a_ids:
            kind = "new"
        elif len(a_ids) == 1 and len(b_ids) == 1:
            ch = (area_b - area_a) / area_a if area_a else 0.0
            kind = "stable" if abs(ch) <= area_tol else ("grown" if ch > 0 else "shrunk")
        elif len(a_ids) == 1:
            kind = "split"
        elif len(b_ids) == 1:
            kind = "merged"
        else:
            kind = "reorganised"
        events.append({"type": kind, "patches_a": a_ids, "patches_b": b_ids, "area_a_ha": round(area_a, 2),
                       "area_b_ha": round(area_b, 2), "area_change_ha": round(area_b - area_a, 2)})

    order = {"disappeared": 0, "split": 1, "merged": 2, "reorganised": 3, "shrunk": 4, "grown": 5, "new": 6, "stable": 7}
    events.sort(key=lambda e: (order[e["type"]], -abs(e["area_change_ha"])))
    counts = defaultdict(int)
    for e in events:
        counts[e["type"]] += 1
    return {"events": events, "counts": dict(counts), "links": [{"a": a, "b": b, "overlap_ha": round(o, 2)} for a, b, o in links],
            "rule": {"min_overlap_of_smaller": min_overlap, "area_tolerance": area_tol, "projection": "EPSG:6933 (equal area)"}}


def summarise(tracking: dict, comp: Optional[dict] = None) -> str:
    c = tracking["counts"]
    parts = [f"{c[k]} {k}" for k in ("stable", "grown", "shrunk", "split", "merged", "reorganised", "disappeared", "new") if c.get(k)]
    txt = "Patch tracking (polygon overlap): " + (", ".join(parts) or "no patches") + "."
    if comp is not None:
        txt += " " + comp["note"]
    return txt
