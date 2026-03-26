<script lang="ts">
	import { Chart, registerables } from 'chart.js';
	import type { Trip } from '$lib/api/types';
	import { onMount } from 'svelte';
	import { vnd } from '$lib/format';

	Chart.register(...registerables);

	let { trips }: { trips: Trip[] } = $props();

	let canvas: HTMLCanvasElement;
	let chart: Chart | null = null;

	interface CostEntry { name: string; amountVnd: number }

	function parseAdditional(raw: string | CostEntry[]): CostEntry[] {
		try {
			const items = typeof raw === 'string' ? JSON.parse(raw) : raw;
			return Array.isArray(items) ? items.filter(c => c.name && c.amountVnd > 0) : [];
		} catch { return []; }
	}

	function buildData() {
		const byCategory = new Map<string, number>();
		for (const t of trips) {
			for (const c of parseAdditional(t.additional_costs)) {
				byCategory.set(c.name, (byCategory.get(c.name) || 0) + c.amountVnd);
			}
		}

		const sorted = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
		const labels = sorted.map(([name]) => name);
		const data = sorted.map(([, val]) => val);

		const palette = ['#1273FF', '#14b8a6', '#f59e0b', '#a78bfa', '#f472b6', '#06b6d4', '#10b981', '#ef4444'];

		return {
			labels,
			datasets: [{
				data,
				backgroundColor: labels.map((_, i) => palette[i % palette.length]),
				borderWidth: 0,
				borderRadius: 4,
				barPercentage: 0.6,
			}],
		};
	}

	let categoryData = $derived((() => {
		const byCategory = new Map<string, number>();
		for (const t of trips) {
			for (const c of parseAdditional(t.additional_costs)) {
				byCategory.set(c.name, (byCategory.get(c.name) || 0) + c.amountVnd);
			}
		}
		return [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
	})());

	let total = $derived(categoryData.reduce((sum, [, v]) => sum + v, 0));

	onMount(() => {
		chart = new Chart(canvas, {
			type: 'doughnut',
			data: buildData(),
			options: {
				responsive: true,
				maintainAspectRatio: false,
				cutout: '65%',
				plugins: {
					legend: { display: false },
					tooltip: {
						backgroundColor: '#1a1d23',
						titleFont: { family: 'Inter' },
						bodyFont: { family: 'Inter' },
						padding: 10,
						cornerRadius: 8,
						callbacks: { label: (ctx) => `${ctx.label}: ${vnd(Number(ctx.raw))}đ` },
					},
				},
			},
		});
		return () => chart?.destroy();
	});

	$effect(() => {
		if (chart && trips) {
			chart.data = buildData();
			chart.update();
		}
	});
</script>

<div class="cost-categories">
	<div class="donut-wrap">
		<canvas bind:this={canvas}></canvas>
		<div class="donut-center">
			<span class="donut-total">{vnd(total)}đ</span>
			<span class="donut-label">Tổng phát sinh</span>
		</div>
	</div>

	{#if categoryData.length > 0}
		<div class="category-list">
			{#each categoryData as [name, amount], i}
				{@const pct = total > 0 ? (amount / total * 100).toFixed(0) : '0'}
				<div class="category-row">
					<div class="category-dot" style="background: {palette[i % palette.length]}"></div>
					<span class="category-name">{name}</span>
					<span class="category-bar-wrap">
						<span class="category-bar" style="width: {pct}%; background: {palette[i % palette.length]}"></span>
					</span>
					<span class="category-amount">{vnd(amount)}đ</span>
					<span class="category-pct">{pct}%</span>
				</div>
			{/each}
		</div>
	{:else}
		<div class="category-empty">Không có chi phí phát sinh</div>
	{/if}
</div>

<style>
	.cost-categories {
		display: flex;
		gap: 32px;
		align-items: center;
	}

	.donut-wrap {
		position: relative;
		width: 180px;
		height: 180px;
		flex-shrink: 0;
	}

	.donut-center {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		text-align: center;
		pointer-events: none;
	}

	.donut-total {
		display: block;
		font-size: 16px;
		font-weight: 800;
		color: #1273FF;
		line-height: 1.2;
	}

	.donut-label {
		display: block;
		font-size: 10px;
		color: #9ca3af;
		margin-top: 2px;
		font-weight: 500;
	}

	.category-list {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.category-row {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.category-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.category-name {
		font-size: 13px;
		font-weight: 600;
		color: #1a1d23;
		min-width: 100px;
	}

	.category-bar-wrap {
		flex: 1;
		height: 6px;
		background: #f3f4f6;
		border-radius: 3px;
		overflow: hidden;
	}

	.category-bar {
		display: block;
		height: 100%;
		border-radius: 3px;
		transition: width 0.3s ease;
	}

	.category-amount {
		font-size: 13px;
		font-weight: 700;
		color: #1a1d23;
		min-width: 90px;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.category-pct {
		font-size: 12px;
		color: #9ca3af;
		min-width: 32px;
		text-align: right;
		font-weight: 500;
	}

	.category-empty {
		color: #9ca3af;
		font-size: 13px;
		font-style: italic;
	}

	@media (max-width: 640px) {
		.cost-categories { flex-direction: column; }
		.donut-wrap { margin: 0 auto; }
	}
</style>
