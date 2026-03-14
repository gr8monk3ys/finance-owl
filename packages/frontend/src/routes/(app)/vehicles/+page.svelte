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

	function getVehicleValue(vehicle: any): number {
		return vehicle.currentEstimate ?? vehicle.purchasePrice ?? 0;
	}

	function formatCondition(condition: string): string {
		return condition.charAt(0).toUpperCase() + condition.slice(1);
	}

	function conditionBadgeClass(condition: string): string {
		switch (condition) {
			case 'excellent':
				return 'bg-green-900/50 text-green-400';
			case 'good':
				return 'bg-blue-900/50 text-blue-400';
			case 'fair':
				return 'bg-yellow-900/50 text-yellow-400';
			case 'poor':
				return 'bg-red-900/50 text-red-400';
			default:
				return 'bg-surface-700 text-surface-300';
		}
	}
</script>

<svelte:head>
	<title>Vehicles - Finance Owl</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-2xl font-bold text-white">Vehicles</h2>
			<p class="mt-1 text-sm text-surface-400">Track your vehicle values and depreciation</p>
		</div>
		<Button onclick={() => (showAddModal = true)}>Add Vehicle</Button>
	</div>

	<!-- Error -->
	{#if form?.error}
		<div class="rounded-lg bg-red-900/50 p-3 text-sm text-red-300">{form.error}</div>
	{/if}

	<!-- Fleet Summary -->
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<Card>
			<p class="text-sm text-surface-400">Total Value</p>
			<p class="mt-1 text-2xl font-bold text-white">{fmt(data.summary.totalValue)}</p>
		</Card>
		<Card>
			<p class="text-sm text-surface-400">Total Paid</p>
			<p class="mt-1 text-2xl font-bold text-surface-300">{fmt(data.summary.totalPurchasePrice)}</p>
		</Card>
		<Card>
			<p class="text-sm text-surface-400">Total Depreciation</p>
			<p class="mt-1 text-2xl font-bold {data.summary.totalDepreciation > 0 ? 'text-red-400' : 'text-green-400'}">
				{fmt(data.summary.totalDepreciation)}
			</p>
		</Card>
		<Card>
			<p class="text-sm text-surface-400">Vehicles</p>
			<p class="mt-1 text-2xl font-bold text-white">{data.summary.vehicleCount}</p>
		</Card>
	</div>

	<!-- Vehicle list -->
	{#if data.vehicles.length === 0}
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
						d="M8 7h8m-8 5h2m4 0h2M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
					/>
				</svg>
				<p class="mt-4 text-lg text-surface-300">No vehicles yet</p>
				<p class="mt-1 text-sm text-surface-500">
					Add your vehicles to track their value and depreciation over time.
				</p>
			</div>
		</Card>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.vehicles as vehicle}
				<Card>
					<div class="flex items-start justify-between">
						<div class="min-w-0 flex-1">
							<p class="truncate font-semibold text-white">
								{vehicle.year} {vehicle.make} {vehicle.model}
							</p>
							{#if vehicle.trim}
								<p class="text-sm text-surface-400">{vehicle.trim}</p>
							{/if}
						</div>
						<span
							class="ml-2 inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium {conditionBadgeClass(vehicle.condition)}"
						>
							{formatCondition(vehicle.condition)}
						</span>
					</div>

					<div class="mt-4 grid grid-cols-2 gap-3">
						{#if vehicle.mileage}
							<div>
								<p class="text-sm font-medium text-white">{vehicle.mileage.toLocaleString()} mi</p>
								<p class="text-xs text-surface-500">Mileage</p>
							</div>
						{/if}
						{#if vehicle.vin}
							<div>
								<p class="truncate text-sm font-medium text-white">{vehicle.vin}</p>
								<p class="text-xs text-surface-500">VIN</p>
							</div>
						{/if}
					</div>

					<div class="mt-4 space-y-2 border-t border-surface-700 pt-4">
						<div class="flex items-center justify-between">
							<span class="text-sm text-surface-400">Estimated Value</span>
							<span class="font-semibold text-white">{fmt(getVehicleValue(vehicle))}</span>
						</div>
						{#if vehicle.purchasePrice}
							<div class="flex items-center justify-between">
								<span class="text-sm text-surface-400">Purchase Price</span>
								<span class="text-sm text-surface-300">{fmt(vehicle.purchasePrice)}</span>
							</div>
						{/if}
						{#if vehicle.lastEstimateDate}
							<p class="text-xs text-surface-500">
								Last estimated: {new Date(vehicle.lastEstimateDate).toLocaleDateString()}
							</p>
						{/if}
					</div>

					<div class="mt-4 flex justify-end border-t border-surface-700 pt-3">
						<form method="POST" action="?/delete" use:enhance>
							<input type="hidden" name="id" value={vehicle.id} />
							<Button type="submit" variant="danger" size="sm">Remove</Button>
						</form>
					</div>
				</Card>
			{/each}
		</div>
	{/if}
</div>

<!-- Add Vehicle Modal -->
<Modal open={showAddModal} onclose={() => (showAddModal = false)} title="Add Vehicle">
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
		<div class="grid grid-cols-3 gap-3">
			<div>
				<label for="year" class="block text-sm font-medium text-surface-300">Year</label>
				<input
					id="year"
					name="year"
					type="number"
					required
					min="1900"
					max="2030"
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					placeholder="2023"
				/>
			</div>
			<div>
				<label for="make" class="block text-sm font-medium text-surface-300">Make</label>
				<input
					id="make"
					name="make"
					type="text"
					required
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					placeholder="Toyota"
				/>
			</div>
			<div>
				<label for="model" class="block text-sm font-medium text-surface-300">Model</label>
				<input
					id="model"
					name="model"
					type="text"
					required
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					placeholder="Camry"
				/>
			</div>
		</div>

		<div class="grid grid-cols-2 gap-3">
			<div>
				<label for="trim" class="block text-sm font-medium text-surface-300">Trim (optional)</label>
				<input
					id="trim"
					name="trim"
					type="text"
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					placeholder="SE"
				/>
			</div>
			<div>
				<label for="vin" class="block text-sm font-medium text-surface-300">VIN (optional)</label>
				<input
					id="vin"
					name="vin"
					type="text"
					maxlength="17"
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				/>
			</div>
		</div>

		<div class="grid grid-cols-2 gap-3">
			<div>
				<label for="mileage" class="block text-sm font-medium text-surface-300">Mileage</label>
				<input
					id="mileage"
					name="mileage"
					type="number"
					min="0"
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
					placeholder="45000"
				/>
			</div>
			<div>
				<label for="condition" class="block text-sm font-medium text-surface-300">Condition</label>
				<select
					id="condition"
					name="condition"
					class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				>
					<option value="excellent">Excellent</option>
					<option value="good" selected>Good</option>
					<option value="fair">Fair</option>
					<option value="poor">Poor</option>
				</select>
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
					placeholder="28000"
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

		<div>
			<label for="currentEstimate" class="block text-sm font-medium text-surface-300">Current Estimate</label>
			<input
				id="currentEstimate"
				name="currentEstimate"
				type="number"
				step="0.01"
				min="0"
				class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				placeholder="22000"
			/>
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
			<Button type="submit">Add Vehicle</Button>
		</div>
	</form>
</Modal>
