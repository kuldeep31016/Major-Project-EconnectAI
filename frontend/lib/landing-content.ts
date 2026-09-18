/**
 * Editable content for the landing page. Facts here are either configuration (study areas,
 * sensors) or method descriptions taken from the paper — no measured numbers live here;
 * those come from the backend at runtime with their provenance label.
 */
export const NAV = [
  { href: "#home", label: "Home" },
  { href: "#about", label: "About" },
  { href: "#explore", label: "Explore" },
  { href: "#methodology", label: "Methodology" },
  { href: "#study-areas", label: "Study Areas" },
  { href: "#workflow", label: "Field & Reports" },
  { href: "#responsible-ai", label: "Responsible AI" },
  { href: "#team", label: "Team" },
] as const;

export const HERO = {
  eyebrow: "Satellite data · Ecosystem science · Real impact",
  title: ["Coastal Ecosystem Intelligence", "for Evidence-Based Conservation"],
  body:
    "EcoConnectAI turns public satellite imagery into habitat maps, connectivity graphs, ranked priorities and field-verifiable recommendations for coastal forest departments — with the evidence behind every number.",
  features: [
    { icon: "Satellite", label: "Satellite\nImagery" },
    { icon: "Network", label: "Connectivity\nAnalysis" },
    { icon: "Leaf", label: "Conservation\nDecision Support" },
    { icon: "ShieldCheck", label: "Explainable\n& Transparent" },
  ],
} as const;

export const WHY = [
  { icon: "Leaf", title: "Biodiversity Protection", text: "Supports rich marine and coastal life" },
  { icon: "Cloud", title: "Carbon Storage", text: "Helps mitigate climate change" },
  { icon: "ShieldCheck", title: "Disaster Resilience", text: "Reduces the impact of storm surges" },
  { icon: "Users", title: "Informed Decision-Making", text: "Data-driven insights for effective conservation" },
] as const;

/** The eleven pipeline stages of the paper's Fig. 1. */
export const PIPELINE = [
  { n: 1, title: "Satellite acquisition", text: "Sentinel-1 SAR (VV/VH) as the primary input; Sentinel-2 L2A as complementary optical data. Public STAC catalogues, no credentials." },
  { n: 2, title: "Preprocessing", text: "Cloud masking, temporal median composites, dB scaling, co-registration on a 10 m UTM grid, tiling with spatial-block splits." },
  { n: 3, title: "Habitat segmentation", text: "U-Net decoder on an EfficientNet-B7 encoder (UNB7), weakly supervised against Global Mangrove Watch." },
  { n: 4, title: "Probability map", text: "Per-pixel P(mangrove); the threshold is calibrated by a sweep, not assumed." },
  { n: 5, title: "Patch extraction", text: "Connected components with true geodesic area, centroid, confidence and geometry; 2 ha minimum mapping unit." },
  { n: 6, title: "Connectivity graph", text: "Patches become nodes; k-nearest links within a dispersal threshold τ, weighted by √(qᵢqⱼ)·e^(−d/τ)." },
  { n: 7, title: "Connectivity metrics", text: "IIC, PC and ECA computed from their definitions — reported across τ = 3, 5, 8 km." },
  { n: 8, title: "Patch criticality", text: "Exact leave-one-out: every patch is removed, the index recomputed, and Sᵢ = ΔCᵢ / C(G) ranked." },
  { n: 9, title: "What-if simulation", text: "Remove a patch or draw a polygon; the network is rebuilt and the loss recomputed — no heuristics." },
  { n: 10, title: "Explainable decisions", text: "Rule-based explanations quoting area, degree, bridge status, neighbours and ΔC." },
  { n: 11, title: "Restoration prioritisation", text: "Candidates ranked by connectivity gained per node addition; cost-aware only with real cost data." },
] as const;

export const METHOD_EQUATIONS = [
  { label: "Habitat probability", eq: "Pᵢ(c) = P(yᵢ = c | X; θ)", note: "Eq. 1 — soft output of the segmentation model" },
  { label: "Edge weight", eq: "wᵢⱼ = √(qᵢ qⱼ) · exp(−dᵢⱼ / τ)", note: "Eq. 6 — k = 3 nearest neighbours, dᵢⱼ ≤ τ" },
  { label: "Integral Index of Connectivity", eq: "IIC = Σᵢ Σⱼ aᵢ aⱼ / (1 + nlᵢⱼ) / A_L²", note: "Pascual-Hortal & Saura (2006)" },
  { label: "Criticality", eq: "Sᵢ = (C(G) − C(G − vᵢ)) / C(G)", note: "Eq. 9 — exact node removal" },
  { label: "Restoration gain", eq: "Rᵢ = C(G + vᵢ) − C(G)", note: "Eq. 11 — Priorityᵢ = Rᵢ / Costᵢ only when costs exist" },
] as const;

export const TEAM = {
  project: "Final-year major project — Computer Science & Engineering",
  note: "Add team member names, roles and guide in frontend/lib/landing-content.ts.",
  members: [
    { name: "Team member 1", role: "Remote sensing & segmentation" },
    { name: "Team member 2", role: "Graph analysis & backend" },
    { name: "Team member 3", role: "Frontend & visualisation" },
    { name: "Project guide", role: "Supervision" },
  ],
} as const;

export const WORKFLOW = [
  { title: "Monitoring", text: "Sentinel-1 and Sentinel-2 composites per landscape, repeated per observation date; change between dates is a mask difference, reported without attributing a cause." },
  { title: "Connectivity intelligence", text: "Patches become a graph; IIC, PC and ECA are computed from their definitions and every patch is priced by exact leave-one-out removal, across τ = 3 / 5 / 8 km." },
  { title: "Restoration planning", text: "Candidate sites are ranked by connectivity gained; feasibility rules state what was checked (water, proximity, overlap) and what was not (legal status, cost)." },
  { title: "Field verification", text: "AI detections become tasks; field officers submit GPS, observation and photo; only accepted evidence turns a detection into a verified fact." },
  { title: "Reports", text: "Official reports are composed from stored artefacts, project records and field evidence, with provenance and limitations sections — nothing is written by hand." },
] as const;

export const RESPONSIBLE_AI = [
  "Every number carries a label: foundation-paper result, prototype/demonstration data, development result (not final), our experimental result, or simulated scenario.",
  "Segmentation labels are Global Mangrove Watch — an existing map. Agreement with it is reported as such, never as field-truth accuracy.",
  "The dispersal threshold τ is a configurable analysis parameter, not a biological constant; rankings are shown across values.",
  "AI recommends, evidence explains, GIS contextualises, scenarios quantify, officers decide, field verification confirms. Predictions never self-verify.",
  "No costs, field observations, government integrations or performance figures are invented; missing data is shown as missing.",
] as const;
