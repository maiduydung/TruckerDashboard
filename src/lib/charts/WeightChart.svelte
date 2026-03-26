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
				{ label: 'Lấy', data: labels.map(l => byDriver.get(l)!.pickup), backgroundColor: '#1273FF', borderRadius: 6 },
				{ label: 'Giao', data: labels.map(l => byDriver.get(l)!.delivery), backgroundColor: '#a3c8ff', borderRadius: 6 },
			],
		};
	}

	const chartOpts = {
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: { position: 'top' as const, labels: { usePointStyle: true, pointStyle: 'circle' as const, padding: 16, font: { size: 12, family: 'Inter' } } },
		},
		scales: {
			x: { grid: { display: false } },
			y: { beginAtZero: true, grid: { color: '#f3f4f6' }, ticks: { callback: (v: string | number) => `${Number(v).toLocaleString()} kg`, font: { size: 11 } } },
		},
	};

	onMount(() => {
		chart = new Chart(canvas, { type: 'bar', data: buildData(), options: chartOpts });
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
