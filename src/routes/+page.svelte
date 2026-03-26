<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchSummary, fetchTrips, fetchDrivers } from '$lib/api/client';
	import type { DashboardSummary, Trip, Filters } from '$lib/api/types';
	import { vnd, formatDate } from '$lib/format';
	import { exportCSV, exportExcel, exportJSON, exportPDF } from '$lib/exports/exporter';
	import CostBreakdown from '$lib/charts/CostBreakdown.svelte';
	import WeightChart from '$lib/charts/WeightChart.svelte';
	import Timeline from '$lib/charts/Timeline.svelte';

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
				<div class="metric-icon">🚛</div>
				<div class="metric-value">{summary.totalTrips} chuyến</div>
				<div class="metric-label">{summary.completedTrips} hoàn tất · {summary.draftTrips} nháp</div>
			</div>
			<div class="metric-card">
				<div class="metric-icon">💰</div>
				<div class="metric-value">{vnd(summary.totalAdvance)}đ</div>
				<div class="metric-label">Tiền ứng trước</div>
			</div>
			<div class="metric-card">
				<div class="metric-icon">📊</div>
				<div class="metric-value muted">{vnd(summary.totalFuel + summary.totalLoading)}đ</div>
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
			<div class="chart-card chart-full">
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
						<tr>
							<td><strong>{t.driver_name}</strong></td>
							<td>{t.pickup_location} → {t.delivery_location}</td>
							<td>{formatDate(t.submitted_at)}</td>
							<td class="number">{t.pickup_weight_kg.toLocaleString()}</td>
							<td class="number">{t.delivery_weight_kg.toLocaleString()}</td>
							<td class="number">{vnd(t.advance_payment)}</td>
							<td class="number">{vnd(t.fuel_nam_phat_vnd)}</td>
							<td class="number">{vnd(t.loading_fee_vnd)}</td>
							<td class="number">{vnd(t.additionalTotal)}</td>
							<td class="number"><strong>{vnd(t.totalCost)}</strong></td>
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
				<button class="btn" onclick={() => exportCSV(trips)}>📄 CSV</button>
				<button class="btn" onclick={() => exportExcel(trips)}>📊 Excel</button>
				<button class="btn" onclick={() => exportJSON(trips)}>🔧 JSON</button>
				<button class="btn" onclick={() => exportPDF(trips)}>📕 PDF</button>
			</div>
		</div>
	{:else}
		<div class="empty">Không có dữ liệu cho bộ lọc này.</div>
	{/if}
</div>
