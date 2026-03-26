<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchSummary, fetchTrips, fetchDrivers } from '$lib/api/client';
	import type { DashboardSummary, Trip, Filters } from '$lib/api/types';
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
			<h1><span class="logo-accent">NhuTin</span> Dashboard</h1>
			<span class="subtitle">Quản lý vận tải</span>
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
						<th>Tuyến</th>
						<th>Ngày</th>
						<th>KG lấy</th>
						<th>KG giao</th>
						<th>Tiền ứng</th>
						<th>Dầu NP</th>
						<th>Bốc xếp</th>
						<th>Phát sinh</th>
						<th>Tổng CP</th>
						<th>Trạng thái</th>
					</tr>
				</thead>
				<tbody>
					{#each trips as t}
						{@const costs = parseAdditional(t.additional_costs)}
						<tr>
							<td><strong>{t.driver_name}</strong></td>
							<td class="route">{t.pickup_location} <span class="arrow">→</span> {t.delivery_location}</td>
							<td>{formatDate(t.submitted_at)}</td>
							<td class="number">{t.pickup_weight_kg.toLocaleString()}</td>
							<td class="number">{t.delivery_weight_kg.toLocaleString()}</td>
							<td class="number">{vnd(t.advance_payment)}</td>
							<td class="number">{vnd(t.fuel_nam_phat_vnd)}</td>
							<td class="number">{vnd(t.loading_fee_vnd)}</td>
							<td class="number">
								{#if costs.length > 0}
									<div class="cost-tags">
										{#each costs as c}
											<span class="cost-tag" title={c.note || c.name}>{c.name} {vnd(c.amountVnd)}đ</span>
										{/each}
									</div>
								{:else}
									<span class="text-muted">—</span>
								{/if}
							</td>
							<td class="number total-col"><strong>{vnd(t.totalCost)}</strong></td>
							<td>
								{#if t.is_draft}
									<span class="status status-draft">Nháp</span>
								{:else}
									<span class="status status-done">Xong</span>
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
	.route { white-space: nowrap; }
	.arrow { color: #9ca3af; margin: 0 2px; }
	.text-muted { color: #d1d5db; }

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
