# EcoConnectAI — frontend

The original prototype interface (Next.js 16, React 19, Tailwind v4, Leaflet, React Flow, Recharts), now
backed by the FastAPI service in `../backend`.

```bash
npm install
cp .env.example .env.local       # NEXT_PUBLIC_API_URL, default http://localhost:8000
npm run dev                      # http://localhost:3000
```

* `lib/api.ts` — backend client. `lib/data.ts` — live-bundle registry with mock fallback (labelled).
* `hooks/use-analysis.tsx` — loads the latest run per scene; exact what-if via `POST /what-if`.
* `components/shared/provenance-badge.tsx` — header badge stating the data source of every number.
* Scenario projections, the 2020–25 timeline, reports, history and the assistant are prototype
  demonstration content and remain mock in every mode.

The original prototype README is preserved in git history (`frontend/README.md` before commit d8f034e).
