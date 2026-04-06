<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchSummary, fetchTrips, fetchDrivers } from '$lib/api/client';
	import type { DashboardSummary, Trip, Filters, DisplayRow, StopRecord } from '$lib/api/types';
	import { vnd, formatDate } from '$lib/format';
	import { exportCSV, exportExcel, exportJSON, exportPDF } from '$lib/exports/exporter';
	import CostBreakdown from '$lib/charts/CostBreakdown.svelte';
	import WeightChart from '$lib/charts/WeightChart.svelte';
	import Timeline from '$lib/charts/Timeline.svelte';
	import CostCategories from '$lib/charts/CostCategories.svelte';

	let drivers: string[] = $state([]);
	let summary: DashboardSummary | null = $state(null);
	let trips: Trip[] = $state([]);
	let loading = $state(true);
	let error = $state('');

	let filters: Filters = $state({ driver: '', status: '', days: 7 });
	let pickupFilter = $state('');
	let deliveryFilter = $state('');

	function getSummaryTotalCost(summaryValue: DashboardSummary): number {
		const summaryAny = summaryValue as unknown as { totalCost?: number; total_cost?: number };
		return summaryAny.totalCost ?? summaryAny.total_cost ?? summaryValue.totalFuel + summaryValue.totalLoading;
	}

	function parseStops(raw: StopRecord[] | string): StopRecord[] {
		try {
			const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
			return Array.isArray(arr) ? arr : [];
		} catch { return []; }
	}

	function expandTrips(rawTrips: Trip[]): DisplayRow[] {
		const tripNumberMap = new Map<string, number>();
		const driverGroups = new Map<string, Trip[]>();
		for (const t of rawTrips) {
			if (!driverGroups.has(t.driver_name)) driverGroups.set(t.driver_name, []);
			driverGroups.get(t.driver_name)!.push(t);
		}
		for (const [, dTrips] of driverGroups) {
			const sorted = [...dTrips].sort(
				(a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
			);
			sorted.forEach((t, i) => tripNumberMap.set(t.id, i + 1));
		}

		const rows: DisplayRow[] = [];
		for (const t of rawTrips) {
			const stops = parseStops(t.stops);
			const pickups = stops.filter(s => s.type === 'pickup');
			const deliveries = stops.filter(s => s.type === 'delivery');
			const rowCount = Math.max(pickups.length, deliveries.length, 1);

			for (let i = 0; i < rowCount; i++) {
				rows.push({
					tripId: t.id,
					driverName: t.driver_name,
					tripNumber: tripNumberMap.get(t.id) || 1,
					submittedAt: t.submitted_at,
					isDraft: t.is_draft,
					pickupLocation: pickups[i]?.location || '',
					pickupWeightKg: pickups[i]?.weightKg || 0,
					deliveryLocation: deliveries[i]?.location || '',
					deliveryWeightKg: deliveries[i]?.weightKg || 0,
					advancePayment: t.advance_payment,
					openingBalance: t.opening_balance,
					fuelNamPhatVnd: t.fuel_nam_phat_vnd,
					loadingFeeVnd: t.loading_fee_vnd,
					additionalCosts: t.additional_costs,
					additionalTotal: t.additionalTotal,
					totalCost: t.totalCost,
					closingBalance: t.closing_balance,
					isFirstRow: i === 0,
					rowsInGroup: rowCount,
				});
			}
		}
		return rows;
	}

	let allDisplayRows: DisplayRow[] = $derived(expandTrips(trips));

	let pickupLocations: string[] = $derived(
		[...new Set(allDisplayRows.map(r => r.pickupLocation).filter(Boolean))].sort()
	);
	let deliveryLocations: string[] = $derived(
		[...new Set(allDisplayRows.map(r => r.deliveryLocation).filter(Boolean))].sort()
	);

	let displayRows: DisplayRow[] = $derived.by(() => {
		if (!pickupFilter && !deliveryFilter) return allDisplayRows;

		const matchingTripIds = new Set<string>();
		for (const row of allDisplayRows) {
			const pickupMatch = !pickupFilter || row.pickupLocation === pickupFilter;
			const deliveryMatch = !deliveryFilter || row.deliveryLocation === deliveryFilter;
			if (pickupMatch && deliveryMatch) {
				matchingTripIds.add(row.tripId);
			}
		}
		return allDisplayRows.filter(r => matchingTripIds.has(r.tripId));
	});

	interface LowBalanceDriver { name: string; balance: number }
	let lowBalanceDrivers: LowBalanceDriver[] = $derived.by(() => {
		const latest = new Map<string, number>();
		for (const row of allDisplayRows) {
			if (row.isFirstRow) {
				const existing = latest.get(row.driverName);
				if (existing === undefined || row.closingBalance < existing) {
					latest.set(row.driverName, row.closingBalance);
				}
			}
		}
		const result: LowBalanceDriver[] = [];
		for (const [name, balance] of latest) {
			if (balance < 500000) result.push({ name, balance });
		}
		return result.sort((a, b) => a.balance - b.balance);
	});

	async function loadData() {
		loading = true;
		error = '';
		try {
			const [s, t] = await Promise.all([fetchSummary(filters), fetchTrips(filters)]);
			summary = s;
			trips = t;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Không thể tải dữ liệu';
		} finally {
			loading = false;
		}
	}

	onMount(async () => {
		try {
			drivers = await fetchDrivers();
		} catch {}
		await loadData();
	});

	function handleFilterChange() {
		loadData();
	}

	interface CostEntry { name: string; amountVnd: number; note: string }

	function parseAdditional(raw: string | CostEntry[]): CostEntry[] {
		try {
			const items = typeof raw === 'string' ? JSON.parse(raw) : raw;
			return Array.isArray(items) ? items.filter(c => c.name && c.amountVnd > 0) : [];
		} catch { return []; }
	}
</script>

<div class="container">
	<div class="header">
		<div class="header-left">
			<h1><span class="logo-accent">Pathfinder</span> Trucker Dashboard</h1>
		</div>
		<div class="filters">
			<select bind:value={filters.driver} onchange={handleFilterChange}>
				<option value="">Tất cả tài xế</option>
				{#each drivers as d}
					<option value={d}>{d}</option>
				{/each}
			</select>
			<select bind:value={pickupFilter}>
				<option value="">Tất cả nơi lấy</option>
				{#each pickupLocations as loc}
					<option value={loc}>{loc}</option>
				{/each}
			</select>
			<select bind:value={deliveryFilter}>
				<option value="">Tất cả nơi giao</option>
				{#each deliveryLocations as loc}
					<option value={loc}>{loc}</option>
				{/each}
			</select>
			<select bind:value={filters.status} onchange={handleFilterChange}>
				<option value="">Tất cả trạng thái</option>
				<option value="completed">Hoàn tất</option>
				<option value="draft">Nháp</option>
			</select>
			<select bind:value={filters.days} onchange={handleFilterChange}>
				<option value={0}>Tất cả</option>
				<option value={7}>7 ngày</option>
				<option value={14}>14 ngày</option>
				<option value={30}>30 ngày</option>
				<option value={90}>90 ngày</option>
			</select>
		</div>
	</div>

	{#if error}
		<div class="error">{error}</div>
	{/if}

	{#if lowBalanceDrivers.length > 0}
		<div class="alert-banner">
			<div class="alert-icon">!</div>
			<div class="alert-content">
				<strong>Cần ứng thêm</strong>
				<span class="alert-detail">
					{#each lowBalanceDrivers as d, i}
						{#if i > 0}<span class="alert-sep">·</span>{/if}
						<span class="alert-driver">{d.name}</span> dư <span class="alert-amount">{vnd(d.balance)}đ</span>
					{/each}
				</span>
			</div>
		</div>
	{/if}

	{#if loading}
		<div class="loading">Đang tải dữ liệu...</div>
	{:else if summary && trips.length > 0}
		<div class="metrics">
			<div class="metric-card">
				<div class="metric-value">{summary.totalTrips} <span class="metric-unit">chuyến</span></div>
				<div class="metric-label">{summary.completedTrips} hoàn tất · {summary.draftTrips} nháp</div>
			</div>
			<div class="metric-card">
				<div class="metric-value">{vnd(summary.totalAdvance)}<span class="metric-unit">đ</span></div>
				<div class="metric-label">Tiền ứng trước</div>
			</div>
			<div class="metric-card">
				<div class="metric-value muted">{vnd(getSummaryTotalCost(summary))}<span class="metric-unit">đ</span></div>
				<div class="metric-label">Tổng chi phí</div>
			</div>
		</div>

		<div class="charts">
			<div class="chart-card">
				<h2>Chi phí theo tài xế</h2>
				<CostBreakdown {trips} />
			</div>
			<div class="chart-card">
				<h2>Khối lượng theo tài xế</h2>
				<WeightChart {trips} />
			</div>
		</div>

		<div class="charts">
			<div class="chart-card">
				<h2>Chi phí phát sinh theo loại</h2>
				<CostCategories {trips} />
			</div>
			<div class="chart-card">
				<h2>Chuyến theo ngày</h2>
				<Timeline {trips} />
			</div>
		</div>

		<div class="table-wrap">
			<h2>Chi tiết chuyến</h2>
			<table>
				<thead>
					<tr>
						<th>Tài xế</th>
						<th>Chuyến</th>
						<th>Nơi lấy</th>
						<th>Nơi giao</th>
						<th>Ngày</th>
						<th>KG lấy</th>
						<th>KG giao</th>
						<th>Tiền ứng</th>
						<th>Dư đầu</th>
						<th>Dầu NP</th>
						<th>Bốc xếp</th>
						<th>Phát sinh</th>
						<th>Tổng CP</th>
						<th>Dư cuối</th>
						<th>Trạng thái</th>
					</tr>
				</thead>
				<tbody>
					{#each displayRows as row, idx}
						{@const costs = row.isFirstRow ? parseAdditional(row.additionalCosts) : []}
						{@const isGroupStart = row.isFirstRow && row.rowsInGroup > 1}
						{@const isGroupCont = !row.isFirstRow}
						<tr class:group-start={isGroupStart} class:group-cont={isGroupCont}>
							<td><strong>{row.driverName}</strong></td>
							<td class="number trip-num">
								<span class="trip-badge" class:multi={row.rowsInGroup > 1}>{row.tripNumber}</span>
							</td>
							<td class="route-cell">
								{#if row.pickupLocation}
									{row.pickupLocation}
								{:else}
									<span class="text-muted">—</span>
								{/if}
							</td>
							<td class="route-cell">
								{#if row.deliveryLocation}
									{row.deliveryLocation}
								{:else}
									<span class="text-muted">—</span>
								{/if}
							</td>
							<td>{row.isFirstRow ? formatDate(row.submittedAt) : ''}</td>
							<td class="number">{row.pickupWeightKg ? row.pickupWeightKg.toLocaleString() : ''}</td>
							<td class="number">{row.deliveryWeightKg ? row.deliveryWeightKg.toLocaleString() : ''}</td>
							<td class="number">{row.isFirstRow ? vnd(row.advancePayment) : ''}</td>
							<td class="number">{row.isFirstRow ? vnd(row.openingBalance) : ''}</td>
							<td class="number">{row.isFirstRow ? vnd(row.fuelNamPhatVnd) : ''}</td>
							<td class="number">{row.isFirstRow ? vnd(row.loadingFeeVnd) : ''}</td>
							<td class="number">
								{#if row.isFirstRow}
									{#if costs.length > 0}
										<div class="cost-tags">
											{#each costs as c}
												<span class="cost-tag" title={c.note || c.name}>{c.name} {vnd(c.amountVnd)}đ</span>
											{/each}
										</div>
									{:else}
										<span class="text-muted">—</span>
									{/if}
								{/if}
							</td>
							<td class="number total-col">{#if row.isFirstRow}<strong>{vnd(row.totalCost)}</strong>{/if}</td>
							<td class="number">
								{#if row.isFirstRow}
									<span class="closing-balance" class:balance-low={row.closingBalance < 500000 && row.closingBalance >= 0} class:balance-negative={row.closingBalance < 0} class:balance-ok={row.closingBalance >= 500000}>
										{vnd(row.closingBalance)}
										{#if row.closingBalance < 500000}
											<span class="balance-alert" title="Dư cuối dưới 500,000đ — cần ứng thêm">!</span>
										{/if}
									</span>
								{/if}
							</td>
							<td>
								{#if row.isFirstRow}
									{#if row.isDraft}
										<span class="status status-draft">Nháp</span>
									{:else}
										<span class="status status-done">Xong</span>
									{/if}
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<div class="export-section">
			<h2>Xuất dữ liệu</h2>
			<div class="export-bar">
				<button class="btn" onclick={() => exportCSV(trips)}>CSV</button>
				<button class="btn" onclick={() => exportExcel(trips)}>Excel</button>
				<button class="btn" onclick={() => exportJSON(trips)}>JSON</button>
				<button class="btn btn-primary" onclick={() => exportPDF(trips)}>PDF</button>
			</div>
		</div>
	{:else}
		<div class="empty">Không có dữ liệu cho bộ lọc này.</div>
	{/if}
</div>

<style>
	.text-muted { color: #d1d5db; }

	.route-cell { white-space: nowrap; }

	.trip-num { text-align: center !important; }
	.trip-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 24px;
		height: 24px;
		border-radius: 6px;
		font-size: 12px;
		font-weight: 700;
		background: var(--blue-light);
		color: var(--blue);
	}
	.trip-badge.multi {
		background: var(--blue);
		color: white;
	}

	tr.group-start td { border-bottom: none; }
	tr.group-cont td {
		border-top: 1px dashed var(--border);
		border-bottom: 1px solid var(--border);
		color: var(--text-muted);
		font-size: 12px;
	}
	tr.group-cont .route-cell { color: var(--text-secondary); font-size: 13px; }

	.cost-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.cost-tag {
		display: inline-block;
		padding: 2px 8px;
		border-radius: 12px;
		font-size: 11px;
		font-weight: 600;
		white-space: nowrap;
		letter-spacing: -0.2px;
	}

	.cost-tag:nth-child(7n+1) { background: #e8f0fe; color: #1273FF; }
	.cost-tag:nth-child(7n+2) { background: #ccfbf1; color: #0d9488; }
	.cost-tag:nth-child(7n+3) { background: #fef3c7; color: #b45309; }
	.cost-tag:nth-child(7n+4) { background: #ede9fe; color: #7c3aed; }
	.cost-tag:nth-child(7n+5) { background: #fce7f3; color: #db2777; }
	.cost-tag:nth-child(7n+6) { background: #cffafe; color: #0891b2; }
	.cost-tag:nth-child(7n+7) { background: #d1fae5; color: #059669; }

	.total-col { color: #1a1d23; }

	.metric-unit {
		font-size: 14px;
		font-weight: 600;
		opacity: 0.7;
	}

	.btn-primary {
		background: #1273FF;
		color: white;
		border-color: #1273FF;
	}

	.btn-primary:hover {
		background: #0d5bbf;
		border-color: #0d5bbf;
	}

	/* ── Balance alert ────────────────────────────────── */
	.closing-balance {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-weight: 600;
	}

	.balance-ok { color: #059669; }
	.balance-low { color: #d97706; }
	.balance-negative { color: #ef4444; }

	.balance-alert {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		border-radius: 50%;
		font-size: 11px;
		font-weight: 800;
		line-height: 1;
		cursor: help;
	}

	.balance-low .balance-alert {
		background: var(--amber-bg);
		color: var(--amber);
		border: 1.5px solid #fbbf24;
	}

	.balance-negative .balance-alert {
		background: #fef2f2;
		color: #ef4444;
		border: 1.5px solid #fca5a5;
	}

	/* ── Top alert banner ────────────────────────────── */
	.alert-banner {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px 20px;
		margin-bottom: 20px;
		background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
		border: 1px solid #fbbf24;
		border-radius: 12px;
		box-shadow: 0 1px 3px rgba(217, 119, 6, 0.1);
	}

	.alert-icon {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: #f59e0b;
		color: white;
		font-size: 14px;
		font-weight: 800;
	}

	.alert-content {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 6px;
		font-size: 13px;
		color: #92400e;
	}

	.alert-content strong {
		font-weight: 700;
		color: #78350f;
		margin-right: 4px;
	}

	.alert-detail {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px;
	}

	.alert-driver { font-weight: 600; color: #92400e; }
	.alert-amount { font-weight: 700; font-variant-numeric: tabular-nums; }
	.alert-sep { color: #d97706; margin: 0 2px; }
</style>
