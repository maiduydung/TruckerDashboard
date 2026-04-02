# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

```bash
npm run dev          # Start dev server (localhost:5173)
npm run build        # Production build → /build directory
npm run preview      # Preview production build
npm run check        # Type check + Svelte validation
npm run check:watch  # Type check in watch mode
```

No test framework is configured.

## Architecture

**SvelteKit 2 + Svelte 5** single-page dashboard for tracking trucker trips, costs, and weights. Deployed as a **prerendered static SPA** on Azure Static Web Apps via `@sveltejs/adapter-static`.

- `+layout.ts` sets `prerender = true` and `ssr = false` — purely client-rendered
- Svelte 5 **runes** enabled globally (`$state`, `$derived`, `$effect`, `$props`)
- No centralized store — all state lives in `+page.svelte`

### Key Directories

- `src/routes/` — Single route: `+page.svelte` is the entire app (filters, metrics cards, charts, data table, export buttons)
- `src/lib/api/client.ts` — Fetch functions for 3 endpoints: `/dashboard/summary`, `/dashboard/trips`, `/dashboard/drivers`
- `src/lib/api/types.ts` — TypeScript interfaces (`Trip`, `DisplayRow`, `Filters`, `DashboardSummary`, `StopRecord`)
- `src/lib/charts/` — Four Chart.js components: `CostBreakdown`, `CostCategories`, `Timeline`, `WeightChart`
- `src/lib/exports/exporter.ts` — Multi-format export (CSV, Excel via xlsx-js-style, PDF via jspdf, JSON)
- `src/lib/format.ts` — VND currency formatting, date helpers

### Data Flow

1. On mount, filters trigger `loadData()` → `Promise.all([fetchSummary, fetchTrips])`
2. API base URL comes from `import.meta.env.VITE_API_URL` (set in `.env` / `.env.production`)
3. Trips with multiple stops are expanded client-side into per-stop `DisplayRow`s via `expandTrips()` in `+page.svelte`
4. Charts use `$effect` to imperatively call `chart.update()` when trip data changes

### Multi-Stop Trip Expansion

A single `Trip` can have multiple pickup/delivery stops stored as JSON in the `stops` field. The `expandTrips()` function generates `Math.max(pickups, deliveries, 1)` rows per trip. First row carries financial data; continuation rows show only stop-level location/weight. This same expansion logic is used in exports (`expandToRows()` in exporter.ts).

### Styling

- Global design system in `app.css` — Inter font, primary blue `#1273FF`
- Component-scoped `<style>` blocks
- Responsive breakpoint at 768px
