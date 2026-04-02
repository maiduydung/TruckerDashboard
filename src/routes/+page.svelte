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

	let displayRows: DisplayRow[] = $derived(expandTrips(trips));

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
			<h1><span class="logo-accent">Nhu Tin</span> Trucker Dashboard</h1>
		</div>
		<div class="filters">
			<select bind:value={filters.driver} onchange={handleFilterChange}>
				<option value="">Tất cả tài xế</option>
				{#each drivers as d}
					<option value={d}>{d}</option>
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
				<div class="metric-value muted">{vnd(summary.totalFuel + summary.totalLoading)}<span class="metric-unit">đ</span></div>
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
									<span style="color: {row.closingBalance < 0 ? '#ef4444' : '#059669'}; font-weight: 600;">{vnd(row.closingBalance)}</span>
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
</style>
