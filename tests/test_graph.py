"""Unit tests for the graph layer on tiny graphs whose values can be computed by hand.

These synthetic graphs exist ONLY to test the mathematics.  They are never
reported as experimental results.
"""
import math

import pytest

from ecoconnect.graph import (
    Patch, build_graph, build_edges, haversine_km, edge_weight,
    iic, pc, eca_ha, compute_criticality, spearman, simulate_removal,
    evaluate_candidates, composite_interface_score, explain_patch,
)

A_L = 1000.0  # landscape area, ha


def planar(id_, x, y, area=100.0, q=1.0, **kw):
    return Patch(id=id_, area_ha=area, centroid=(x, y), quality=q, **kw)


# ----------------------------------------------------------------- distances
def test_haversine_known_distance():
    # Kochi (9.9312, 76.2673) -> Thiruvananthapuram (8.5241, 76.9366) ~ 173 km
    d = haversine_km((9.9312, 76.2673), (8.5241, 76.9366))
    assert 170 < d < 176


def test_haversine_zero():
    assert haversine_km((10.0, 76.0), (10.0, 76.0)) == 0.0


# ----------------------------------------------------------------- edges (Eq. 4 / 6)
def test_edges_respect_tau_and_k():
    # a line of 4 patches 1 km apart; tau = 1.5 -> only adjacent links
    ps = [planar(f"p{i}", float(i), 0.0) for i in range(4)]
    edges = build_edges(ps, k=3, tau_km=1.5, distance_mode="euclidean")
    keys = sorted(e.key for e in edges)
    assert keys == [("p0", "p1"), ("p1", "p2"), ("p2", "p3")]
    # k = 1 with large tau: each node links to its single nearest; union gives the chain
    edges_k1 = build_edges(ps, k=1, tau_km=100.0, distance_mode="euclidean")
    assert sorted(e.key for e in edges_k1) == [("p0", "p1"), ("p1", "p2"), ("p2", "p3")]


def test_edge_weight_formula():
    # w = sqrt(q_i q_j) exp(-d/tau)
    assert edge_weight(1.0, 1.0, 0.0, 5.0) == pytest.approx(1.0)
    assert edge_weight(0.25, 1.0, 5.0, 5.0) == pytest.approx(0.5 * math.exp(-1))
    assert edge_weight(0.0, 1.0, 1.0, 5.0) == 0.0


def test_no_edge_beyond_tau():
    ps = [planar("a", 0, 0), planar("b", 10, 0)]
    g = build_graph(ps, k=3, tau_km=5.0, distance_mode="euclidean")
    assert g.n_edges == 0 and g.n_components() == 2


# ----------------------------------------------------------------- IIC (hand computed)
def test_iic_single_patch():
    g = build_graph([planar("a", 0, 0, area=100)], k=3, tau_km=5, distance_mode="euclidean")
    # IIC = a^2 / A_L^2
    assert iic(g, A_L) == pytest.approx(100 ** 2 / A_L ** 2)


def test_iic_two_connected_vs_disconnected():
    a, b = 100.0, 200.0
    conn = build_graph([planar("a", 0, 0, a), planar("b", 1, 0, b)], k=3, tau_km=5, distance_mode="euclidean")
    disc = build_graph([planar("a", 0, 0, a), planar("b", 50, 0, b)], k=3, tau_km=5, distance_mode="euclidean")
    # connected: a^2 + b^2 + 2ab/(1+1)
    assert iic(conn, A_L) == pytest.approx((a * a + b * b + 2 * a * b / 2) / A_L ** 2)
    # disconnected: a^2 + b^2
    assert iic(disc, A_L) == pytest.approx((a * a + b * b) / A_L ** 2)
    assert iic(conn, A_L) > iic(disc, A_L)


def test_iic_chain_of_three():
    # a - b - c, all area 100; nl(a,c) = 2
    ps = [planar("a", 0, 0), planar("b", 1, 0), planar("c", 2, 0)]
    g = build_graph(ps, k=1, tau_km=1.5, distance_mode="euclidean")
    assert g.n_edges == 2
    a = 100.0
    expected = (3 * a * a                      # self pairs
                + 2 * (a * a / 2) * 2          # (a,b),(b,c) both directions
                + 2 * (a * a / 3)) / A_L ** 2  # (a,c) both directions
    assert iic(g, A_L) == pytest.approx(expected)


# ----------------------------------------------------------------- PC / ECA
def test_pc_direct_probability_half_at_tau():
    ps = [planar("a", 0, 0), planar("b", 5, 0)]  # d = tau = 5 -> p = 0.5
    g = build_graph(ps, k=3, tau_km=5.0, distance_mode="euclidean")
    a = 100.0
    expected = (2 * a * a + 2 * a * a * 0.5) / A_L ** 2
    assert pc(g, A_L) == pytest.approx(expected)


def test_pc_uses_max_product_path():
    # a-b-c on a line 4 km apart; direct a->c p=exp(-alpha*8), via b p=exp(-alpha*4)^2 = same.
    # Make the path strictly better by bending: a(0,0) b(3,0) c(3,3) -> direct d=4.243, via b d=6
    # so direct wins; PC must still equal direct probability for that pair (max of the two).
    ps = [planar("a", 0, 0), planar("b", 3, 0), planar("c", 3, 3)]
    g = build_graph(ps, k=3, tau_km=5.0, distance_mode="euclidean")
    alpha = math.log(2) / 5.0
    a = 100.0
    dab, dbc, dac = 3.0, 3.0, math.hypot(3, 3)
    p_ab, p_bc, p_ac = (math.exp(-alpha * d) for d in (dab, dbc, dac))
    p_ac_star = max(p_ac, p_ab * p_bc)
    expected = (3 * a * a + 2 * a * a * (p_ab + p_bc + p_ac_star)) / A_L ** 2
    assert pc(g, A_L) == pytest.approx(expected)


def test_eca():
    assert eca_ha(0.25, 1000.0) == pytest.approx(500.0)


# ----------------------------------------------------------------- criticality (Eq. 8-9)
def test_bridge_patch_is_most_critical_despite_smallest_area():
    # Two big clusters joined only through a small bridge patch 'm'.
    # Under IIC a patch's removal also deletes its own a_i^2 term, so a small
    # bridge only dominates when the clusters it joins are large enough:
    # cross-cluster pairs lost = 2 * 4 * 4 * (300*300)/(1+2) = 960 000
    # vs. a large patch: 90 000 (self) + 270 000 (3 intra pairs) + 240 000 (4 cross) = 600 000.
    ps = [planar(f"a{i}", 0, float(i) * 0.5, 300) for i in range(4)] + [
        planar("m", 2, 0.75, 20),                                     # small bridge
    ] + [planar(f"b{i}", 4, float(i) * 0.5, 300) for i in range(4)]
    g = build_graph(ps, k=4, tau_km=2.2, distance_mode="euclidean")
    assert g.is_cut_vertex("m")
    rows, c_base = compute_criticality(g, A_L, "iic")
    assert rows[0].patch_id == "m"
    assert rows[0].is_cut_vertex
    assert rows[0].component_count_after == 2 and rows[0].component_count_before == 1
    assert rows[0].rank_by_area == 9           # smallest by area, most critical
    # S_i = (C - C_-i) / C computed exactly
    from ecoconnect.graph import iic as _iic
    s_manual = (c_base - _iic(g.without("m"), A_L)) / c_base
    assert rows[0].criticality_score == pytest.approx(s_manual)
    assert all(0.0 <= r.criticality_score <= 1.0 for r in rows)


def test_isolated_patch_delta_equals_own_area_term():
    ps = [planar("a", 0, 0, 100), planar("z", 100, 100, 50)]
    g = build_graph(ps, k=3, tau_km=5, distance_mode="euclidean")
    rows, c_base = compute_criticality(g, A_L, "iic")
    z = next(r for r in rows if r.patch_id == "z")
    assert z.delta_connectivity == pytest.approx(50 ** 2 / A_L ** 2)
    assert z.degree == 0


def test_spearman():
    assert spearman([1, 2, 3, 4], [1, 2, 3, 4]) == pytest.approx(1.0)
    assert spearman([1, 2, 3, 4], [4, 3, 2, 1]) == pytest.approx(-1.0)


# ----------------------------------------------------------------- what-if (Eq. 10)
def test_what_if_matches_criticality_for_single_patch():
    ps = [planar("a", 0, 0), planar("b", 1, 0), planar("c", 2, 0), planar("d", 3, 0)]
    g = build_graph(ps, k=1, tau_km=1.5, distance_mode="euclidean")
    rows, _ = compute_criticality(g, A_L)
    row_b = next(r for r in rows if r.patch_id == "b")
    res = simulate_removal(g, ["b"], A_L, include_interface_score=False)
    assert res.delta_connectivity == pytest.approx(row_b.delta_connectivity)
    assert res.loss_fraction == pytest.approx(row_b.criticality_score)
    assert res.components_before == 1 and res.components_after == 2
    assert sorted(e["source"] + e["target"] for e in res.severed_edges) == ["ab", "bc"]
    assert res.newly_isolated_patch_ids == ["a"]
    assert res.affected_patch_ids == ["a", "c"]


def test_what_if_multiple_and_unknown_ids():
    ps = [planar("a", 0, 0), planar("b", 1, 0), planar("c", 2, 0)]
    g = build_graph(ps, k=1, tau_km=1.5, distance_mode="euclidean")
    res = simulate_removal(g, ["a", "c", "nope"], A_L, include_interface_score=False)
    assert res.removed_patch_ids == ["a", "c"]
    assert res.notes and "nope" in res.notes[0]
    assert res.c_after == pytest.approx(100 ** 2 / A_L ** 2)


# ----------------------------------------------------------------- restoration (Eq. 11-12)
def test_restoration_gain_and_cost_ranking():
    ps = [planar("a", 0, 0, 300), planar("b", 6, 0, 300)]           # disconnected at tau=5
    g = build_graph(ps, k=3, tau_km=5.0, distance_mode="euclidean")
    assert g.n_edges == 0
    bridge = planar("c_bridge", 3, 0, 20)      # links a and b
    far = planar("c_far", 30, 30, 200)         # links nothing
    rows, c_base = evaluate_candidates(g, [far, bridge], A_L)
    assert rows[0].candidate_id == "c_bridge" and rows[0].new_links == 2
    assert rows[0].components_after == 1
    assert rows[0].ranking_basis == "raw_gain" and rows[0].cost is None
    # R_i must equal C(G+v) - C(G) exactly
    assert rows[0].connectivity_gain == pytest.approx(iic(g.with_patch(bridge), A_L) - c_base)
    # with costs: cheap 'far' patch can outrank if its gain/cost is higher
    rows_c, _ = evaluate_candidates(g, [far, bridge], A_L, costs={"c_far": 1.0, "c_bridge": 1e6}, cost_unit="unit")
    assert rows_c[0].ranking_basis == "gain_per_cost"
    assert rows_c[0].candidate_id == "c_far"


def test_partial_costs_fall_back_to_raw_gain():
    ps = [planar("a", 0, 0, 300), planar("b", 6, 0, 300)]
    g = build_graph(ps, k=3, tau_km=5.0, distance_mode="euclidean")
    rows, _ = evaluate_candidates(g, [planar("x", 3, 0, 20), planar("y", 3, 1, 20)], A_L, costs={"x": 5.0})
    assert all(r.ranking_basis == "raw_gain" and r.cost is None for r in rows)


# ----------------------------------------------------------------- interface score / explanation
def test_composite_score_bounds_and_weights():
    ps = [planar("a", 0, 0, 300, protected=True), planar("b", 1, 0, 300)]
    g = build_graph(ps, k=3, tau_km=5.0, distance_mode="euclidean")
    out = composite_interface_score(g, A_L)
    assert 0 <= out["score"] <= 100
    assert out["components"]["protection"] == pytest.approx(0.5)
    with pytest.raises(ValueError):
        composite_interface_score(g, A_L, weights={"structural": 0.5, "functional": 0.6,
                                                   "quality": 0, "redundancy": 0, "protection": 0})


def test_explanation_uses_computed_evidence():
    ps = [planar("a1", 0, 0, 300), planar("m", 2, 0, 20), planar("b1", 4, 0, 300)]
    g = build_graph(ps, k=2, tau_km=2.5, distance_mode="euclidean")
    rows, _ = compute_criticality(g, A_L)
    row_m = next(r for r in rows if r.patch_id == "m")
    ex = explain_patch(row_m, g)
    assert ex.patch_id == "m"
    assert "cut vertex" in ex.text
    assert f"{row_m.delta_pct:.1f}%" in ex.text
    assert f"#{row_m.rank} of 3" in ex.text
    assert ex.evidence["degree"] == 2 and ex.evidence["is_cut_vertex"] is True
