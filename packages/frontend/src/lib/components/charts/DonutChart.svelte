<script lang="ts">
	import { onMount } from 'svelte';
	import { Chart, DoughnutController, ArcElement, Tooltip, Legend } from 'chart.js';

	Chart.register(DoughnutController, ArcElement, Tooltip, Legend);

	interface Props {
		labels: string[];
		data: number[];
		colors: string[];
		height?: number;
	}

	let { labels, data, colors, height = 250 }: Props = $props();

	let canvas: HTMLCanvasElement;
	let chart: Chart | null = null;

	onMount(() => {
		chart = new Chart(canvas, {
			type: 'doughnut',
			data: {
				labels,
				datasets: [
					{
						data,
						backgroundColor: colors,
						borderColor: 'transparent',
						borderWidth: 0,
						hoverOffset: 4
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				cutout: '60%',
				plugins: {
					legend: {
						display: false
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
								const value = context.parsed;
								const total = context.dataset.data.reduce(
									(a: number, b: number) => a + b,
									0
								);
								const pct = ((value / total) * 100).toFixed(1);
								return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${pct}%)`;
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
			chart.data.datasets[0].data = data;
			chart.data.datasets[0].backgroundColor = colors;
			chart.update();
		}
	});
</script>

<div style="height: {height}px">
	<canvas bind:this={canvas}></canvas>
</div>
