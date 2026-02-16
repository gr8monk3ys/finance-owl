<script lang="ts">
	import { onMount } from 'svelte';
	import {
		Chart,
		BarController,
		BarElement,
		CategoryScale,
		LinearScale,
		Tooltip,
		Legend
	} from 'chart.js';

	Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

	interface Dataset {
		label: string;
		data: number[];
		backgroundColor: string;
	}

	interface Props {
		labels: string[];
		datasets: Dataset[];
		height?: number;
		stacked?: boolean;
	}

	let { labels, datasets, height = 250, stacked = false }: Props = $props();

	let canvas: HTMLCanvasElement;
	let chart: Chart | null = null;

	onMount(() => {
		chart = new Chart(canvas, {
			type: 'bar',
			data: {
				labels,
				datasets: datasets.map((ds) => ({
					...ds,
					borderRadius: 4,
					borderSkipped: false
				}))
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				scales: {
					x: {
						stacked,
						grid: { display: false },
						ticks: { color: '#94a3b8' },
						border: { display: false }
					},
					y: {
						stacked,
						grid: { color: '#1e293b' },
						ticks: {
							color: '#94a3b8',
							callback: (value) => `$${Number(value).toLocaleString()}`
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
							label(context) {
								return `${context.dataset.label}: $${(context.parsed.y ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
							}
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
				borderRadius: 4,
				borderSkipped: false as const
			}));
			chart.update();
		}
	});
</script>

<div style="height: {height}px">
	<canvas bind:this={canvas}></canvas>
</div>
