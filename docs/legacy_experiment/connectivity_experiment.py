#!/usr/bin/env python3
"""
EcoConnectAI -- connectivity, criticality and restoration experiment.

Input : patch sets (area, centroid, quality) for four coastal landscapes.
Method: graph built per Section IV-D (k nearest neighbours, d <= tau);
        C(G) evaluated with the Integral Index of Connectivity (IIC) and the
        Probability of Connectivity (PC); per-patch criticality S_i per Eq. (9);
        restoration gain R_i per Eq. (11) by node addition and recomputation.
Output: results.json  (all numbers reported in Section VI of the paper)

Run:  python3 connectivity_experiment.py
"""
import json, math, os, itertools
from collections import deque

DATA = os.path.expanduser("~/ecoconnect-ai/mock-data")
TAU_KM = 5.0          # dispersal threshold (Sec. IV-D); p(tau) = 0.5 for PC
KNN = 3               # k nearest neighbours (Sec. IV-D)

# ---------------------------------------------------------------- helpers
def haversine(a, b):
    R = 6371.0088
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2-la1)/2)**2 + math.cos(la1)*math.cos(la2)*math.sin((lo2-lo1)/2)**2
    return 2*R*math.asin(math.sqrt(h))

def build_edges(ids, cen, tau=TAU_KM, knn=KNN):
    """k nearest neighbours subject to d <= tau, undirected (union)."""
    E = set()
    for i in ids:
        cand = sorted(((haversine(cen[i], cen[j]), j) for j in ids if j != i))
        for d, j in cand[:knn]:
            if d <= tau:
                E.add((i, j) if i < j else (j, i))
    return E

def adjacency(ids, E):
    adj = {i: set() for i in ids}
    for u, v in E:
        if u in adj and v in adj:
            adj[u].add(v); adj[v].add(u)
    return adj

def topo_dist(adj, src):
    """BFS link count; unreachable -> inf."""
    dist = {src: 0}; q = deque([src])
    while q:
        u = q.popleft()
        for v in adj[u]:
            if v not in dist:
                dist[v] = dist[u] + 1; q.append(v)
    return dist

def IIC(ids, area, adj, A_L):
    """Pascual-Hortal & Saura (2006). Sum a_i a_j / (1 + nl_ij) over all pairs."""
    tot = 0.0
    for i in ids:
        d = topo_dist(adj, i)
        for j in ids:
            if j in d:
                tot += area[i]*area[j]/(1.0 + d[j])
    return tot/(A_L**2)

def PC(ids, area, cen, A_L, tau=TAU_KM):
    """Saura & Pascual-Hortal (2007). Max product probability path,
    p_ij = exp(-alpha d_ij) with p(tau) = 0.5."""
    alpha = math.log(2.0)/tau
    idx = {k: n for n, k in enumerate(ids)}
    n = len(ids)
    p = [[0.0]*n for _ in range(n)]
    for i in ids:
        for j in ids:
            p[idx[i]][idx[j]] = 1.0 if i == j else math.exp(-alpha*haversine(cen[i], cen[j]))
    # max-product transitive closure (Floyd-Warshall variant)
    for k in range(n):
        for i in range(n):
            pik = p[i][k]
            if pik == 0.0: continue
            for j in range(n):
                v = pik*p[k][j]
                if v > p[i][j]: p[i][j] = v
    tot = sum(area[i]*area[j]*p[idx[i]][idx[j]] for i in ids for j in ids)
    return tot/(A_L**2)

def components(ids, adj):
    seen, comps = set(), 0
    for i in ids:
        if i not in seen:
            comps += 1; seen |= set(topo_dist(adj, i).keys())
    return comps

def spearman(x, y):
    def rank(v):
        order = sorted(range(len(v)), key=lambda i: v[i])
        r = [0.0]*len(v)
        i = 0
        while i < len(order):
            j = i
            while j+1 < len(order) and v[order[j+1]] == v[order[i]]: j += 1
            avg = (i+j)/2.0 + 1
            for k in range(i, j+1): r[order[k]] = avg
            i = j+1
        return r
    rx, ry = rank(x), rank(y)
    n = len(x)
    mx, my = sum(rx)/n, sum(ry)/n
    num = sum((a-mx)*(b-my) for a, b in zip(rx, ry))
    den = math.sqrt(sum((a-mx)**2 for a in rx)*sum((b-my)**2 for b in ry))
    return num/den if den else float("nan")

# ---------------------------------------------------------------- analysis
masks  = json.load(open(f"{DATA}/habitat-mask.json"))
scenes = {s["id"]: s for s in json.load(open(f"{DATA}/satellite-images.json"))["scenes"]}
recs   = json.load(open(f"{DATA}/recommendations.json"))

out = {"parameters": {"tau_km": TAU_KM, "knn": KNN,
                      "C_of_G": "IIC (Pascual-Hortal & Saura 2006)",
                      "PC_p_at_tau": 0.5}, "landscapes": {}}

for sid, mask in masks.items():
    patches = mask["patches"]
    ids  = [p["id"] for p in patches]
    area = {p["id"]: p["areaHa"] for p in patches}
    cen  = {p["id"]: p["center"] for p in patches}
    name = {p["id"]: p["name"] for p in patches}
    A_L  = scenes[sid]["areaKm2"]*100.0          # scene footprint, hectares
    A_H  = sum(area.values())

    E   = build_edges(ids, cen)
    adj = adjacency(ids, E)
    iic_base = IIC(ids, area, adj, A_L)
    pc_base  = PC(ids, area, cen, A_L)
    eca_base = math.sqrt(pc_base)*A_L

    # ---- per-patch criticality: remove node, recompute (Eq. 8, 9)
    rows = []
    for i in ids:
        keep = [j for j in ids if j != i]
        E2   = {(u, v) for (u, v) in E if u != i and v != i}
        adj2 = adjacency(keep, E2)
        iic_i = IIC(keep, area, adj2, A_L)
        dC = iic_base - iic_i
        rows.append({
            "id": i, "name": name[i], "areaHa": area[i],
            "areaPct": 100.0*area[i]/A_H,
            "degree": len(adj[i]),
            "deltaC": dC, "S": dC/iic_base,
            "dIIC_pct": 100.0*dC/iic_base,
            "componentsAfter": components(keep, adj2),
        })
    rows.sort(key=lambda r: -r["S"])
    for n, r in enumerate(rows, 1): r["rank"] = n

    # area-only ranking, for the baseline comparison (Sec. VI-E)
    by_area = sorted(rows, key=lambda r: -r["areaHa"])
    for n, r in enumerate(by_area, 1): r["rankByArea"] = n
    rho = spearman([r["areaHa"] for r in rows], [r["S"] for r in rows])

    # ---- restoration gain: add candidate node, recompute (Eq. 11, 12)
    rest = []
    for a in recs.get(sid, {}).get("actions", []):
        cid = "cand-" + a["id"]
        ids2  = ids + [cid]
        area2 = dict(area); area2[cid] = a["areaHa"]
        cen2  = dict(cen);  cen2[cid]  = a["center"]
        near  = sorted(((haversine(cen2[cid], cen2[j]), j) for j in ids))[:KNN]
        E2    = set(E) | {(cid, j) if cid < j else (j, cid) for d, j in near if d <= TAU_KM}
        adj2  = adjacency(ids2, E2)
        iic_p = IIC(ids2, area2, adj2, A_L)
        R = iic_p - iic_base
        rest.append({
            "id": a["id"], "site": a["location"], "areaHa": a["areaHa"],
            "intervention": a["interventionType"], "costLakh": a["costLakh"],
            "R": R, "gainPct": 100.0*R/iic_base,
            "priority": (100.0*R/iic_base)/a["costLakh"],
            "newLinks": len(E2) - len(E),
        })
    rest.sort(key=lambda r: -r["priority"])
    for n, r in enumerate(rest, 1): r["rank"] = n

    out["landscapes"][sid] = {
        "name": scenes[sid]["name"], "region": scenes[sid]["region"],
        "patches": len(ids), "edges": len(E), "components": components(ids, adj),
        "habitatAreaHa": A_H, "landscapeAreaHa": A_L,
        "IIC": iic_base, "PC": pc_base, "ECA_ha": eca_base,
        "ECA_pct_of_habitat": 100.0*eca_base/A_H,
        "meanDegree": 2.0*len(E)/len(ids),
        "spearman_area_vs_S": rho,
        "sensitivity": rows, "restoration": rest,
    }

# ---- tau robustness check on the criticality ranking (Kerala)
rob = {}
sid = "kerala-coast"
patches = masks[sid]["patches"]
ids  = [p["id"] for p in patches]
area = {p["id"]: p["areaHa"] for p in patches}
cen  = {p["id"]: p["center"] for p in patches}
A_L  = scenes[sid]["areaKm2"]*100.0
base_rank = {r["id"]: r["rank"] for r in out["landscapes"][sid]["sensitivity"]}
for tau in (3.0, 5.0, 8.0):
    E = build_edges(ids, cen, tau=tau); adj = adjacency(ids, E)
    ib = IIC(ids, area, adj, A_L)
    sc = []
    for i in ids:
        keep = [j for j in ids if j != i]
        E2 = {(u, v) for (u, v) in E if u != i and v != i}
        sc.append((i, (ib - IIC(keep, area, adjacency(keep, E2), A_L))/ib))
    sc.sort(key=lambda t: -t[1])
    order = {i: n for n, (i, _) in enumerate(sc, 1)}
    rob[f"tau_{tau:g}km"] = {
        "edges": len(E),
        "top5": [i for i, _ in sc[:5]],
        "spearman_vs_tau5": spearman([base_rank[i] for i in ids], [order[i] for i in ids]),
    }
out["tau_robustness_kerala"] = rob

here = os.path.dirname(os.path.abspath(__file__))
json.dump(out, open(os.path.join(here, "results.json"), "w"), indent=1)
print("wrote results.json")
for sid, L in out["landscapes"].items():
    print(f"\n{L['name']}  patches={L['patches']} edges={L['edges']} comp={L['components']}")
    print(f"  IIC={L['IIC']:.5f}  PC={L['PC']:.5f}  ECA={L['ECA_ha']:.0f} ha "
          f"({L['ECA_pct_of_habitat']:.1f}% of habitat)  rho(area,S)={L['spearman_area_vs_S']:.3f}")
    for r in L["sensitivity"][:4]:
        print(f"   #{r['rank']} {r['name'][:28]:<28} A={r['areaHa']:7.1f}ha "
              f"({r['areaPct']:4.1f}%) deg={r['degree']} S={r['S']:.4f} "
              f"dIIC={r['dIIC_pct']:5.2f}% areaRank={r['rankByArea']}")
    for r in L["restoration"][:3]:
        print(f"   R#{r['rank']} {r['site'][:26]:<26} A={r['areaHa']:5.1f}ha "
              f"cost={r['costLakh']:6.1f}L gain={r['gainPct']:5.2f}% prio={r['priority']:.4f}")
print("\ntau robustness (Kerala):", json.dumps(out["tau_robustness_kerala"], indent=1))
