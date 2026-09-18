# Major-Project-Prototype

# EcoConnectAI

**AI-powered Coastal Habitat Connectivity Analysis & Conservation Decision Support System**

A high-fidelity software prototype that simulates how an AI-driven coastal conservation
platform works end to end: a satellite scene goes in, and a decision-ready conservation
recommendation comes out.

> **Prototype note.** This is a product prototype, not a machine-learning implementation.
> All analysis output is served from prepared mock datasets so the full pipeline can be
> demonstrated without a processing backend. There is no Python, no backend, and no database.

---

## The story it tells

A government officer receives a new Sentinel-2 image of a coastal ecosystem. Instead of
manually analysing it in desktop GIS software, they upload it to EcoConnectAI, which:

1. detects and segments habitat
2. estimates ecological connectivity
3. identifies critical habitat corridors
4. generates a connectivity sensitivity heatmap
5. simulates habitat destruction
6. recommends restoration priorities under a budget
7. explains *why* specific locations matter
8. generates a scientific conservation report

---

## Implemented functionality

| # | Feature | Route |
|---|---------|-------|
| 1 | Landing page — animated globe, live statistics, research contribution | `/` |
| 2 | Dashboard — KPI cards, animated counters, sidebar navigation | `/dashboard` |
| 3 | Upload — drag & drop + 4 demo datasets | `/upload` |
| 4 | Analysis pipeline — 7 animated stages with live processing log | `/analysis/running` |
| 5 | Results dashboard — split satellite / heatmap view + summary bar | `/analysis` |
| 6 | Interactive GIS map — layers, basemaps, legend, compass, scale, minimap, coordinates | `/analysis` |
| 7 | Habitat connectivity graph — React Flow network, clickable nodes | `/graph` |
| 8 | Connectivity heatmap — 4-band sensitivity surface with opacity slider | `/analysis` |
| 9 | Pixel inspector — click any patch or cell for a full readout | `/analysis` |
| 10 | Explainability panel — bridge score, alternative routes, importance timeline | `/analysis`, `/graph` |
| 11 | What-if simulator — remove patches or draw a polygon, watch the network re-solve | `/simulation` |
| 12 | Scenario simulator — cyclone, urban expansion, sea level rise, aquaculture, roads, encroachment | `/simulation` |
| 13 | Restoration recommendation — ₹10 lakh → ₹5 crore budget slider with ranked priorities | `/simulation` |
| 14 | Timeline — 2020–2025, updates map, graph and statistics | `/simulation` |
| 15 | AI assistant — floating chat panel with intelligent predefined responses (`⌘K`) | global |
| 16 | Scientific report — full assessment with tables, methodology, PDF export | `/reports` |
| 17 | History — previous analyses with search and filters | `/history` |
| 18 | Settings — theme, map style, units, export options | `/settings` |

### Analysis model

The prototype's numbers are internally consistent rather than arbitrary:

- **Habitat patches** carry area, quality, confidence, bridge score, sensitivity band,
  carbon stock and degradation risk.
- **The graph** links patches within a dispersal threshold; edge weight is derived from
  habitat quality and distance. An edge is marked a *critical corridor* when it is one of
  very few connections between two clusters.
- **The heatmap** is a leave-one-out marginal-importance surface, normalised per scene and
  contrast-curved — so it highlights narrow corridors rather than simply dense habitat.
- **The what-if simulator** weights bridging role far above raw area, which reproduces the
  headline finding: removing ~4% of habitat area can cost ~17 points of connectivity.

Every patch id referenced by the graph, heatmap, simulation, restoration and timeline files
resolves to a real patch — verified at generation time.

---

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui ·
Framer Motion · Leaflet · React Flow · Recharts · Lucide React

---

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run build   # production build
npm start       # serve the production build
```

---

## Deployment

Deployable to Vercel as-is — it is a static Next.js App Router project with no
environment variables, no backend and no database.

```bash
vercel
```

Or import the repository at [vercel.com/new](https://vercel.com/new); the framework is
detected automatically.

---

## Project structure

```
app/            routes (landing, dashboard, upload, analysis, graph, simulation, reports, history, settings)
components/     maps · charts · dashboard · graph · report · chat · simulation · landing · ui
mock-data/      10 self-consistent JSON datasets across 4 coastal landscapes
hooks/          analysis context, animated counters
lib/            typed data-access layer, constants
types/          shared domain model
utils/          formatting helpers
```

## Datasets

Four Indian coastal landscapes, each with its own habitat mask, graph, heatmap,
connectivity metrics, scenarios, restoration plan and timeline:

- **Kerala Coast** — Vembanad–Kol Wetland (Ramsar)
- **Sundarbans** — Western Delta Block (UNESCO)
- **Gulf of Mannar** — Island Reef Chain (Marine National Park)
- **Odisha Coast** — Bhitarkanika Delta (Ramsar)
