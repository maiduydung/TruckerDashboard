<script lang="ts">
	import { Chart, registerables } from 'chart.js';
	import type { Trip } from '$lib/api/types';
	import { formatDateShort } from '$lib/format';
	import { onMount } from 'svelte';

	Chart.register(...registerables);

	let { trips }: { trips: Trip[] } = $props();

	let canvas: HTMLCanvasElement;
	let chart: Chart | null = null;

	function buildData() {
		const byDateDriver = new Map<string, Map<string, number>>();
		const drivers = new Set<string>();

		for (const t of trips) {
			if (!t.submitted_at) continue;
			const dateKey = formatDateShort(t.submitted_at);
			drivers.add(t.driver_name);
			if (!byDateDriver.has(dateKey)) byDateDriver.set(dateKey, new Map());
			const driverMap = byDateDriver.get(dateKey)!;
			driverMap.set(t.driver_name, (driverMap.get(t.driver_name) || 0) + 1);
		}

		const labels = [...byDateDriver.keys()].reverse();
		const colors = ['#1273FF', '#6ba3ff', '#c0d9ff'];
		const driverList = [...drivers];

		return {
			labels,
			datasets: driverList.map((driver, i) => ({
				label: driver,
				data: labels.map(date => byDateDriver.get(date)?.get(driver) || 0),
				backgroundColor: colors[i % colors.length],
				borderRadius: 6,
				barPercentage: 0.5,
				categoryPercentage: 0.6,
			})),
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
					tooltip: { backgroundColor: '#1a1d23', titleFont: { family: 'Inter' }, bodyFont: { family: 'Inter' }, padding: 10, cornerRadius: 8 },
				},
				scales: {
					x: { grid: { display: false }, ticks: { font: { size: 12, family: 'Inter' } } },
					y: { beginAtZero: true, border: { display: false }, grid: { color: '#f3f4f6' }, ticks: { stepSize: 1, font: { size: 11, family: 'Inter' }, padding: 8 } },
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

<div style="height: 260px;">
	<canvas bind:this={canvas}></canvas>
</div>
