# Changelog

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
