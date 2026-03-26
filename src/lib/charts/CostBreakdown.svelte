<script lang="ts">
	import { Chart, registerables } from 'chart.js';
	import type { Trip } from '$lib/api/types';
	import { onMount } from 'svelte';

	Chart.register(...registerables);

	let { trips }: { trips: Trip[] } = $props();

	let canvas: HTMLCanvasElement;
	let chart: Chart | null = null;

	function buildData() {
		const byDriver = new Map<string, { fuel: number; loading: number; additional: number }>();
		for (const t of trips) {
			const d = byDriver.get(t.driver_name) || { fuel: 0, loading: 0, additional: 0 };
			d.fuel += t.fuel_nam_phat_vnd;
			d.loading += t.loading_fee_vnd;
			d.additional += t.additionalTotal;
			byDriver.set(t.driver_name, d);
		}
		const labels = [...byDriver.keys()];
		return {
			labels,
			datasets: [
				{ label: 'Dầu NP', data: labels.map(l => byDriver.get(l)!.fuel), backgroundColor: '#1273FF', borderRadius: 6, barPercentage: 0.6, categoryPercentage: 0.7 },
				{ label: 'Bốc xếp', data: labels.map(l => byDriver.get(l)!.loading), backgroundColor: '#5a9fff', borderRadius: 6, barPercentage: 0.6, categoryPercentage: 0.7 },
				{ label: 'Phát sinh', data: labels.map(l => byDriver.get(l)!.additional), backgroundColor: '#c0d9ff', borderRadius: 6, barPercentage: 0.6, categoryPercentage: 0.7 },
			],
		};
	}

	onMount(() => {
		chart = new Chart(canvas, {
			type: 'bar',
			data: buildData(),
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: { position: 'top', labels: { usePointStyle: true, pointStyle: 'circle', padding: 20, font: { size: 12, family: 'Inter' } } },
					tooltip: { backgroundColor: '#1a1d23', titleFont: { family: 'Inter' }, bodyFont: { family: 'Inter' }, padding: 10, cornerRadius: 8, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${(Number(ctx.raw) / 1_000_000).toFixed(1)}M đ` } },
				},
				scales: {
					x: { stacked: true, grid: { display: false }, ticks: { font: { size: 12, family: 'Inter', weight: 'bold' as const } } },
					y: { stacked: true, beginAtZero: true, border: { display: false }, grid: { color: '#f3f4f6' }, ticks: { callback: (v) => `${Number(v) / 1_000_000}M`, font: { size: 11, family: 'Inter' }, padding: 8 } },
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

<div style="height: 300px;">
	<canvas bind:this={canvas}></canvas>
</div>
