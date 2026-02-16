<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { ActionData, PageData } from './$types';
	import { Button, Card } from '$components/ui';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let saving = $state(false);
	let refreshing = $state(false);
	let selectedCurrency = $state('');
	let selectedFormat = $state('');

	$effect(() => {
		if (data.preferences) {
			selectedCurrency = data.preferences.defaultCurrency;
			selectedFormat = data.preferences.displayFormat;
		}
	});

	$effect(() => {
		if (form?.success) {
			invalidateAll();
		}
		if (form?.refreshed) {
			invalidateAll();
		}
	});

	function formatRate(rate: number): string {
		if (rate >= 100) return rate.toFixed(2);
		if (rate >= 1) return rate.toFixed(4);
		return rate.toFixed(6);
	}

	function getCurrencySymbol(code: string): string {
		const currency = data.supported.find((c: any) => c.code === code);
		return currency?.symbol ?? code;
	}
</script>

<svelte:head>
	<title>Currency Settings - FinanceOwl</title>
</svelte:head>

<div class="mx-auto max-w-2xl space-y-6">
	<div class="flex items-center gap-3">
		<a
			href="/settings"
			class="flex h-8 w-8 items-center justify-center rounded-lg text-surface-400 transition hover:bg-surface-700 hover:text-white"
			aria-label="Back to settings"
		>
			<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
			</svg>
		</a>
		<h1 class="text-2xl font-bold text-white">Currency Settings</h1>
	</div>

	{#if form?.success}
		<div class="rounded-lg bg-green-900/50 px-4 py-3 text-sm text-green-300">
			Currency preferences saved successfully.
		</div>
	{/if}

	{#if form?.error}
		<div class="rounded-lg bg-red-900/50 px-4 py-3 text-sm text-red-300">
			{form.error}
		</div>
	{/if}

	{#if form?.refreshed}
		<div class="rounded-lg bg-green-900/50 px-4 py-3 text-sm text-green-300">
			Exchange rates refreshed successfully.
		</div>
	{/if}

	<!-- Currency Preferences -->
	<form
		method="POST"
		action="?/save"
		use:enhance={() => {
			saving = true;
			return async ({ update }) => {
				saving = false;
				await update();
			};
		}}
	>
		<Card padding="none">
			<div class="space-y-6 p-6">
				<div>
					<h2 class="text-lg font-semibold text-white">Default Currency</h2>
					<p class="mt-1 text-sm text-surface-400">
						Set your preferred currency for displaying amounts across the app.
					</p>
				</div>

				<div>
					<label for="defaultCurrency" class="block text-sm font-medium text-surface-300">
						Currency
					</label>
					<select
						id="defaultCurrency"
						name="defaultCurrency"
						bind:value={selectedCurrency}
						class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					>
						{#each data.supported as currency}
							<option value={currency.code}>
								{currency.symbol} {currency.code} - {currency.name}
							</option>
						{/each}
					</select>
				</div>

				<div>
					<label for="displayFormat" class="block text-sm font-medium text-surface-300">
						Display Format
					</label>
					<select
						id="displayFormat"
						name="displayFormat"
						bind:value={selectedFormat}
						class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					>
						<option value="symbol">Symbol ({getCurrencySymbol(selectedCurrency)}1,234.56)</option>
						<option value="code">Code (1,234.56 {selectedCurrency})</option>
						<option value="name">Full Name</option>
					</select>
				</div>
			</div>

			<div class="border-t border-surface-700 px-6 py-4">
				<Button type="submit" loading={saving}>Save Preferences</Button>
			</div>
		</Card>
	</form>

	<!-- Exchange Rates Table -->
	<Card padding="none">
		<div class="space-y-4 p-6">
			<div class="flex items-start justify-between">
				<div>
					<h2 class="text-lg font-semibold text-white">Exchange Rates</h2>
					<p class="mt-1 text-sm text-surface-400">
						Current exchange rates relative to USD.
					</p>
				</div>
				<form
					method="POST"
					action="?/refresh"
					use:enhance={() => {
						refreshing = true;
						return async ({ update }) => {
							refreshing = false;
							await update();
						};
					}}
				>
					<Button size="sm" type="submit" loading={refreshing}>
						<svg class="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
						</svg>
						Refresh
					</Button>
				</form>
			</div>

			{#if data.rates.length === 0}
				<div class="rounded-lg border border-dashed border-surface-600 px-6 py-8 text-center">
					<p class="text-sm text-surface-400">No exchange rates available.</p>
					<p class="mt-1 text-xs text-surface-500">Click refresh to load the latest rates.</p>
				</div>
			{:else}
				<div class="overflow-hidden rounded-lg border border-surface-700">
					<table class="w-full">
						<thead>
							<tr class="border-b border-surface-700 bg-surface-800">
								<th class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-surface-400">
									Currency
								</th>
								<th class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-surface-400">
									Rate
								</th>
								<th class="hidden px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-surface-400 sm:table-cell">
									Source
								</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-surface-700">
							{#each data.rates as rate}
								<tr class="transition-colors hover:bg-surface-800/50">
									<td class="px-4 py-3">
										<div class="flex items-center gap-2">
											<span class="text-sm font-medium text-white">{rate.targetCurrency}</span>
											<span class="text-xs text-surface-500">
												{data.supported.find((c: any) => c.code === rate.targetCurrency)?.name ?? ''}
											</span>
										</div>
									</td>
									<td class="px-4 py-3 text-right">
										<span class="text-sm font-mono text-white">{formatRate(rate.rate)}</span>
									</td>
									<td class="hidden px-4 py-3 text-right text-xs text-surface-500 sm:table-cell">
										{rate.source ?? 'N/A'}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	</Card>
</div>
