<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Chart,
		LineController,
		LineElement,
		PointElement,
		CategoryScale,
		LinearScale,
		Filler,
		Tooltip,
		Legend
	} from 'chart.js';

	Chart.register(
		LineController,
		LineElement,
		PointElement,
		CategoryScale,
		LinearScale,
		Filler,
		Tooltip,
		Legend
	);

	interface Dataset {
		label: string;
		data: number[];
		borderColor: string;
		backgroundColor?: string;
		fill?: boolean;
	}

	interface Props {
		labels: string[];
		datasets: Dataset[];
		height?: number;
		currency?: boolean;
	}

	let { labels, datasets, height = 250, currency = true }: Props = $props();

	let canvas: HTMLCanvasElement;
	let chart: Chart | null = null;

	onMount(() => {
		chart = new Chart(canvas, {
			type: 'line',
			data: {
				labels,
				datasets: datasets.map((ds) => ({
					...ds,
					tension: 0.3,
					borderWidth: 2,
					pointRadius: 0,
					pointHoverRadius: 5,
					fill: ds.fill ?? false,
					backgroundColor: ds.backgroundColor || ds.borderColor + '20'
				}))
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				interaction: {
					intersect: false,
					mode: 'index'
				},
				scales: {
					x: {
						grid: { display: false },
						ticks: { color: '#94a3b8', maxTicksLimit: 8 },
						border: { display: false }
					},
					y: {
						grid: { color: '#1e293b' },
						ticks: {
							color: '#94a3b8',
							callback: currency
								? (value) => `$${Number(value).toLocaleString()}`
								: undefined
						},
						border: { display: false }
					}
				},
				plugins: {
					legend: {
						display: datasets.length > 1,
						position: 'top',
						labels: { color: '#cbd5e1', usePointStyle: true, pointStyle: 'circle' }
					},
					tooltip: {
						backgroundColor: '#1e293b',
						titleColor: '#f8fafc',
						bodyColor: '#cbd5e1',
						borderColor: '#334155',
						borderWidth: 1,
						padding: 10,
						callbacks: {
							label: currency
								? (context) =>
										`${context.dataset.label}: $${(context.parsed.y ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
								: undefined
						}
					}
				}
			}
		});

		return () => chart?.destroy();
	});

	$effect(() => {
		if (chart) {
			chart.data.labels = labels;
			chart.data.datasets = datasets.map((ds) => ({
				...ds,
				tension: 0.3,
				borderWidth: 2,
				pointRadius: 0,
				pointHoverRadius: 5,
				fill: ds.fill ?? false,
				backgroundColor: ds.backgroundColor || ds.borderColor + '20'
			}));
			chart.update();
		}
	});
</script>

<div style="height: {height}px">
	<canvas bind:this={canvas}></canvas>
</div>
