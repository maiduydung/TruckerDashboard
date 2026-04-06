# Feature: Shipment Contract Tracking

**Priority**: High | **Status**: Implemented (v1.0.0 Dashboard / v0.7.0 Backend) | **Impact**: Must-have

## Problem

The client manages shipment contracts with suppliers (pickup) and customers (delivery), each with a target tonnage, price per unit, and date range. Currently there's no way to track fulfillment progress or get alerts when a contract is nearly complete. This causes:

- Missed renegotiation windows (new lot/price needed but nobody noticed the old one is almost done)
- Poor truck dispatching (didn't know they were close to fulfilling a delivery obligation)
- Manual tracking in spreadsheets/chat

## Client Examples

1. **Delivery contract**: "Deliver 250 tons to VTL from Apr 1-15." Alert when only 30 tons remain.
2. **Pickup contract**: "Pick up 300 tons from KG at 2,000/kg starting Apr 3." Alert when nearing completion so they can negotiate the next lot at a new price.

Both pickup and delivery contracts need this. Different customers/suppliers, different quantities, different date ranges, different prices.

## Proposed Data Model

### `contracts` table

| Column              | Type        | Description                                      |
|---------------------|-------------|--------------------------------------------------|
| `id`                | UUID / PK   | Contract ID                                      |
| `user_id`           | FK          | Owner (for multi-tenant data isolation)          |
| `type`              | ENUM        | `pickup` or `delivery`                           |
| `counterparty`      | VARCHAR     | Customer or supplier name (e.g., "VTL", "KG")    |
| `location`          | VARCHAR     | Associated pickup/delivery location              |
| `target_kg`         | DECIMAL     | Total contracted weight in kg                    |
| `price_per_kg`      | DECIMAL     | Price per kg in VND (nullable if not applicable)  |
| `start_date`        | DATE        | Contract start date                              |
| `end_date`          | DATE        | Contract end date                                |
| `alert_threshold_kg`| DECIMAL     | Remaining kg at which to fire alert              |
| `status`            | ENUM        | `active`, `completed`, `expired`, `cancelled`    |
| `notes`             | TEXT        | Free-text notes                                  |
| `created_at`        | TIMESTAMP   | Record creation time                             |
| `updated_at`        | TIMESTAMP   | Last update time                                 |

### `contract_trip_links` table (optional, for manual linking)

| Column        | Type   | Description                          |
|---------------|--------|--------------------------------------|
| `contract_id` | FK     | References `contracts.id`            |
| `trip_id`     | FK     | References `trips.id`                |
| `kg_applied`  | DECIMAL| Weight from this trip applied to contract |

## API Endpoints (TruckerMobileBackend)

Following the existing patterns in the backend:

| Method | Endpoint                          | Description                              |
|--------|-----------------------------------|------------------------------------------|
| GET    | `/api/contracts`                  | List contracts (with filters: type, status, counterparty) |
| GET    | `/api/contracts/:id`              | Get single contract with fulfillment summary |
| POST   | `/api/contracts`                  | Create new contract                      |
| PUT    | `/api/contracts/:id`              | Update contract                          |
| DELETE | `/api/contracts/:id`              | Soft-delete / cancel contract            |
| GET    | `/api/contracts/:id/progress`     | Fulfillment progress (fulfilled_kg, remaining_kg, %) |
| GET    | `/api/dashboard/contracts-summary`| Dashboard endpoint: all active contracts with progress |

## Trip-to-Contract Matching

Two approaches, can be combined:

### Option A: Auto-match by location + date range (simpler, less accurate)
- When calculating fulfillment, query trips where:
  - Stop location matches `contract.location`
  - Stop type matches `contract.type`
  - Trip date falls within `contract.start_date` to `contract.end_date`
- Sum the matched stop weights = `fulfilled_kg`
- Pro: No mobile app changes needed
- Con: Ambiguous if same location serves multiple contracts

### Option B: Manual linking from mobile app (more accurate, requires mobile change)
- Trucker selects the active contract when submitting a trip in TruckerMobile
- Creates a record in `contract_trip_links`
- Pro: Exact, no ambiguity
- Con: Extra step for truckers, requires mobile app update

### Recommendation
Start with **Option A** (auto-match) for the MVP. It works well if each location maps to roughly one active contract. Add Option B later if ambiguity becomes a real problem.

## Dashboard UI (TruckerDashboard)

### New "Hop dong" (Contracts) section
- Placed between the charts and the trip detail table
- Card-based layout, one card per active contract:
  - Header: counterparty name + type badge (Lay/Giao)
  - Progress bar showing `fulfilled_kg / target_kg`
  - Key stats: remaining kg, days left, price/kg
  - Color coding:
    - Green: on track (> threshold remaining)
    - Amber: approaching threshold (alert zone)
    - Red: overdue or past end_date with unfulfilled quantity

### Alert integration
- Contracts nearing threshold appear in the same alert banner as low-balance drivers
- Distinct styling (e.g., blue/purple vs amber) to differentiate from balance alerts

## Alert Logic (Logic App or Timer Function)

Reuses the same scheduled job planned for Feature 1 (balance alerts):

1. Timer fires every 4-6 hours
2. Calls `/api/dashboard/contracts-summary`
3. For each active contract where `remaining_kg <= alert_threshold_kg`:
   - Send email to mailing list
   - Include: counterparty, type, remaining kg, end date, % complete
4. Deduplication: don't re-alert for the same contract within 24 hours (track last alert time in DB or use a simple cache)

## Mobile App Changes (TruckerMobile)

### Phase 1 (no changes needed)
- Auto-matching handles everything server-side

### Phase 2 (if needed later)
- Contract selector dropdown on trip submission screen
- Only shows active contracts matching the trip's locations
- Optional — trucker can skip if unsure

## Security / Multi-tenancy

Per the client's note about data isolation:
- Contracts are scoped to `user_id` (the fleet owner)
- API endpoints enforce ownership via auth middleware
- Truckers (via mobile) don't see contracts directly — only the fleet owner dashboard shows them

## Implementation Order

1. **Backend**: Create `contracts` table + CRUD endpoints
2. **Backend**: Build auto-match fulfillment calculation logic
3. **Backend**: Add `/api/dashboard/contracts-summary` endpoint
4. **Dashboard**: Build contracts UI section with progress bars
5. **Dashboard**: Integrate contract alerts into alert banner
6. **Alert job**: Extend the balance-alert Logic App/Function to include contract threshold alerts
7. **(Later)** Mobile: Add contract selector to trip submission

## Open Questions

- Should contracts auto-close when `fulfilled_kg >= target_kg`, or require manual completion?
- Do we need historical contract reporting (past contracts, fulfillment rates)?
- Should the price_per_kg field affect cost calculations in the dashboard, or is it just informational?
- Multiple contracts for the same location + overlapping dates — how to handle in auto-match? (FIFO by start_date?)
