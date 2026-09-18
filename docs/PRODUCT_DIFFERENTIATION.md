# Product differentiation — documented capability comparison

**Purpose:** decide what EcoConnectAI may honestly claim. Descriptions below summarise each system's publicly
documented capabilities as understood on 2026-09-19; they are *not* independent evaluations and should be
re-verified against the systems' current documentation before any external claim is made. No claim of "no
existing system does this" is made anywhere in this repository.

| Capability | Global Mangrove Watch (platform + data) | Indian government GIS / forestry portals (e.g. ISRO Bhuvan, FSI India State of Forest Report/GIS, e-Green Watch) | Forest / conservation decision-support systems (e.g. Global Forest Watch; Marxan / Zonation prioritisation; Conefor / Circuitscape connectivity tools) | Mangrove monitoring platforms (GMW alerts, national mangrove atlases) | Restoration planning platforms (e.g. Restor, Mangrove Restoration Tracker Tool) | **EcoConnectAI (proposed)** |
|---|---|---|---|---|---|---|
| What it does | Global mangrove extent maps 1996–2020, change and alert layers | National land-cover/forest cover mapping, thematic layers, plantation monitoring | Deforestation alerts and dashboards; site-selection optimisation; graph/circuit connectivity analysis | Mangrove extent/change viewing and alerting | Restoration site registration, monitoring, ecological context | Habitat mapping → patch graph → criticality → scenarios → restoration → field verification → report, in one workflow |
| Data sources | Sentinel-1/2, Landsat, ALOS | IRS/Resourcesat, LISS, Cartosat, Sentinel | Landsat/Sentinel alerts (GFW); user-supplied layers (Marxan/Conefor) | GMW, Landsat/Sentinel | user uploads, global layers | Sentinel-1 RTC (primary), Sentinel-2 (complementary), GMW as weak label |
| Monitoring | yes (global, annual + alerts) | yes (national programmes) | yes (GFW) | yes | project-level | per study area, on demand; timeline from repeated runs |
| Mapping | yes | yes | partial | yes | partial | yes (own weakly-supervised model; agreement with GMW reported, not field truth) |
| Change detection | yes (extent change, alerts) | yes (forest cover change) | yes (GFW) | yes | partial | patch-level change incl. fragmentation, connectivity and criticality change (planned) |
| Connectivity analysis | no | no | yes in dedicated tools (Conefor: IIC/PC; Circuitscape) — not integrated with mapping | no | no | yes, integrated: IIC/PC/ECA on model-derived patches, exact leave-one-out criticality |
| Scenario analysis | no | no | prioritisation scenarios (Marxan/Zonation); Conefor node removal/addition | no | no | patch removal, polygon removal, restoration, τ/threshold/time comparisons, labelled SIMULATED |
| Restoration prioritisation | no (restoration potential layers exist) | no | Marxan/Zonation (area selection); Conefor node-addition importance | no | site tracking, not ranking | connectivity-gain ranking (Eq. 11), cost-aware only with real costs, feasibility constraints from real layers |
| Field verification | no | plantation monitoring in some portals | no | no | yes (monitoring records) | planned: AI detection → review → field task → evidence → status |
| Evidence / audit | provenance of layers | partial | partial | partial | partial | planned: evidence chain per recommendation + application audit log |
| AI assistant | no | no | no | no | no | planned: retrieval over application data, no free-form generation |
| Workflow / project management | no | partial (scheme monitoring) | no | no | yes (projects) | planned: projects, tasks, statuses, reports |

## EcoConnectAI's proposed differentiation (narrow, capability-combination based)

EcoConnectAI does **not** claim better maps than GMW or national portals, and does **not** claim novel
connectivity mathematics (IIC/PC/ECA come from Pascual-Hortal & Saura 2006 / Saura & Pascual-Hortal 2007 and
are implemented in Conefor). Its proposed differentiation is the **integration** of:

1. a reproducible, credential-free satellite-to-habitat pipeline for named Indian coastal landscapes,
2. graph-theoretic criticality and exact scenario simulation computed on the model's own patches,
3. explanations and evidence chains attached to every ranked recommendation,
4. a human-in-the-loop verification and project workflow suitable for a forest department,

with every number labelled by provenance (foundation-paper / prototype / development / experimental / simulated).
Whether this combination is unique is not asserted; what is asserted is that none of the systems reviewed above
documents all four in one operational workflow, to the best of the documentation reviewed here.

## Claims policy
* Allowed: "integrates mapping, connectivity criticality, scenario simulation, restoration ranking and field
  verification in one workflow"; "reproducible from public data"; "every recommendation carries its evidence".
* Not allowed: "first", "only", "state-of-the-art accuracy", any accuracy number other than our labelled results,
  any implication of operational government integration.
