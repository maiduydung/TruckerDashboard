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
		const colors = ['#1273FF', '#425d99', '#a3c8ff'];
		const driverList = [...drivers];

		return {
			labels,
			datasets: driverList.map((driver, i) => ({
				label: driver,
				data: labels.map(date => byDateDriver.get(date)?.get(driver) || 0),
				backgroundColor: colors[i % colors.length],
				borderRadius: 6,
			})),
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
			y: { beginAtZero: true, grid: { color: '#f3f4f6' }, ticks: { stepSize: 1, font: { size: 11 } } },
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

<div style="height: 260px;">
	<canvas bind:this={canvas}></canvas>
</div>
