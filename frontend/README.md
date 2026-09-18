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

---

## Integration with the real pipeline (added 2026-09-18)

This interface is now backed by the FastAPI service in `../backend` and the analysis pipeline in
`../ecoconnect`. The "Prototype note" above still describes the **mock fallback**: when the backend is
offline or no run exists for a study area, the pages show the prepared datasets and the header badge says
*Prototype · synthetic*. When a pipeline run exists, every getter in `lib/data.ts` returns the real run
instead and the badge states its provenance.

```bash
npm install
cp .env.example .env.local       # NEXT_PUBLIC_API_URL, default http://localhost:8000
npm run dev                      # http://localhost:3000   (backend: uvicorn backend.main:app --port 8000)
```

* `lib/api.ts` — backend client. `lib/data.ts` — live-bundle registry with labelled mock fallback.
* `hooks/use-analysis.tsx` — loads the latest run per scene; exact what-if (paper Eq. 10) via `POST /what-if`.
* `components/shared/provenance-badge.tsx` — header badge stating the data source of every number.
* `app/simulation/page.tsx` — the heuristic what-if of the prototype is used only for mock data and is
  labelled as a heuristic; live runs show C(G) retained, ΔC, components, severed links, isolated patches.
* Scenario projections, the 2020–25 timeline, reports, history and the assistant are prototype
  demonstration content outside the paper's pipeline and remain mock in every mode.
