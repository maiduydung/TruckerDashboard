<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchSummary, fetchTrips, fetchDrivers, fetchLocations, wipePreviousMonths, ApiError } from '$lib/api/client';
	import type { DashboardSummary, Trip, Filters, DisplayRow, StopRecord, WipeResult } from '$lib/api/types';
	import { vnd, formatDate } from '$lib/format';
	import { exportCSV, exportExcel, exportJSON, exportPDF } from '$lib/exports/exporter';
	import CostBreakdown from '$lib/charts/CostBreakdown.svelte';
	import WeightChart from '$lib/charts/WeightChart.svelte';
	import Timeline from '$lib/charts/Timeline.svelte';
	import CostCategories from '$lib/charts/CostCategories.svelte';
	import ContractTab from '$lib/contracts/ContractTab.svelte';

	let drivers: string[] = $state([]);
	let allPickups: string[] = $state([]);
	let allDeliveries: string[] = $state([]);
	let summary: DashboardSummary | null = $state(null);
	let trips: Trip[] = $state([]);
	let loading = $state(true);
	let error = $state('');

	let wipeInFlight = $state(false);
	let confirmOpen = $state(false);

	function previousMonthLabel(): number {
		const m = new Date().getMonth(); // 0=Jan ... 11=Dec
		return m === 0 ? 12 : m;         // Jan→12, Feb→1, ..., Dec→11
	}

	function openConfirm() {
		confirmOpen = true;
	}

	function cancelWipe() {
		confirmOpen = false;
	}

	async function executeWipe() {
		wipeInFlight = true;
		try {
			const result: WipeResult = await wipePreviousMonths('dashboard');
			confirmOpen = false;
			alert(`Đã xoá ${result.wipedCount} chuyến`);
			await loadData();
		} catch (e) {
			console.error('wipe failed', e);
			if (e instanceof ApiError) {
				alert(`Không thể xoá ngay: ${e.message}`);
			} else {
				alert('Không thể xoá ngay. Thử lại sau.');
			}
		} finally {
			wipeInFlight = false;
			confirmOpen = false;
		}
	}

	let activeTab = $state<'dashboard' | 'contracts'>('dashboard');
	let filters: Filters = $state({ driver: '', status: '', days: 7 });
	let pickupFilter = $state('');
	let deliveryFilter = $state('');

	let currentPage = $state(1);
	let pageSize = $state(20);

	function fmtDay(d: Date): string {
		const dd = String(d.getDate()).padStart(2, '0');
		const mm = String(d.getMonth() + 1).padStart(2, '0');
		const yy = d.getFullYear();
		return `${dd}/${mm}/${yy}`;
	}

	let rangeLabel: string = $derived.by(() => {
		const today = new Date();
		if (!filters.days || filters.days <= 0) return `Tất cả dữ liệu · tính đến ${fmtDay(today)}`;
		const from = new Date(today);
		from.setDate(from.getDate() - filters.days);
		return `Từ ${fmtDay(from)} đến ${fmtDay(today)} · ${filters.days} ngày gần nhất`;
	});

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
					receivedAt: t.received_at,
					isDraft: t.is_draft,
					pickupLocation: pickups[i]?.location || '',
					pickupWeightKg: pickups[i]?.weightKg || 0,
					deliveryLocation: deliveries[i]?.location || '',
					deliveryWeightKg: deliveries[i]?.weightKg || 0,
					advancePayment: t.advance_payment,
					openingBalance: t.opening_balance,
					fuelNamPhatVnd: t.fuel_nam_phat_vnd,
					fuelHnLiters: t.fuel_hn_liters,
					loadingFeeVnd: t.loading_fee_vnd,
					notes: t.notes || '',
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
		[...new Set([...allPickups, ...allDisplayRows.map(r => r.pickupLocation).filter(Boolean)])].sort()
	);
	let deliveryLocations: string[] = $derived(
		[...new Set([...allDeliveries, ...allDisplayRows.map(r => r.deliveryLocation).filter(Boolean)])].sort()
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

	interface FilterTotals { trips: number; pickupKg: number; deliveryKg: number }
	let filterTotals: FilterTotals = $derived.by(() => {
		let pickupKg = 0;
		let deliveryKg = 0;
		const tripIds = new Set<string>();
		for (const r of displayRows) {
			tripIds.add(r.tripId);
			if (!pickupFilter || r.pickupLocation === pickupFilter) pickupKg += r.pickupWeightKg || 0;
			if (!deliveryFilter || r.deliveryLocation === deliveryFilter) deliveryKg += r.deliveryWeightKg || 0;
		}
		return { trips: tripIds.size, pickupKg, deliveryKg };
	});

	let filteredTrips: Trip[] = $derived.by(() => {
		if (!pickupFilter && !deliveryFilter) return trips;
		const ids = new Set(displayRows.map(r => r.tripId));
		return trips.filter(t => ids.has(t.id));
	});

	let exportLabel: string = $derived.by(() => {
		const parts = [rangeLabel];
		if (pickupFilter) parts.push(`Nơi lấy: ${pickupFilter}`);
		if (deliveryFilter) parts.push(`Nơi giao: ${deliveryFilter}`);
		if (filters.driver) parts.push(`Tài xế: ${filters.driver}`);
		if (filters.status) parts.push(`Trạng thái: ${filters.status === 'draft' ? 'Nháp' : 'Hoàn tất'}`);
		return parts.join(' · ');
	});

	let uniqueTripIds: string[] = $derived.by(() => {
		const seen = new Set<string>();
		const ids: string[] = [];
		for (const r of displayRows) {
			if (!seen.has(r.tripId)) { seen.add(r.tripId); ids.push(r.tripId); }
		}
		return ids;
	});
	let totalTrips: number = $derived(uniqueTripIds.length);
	let totalPages: number = $derived(Math.max(1, Math.ceil(totalTrips / pageSize)));

	$effect(() => {
		if (currentPage > totalPages) currentPage = totalPages;
		if (currentPage < 1) currentPage = 1;
	});

	let pagedRows: DisplayRow[] = $derived.by(() => {
		const start = (currentPage - 1) * pageSize;
		const pageTripIds = new Set(uniqueTripIds.slice(start, start + pageSize));
		return displayRows.filter(r => pageTripIds.has(r.tripId));
	});

	let pageWindow: number[] = $derived.by(() => {
		const max = 5;
		let start = Math.max(1, currentPage - 2);
		const end = Math.min(totalPages, start + max - 1);
		start = Math.max(1, end - max + 1);
		return Array.from({ length: end - start + 1 }, (_, i) => start + i);
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
			const [d, loc] = await Promise.all([fetchDrivers(), fetchLocations()]);
			drivers = d;
			allPickups = loc.pickups;
			allDeliveries = loc.deliveries;
		} catch {}
		await loadData();
	});

	function handleFilterChange() {
		currentPage = 1;
		loadData();
	}

	$effect(() => { pickupFilter; deliveryFilter; currentPage = 1; });

	function goToPage(p: number) {
		currentPage = Math.min(Math.max(1, p), totalPages);
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
		{#if activeTab === 'dashboard'}
		<div class="header-right">
			<button
				type="button"
				class="wipe-btn"
				disabled={wipeInFlight}
				onclick={openConfirm}
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
					style="margin-right: 6px; vertical-align: -2px;"
				>
					<path d="M3 6h18" />
					<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
					<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
				</svg>
				Xoá dữ liệu tháng {previousMonthLabel()}
			</button>
		</div>
		{/if}
	</div>

	{#if activeTab === 'dashboard'}
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
			{#if filters.days > 0 && ![7, 14, 30, 90].includes(filters.days)}
				<option value={filters.days}>{filters.days} ngày</option>
			{/if}
		</select>
		<input
			type="number"
			class="days-input"
			min="1"
			step="1"
			placeholder="Tuỳ chỉnh ngày"
			value={filters.days > 0 && ![7, 14, 30, 90].includes(filters.days) ? filters.days : ''}
			onchange={(e) => {
				const v = parseInt((e.currentTarget as HTMLInputElement).value, 10);
				if (Number.isFinite(v) && v >= 1) {
					filters.days = v;
					handleFilterChange();
				}
			}}
		/>
	</div>
	{/if}

	{#if activeTab === 'dashboard'}
		<div class="range-caption">
			<span class="range-icon">📅</span>
			<span>{rangeLabel}</span>
		</div>
	{/if}

	<nav class="tab-nav">
		<button class="tab-item" class:active={activeTab === 'dashboard'}
			onclick={() => activeTab = 'dashboard'}>Tổng quan</button>
		<button class="tab-item" class:active={activeTab === 'contracts'}
			onclick={() => activeTab = 'contracts'}>Hợp đồng</button>
	</nav>

	{#if activeTab === 'contracts'}
		<ContractTab />
	{/if}

	{#if activeTab === 'dashboard'}

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
		{#if summary?.lastWipeAt}
			<div class="last-wipe-banner">
				💾 Lần xoá gần nhất: {new Date(summary.lastWipeAt).toLocaleDateString('vi-VN')}
			</div>
		{/if}

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
			<div class="table-scroll">
			<table>
				<thead>
					<tr>
						<th>Tài xế</th>
						<th>Chuyến</th>
						<th>Nơi lấy</th>
						<th>Nơi giao</th>
						<th>Ngày gửi</th>
						<th>Ngày nhận</th>
						<th>KG lấy</th>
						<th>KG giao</th>
						<th>Tiền ứng</th>
						<th>Dư đầu</th>
						<th>Dầu NP</th>
						<th>Dầu HN (L)</th>
						<th>Bốc xếp</th>
						<th>Phát sinh</th>
						<th>Tổng CP</th>
						<th>Dư cuối</th>
						<th>Ghi chú</th>
						<th>Trạng thái</th>
					</tr>
				</thead>
				<tbody>
					{#each pagedRows as row, idx}
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
							<td>{row.isFirstRow ? formatDate(row.receivedAt) : ''}</td>
							<td class="number">{row.pickupWeightKg ? row.pickupWeightKg.toLocaleString() : ''}</td>
							<td class="number">{row.deliveryWeightKg ? row.deliveryWeightKg.toLocaleString() : ''}</td>
							<td class="number">{row.isFirstRow ? vnd(row.advancePayment) : ''}</td>
							<td class="number">{row.isFirstRow ? vnd(row.openingBalance) : ''}</td>
							<td class="number">{row.isFirstRow ? vnd(row.fuelNamPhatVnd) : ''}</td>
							<td class="number">{row.isFirstRow && row.fuelHnLiters ? row.fuelHnLiters.toLocaleString() : ''}</td>
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
							<td class="notes-cell">
								{#if row.isFirstRow && row.notes}
									<span class="notes-text" title={row.notes}>{row.notes}</span>
								{:else if row.isFirstRow}
									<span class="text-muted">—</span>
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

			{#if pickupFilter || deliveryFilter}
				<div class="filter-totals">
					<div class="filter-totals-label">
						Tổng cho bộ lọc
						{#if pickupFilter}<span class="filter-chip">Nơi lấy: <strong>{pickupFilter}</strong></span>{/if}
						{#if deliveryFilter}<span class="filter-chip">Nơi giao: <strong>{deliveryFilter}</strong></span>{/if}
					</div>
					<div class="filter-totals-values">
						<div><span class="ft-label">Chuyến</span><strong>{filterTotals.trips.toLocaleString('vi-VN')}</strong></div>
						<div><span class="ft-label">Tổng KG lấy</span><strong>{filterTotals.pickupKg.toLocaleString('vi-VN')} kg</strong></div>
						<div><span class="ft-label">Tổng KG giao</span><strong>{filterTotals.deliveryKg.toLocaleString('vi-VN')} kg</strong></div>
					</div>
				</div>
			{/if}

			{#if totalTrips > 0}
				<div class="pagination">
					<div class="pagination-info">
						Hiển thị <strong>{(currentPage - 1) * pageSize + 1}</strong>–<strong>{Math.min(currentPage * pageSize, totalTrips)}</strong> / <strong>{totalTrips}</strong> chuyến
					</div>
					<div class="pagination-controls">
						<label class="page-size">
							Mỗi trang
							<select bind:value={pageSize} onchange={() => currentPage = 1}>
								<option value={10}>10</option>
								<option value={20}>20</option>
								<option value={50}>50</option>
								<option value={100}>100</option>
							</select>
						</label>
						<button class="page-btn" disabled={currentPage === 1} onclick={() => goToPage(1)}>«</button>
						<button class="page-btn" disabled={currentPage === 1} onclick={() => goToPage(currentPage - 1)}>‹</button>
						{#each pageWindow as p}
							<button class="page-btn" class:active={p === currentPage} onclick={() => goToPage(p)}>{p}</button>
						{/each}
						<button class="page-btn" disabled={currentPage === totalPages} onclick={() => goToPage(currentPage + 1)}>›</button>
						<button class="page-btn" disabled={currentPage === totalPages} onclick={() => goToPage(totalPages)}>»</button>
					</div>
				</div>
			{/if}
		</div>

		<div class="export-section">
			<h2>Xuất dữ liệu</h2>
			<div class="export-bar">
				<button class="btn" onclick={() => exportCSV(filteredTrips, exportLabel)}>CSV</button>
				<button class="btn" onclick={() => exportExcel(filteredTrips, exportLabel)}>Excel</button>
				<button class="btn" onclick={() => exportJSON(filteredTrips, exportLabel)}>JSON</button>
				<button class="btn btn-primary" onclick={() => exportPDF(filteredTrips, exportLabel)}>PDF</button>
			</div>
		</div>
	{:else}
		<div class="empty">Không có dữ liệu cho bộ lọc này.</div>
	{/if}

	{/if}
</div>

{#if confirmOpen}
	<div
		class="modal-overlay"
		onclick={cancelWipe}
		onkeydown={(e) => { if (e.key === 'Escape') cancelWipe(); }}
		role="presentation"
	>
		<div
			class="modal"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			tabindex="-1"
		>
			<h3>Bạn có chắc?</h3>
			<p>
				Sẽ xoá <strong>{summary?.pendingWipeCount ?? 0}</strong> chuyến
				từ tháng {previousMonthLabel()} trở về trước.
				Không thể hoàn tác từ giao diện này.
			</p>
			<div class="modal-actions">
				<button type="button" class="btn-secondary" onclick={cancelWipe}>Huỷ</button>
				<button
					type="button"
					class="btn-danger"
					onclick={executeWipe}
					disabled={wipeInFlight}
				>
					{wipeInFlight ? 'Đang xoá...' : 'Xoá ngay'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	/* ── Tab navigation ──────────────────────────────── */
	.tab-nav {
		display: flex; gap: 0; margin-bottom: 24px;
		border-bottom: 1px solid var(--border);
	}
	.tab-item {
		padding: 10px 24px; border: none; background: none;
		font-size: 14px; font-weight: 600; font-family: inherit;
		color: var(--text-muted); cursor: pointer;
		position: relative; transition: color 0.15s;
	}
	.tab-item::after {
		content: ''; position: absolute; bottom: -1px; left: 0; right: 0;
		height: 2px; background: transparent; border-radius: 2px 2px 0 0;
		transition: background 0.15s;
	}
	.tab-item.active { color: var(--blue); }
	.tab-item.active::after { background: var(--blue); }
	.tab-item:hover:not(.active) { color: var(--text-secondary); }

	.text-muted { color: #d1d5db; }

	.range-caption {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		margin: 16px 0 16px;
		background: #f3f6fb;
		border: 1px solid #e5edf8;
		border-radius: 999px;
		font-size: 12px;
		color: #334155;
		font-weight: 500;
	}
	.range-icon { font-size: 13px; }

	.days-input {
		width: 170px;
		padding: 6px 10px;
		font-size: 13px;
		font-family: inherit;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: white;
	}
	.days-input:focus {
		outline: none;
		border-color: #1273FF;
	}
	.days-input::-webkit-outer-spin-button,
	.days-input::-webkit-inner-spin-button { opacity: 1; }

	.filter-totals {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 12px 16px;
		margin-top: 14px;
		background: #f3f6fb;
		border: 1px solid #e5edf8;
		border-radius: 10px;
		flex-wrap: wrap;
	}
	.filter-totals-label {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: var(--text-secondary);
		font-weight: 500;
	}
	.filter-chip {
		padding: 2px 10px;
		background: white;
		border: 1px solid var(--border);
		border-radius: 999px;
		font-size: 12px;
		color: var(--text);
	}
	.filter-chip strong { color: #1273FF; font-weight: 600; }
	.filter-totals-values {
		display: flex;
		gap: 24px;
		flex-wrap: wrap;
	}
	.filter-totals-values > div {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.ft-label {
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		color: var(--text-muted, #94a3b8);
		font-weight: 600;
	}
	.filter-totals-values strong {
		font-size: 15px;
		font-weight: 700;
		color: var(--text);
		font-variant-numeric: tabular-nums;
	}

	.pagination {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 14px 4px 4px;
		flex-wrap: wrap;
	}
	.pagination-info {
		font-size: 13px;
		color: var(--text-secondary);
	}
	.pagination-info strong { color: var(--text); font-weight: 600; }
	.pagination-controls {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
	}
	.page-size {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		color: var(--text-secondary);
		margin-right: 8px;
	}
	.page-size select {
		padding: 4px 8px;
		font-size: 13px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: white;
		font-family: inherit;
	}
	.page-btn {
		min-width: 32px;
		height: 32px;
		padding: 0 10px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: white;
		font-size: 13px;
		font-weight: 600;
		font-family: inherit;
		color: var(--text-secondary);
		cursor: pointer;
		transition: all 0.15s;
	}
	.page-btn:hover:not(:disabled):not(.active) {
		background: #f3f4f6;
		color: var(--text);
	}
	.page-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.page-btn.active {
		background: #1273FF;
		border-color: #1273FF;
		color: white;
	}

	.notes-cell { max-width: 220px; }
	.notes-text {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		text-overflow: ellipsis;
		font-size: 12px;
		color: var(--text-secondary);
		white-space: normal;
	}

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

	/* ── Header right slot ───────────────────────────── */
	.header-right {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	/* ── Wipe button (outlined-danger ghost) ─────────── */
	.wipe-btn {
		display: inline-flex;
		align-items: center;
		background: white;
		border: 1px solid #dc2626;
		color: #dc2626;
		padding: 6px 12px;
		border-radius: 8px;
		font-size: 13px;
		font-weight: 600;
		font-family: 'Inter', system-ui, sans-serif;
		cursor: pointer;
		white-space: nowrap;
		transition: background 0.15s, color 0.15s;
	}
	.wipe-btn:hover:not(:disabled) {
		background: #dc2626;
		color: white;
	}
	.wipe-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* ── Last-wipe banner ────────────────────────────── */
	.last-wipe-banner {
		background: #eff6ff;
		border: 1px solid #bfdbfe;
		color: #1e40af;
		padding: 10px 16px;
		border-radius: 8px;
		margin: 0 0 16px;
		font-family: 'Inter', system-ui, sans-serif;
		font-size: 13px;
		font-weight: 500;
	}

	/* ── Confirm modal ───────────────────────────────── */
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}
	.modal {
		background: white;
		border-radius: 12px;
		padding: 24px;
		max-width: 420px;
		width: calc(100% - 32px);
		font-family: 'Inter', system-ui, sans-serif;
		box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
	}
	.modal h3 { margin: 0 0 12px; font-size: 18px; font-weight: 700; color: #111827; }
	.modal p { margin: 0 0 20px; color: #4b5563; line-height: 1.5; font-size: 14px; }
	.modal-actions { display: flex; gap: 12px; justify-content: flex-end; }
	.btn-secondary {
		background: #f3f4f6;
		color: #1f2937;
		border: none;
		padding: 8px 16px;
		border-radius: 8px;
		font-weight: 600;
		font-family: 'Inter', system-ui, sans-serif;
		font-size: 14px;
		cursor: pointer;
		transition: background 0.15s;
	}
	.btn-secondary:hover { background: #e5e7eb; }
	.btn-danger {
		background: #ef4444;
		color: white;
		border: none;
		padding: 8px 16px;
		border-radius: 8px;
		font-weight: 600;
		font-family: 'Inter', system-ui, sans-serif;
		font-size: 14px;
		cursor: pointer;
		transition: background 0.15s;
	}
	.btn-danger:hover:not(:disabled) { background: #dc2626; }
	.btn-danger:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
