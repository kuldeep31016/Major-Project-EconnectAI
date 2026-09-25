// EcoConnectAI product demo — one continuous Kerala (Vembanad–Kol) user journey.
// Every figure in the narration was read from the running app / run files on 25 Sept 2026.
// Fields: ch (chapter pill), page, click, expect, point (technical point), say (narration), act (actions).
const SIDEBAR = [0, 60, 232, 900];

module.exports = [
// ───────────────────────── 1. OPENING
{ ch: '1 · Opening the product', page: '/', click: '—', expect: 'Public landing page, hero with Vembanad–Kol illustration',
  point: 'Introduces the product and its purpose (decision support, not just a map).',
  say: `Good afternoon. This is EcoConnectAI, a satellite-driven coastal ecosystem intelligence and conservation decision-support platform. Its purpose is not simply to show a habitat map. It converts satellite-derived habitat information into patch-level connectivity analysis, criticality assessment, scenario analysis and restoration support.`,
  act: async d => { await d.go('/'); await d.wait(1500); await d.moveTo({ xy: [330, 380] }, 1400); await d.wait(4000); await d.moveTo({ xy: [420, 500] }, 1200); } },

{ ch: '1 · Opening the product', page: '/', click: 'hover top navigation', expect: 'Navigation: The Insight, How It Works, Capabilities, Study Areas, Restoration, About, Launch Command Center',
  point: 'Public overview vs operational platform.',
  say: `This is the public overview. The navigation covers the insight behind the project, how it works, its capabilities, the four study areas, restoration, and an about section. The visual on the right is an illustration, and the figures on this public page come from our early prototype. Every operational number I show today comes from inside the platform.`,
  act: async d => { for (const t of ['The Insight', 'How It Works', 'Capabilities', 'Study Areas', 'Restoration', 'About']) { await d.moveTo({ text: t, tag: 'a', region: [0, 0, 1600, 70] }, 700); await d.wait(900); } await d.moveTo({ xy: [1180, 420] }, 1000); await d.wait(2500); } },

{ ch: '1 · Opening the product', page: '/ → /command', click: 'Launch Command Center', expect: 'Command Center opens (read-only until sign-in)',
  point: 'Entry into the operational side.',
  say: `Now I click Launch Command Center. This opens the operational side of the platform. Before working with it, I will sign in, because actions like creating field tasks are controlled by role.`,
  act: async d => { await d.click({ text: 'Launch Command Center', tag: 'a' }); await d.wait(5000); await d.moveTo({ text: 'Sign in', tag: 'a' }, 1000); await d.wait(1500); } },

{ ch: '2 · Sign in', page: '/login', click: 'Sign in → State Administrator demo card (one-click sign-in)', expect: 'Login page with six demo roles; redirect to Command Center',
  point: 'JWT authentication with six roles (state admin, senior officer, range officer, field officer, GIS officer, analyst).',
  say: `I click Sign in. The platform has six roles, from state administrator to field officer, and each role sees only the actions it is allowed to perform. These are demonstration accounts, and clicking a card signs in directly. I click State Administrator, which has access to every module.`,
  act: async d => { await d.click({ text: 'Sign in', tag: 'a' }); await d.wait(2500); for (const t of ['Senior Conservation Officer', 'Field Officer', 'GIS / Technical Officer']) { await d.moveTo({ text: t, tag: 'button' }, 700); await d.wait(700); } await d.click({ text: 'State Administrator', tag: 'button' }); await d.wait(5000); } },

// ───────────────────────── 2. COMMAND CENTER
{ ch: '2 · Command Center', page: '/command', click: 'hover sidebar, header selectors', expect: 'Dashboard: sidebar, study-area and period selectors, map, KPIs, landscape metrics, what-if panel',
  point: 'One operational workspace; every panel is fed by the latest analysis run through the API.',
  say: `This is the Command Center. On the left is the navigation for every module. At the top are the study area selector, currently Kerala, and the analysis period, which is the latest run, from twenty twenty five imagery. The bell shows open alerts. In the centre is the map, and on the right the selected patch, landscape metrics and what-if tools.`,
  act: async d => { await d.moveTo({ text: 'Dashboard', tag: 'a', region: SIDEBAR }, 900); await d.wait(600); await d.moveTo({ text: 'Field Reports', tag: 'a', region: SIDEBAR }, 900); await d.wait(600); await d.moveTo({ sel: 'select', index: 0 }, 900); await d.wait(1600); await d.moveTo({ sel: 'select', index: 1 }, 800); await d.wait(1600); await d.moveTo({ xy: [1379, 32] }, 700); await d.wait(1200); await d.moveTo({ xy: [720, 420] }, 1000); await d.wait(1200); await d.moveTo({ text: 'Landscape Metrics' }, 900); await d.wait(1000); } },

{ ch: '2 · Command Center', page: '/command', click: 'hover map label and KPI cards', expect: 'Map strip "REAL DATA · development model · not final"; KPI cards 24 patches, 43 links, 220 ha, 4 opportunities',
  point: 'Provenance label on every result; numbers come from the run bundle, not hard-coded.',
  say: `Notice the label on the map: real data, development model, not final. Every result in the platform carries a label like this. Below the map, the cards show twenty four detected patches, forty three connectivity links, about two hundred and twenty hectares of mangrove, and four restoration opportunities. All of these come from the latest analysis run, served by the backend.`,
  act: async d => { await d.moveTo({ text: 'REAL DATA' }, 1000); await d.wait(3000); for (const t of ['Detected Patches', 'Connectivity Links', 'Mangrove Area', 'Restoration Opportun']) { await d.moveTo({ text: t }, 800); await d.wait(1300); } } },

{ ch: '2 · Command Center — layers', page: '/command', click: 'Layers panel: Connectivity links, Restoration candidates, Critical patches', expect: 'Layers toggle on the map',
  point: 'Map layers come from the run: patch polygons (by confidence), candidates, top-5 critical, links, AOI boundary, alerts, tasks.',
  say: `The map is the spatial foundation. Every later analysis links back to a location. Here is the layers panel. Green polygons are mangrove patches, split by model confidence. Orange points are restoration candidates. Red marks the five most critical patches. Blue lines are connectivity links. I will switch off the links, and the candidates, so you can see the patches alone, and then switch them back on.`,
  act: async d => { await d.moveTo({ text: 'Layers', region: [940, 150, 1180, 200] }, 900); await d.wait(1500); await d.moveTo({ text: 'Mangrove (high confidence)' }, 700); await d.wait(900); await d.click({ text: 'Connectivity links', region: [940, 300, 1180, 350] }); await d.wait(1500); await d.click({ text: 'Restoration candidates', region: [940, 260, 1180, 300] }); await d.wait(2000); await d.moveTo({ xy: [660, 420] }, 800); await d.wait(1500); await d.click({ text: 'Connectivity links', region: [940, 300, 1180, 350] }); await d.wait(700); await d.click({ text: 'Restoration candidates', region: [940, 260, 1180, 300] }); await d.wait(1500); } },

// ───────────────────────── 3. STUDY AREAS / DATA
{ ch: '3 · Study areas', page: '/command', click: 'Study-area selector → West Bengal (Sundarbans) → back to Kerala', expect: 'Map and KPIs switch to the Sundarbans run (54 patches), then back to Kerala',
  point: 'Four configured landscapes; each has its own real pipeline run.',
  say: `The platform contains four study areas: Vembanad Kol in Kerala, the Sundarbans in West Bengal, the Gulf of Mannar in Tamil Nadu, and Bhitarkanika in Odisha. If I switch to the Sundarbans, the whole dashboard reloads from that landscape's own run. Here the model found fifty four patches over a much larger mangrove system. Kerala is our primary demonstration, so I switch back.`,
  act: async d => { await d.moveTo({ sel: 'select', index: 0 }, 900); await d.wait(1500); await d.select(0, 'sundarbans'); await d.wait(7000); await d.moveTo({ text: 'Detected Patches' }, 900); await d.wait(3000); await d.moveTo({ sel: 'select', index: 0 }, 900); await d.select(0, 'kerala-coast'); await d.wait(6000); } },

{ ch: '3 · Data context', page: '/upload', click: 'Sidebar → New Analysis', expect: 'Landscapes with downloaded scenes; scene metadata (dates, size, EPSG, bands, sensor); "What is real here"',
  point: 'Real satellite data: Sentinel-1 RTC (Planetary Computer), Sentinel-2 L2A (Earth Search); weak labels GMW v3 2020.',
  say: `To see the data behind a landscape, I open New Analysis. For Kerala there are four downloaded scenes. Each one shows its date range, pixel size, projection, bands and sensor. The model uses Sentinel-1 radar: six scenes, combined into a temporal median, at ten metres. Sentinel-2 optical data is also downloaded, but it is complementary; the current model does not use it. This panel on the right states what is real: real satellite scenes, and Global Mangrove Watch labels, which are weak reference labels, not field ground truth.`,
  act: async d => { await d.click({ text: 'New Analysis', tag: 'a', region: SIDEBAR }); await d.wait(4000); await d.moveTo({ text: 'Kerala Coast — Vembanad–Kol Wetland', tag: 'button' }, 900); await d.wait(1500); await d.moveTo({ text: 'kerala-coast_2025_s1_10m' }, 900); await d.wait(3500); await d.moveTo({ text: 'kerala-coast_2020_s2_10m' }, 900); await d.wait(3500); await d.moveTo({ text: 'What is real here' }, 900); await d.wait(2500); await d.moveTo({ text: 'Labels used for training' }, 900); await d.wait(3000); } },

{ ch: '3 · Data context', page: '/upload', click: 'hover Run panel (not clicked)', expect: 'Run panel: landscape, scene, model kerala-coast_development, threshold 0.5',
  point: 'POST /api/segment runs prediction → patches → graph → criticality on the backend; not re-run live because it replaces the latest run.',
  say: `The run panel shows what would execute: this scene, a trained model, and a threshold. Pressing Run pipeline performs the whole chain on the backend: prediction, patch extraction, the graph and criticality. I will not re-run it live, because it would replace the current results. Instead, I will use the latest completed run.`,
  act: async d => { await d.moveTo({ text: 'Run', region: [1140, 170, 1520, 210] }, 900); await d.wait(1500); await d.moveTo({ text: 'Run pipeline', tag: 'button' }, 900); await d.wait(4000); } },

// ───────────────────────── 4. SATELLITE → HABITAT
{ ch: '4 · Satellite → habitat', page: '/command', click: 'Dashboard → basemap Sentinel-1 (SAR, VV) → Sentinel-2 (NDVI) → Satellite', expect: 'Map background switches to our own Sentinel-1 then Sentinel-2 NDVI rasters',
  point: 'Basemaps rendered from the downloaded scene rasters (quicklook endpoint), not a third-party tile layer.',
  say: `Back on the dashboard, I can look at the satellite data directly. I select the Sentinel-1 radar layer. This is the actual input the model sees, rendered from our downloaded raster. Now Sentinel-2 N D V I, the complementary optical view, where vegetation appears bright. And back to the normal satellite basemap.`,
  act: async d => { await d.click({ text: 'Dashboard', tag: 'a', region: SIDEBAR }); await d.wait(4500); await d.click({ text: 'Sentinel-1 (SAR, VV)' }); await d.wait(4500); await d.moveTo({ xy: [680, 420] }, 800); await d.wait(1500); await d.click({ text: 'Sentinel-2 (NDVI)' }); await d.wait(4500); await d.click({ text: 'Satellite (True Color)' }); await d.wait(2500); } },

{ ch: '4 · Satellite → habitat', page: '/analysis', click: 'Top tab Patches → Interactive Map; Layers: Model probability off/on', expect: 'Split map with the model probability raster and habitat mask',
  point: 'Segmentation output: per-pixel P(mangrove) raster → threshold → habitat mask → patches.',
  say: `Now the habitat detection. I open the interactive map. The bright green here is the model's probability raster: for every ten metre pixel, the probability that it is mangrove. If I switch it off, you see the imagery underneath. Switching it back on. The system thresholds this probability to get a habitat mask, and then groups the mask into individual patches.`,
  act: async d => { await d.click({ text: 'Interactive Map', tag: 'a', region: SIDEBAR }); await d.wait(6000); await d.moveTo({ xy: [470, 470] }, 900); await d.wait(1500); await d.click({ text: 'Model probability', region: [640, 360, 910, 400] }, { xOffset: 170 }); await d.wait(2500); await d.click({ text: 'Model probability', region: [640, 360, 910, 400] }, { xOffset: 170 }); await d.wait(2500); await d.moveTo({ xy: [480, 560] }, 800); await d.wait(1500); } },

{ ch: '4 · Model information', page: '/experiments', click: 'Sidebar → Data & Models → kerala-coast_development → multi_E1_s1_b0_dev', expect: 'Model list; metrics cards; validation vs held-out test table',
  point: 'Actual model: U-Net with EfficientNet-B0, input S1 VV/VH; metrics are agreement with GMW. UNB7 (B7) is the research target, not yet trained.',
  say: `Which model produced this? I open Data and Models. The research foundation is a U-Net with an EfficientNet B7 encoder, called UNB7. That full model is not trained yet. What runs today is the same U-Net with a smaller EfficientNet B0 encoder, on Sentinel-1 input. This model, used for the Kerala run, is weak on Kerala: test I O U zero point zero three. Our four-area model reaches zero point eight four, but mostly from the Sundarbans. These are measured against weak labels, and the badge here is only a display label. The ninety five percent card is the foundation study's published result, not ours.`,
  act: async d => { await d.click({ text: 'Data & Models', tag: 'a', region: SIDEBAR }); await d.wait(4500); await d.moveTo({ text: 'Held-out Test' }, 1000); await d.wait(4500); await d.click({ text: 'multi_E1_s1_b0_dev', region: [270, 180, 570, 700] }); await d.wait(3000); await d.moveTo({ text: 'Held-out Test' }, 900); await d.wait(4500); await d.moveTo({ text: 'Validated Model' }, 800); await d.wait(2000); await d.moveTo({ text: 'UNB7 (Ghorbanian' }, 900); await d.wait(3000); await d.click({ text: 'kerala-coast_development', region: [270, 180, 570, 700] }); await d.wait(1500); } },

// ───────────────────────── 5. PATCHES
{ ch: '5 · Habitat patches', page: '/command', click: 'Dashboard → scroll-zoom on the northern cluster → click a patch polygon', expect: 'Map zooms in; Selected Patch card fills with area, connectivity loss, importance, confidence',
  point: 'Each connected component ≥ 2 ha is one patch — an analysable spatial unit with its own attributes.',
  say: `Now the patches. Back on the dashboard, I zoom into the northern cluster. Instead of treating the habitat as one image, the system has extracted individual patches. Let me click one. The selected patch card shows its area, the connectivity loss if it were removed, its importance rank, and the model's confidence. Each patch is an analysable spatial unit.`,
  act: async d => { await d.click({ text: 'Dashboard', tag: 'a', region: SIDEBAR }); await d.wait(4500); await d.moveTo({ xy: [662, 352] }, 900); await d.wheel(662, 352, -120, 4); await d.wait(2500); await d.clickPatch([700, 420], ['#16a34a', '#22c55e', '#4ade80', '#86efac']); await d.wait(2000); await d.moveTo({ text: 'Selected Patch' }, 900); await d.wait(3500); } },

{ ch: '5 · Habitat patches', page: '/command', click: 'Search "P01" → Enter, then search "P17" → Enter', expect: 'Card shows P01 (35.1 ha, 30.7 % loss) then P17 (3.13 ha, 27.0 % loss, critical #3, cut vertex)',
  point: 'Two patches of very different size can have similar structural importance.',
  say: `I can also search by patch I D. P01 is the largest patch, thirty five hectares, with a connectivity loss of about thirty one percent. Now P17. It is only three point one three hectares, yet its connectivity loss is twenty seven percent, and it is ranked third. The card explains why: it is a cut vertex, and removing it splits the network into three components. Patches of very different size can have almost the same structural role.`,
  act: async d => { await d.search('P01'); await d.wait(2500); await d.moveTo({ text: 'Selected Patch' }, 900); await d.wait(3500); await d.search('P17'); await d.wait(2500); await d.ensureSelected('P17'); await d.moveTo({ text: 'Connectivity Loss' }, 900); await d.wait(2500); await d.moveTo({ text: 'Cut vertex' }, 900); await d.wait(3000); } },

// ───────────────────────── 6. CONNECTIVITY GRAPH
{ ch: '6 · Connectivity graph', page: '/graph', click: 'Top tab Connectivity → graph view', expect: 'Network: 24 nodes, 43 links, 2 clusters; topology and clusters cards',
  point: 'Patches = nodes; links = nearest neighbours within 5 km, weighted by distance and confidence.',
  say: `Now we move from where habitat exists, to how patches are connected. I open the Connectivity tab. Each circle is a patch, sized by area. Each line is a link to one of its nearest neighbours within five kilometres, weighted by distance and confidence. Twenty four nodes, forty three links, and two clusters: a main network of twenty three patches, and one isolated patch.`,
  act: async d => { await d.click({ text: 'Connectivity', tag: 'a', region: [1000, 80, 1600, 125] }); await d.wait(5000); await d.moveTo({ xy: [700, 400] }, 900); await d.wait(1500); await d.moveTo({ text: 'Network topology' }, 900); await d.wait(2500); await d.moveTo({ text: 'Functional clusters' }, 900); await d.wait(2500); } },

{ ch: '6 · Connectivity graph', page: '/graph', click: 'Click node P17; toggle "Critical links only"', expect: 'P17 panel: 4 links, cut vertex; critical-links filter shows the single bridging corridor',
  point: 'Per-patch network role: degree, alternative routes, bridging corridor.',
  say: `I click patch P17 in the graph. Its panel shows four functional links, to P14, P04, P15 and P07, and marks it as a cut vertex. Now I switch on critical links only. One bridging corridor remains, the dashed link through P17 and P07. That corridor is the only connection between the northern and southern groups of patches.`,
  act: async d => { await d.clickNode('P17'); await d.wait(800); await d.jsClickStart('P17'); await d.wait(2500); await d.moveTo({ text: 'Why this matters', region: [900, 500, 1240, 900] }, 900); await d.wait(3500); await d.click({ text: 'Show critical links only', tag: 'button' }, { useAria: true, xy: [450, 303] }); await d.wait(2500); await d.moveTo({ xy: [680, 590] }, 900); await d.wait(3000); await d.click({ xy: [450, 303] }); await d.wait(1000); } },

// ───────────────────────── 7. CRITICALITY
{ ch: '7 · Criticality analysis', page: '/graph', click: 'Scroll right panel → Patch importance ranking', expect: 'Ranking: P01 31, P07 30, P17 27, P02 22, P03 21 …',
  point: 'Exact leave-one-out: connectivity recomputed with each patch removed; ranking by relative loss.',
  say: `This is criticality analysis, the main differentiator. The question is not which patch is largest, but which patch matters most to connectivity. For every patch, the system recomputes landscape connectivity with that patch removed, and ranks patches by the loss. Here is the ranking. P01, P07 and P17 are the top three. P01 is the largest patch, but P07 and P17 are small. They rank high because of their position in the network.`,
  act: async d => { await d.moveTo({ xy: [1420, 500] }, 900); await d.wheel(1420, 500, 150, 6); await d.wait(1500); await d.moveTo({ text: 'Patch importance ranking' }, 900); await d.wait(3000); for (const t of ['P01', 'P07', 'P17']) { await d.moveTo({ text: t, region: [1280, 200, 1570, 560] }, 700); await d.wait(1600); } await d.wait(2000); } },

{ ch: '7 · Criticality evidence', page: '/analysis?patch=P17', click: 'Patches tab (map) with P17 → "Why is P17 ranked here? · Evidence"', expect: 'Evidence drawer: decision, C(G), C(G−v), ΔC, S = 0.2695, rank by area #17, degree 4, cut vertex 2 → 3, neighbours, parameters',
  point: 'Transparent evidence instead of an unexplained label; values read from the stored run.',
  say: `Why is P17 critical? I open its evidence. The system identifies it as critical based on the implemented connectivity analysis, and shows the numbers. Connectivity before removal, connectivity after removal, the difference, and the relative loss, zero point two seven. By area it is only seventeenth. Its degree is four, it is a cut vertex, and removing it takes the network from two components to three. Below are its geometry, confidence and the analysis parameters. Nothing here is generated at display time; it is read from the stored run.`,
  act: async d => { await d.go('/analysis?scene=kerala-coast&patch=P17'); await d.wait(5000); await d.moveTo({ text: 'Why is P17 ranked here', tag: 'button' }, 1000); await d.wait(400); await d.jsClick('Why is P17 ranked here'); await d.wait(3000); for (const t of ['Priority CRITICAL', 'C(G − v)', 'rank by area', 'components']) { await d.moveTo({ text: t, region: [1180, 80, 1600, 900] }, 800); await d.wait(1800); } await d.scrollIn([1380, 600], 500); await d.wait(3500); } },

// ───────────────────────── 8. BACK TO THE MAP
{ ch: '8 · Back to the map', page: '/command', click: 'Dashboard → search P17 → point at the red P17 polygon (already selected by the search; clicking it again would deselect it)', expect: 'Map flies to P17; the red critical polygon is selected; card shows P17 details',
  point: 'Analysis result is tied to a physical location an officer can visit.',
  say: `Now I move from the analysis back to geography. On the dashboard, I search for P17, and the map flies to it. The red polygon outlined here is P17, one of the top five critical patches, and it is already selected. An officer does not have to interpret an abstract table; the critical patch is right here, between the northern and southern mangrove groups, with its area, loss and confidence.`,
  act: async d => { await d.click({ text: 'Dashboard', tag: 'a', region: SIDEBAR }); await d.wait(4500); await d.search('P17'); await d.wait(3000); await d.hoverPatch([720, 420], ['#dc2626', '#ef4444']); await d.wait(2500); await d.ensureSelected('P17'); await d.moveTo({ text: 'Selected Patch' }, 900); await d.wait(3000); } },

// ───────────────────────── 9. WHAT-IF
{ ch: '9 · What-if scenario', page: '/command', click: 'Remove Patch', expect: 'What-if card: "Removing P17" — IIC loss −27.0 %, habitat removed 1.4 %, components 2 → 3',
  point: 'Exact server-side recomputation (POST /what-if).',
  say: `Now a management question. What happens to the landscape if P17 is lost? I click Remove Patch. The backend rebuilds the graph without P17 and recomputes connectivity. Here is the result: connectivity falls by twenty seven percent, while only one point four percent of the habitat was removed, and the network breaks from two components into three.`,
  act: async d => { await d.ensureSelected('P17'); await d.click({ text: 'Remove Patch', tag: 'button' }); await d.wait(4000); await d.scrollIn([1390, 700], 300); await d.wait(1000); await d.moveTo({ text: 'Removing P17' }, 900); await d.wait(2500); await d.moveTo({ text: 'IIC loss' }, 800); await d.wait(4000); } },

{ ch: '9 · Scenario Lab', page: '/scenario', click: 'Sidebar → Scenarios → A · Remove patch (P17 carried over) → Run scenario', expect: 'Baseline / scenario / Δ table for IIC, PC, ECA, habitat, links (43 → 39), components (2 → 3); label SIMULATED',
  point: 'Before → after comparison with an explanation built from computed values.',
  say: `For a fuller comparison I open the Scenario Lab. Scenario A, remove patch, already has P17 selected. I click Run scenario. Here is the before state, the baseline, and the simulated after state, side by side: connectivity indices, habitat area, links going from forty three to thirty nine, and components from two to three. Below is an explanation built only from these numbers, and the affected neighbouring patches.`,
  act: async d => { await d.click({ text: 'Scenarios', tag: 'a', region: SIDEBAR }); await d.wait(4000); await d.moveTo({ text: 'Selected: P17' }, 900); await d.wait(1500); await d.click({ text: 'Run scenario', tag: 'button' }); await d.wait(5000); await d.moveTo({ text: 'BASELINE', region: [1230, 140, 1600, 450] }, 900); await d.wait(2500); await d.moveTo({ text: 'Links', region: [1230, 140, 1600, 500] }, 800); await d.wait(2500); await d.moveTo({ text: 'Explanation (from computed values)' }, 900); await d.wait(3500); } },

{ ch: '9 · Scenario Lab', page: '/scenario', click: 'clear → E · Compare τ 3/5/8 km → Run scenario', expect: 'Table: τ 3/5/8 km → links 41/43/47, components 2/2/1, rank correlation 0.96/1.00/0.97; label SIMULATED',
  point: 'Assumption sensitivity: the 5 km distance is a parameter; ranking stays stable.',
  say: `This is not a prediction of the future. It is a what-if based on the current model output and our assumptions. One assumption is the five kilometre connection distance, so let me test it. I choose scenario E and run it. At three, five and eight kilometres, the links change from forty one to forty seven, but the ranking correlation stays above zero point nine six. The critical patches do not depend on that single choice.`,
  act: async d => { await d.click({ text: 'clear', tag: 'button' }); await d.wait(800); await d.click({ text: 'E · Compare', tag: 'button' }); await d.wait(1200); await d.click({ text: 'Run scenario', tag: 'button' }); await d.wait(9000); await d.moveTo({ text: 'LINKS', region: [1230, 140, 1600, 450] }, 900); await d.wait(3000); await d.moveTo({ text: 'Explanation (from computed values)' }, 900); await d.wait(3000); } },

// ───────────────────────── 10. RESTORATION
{ ch: '10 · Restoration planner', page: '/restoration', click: 'Sidebar → Restoration → #1 C1', expect: 'Candidates C1–C4 on the map; C1: 1.6 ha, +1.29 % IIC, 3 new links to P01, P06, P13; why / why not / not assessed',
  point: 'Reverse of criticality: insert candidate, recompute, rank by gain. No invented costs.',
  say: `After finding where connectivity is vulnerable, the next question is where restoration would help most. I open the Restoration planner. Candidates are areas where the model saw marginal habitat. For each one, the system adds it to the graph and measures the gain. I click the top candidate, C1. It is one point six hectares, and it would add three new links, to P01, P06 and P13, raising connectivity by one point two nine percent.`,
  act: async d => { await d.click({ text: 'Restoration', tag: 'a', region: SIDEBAR }); await d.wait(5000); await d.moveTo({ text: 'Candidate method' }, 900); await d.wait(3000); await d.click({ text: '#1 C1' }); await d.wait(3000); await d.moveTo({ text: 'WHY RECOMMENDED' }, 900); await d.wait(3500); } },

{ ch: '10 · Restoration planner', page: '/restoration', click: 'hover Not assessed list; hover Upload real cost table; hover Create field assessment task', expect: 'Not-assessed items (water status, legal status, ownership, cost); cost upload control',
  point: 'Costs only from user-supplied validated data; "Recommended" is a rule output, not a field or legal verdict.',
  say: `The panel is honest about what it has not assessed: water status, legal status, land ownership and cost. The current prototype ranks candidates by connectivity benefit. Cost-aware ranking is used only when validated cost data is uploaded here. So recommended means no rule was violated in the available layers. It is a starting point for a field assessment, not a final decision.`,
  act: async d => { await d.moveTo({ text: 'NOT ASSESSED' }, 900); await d.wait(4000); await d.moveTo({ text: 'Upload real cost table' }, 900); await d.wait(3500); await d.moveTo({ text: 'Create field assessment task', tag: 'button' }, 900); await d.wait(3000); } },

// ───────────────────────── 11. CHANGE DETECTION
{ ch: '11 · Change over time', page: '/scenario', click: 'Period → 2025 kerala_E1 run; Sidebar → Scenarios → G · Compare periods → compare with kerala_E1 2020 → Run', expect: 'OBSERVED (MODEL OUTPUT): habitat 319 vs 382 ha, IIC difference, 9 patches without counterpart, 10 new',
  point: 'Change = difference between two real pipeline runs of the same model and threshold; model output, not measured loss.',
  say: `Next, change over time. For Kerala we have Sentinel-1 imagery for twenty twenty and twenty twenty five, both processed by the same model at the same threshold. I select the twenty twenty five run in the period selector, go to the Scenario Lab, open scenario G, compare periods, choose the twenty twenty run, and run it. Between twenty twenty and twenty twenty five the model output drops from three hundred and eighty two to three hundred and nineteen hectares. Nine patches have no match, and ten are new. This is labelled observed, model output.`,
  act: async d => { await d.moveTo({ sel: 'select', index: 1 }, 900); await d.select(1, 'kerala_E1_s1_b0_dev_2025_t0.70'); await d.wait(4000); await d.click({ text: 'Scenarios', tag: 'a', region: [0, 60, 232, 900] }); await d.wait(4000); await d.click({ text: 'G · Compare periods', tag: 'button' }); await d.wait(1500); await d.moveTo({ sel: 'select', index: 2 }, 800); await d.select(2, 'kerala_E1_s1_b0_dev_t0.70'); await d.wait(1000); await d.click({ text: 'Run scenario', tag: 'button' }); await d.wait(9000); await d.moveTo({ text: 'Habitat (ha)' }, 900); await d.wait(3500); await d.moveTo({ text: 'Patch-level change' }, 900); await d.wait(3000); } },

{ ch: '11 · Change over time', page: '/scenario', click: 'hover explanation; Period → back to latest', expect: 'Explanation: "Both are model outputs; differences include model uncertainty and no cause is attributed"',
  point: 'Honest limitation: the dev model is weak on Kerala, so this difference may be noise.',
  say: `The explanation says it clearly: both are model outputs, and no cause is attributed. This development model is weak on Kerala, so I would not report this as a measured loss of mangrove. What the module demonstrates is the workflow: when a stronger model is available, the same comparison becomes a monitoring tool. I switch back to the latest run.`,
  act: async d => { await d.moveTo({ text: 'Explanation (from computed values)' }, 900); await d.wait(6000); await d.moveTo({ sel: 'select', index: 1 }, 900); await d.select(1, 'latest'); await d.wait(4000); } },

// ───────────────────────── 12. FIELD VERIFICATION
{ ch: '12 · Field verification', page: '/analysis?patch=P17', click: 'Interactive map with P17 → "Send P17 to verification"', expect: 'Message: registered as detection (AI_DETECTED) — see Field Reports → verification queue',
  point: 'Satellite result enters a human review chain: AI_DETECTED → UNDER_REVIEW → FIELD_ASSIGNED → FIELD_VERIFIED → CONFIRMED.',
  say: `Satellite analysis alone should not be treated as the final truth. A real workflow needs human review and field verification. On the interactive map with P17 selected, I click Send P17 to verification. It is registered as a detection with status A I detected. It cannot be marked confirmed until accepted field evidence exists.`,
  act: async d => { await d.go('/analysis?scene=kerala-coast&patch=P17'); await d.wait(5000); await d.moveTo({ text: 'Send P17 to verification', tag: 'button' }, 1000); await d.wait(400); await d.jsClick('Send P17 to verification'); await d.wait(3000); await d.moveTo({ text: 'Registered as detection' }, 900); await d.wait(4000); } },

{ ch: '12 · Field verification', page: '/field', click: 'Sidebar → Field Reports → New task → fill title, reason, location, assignee → Create task', expect: 'New PENDING task "Verify critical patch P17" assigned to the Field Officer; verification queue shows P17',
  point: 'Analysis → action: a task stored in the database (field_tasks) and assigned to a role.',
  say: `Now I open Field Reports. The verification queue shows P17. I click New task and create an assignment: verify critical patch P17, with the reason from the analysis, the patch location, and the field officer as assignee. I click Create task. The task now appears as pending. This is the link from analysis to action.`,
  act: async d => { await d.click({ text: 'Field Reports', tag: 'a', region: SIDEBAR }); await d.wait(4000); await d.click({ text: 'New task', tag: 'button' }); await d.wait(1500);
    await d.fill('input[placeholder="Title"]', 'Verify critical patch P17');
    await d.fill('textarea[placeholder^="Reason"]', 'Cut vertex: removing P17 (3.13 ha) lowers IIC by 27.0 % and splits the network 2 to 3 components. Confirm mangrove presence and condition.');
    await d.fill('input[placeholder="lat"]', '9.86756'); await d.fill('input[placeholder="lon"]', '76.31673');
    await d.selectEl('form select:last-of-type', 'Field Officer'); await d.wait(800);
    await d.click({ text: 'Create task', tag: 'button' }); await d.wait(3500); await d.moveTo({ text: 'Verify critical patch P17' }, 900); await d.wait(2500); } },

{ ch: '12 · Field verification', page: '/field', click: 'Open existing Task #1 (VERIFIED)', expect: 'Task detail with evidence record and verification status (demo test data)',
  point: 'Full loop: task → GPS/photo evidence → senior review → verified; existing record is demonstration data.',
  say: `To show the complete loop, here is an earlier task from our workflow testing. A field officer submitted an observation with location, a senior officer accepted it, and the task became verified. This record is demonstration data from testing, not a real field survey. No real field validation has been carried out yet.`,
  act: async d => { await d.click({ text: 'Verify: Critical patch P01' }); await d.wait(3000); await d.moveTo({ xy: [1150, 400] }, 900); await d.wait(4000); await d.scrollIn([1150, 500], 400); await d.wait(4000); } },

// ───────────────────────── 13. REPORTS
{ ch: '13 · Reports', page: '/reports', click: 'Sidebar → Reports → Kerala report; scroll', expect: 'Scientific report per run: abstract with result label, habitat map, graph, criticality, what-if, τ sensitivity, restoration, provenance',
  point: 'Analysis converted into a reviewable document generated from run files.',
  say: `Reports turn the analysis into something that can be reviewed and shared. I open Reports and select the Kerala assessment. It is generated from the run files: an abstract carrying the result label, then the habitat map, the graph and baseline connectivity, the critical patches, the what-if result, the sensitivity test, restoration candidates, and the data provenance with model and timestamps.`,
  act: async d => { await d.click({ text: 'Reports', tag: 'a', region: SIDEBAR }); await d.wait(4500); await d.click({ text: 'Connectivity assessment — Kerala Coast', tag: 'button' }); await d.wait(3000); await d.moveTo({ text: 'ABSTRACT' }, 900); await d.wait(3000); await d.scrollIn([900, 600], 700); await d.wait(3000); await d.scrollIn([900, 600], 900); await d.wait(3500); } },

{ ch: '13 · Reports', page: '/reports', click: 'Generate official report', expect: 'Official report created and stored (reports table), with field-verification section',
  point: 'Official report stored in the database; PDF via the browser print dialog.',
  say: `I click Generate official report. This version adds a field verification section and is stored in the database with an audit entry. The Download PDF button uses the browser's print to PDF; the backend itself produces the report as structured data.`,
  act: async d => { await d.scrollTop(); await d.click({ text: 'Generate official report', tag: 'button' }); await d.wait(4500); await d.moveTo({ xy: [900, 300] }, 900); await d.wait(2500); await d.moveTo({ text: 'Download PDF', tag: 'button' }, 900); await d.wait(2500); } },

// ───────────────────────── 14. RESPONSIBLE AI / EVIDENCE / BACKEND
{ ch: '14 · Responsible AI', page: '/command', click: '⌘K Ask AI → "Why is P17 critical?"', expect: 'Assistant answer quoting stored values with sources and [DEVELOPMENT-SUBSET RESULT - NOT FINAL]',
  point: 'Assistant is template retrieval over stored results, not an LLM; never invents figures.',
  say: `EcoConnectAI is designed as decision support, not autonomous decision making. Even the assistant follows this rule. I ask: why is P17 critical? The answer is assembled from the stored run, with the source files and the result label. It is not a large language model, and it never invents a number.`,
  act: async d => { await d.click({ text: 'Dashboard', tag: 'a', region: SIDEBAR }); await d.wait(3500); await d.click({ text: 'Ask AI', tag: 'button' }); await d.wait(1500); await d.type('Why is P17 critical?'); await d.key('Enter'); await d.wait(1200); await d.submitActive(); await d.wait(4000); await d.moveTo({ text: 'DEVELOPMENT-' }, 900); await d.wait(3000); await d.key('Escape'); await d.wait(800); } },

{ ch: '14 · Evidence & audit', page: '/audit', click: 'Sidebar → Audit', expect: 'Audit trail with the actions just performed: login, detection registered, task created, report generated',
  point: 'Accountability: every action written to the append-only audit_log table.',
  say: `Every action is recorded. I open the audit trail. At the top are the actions from this demonstration: signing in, registering the detection, creating the field task, and generating the report, each with user, role and time. The platform provides evidence to support an officer. The final management decision remains with the responsible human authority.`,
  act: async d => { await d.click({ text: 'Audit', tag: 'a', region: SIDEBAR }); await d.wait(4500); await d.moveTo({ xy: [700, 260] }, 900); await d.wait(3000); await d.moveTo({ xy: [900, 380] }, 900); await d.wait(4000); } },

{ ch: '14 · How it is built', page: '/audit (overlay)', click: '— (architecture overlay added for this video)', expect: 'Overlay: Next.js frontend → FastAPI → SQLite (workflow) + run files (rasters, graphs) → analysis/model → result',
  point: 'Database answer: SQLite via SQLAlchemy, 15 tables; rasters and run artefacts on disk.',
  say: `Behind the screens, the flow is simple. The Next J S frontend calls a Fast A P I backend. Workflow data, like users, detections, tasks, reports and this audit log, is stored in a S Q Lite database with fifteen tables. Rasters, model checkpoints and analysis results stay as files, and the database records where they are. The model and graph analysis run in Python, and the results come back to the screen.`,
  act: async d => { await d.overlay(true); await d.wait(9000); await d.moveTo({ xy: [800, 470] }, 900); await d.wait(9000); await d.overlay(false); } },

// ───────────────────────── 15. RECAP
{ ch: '15 · Recap', page: '/command', click: 'Sidebar → Dashboard', expect: 'Command Center overview',
  point: 'End-to-end operational workflow in one product.',
  say: `Back to the Command Center. So the complete workflow is: satellite observation, habitat detection, patch extraction, connectivity analysis, criticality assessment, what-if simulation, restoration prioritisation, field verification, and reporting. The key idea is that EcoConnectAI does not stop at showing where habitat exists. It shows how patches relate to one another, identifies structurally important patches, estimates the consequences of losing them, and supports restoration planning, while being clear about what is real and what is still in development. Thank you.`,
  act: async d => { await d.click({ text: 'Dashboard', tag: 'a', region: SIDEBAR }); await d.wait(4000); await d.moveTo({ xy: [720, 420] }, 1200); await d.wait(4000); await d.moveTo({ text: 'Landscape Metrics' }, 1200); await d.wait(4000); await d.moveTo({ xy: [720, 760] }, 1200); await d.wait(5000); } },
];
