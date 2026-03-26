<script lang="ts">
	import { Chart, registerables } from 'chart.js';
	import type { Trip } from '$lib/api/types';
	import { onMount } from 'svelte';

	Chart.register(...registerables);

	let { trips }: { trips: Trip[] } = $props();

	let canvas: HTMLCanvasElement;
	let chart: Chart | null = null;

	function buildData() {
		const byDriver = new Map<string, { pickup: number; delivery: number }>();
		for (const t of trips) {
			const d = byDriver.get(t.driver_name) || { pickup: 0, delivery: 0 };
			d.pickup += t.pickup_weight_kg;
			d.delivery += t.delivery_weight_kg;
			byDriver.set(t.driver_name, d);
		}
		const labels = [...byDriver.keys()];
		return {
			labels,
			datasets: [
				{ label: 'Lấy', data: labels.map(l => byDriver.get(l)!.pickup), backgroundColor: '#1273FF', borderRadius: 6, barPercentage: 0.5, categoryPercentage: 0.6 },
				{ label: 'Giao', data: labels.map(l => byDriver.get(l)!.delivery), backgroundColor: '#c0d9ff', borderRadius: 6, barPercentage: 0.5, categoryPercentage: 0.6 },
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
					tooltip: { backgroundColor: '#1a1d23', titleFont: { family: 'Inter' }, bodyFont: { family: 'Inter' }, padding: 10, cornerRadius: 8, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.raw).toLocaleString()} kg` } },
				},
				scales: {
					x: { grid: { display: false }, ticks: { font: { size: 12, family: 'Inter', weight: 'bold' as const } } },
					y: { beginAtZero: true, border: { display: false }, grid: { color: '#f3f4f6' }, ticks: { callback: (v) => `${Number(v).toLocaleString()}`, font: { size: 11, family: 'Inter' }, padding: 8 } },
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
