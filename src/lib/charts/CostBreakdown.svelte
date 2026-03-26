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
				{ label: 'Dầu NP', data: labels.map(l => byDriver.get(l)!.fuel), backgroundColor: '#1273FF', borderRadius: 4 },
				{ label: 'Bốc xếp', data: labels.map(l => byDriver.get(l)!.loading), backgroundColor: '#5a9fff', borderRadius: 4 },
				{ label: 'Phát sinh', data: labels.map(l => byDriver.get(l)!.additional), backgroundColor: '#a3c8ff', borderRadius: 4 },
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
			x: { stacked: true, grid: { display: false } },
			y: { stacked: true, beginAtZero: true, grid: { color: '#f3f4f6' }, ticks: { callback: (v: string | number) => `${Number(v) / 1_000_000}M`, font: { size: 11 } } },
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
