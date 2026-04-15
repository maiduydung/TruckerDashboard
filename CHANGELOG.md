# Changelog

## v1.1.0 — 2026-04-15

### Trip table: more data, more precision

- **New columns**: Ngày nhận (server-receipt timestamp), Dầu HN (liters), Ghi chú (driver notes)
- **Custom date range**: number input alongside the 7/14/30/90 preset dropdown — accepts any integer ≥ 1 day
- **Explicit range pill**: e.g. `📅 Từ 16/03/2026 đến 15/04/2026 · 30 ngày gần nhất` so the user can see the exact window at a glance (and the same label is injected into every export)
- **Full location list**: pickup/delivery filter dropdowns now union the backend's `/dashboard/locations` response with currently-loaded trips — locations outside the active date window show up too
- **Filter totals**: when a pickup or delivery filter is active, a summary bar under the table shows total trips + aggregate KG lấy / KG giao for the matched set
- **Pagination**: trips table paginates at 20 per page (10/20/50/100 selector) with trip-aware slicing so multi-stop trips stay grouped on one page

### Exports: everything the mobile app records

- **Per-category additional-cost columns**: exports now split phát sinh into 9 fixed columns (Xe xúc, Lò hơi, Cân xe, Cơm, Bồi dưỡng cân, Bảo vệ, Va vỡ, Rửa xe, Khác) with diacritic-insensitive matching; unknowns fall into Khác
- **New export columns**: Ngày nhận, Dầu HN (L), Dư đầu, Dư cuối, Ghi chú
- **Filter-aware exports**: CSV/Excel/JSON/PDF now honor pickup, delivery, driver, and status filters — not just the server-side date range
- **Range + filter label** written into every export (top line of CSV, merged title row in Excel, `Khoảng thời gian` key in JSON, subtitle in PDF)

### PDF rendering

- **Vietnamese diacritics fixed**: Embedded Roboto Regular + Bold TTFs and registered them with jsPDF via `addFileToVFS` + `addFont`. jsPDF's built-in fonts are ASCII-only and were mangling `Bắc`/`Dầu`/etc. into per-byte gibberish.
- **PDF layout trimmed**: dropped the 9 category columns from the PDF only (they remain in CSV/Excel/JSON) so the A4 landscape table stays readable. Column alignment tuned per type (right for numbers, center for dates/status).

### UI polish

- Totals and pagination lifted out of the table's horizontal scroll container so they stay anchored to the card edges when scrolling the wide table sideways.

## v1.0.0 — 2026-04-06

### Shipment contract tracking (Hợp đồng tab)

- **New "Hợp đồng" tab**: Underline-style tab navigation between "Tổng quan" (existing dashboard) and "Hợp đồng" (contracts)
- **Contract CRUD**: Create, edit, and delete shipment contracts with: tên hợp đồng, đối tượng hợp đồng, khối lượng cần giao (kg), đơn giá (1000đ/kg), thời hạn (start/end date), ghi chú
- **Auto-matching**: Contracts auto-match trips where any stop (pickup OR delivery) location matches the contract subject, within the contract date range. Only delivery weights are counted toward fulfillment.
- **Progress cards**: Full-width cards with colored left border (blue/amber/red/green), gradient progress bars, large percentage display, and horizontal stats row (còn lại, giá trị HĐ, đơn giá, thời gian)
- **Contract alerts**: Purple banner at top of contracts tab when any contract reaches ≥90% completion
- **Vietnamese diacritics**: All UI labels use proper tiếng Việt có dấu

### Technical details

- New component: `src/lib/contracts/ContractTab.svelte` — extracted to keep +page.svelte manageable
- New types: `Contract`, `ContractForm` interfaces in `types.ts`
- New API functions: `fetchContracts()`, `createContract()`, `updateContract()`, `deleteContract()` in `client.ts`
- Tab state managed via `$state<'dashboard' | 'contracts'>` — filters hidden when on contracts tab

## v0.9.0 — 2026-04-06

### Pickup & delivery location filters

- **New filter dropdowns**: "Tất cả nơi lấy" and "Tất cả nơi giao" in the header bar
- Locations are dynamically populated from loaded trip data
- Client-side filtering — selecting a location shows only trips with matching stops
- Multi-stop trip grouping preserved (if any stop matches, all rows for that trip display)

### Low-balance alert banner

- **Alert banner**: Amber notification at top of dashboard when any trucker's closing balance < 500,000 VND
- Lists affected drivers with their current balance
- **Inline warning badge**: `!` indicator on the "Dư cuối" column for low-balance rows
- Color-coded: amber for low (0–500k), red for negative balances

### Shipment contract tracking spec

- Added `docs/FEATURE-SHIPMENT-CONTRACTS.md` — detailed design for contract fulfillment tracking (pending client review)

## v0.8.1 — 2026-04-02

### Fix total cost calculation

- **Tổng chi phí card**: Now uses `totalCost` from the summary API (sum of all `total_cost`) instead of only `totalFuel + totalLoading`, which was missing additional costs (xe xúc, lò hơi, cơm, etc.)

## v0.8.0 — 2026-04-02

### Google OAuth login

- **Google Sign-In**: Users must authenticate with Google before accessing the dashboard
- **Email allowlist**: Only `maiduydungvn@gmail.com` and `vuthibichtrang@gmail.com` can access the app
- **Access denied page**: Unauthorized emails see a denial message with option to switch accounts
- **User bar**: Shows logged-in user avatar, email, and logout button at the top of the dashboard
- **Session persistence**: Auth state stored in `sessionStorage` (clears on tab close)
- **Renamed title**: "Pathfinder Dashboard" → "Pathfinder Trucker Dashboard"

## v0.7.0 — 2026-04-01

### Multi-stop trip expansion

- **New "Chuyến" column**: Shows per-driver trip number (chronological within filter window)
- **Expanded rows**: Multi-stop trips (e.g. 2 pickups + 2 deliveries) now display as separate rows — one per pickup/delivery pair — grouped by trip number
- **Split route columns**: Replaced single "Tuyến" column with separate "Nơi lấy" and "Nơi giao" columns showing one location per row
- **Per-stop weights**: KG lấy / KG giao now show per-stop weight instead of aggregated totals
- **Trip-level fields**: Financials, status, date, and balances appear only on the first row of each trip group; continuation rows show only stop-specific data
- **Visual grouping**: Multi-stop continuation rows use dashed borders and muted text; trip badge is highlighted blue for multi-stop trips
- **All exports updated**: CSV, Excel, PDF, and JSON all use the same expanded row format with the Chuyến column

### Technical notes

- No database or backend changes required — the existing `stops` JSONB column already supports multi-stop data
- Trip numbering is computed client-side from chronological order per driver

## v0.6.0 — 2026-04-01

- Add Dư đầu and Dư cuối (opening/closing balance) columns to trip table
- Balance chaining support across the dashboard
