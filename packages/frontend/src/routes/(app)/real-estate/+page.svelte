<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Card, Button, Modal } from '$components/ui';
	import type { PageData, ActionData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	let showAddModal = $state(false);

	$effect(() => {
		if (form?.success) {
			invalidateAll();
			showAddModal = false;
		}
	});

	function fmt(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			maximumFractionDigits: 0
		}).format(amount);
	}

	function formatPropertyType(type: string): string {
		const labels: Record<string, string> = {
			single_family: 'Single Family',
			condo: 'Condo',
			townhouse: 'Townhouse',
			multi_family: 'Multi-Family',
			land: 'Land'
		};
		return labels[type] ?? type;
	}

	function getEquity(property: any): number {
		const currentValue = property.currentEstimate ?? property.purchasePrice ?? 0;
		const purchasePrice = property.purchasePrice ?? 0;
		return currentValue - purchasePrice;
	}

	function getPropertyValue(property: any): number {
		return property.currentEstimate ?? property.purchasePrice ?? 0;
	}
</script>

<svelte:head>
	<title>Real Estate - Finance Owl</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-2xl font-bold text-white">Real Estate</h2>
			<p class="mt-1 text-sm text-surface-400">Track your property portfolio and valuations</p>
		</div>
		<Button onclick={() => (showAddModal = true)}>Add Property</Button>
	</div>

	<!-- Error -->
	{#if form?.error}
		<div class="rounded-lg bg-red-900/50 p-3 text-sm text-red-300">{form.error}</div>
	{/if}

	<!-- Portfolio Summary -->
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<Card>
			<p class="text-sm text-surface-400">Total Value</p>
			<p class="mt-1 text-2xl font-bold text-white">{fmt(data.summary.totalValue)}</p>
		</Card>
		<Card>
			<p class="text-sm text-surface-400">Total Invested</p>
			<p class="mt-1 text-2xl font-bold text-surface-300">{fmt(data.summary.totalPurchasePrice)}</p>
		</Card>
		<Card>
			<p class="text-sm text-surface-400">Total Equity</p>
			<p class="mt-1 text-2xl font-bold {data.summary.totalEquity >= 0 ? 'text-green-400' : 'text-red-400'}">
				{fmt(data.summary.totalEquity)}
			</p>
		</Card>
		<Card>
			<p class="text-sm text-surface-400">Properties</p>
			<p class="mt-1 text-2xl font-bold text-white">{data.summary.propertyCount}</p>
		</Card>
	</div>

	<!-- Property list -->
	{#if data.properties.length === 0}
		<Card>
			<div class="flex flex-col items-center justify-center py-12 text-center">
				<svg
					class="h-16 w-16 text-surface-600"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="1"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
					/>
				</svg>
				<p class="mt-4 text-lg text-surface-300">No properties yet</p>
				<p class="mt-1 text-sm text-surface-500">
					Add your properties to track their value and equity over time.
				</p>
			</div>
		</Card>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.properties as property}
				<Card>
					<div class="flex items-start justify-between">
						<div class="min-w-0 flex-1">
							<p class="truncate font-semibold text-white">{property.address}</p>
							<p class="text-sm text-surface-400">
								{property.city}, {property.state} {property.zipCode}
							</p>
						</div>
						<span
							class="ml-2 inline-flex shrink-0 items-center rounded-full bg-surface-700 px-2.5 py-0.5 text-xs font-medium text-surface-300"
						>
							{formatPropertyType(property.propertyType)}
						</span>
					</div>

					<div class="mt-4 grid grid-cols-3 gap-3 text-center">
						{#if property.bedrooms}
							<div>
								<p class="text-lg font-semibold text-white">{property.bedrooms}</p>
								<p class="text-xs text-surface-500">Beds</p>
							</div>
						{/if}
						{#if property.bathrooms}
							<div>
								<p class="text-lg font-semibold text-white">{property.bathrooms}</p>
								<p class="text-xs text-surface-500">Baths</p>
							</div>
						{/if}
						{#if property.squareFeet}
							<div>
								<p class="text-lg font-semibold text-white">{property.squareFeet.toLocaleString()}</p>
								<p class="text-xs text-surface-500">Sq Ft</p>
							</div>
						{/if}
					</div>

					<div class="mt-4 space-y-2 border-t border-surface-700 pt-4">
						<div class="flex items-center justify-between">
							<span class="text-sm text-surface-400">Estimated Value</span>
							<span class="font-semibold text-white">{fmt(getPropertyValue(property))}</span>
						</div>
						{#if property.purchasePrice}
							<div class="flex items-center justify-between">
								<span class="text-sm text-surface-400">Equity</span>
								<span class="font-semibold {getEquity(property) >= 0 ? 'text-green-400' : 'text-red-400'}">
									{fmt(getEquity(property))}
								</span>
							</div>
						{/if}
						{#if property.lastEstimateDate}
							<p class="text-xs text-surface-500">
								Last estimated: {new Date(property.lastEstimateDate).toLocaleDateString()}
							</p>
						{/if}
					</div>

					<div class="mt-4 flex justify-end border-t border-surface-700 pt-3">
						<form method="POST" action="?/delete" use:enhance>
							<input type="hidden" name="id" value={property.id} />
							<Button type="submit" variant="danger" size="sm">Remove</Button>
						</form>
					</div>
				</Card>
			{/each}
		</div>
	{/if}
</div>

<!-- Add Property Modal -->
<Modal open={showAddModal} onclose={() => (showAddModal = false)} title="Add Property">
	<form
		method="POST"
		action="?/create"
		use:enhance={() => {
			return async ({ update }) => {
				await update();
			};
		}}
		class="space-y-4"
	>
		<div>
			<label for="address" class="block text-sm font-medium text-surface-300">Address</label>
			<input
				id="address"
				name="address"
				type="text"
				required
				class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				placeholder="123 Main St"
			/>
		</div>

		<div class="grid grid-cols-3 gap-3">
			<div>
				<label for="city" class="block text-sm font-medium text-surface-300">City</label>
				<input
					id="city"
					name="city"
					type="text"
					required
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				/>
			</div>
			<div>
				<label for="state" class="block text-sm font-medium text-surface-300">State</label>
				<input
					id="state"
					name="state"
					type="text"
					required
					maxlength="2"
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					placeholder="CA"
				/>
			</div>
			<div>
				<label for="zipCode" class="block text-sm font-medium text-surface-300">Zip</label>
				<input
					id="zipCode"
					name="zipCode"
					type="text"
					required
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				/>
			</div>
		</div>

		<div>
			<label for="propertyType" class="block text-sm font-medium text-surface-300">Property Type</label>
			<select
				id="propertyType"
				name="propertyType"
				class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
			>
				<option value="single_family">Single Family</option>
				<option value="condo">Condo</option>
				<option value="townhouse">Townhouse</option>
				<option value="multi_family">Multi-Family</option>
				<option value="land">Land</option>
			</select>
		</div>

		<div class="grid grid-cols-3 gap-3">
			<div>
				<label for="bedrooms" class="block text-sm font-medium text-surface-300">Beds</label>
				<input
					id="bedrooms"
					name="bedrooms"
					type="number"
					min="0"
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				/>
			</div>
			<div>
				<label for="bathrooms" class="block text-sm font-medium text-surface-300">Baths</label>
				<input
					id="bathrooms"
					name="bathrooms"
					type="number"
					min="0"
					step="0.5"
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				/>
			</div>
			<div>
				<label for="squareFeet" class="block text-sm font-medium text-surface-300">Sq Ft</label>
				<input
					id="squareFeet"
					name="squareFeet"
					type="number"
					min="0"
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				/>
			</div>
		</div>

		<div class="grid grid-cols-2 gap-3">
			<div>
				<label for="yearBuilt" class="block text-sm font-medium text-surface-300">Year Built</label>
				<input
					id="yearBuilt"
					name="yearBuilt"
					type="number"
					min="1800"
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				/>
			</div>
			<div>
				<label for="purchaseDate" class="block text-sm font-medium text-surface-300">Purchase Date</label>
				<input
					id="purchaseDate"
					name="purchaseDate"
					type="date"
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				/>
			</div>
		</div>

		<div class="grid grid-cols-2 gap-3">
			<div>
				<label for="purchasePrice" class="block text-sm font-medium text-surface-300">Purchase Price</label>
				<input
					id="purchasePrice"
					name="purchasePrice"
					type="number"
					step="0.01"
					min="0"
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					placeholder="350000"
				/>
			</div>
			<div>
				<label for="currentEstimate" class="block text-sm font-medium text-surface-300">Current Estimate</label>
				<input
					id="currentEstimate"
					name="currentEstimate"
					type="number"
					step="0.01"
					min="0"
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					placeholder="400000"
				/>
			</div>
		</div>

		<div>
			<label for="notes" class="block text-sm font-medium text-surface-300">Notes (optional)</label>
			<textarea
				id="notes"
				name="notes"
				rows="2"
				class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				placeholder="Any additional notes..."
			></textarea>
		</div>

		<div class="flex justify-end gap-3 pt-2">
			<Button variant="ghost" type="button" onclick={() => (showAddModal = false)}>
				Cancel
			</Button>
			<Button type="submit">Add Property</Button>
		</div>
	</form>
</Modal>
