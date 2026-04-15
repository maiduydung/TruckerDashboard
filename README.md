# Pathfinder Trucker Dashboard

Owner-facing SPA dashboard for tracking trucker trips, costs, weights, and shipment contracts. Built with **SvelteKit 2 + Svelte 5**, deployed as a static SPA on **Azure Static Web Apps**.

## System Overview

```mermaid
graph TB
    subgraph "Mobile"
        A[TruckerMobile<br/>React Native / Expo]
    end

    subgraph "Azure Cloud"
        B[Azure Function App<br/>Python 3.11]
        C[(PostgreSQL<br/>Flexible Server)]
        D[Azure Static Web Apps]
    end

    subgraph "Dashboard"
        E[TruckerDashboard<br/>SvelteKit SPA]
    end

    A -- "POST/PUT/DELETE /api/trips" --> B
    B -- "SQL" --> C
    E -- "GET /api/dashboard/*" --> B
    E -- "GET/POST/PUT/DELETE /api/contracts" --> B
    D -- "Hosts" --> E
```

## Features

### Trip Management (Tổng quan tab)
- **Metric cards**: Total trips, advance payments, total costs
- **Interactive charts**: Cost breakdown by driver, weight by driver, cost categories, trips over time (Chart.js)
- **Detailed trip table**: Multi-stop expansion, per-stop weights, balance tracking, additional cost tags, driver notes, Ngày gửi + Ngày nhận columns, Dầu HN (liters)
- **Filters**: Driver, pickup location, delivery location, status (draft/completed), time range (7/14/30/90 presets + custom integer input). Location dropdowns are populated from `/dashboard/locations` so new shipping sites show up automatically.
- **Explicit range label**: pill under the filters shows the concrete `Từ DD/MM/YYYY đến DD/MM/YYYY` window; same label travels into every export.
- **Filter totals**: when a location filter is active, a summary bar shows matched trip count + aggregate KG lấy / KG giao.
- **Pagination**: trip-aware (multi-stop trips stay grouped), 10/20/50/100 per page.
- **Low-balance alerts**: Amber banner when any trucker's closing balance < 500,000 VND
- **Multi-format export** (CSV, Excel, PDF, JSON): honors all client-side filters, splits phát sinh into 9 category columns, embeds Roboto for Vietnamese diacritics in PDF.

### Shipment Contracts (Hợp đồng tab)
- **Contract CRUD**: Create, edit, delete shipment contracts with target tonnage, price/kg, and date range
- **Auto-matching**: Trips are matched to contracts by pickup OR delivery location matching the contract subject (đối tượng hợp đồng), within the contract date range
- **Progress tracking**: Real-time completion percentage with visual progress bars
- **Color-coded status**: Blue (on track), amber (≥80%), red (overdue), green (completed)
- **Contract alerts**: Banner notification when contracts reach ≥90% completion

```mermaid
flowchart LR
    subgraph "Contract Matching"
        A[Contract<br/>subject = 'YP'] --> B{Trip stops}
        B -->|pickup: YP| C[Match ✓]
        B -->|delivery: LHH| D[No match]
        C --> E[Sum delivery<br/>weights only]
        E --> F[60.350 / 100.000 kg<br/>60.4%]
    end
```

### Authentication
- **Google OAuth**: Allowlisted email addresses only
- **Session-based**: Stored in sessionStorage, clears on tab close

## Architecture

```
src/
├── routes/+page.svelte         # Main page with tab navigation (Tổng quan / Hợp đồng)
├── lib/
│   ├── api/
│   │   ├── client.ts           # API client (dashboard + contract endpoints)
│   │   └── types.ts            # TypeScript interfaces (Trip, Contract, etc.)
│   ├── contracts/
│   │   └── ContractTab.svelte  # Contract management UI (cards, form, progress bars)
│   ├── charts/                 # Chart.js components (CostBreakdown, WeightChart, Timeline, CostCategories)
│   ├── exports/exporter.ts     # Multi-format export (CSV, Excel, PDF, JSON)
│   └── format.ts               # VND currency formatting, date helpers
├── app.css                     # Global design system (Inter font, CSS variables)
└── +layout.ts                  # prerender=true, ssr=false (static SPA)
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Single-page with tabs | Contracts and trips share context (same API base, same drivers). Tabs keep navigation simple. |
| Contract matching at query time | No FK links to trips — matching by location + date range is computed server-side via PostgreSQL lateral join. Simple, no sync issues. |
| Delivery weights only | Contract fulfillment counts only delivery stop weights, not pickup. Pickup weight ≠ delivered goods. |
| Extracted ContractTab component | Keeps +page.svelte manageable (~380 lines) by isolating the contracts UI (~210 lines) into its own component. |

## Development

```bash
npm install
npm run dev          # localhost:5173
npm run build        # Production build → /build
npm run check        # Type check + Svelte validation
```

## Deployment

```bash
./scripts/deploy.sh  # Build + deploy to Azure Static Web Apps
```

Requires Azure CLI login (`az login`). Deploys to: `https://thankful-water-0807a7b00.1.azurestaticapps.net`

## Related Repos

- **[TruckerMobileBackend](https://github.com/maiduydung/TruckerMobileBackend)** — Azure Function App API (trips, contracts, alerts)
- **[TruckerMobile](https://github.com/maiduydung/TruckerMobile)** — React Native/Expo mobile app for drivers
