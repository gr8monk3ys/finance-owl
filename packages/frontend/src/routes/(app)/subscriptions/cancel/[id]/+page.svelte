<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Card, Button } from '$components/ui';
	import type { PageData, ActionData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	let reason = $state('');
	let notes = $state('');
	let currentStep = $state(0);

	$effect(() => {
		if (form?.success) {
			invalidateAll();
		}
		if (form?.confirmed) {
			currentStep = 3;
		}
	});

	function fmt(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount);
	}

	function getFrequencyLabel(frequency: string): string {
		const labels: Record<string, string> = {
			weekly: 'Weekly',
			biweekly: 'Biweekly',
			monthly: 'Monthly',
			quarterly: 'Quarterly',
			annual: 'Annual'
		};
		return labels[frequency] ?? frequency;
	}

	function getAnnualMultiplier(frequency: string): number {
		const multipliers: Record<string, number> = {
			weekly: 52,
			biweekly: 26,
			monthly: 12,
			quarterly: 4,
			annual: 1
		};
		return multipliers[frequency] ?? 12;
	}

	const annualSavings = $derived(
		data.subscription
			? data.subscription.estimatedAmount * getAnnualMultiplier(data.subscription.frequency)
			: 0
	);

	const monthlySavings = $derived(
		Math.round((annualSavings / 12) * 100) / 100
	);

	const request = $derived(data.existingRequest);

	const statusIndex = $derived(
		request
			? request.status === 'pending'
				? 0
				: request.status === 'in_progress'
					? 1
					: request.status === 'completed'
						? 3
						: request.status === 'failed'
							? -1
							: 0
			: -1
	);

	const instructions = $derived(
		request?.cancellationInstructions ?? data.instructions?.steps ?? []
	);

	const contactInfo = $derived(
		request?.providerContactInfo ?? {
			phone: data.instructions?.phone ?? null,
			email: data.instructions?.email ?? null,
			website: data.instructions?.website ?? null,
			chatUrl: data.instructions?.chatUrl ?? null
		}
	);

	const methods = $derived(data.instructions?.methods ?? ['self_service']);

	const statusSteps = ['Requested', 'In Progress', 'Awaiting Confirmation', 'Completed'];
</script>

<svelte:head>
	<title>Cancel Subscription - FinanceOwl</title>
</svelte:head>

<div class="mx-auto max-w-3xl space-y-6">
	<!-- Back link -->
	<a
		href="/subscriptions"
		class="inline-flex items-center gap-1 text-sm text-surface-400 hover:text-white transition"
	>
		<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
			<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
		</svg>
		Back to Subscriptions
	</a>

	{#if !data.subscription}
		<!-- Subscription not found -->
		<Card>
			<div class="flex flex-col items-center justify-center py-12 text-center">
				<svg class="h-16 w-16 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
				</svg>
				<p class="mt-4 text-lg text-surface-300">Subscription not found</p>
				<p class="mt-1 text-sm text-surface-500">
					This subscription may have been deleted or you may not have access to it.
				</p>
			</div>
		</Card>
	{:else}
		<!-- Header -->
		<div>
			<h2 class="text-2xl font-bold text-white">
				Cancel {data.subscription.merchantName || data.subscription.name}
			</h2>
			<p class="mt-1 text-surface-400">
				Follow the steps below to cancel your subscription
			</p>
		</div>

		<!-- Error -->
		{#if form?.error}
			<div class="rounded-lg bg-red-900/50 border border-red-800 p-4 text-sm text-red-300">
				{form.error}
			</div>
		{/if}

		<!-- Subscription Details + Savings -->
		<div class="grid gap-4 sm:grid-cols-2">
			<Card>
				<div class="space-y-3">
					<div class="flex items-center gap-3">
						<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-red-900/30">
							<svg class="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</div>
						<div>
							<p class="font-semibold text-white">
								{data.subscription.merchantName || data.subscription.name}
							</p>
							<p class="text-xs text-surface-400">
								{getFrequencyLabel(data.subscription.frequency)}
							</p>
						</div>
					</div>
					<div class="border-t border-surface-700 pt-3">
						<div class="flex justify-between text-sm">
							<span class="text-surface-400">Current charge</span>
							<span class="font-medium text-white">
								{fmt(data.subscription.estimatedAmount)}
								<span class="text-surface-500">/ {data.subscription.frequency === 'annual' ? 'year' : data.subscription.frequency === 'quarterly' ? 'quarter' : data.subscription.frequency === 'biweekly' ? '2 weeks' : data.subscription.frequency === 'weekly' ? 'week' : 'month'}</span>
							</span>
						</div>
						{#if data.subscription.nextExpectedDate}
							<div class="mt-2 flex justify-between text-sm">
								<span class="text-surface-400">Next billing</span>
								<span class="text-surface-300">
									{new Date(data.subscription.nextExpectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
								</span>
							</div>
						{/if}
						{#if data.subscription.categoryName}
							<div class="mt-2 flex justify-between text-sm">
								<span class="text-surface-400">Category</span>
								<span class="text-surface-300">{data.subscription.categoryName}</span>
							</div>
						{/if}
					</div>
				</div>
			</Card>

			<Card>
				<div class="space-y-3">
					<div class="flex items-center gap-3">
						<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-green-900/30">
							<svg class="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
						</div>
						<div>
							<p class="text-sm text-surface-400">Estimated Savings</p>
						</div>
					</div>
					<div class="border-t border-surface-700 pt-3">
						<div class="flex justify-between text-sm">
							<span class="text-surface-400">Monthly savings</span>
							<span class="font-medium text-green-400">{fmt(monthlySavings)}</span>
						</div>
						<div class="mt-2 flex justify-between text-sm">
							<span class="text-surface-400">Annual savings</span>
							<span class="font-semibold text-green-400">{fmt(annualSavings)}</span>
						</div>
					</div>
				</div>
			</Card>
		</div>

		<!-- Status Tracker (visible when cancellation has been requested) -->
		{#if request}
			<Card>
				<h3 class="mb-4 text-lg font-semibold text-white">Cancellation Status</h3>
				<div class="flex items-center justify-between">
					{#each statusSteps as step, i}
						<div class="flex flex-1 items-center">
							<div class="flex flex-col items-center">
								<div
									class="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition
									{i <= statusIndex
										? 'bg-primary-600 text-white'
										: request.status === 'failed'
											? 'bg-red-900/50 text-red-400 border border-red-700'
											: 'bg-surface-700 text-surface-400'}"
								>
									{#if i < statusIndex}
										<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
											<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
										</svg>
									{:else if i === statusIndex && request.status === 'completed'}
										<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
											<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
										</svg>
									{:else}
										{i + 1}
									{/if}
								</div>
								<p class="mt-1.5 text-center text-xs {i <= statusIndex ? 'text-white' : 'text-surface-500'}">
									{step}
								</p>
							</div>
							{#if i < statusSteps.length - 1}
								<div
									class="mx-2 mb-5 h-0.5 flex-1
									{i < statusIndex ? 'bg-primary-600' : 'bg-surface-700'}"
								></div>
							{/if}
						</div>
					{/each}
				</div>
				{#if request.status === 'failed'}
					<div class="mt-4 rounded-lg bg-red-900/30 border border-red-800 p-3 text-sm text-red-300">
						Cancellation failed. You may need to try again or contact the provider directly.
					</div>
				{/if}
			</Card>
		{/if}

		<!-- Cancellation Methods -->
		{#if methods.length > 0}
			<Card>
				<h3 class="mb-4 text-lg font-semibold text-white">Cancellation Methods</h3>
				<div class="grid gap-3 sm:grid-cols-2">
					{#if methods.includes('self_service')}
						<div class="rounded-lg border border-surface-700 p-4 hover:border-primary-600/50 transition">
							<div class="flex items-center gap-3 mb-2">
								<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-900/30">
									<svg class="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
									</svg>
								</div>
								<div>
									<p class="font-medium text-white text-sm">Online / Self-Service</p>
									<p class="text-xs text-surface-500">Cancel through their website</p>
								</div>
							</div>
							{#if contactInfo?.website}
								<a
									href={contactInfo.website}
									target="_blank"
									rel="noopener noreferrer"
									class="mt-2 inline-flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300"
								>
									Go to cancellation page
									<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
									</svg>
								</a>
							{/if}
						</div>
					{/if}

					{#if methods.includes('phone')}
						<div class="rounded-lg border border-surface-700 p-4 hover:border-primary-600/50 transition">
							<div class="flex items-center gap-3 mb-2">
								<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-900/30">
									<svg class="h-4 w-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
									</svg>
								</div>
								<div>
									<p class="font-medium text-white text-sm">Phone</p>
									<p class="text-xs text-surface-500">Call customer support</p>
								</div>
							</div>
							{#if contactInfo?.phone}
								<a
									href="tel:{contactInfo.phone}"
									class="mt-2 inline-flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300"
								>
									{contactInfo.phone}
								</a>
							{/if}
						</div>
					{/if}

					{#if methods.includes('email')}
						<div class="rounded-lg border border-surface-700 p-4 hover:border-primary-600/50 transition">
							<div class="flex items-center gap-3 mb-2">
								<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-900/30">
									<svg class="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
									</svg>
								</div>
								<div>
									<p class="font-medium text-white text-sm">Email</p>
									<p class="text-xs text-surface-500">Send a cancellation email</p>
								</div>
							</div>
							{#if contactInfo?.email}
								<a
									href="mailto:{contactInfo.email}"
									class="mt-2 inline-flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300"
								>
									{contactInfo.email}
								</a>
							{/if}
						</div>
					{/if}

					{#if methods.includes('chat')}
						<div class="rounded-lg border border-surface-700 p-4 hover:border-primary-600/50 transition">
							<div class="flex items-center gap-3 mb-2">
								<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-900/30">
									<svg class="h-4 w-4 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
									</svg>
								</div>
								<div>
									<p class="font-medium text-white text-sm">Live Chat</p>
									<p class="text-xs text-surface-500">Chat with support</p>
								</div>
							</div>
							{#if contactInfo?.chatUrl}
								<a
									href={contactInfo.chatUrl}
									target="_blank"
									rel="noopener noreferrer"
									class="mt-2 inline-flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300"
								>
									Open chat support
									<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
									</svg>
								</a>
							{/if}
						</div>
					{/if}
				</div>
			</Card>
		{/if}

		<!-- Step-by-step instructions -->
		{#if instructions.length > 0}
			<Card>
				<h3 class="mb-4 text-lg font-semibold text-white">Step-by-Step Instructions</h3>
				<ol class="space-y-3">
					{#each instructions as step, i}
						<li class="flex gap-3">
							<div
								class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-surface-700 text-xs font-bold text-surface-300"
							>
								{i + 1}
							</div>
							<p class="text-sm text-surface-300 leading-relaxed pt-0.5">{step}</p>
						</li>
					{/each}
				</ol>
			</Card>
		{/if}

		<!-- Request Cancellation Form (when no active request exists) -->
		{#if !request}
			<Card>
				<h3 class="mb-4 text-lg font-semibold text-white">Start Cancellation</h3>
				<form
					method="POST"
					action="?/requestCancellation"
					use:enhance={() => {
						return async ({ update }) => {
							await update();
						};
					}}
					class="space-y-4"
				>
					<div>
						<label for="reason" class="block text-sm font-medium text-surface-300">
							Reason for cancelling (optional)
						</label>
						<select
							id="reason"
							name="reason"
							bind:value={reason}
							class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
						>
							<option value="">Select a reason...</option>
							<option value="Too expensive">Too expensive</option>
							<option value="Not using it enough">Not using it enough</option>
							<option value="Found a better alternative">Found a better alternative</option>
							<option value="Poor service quality">Poor service quality</option>
							<option value="Temporary financial constraints">Temporary financial constraints</option>
							<option value="No longer needed">No longer needed</option>
							<option value="Other">Other</option>
						</select>
					</div>

					<div class="rounded-lg bg-amber-900/20 border border-amber-800/50 p-4">
						<div class="flex gap-3">
							<svg class="h-5 w-5 flex-shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							<div>
								<p class="text-sm font-medium text-amber-300">Before you cancel</p>
								<p class="mt-1 text-xs text-amber-400/80">
									By cancelling, you will save an estimated {fmt(annualSavings)} per year.
									Your access will typically continue until the end of your current billing period.
								</p>
							</div>
						</div>
					</div>

					<div class="flex justify-end gap-3 pt-2">
						<a href="/subscriptions">
							<Button variant="ghost" type="button">Keep Subscription</Button>
						</a>
						<Button type="submit" variant="danger">
							Request Cancellation
						</Button>
					</div>
				</form>
			</Card>
		{:else}
			<!-- Active Cancellation Request - Actions -->
			<Card>
				<h3 class="mb-4 text-lg font-semibold text-white">Track Your Cancellation</h3>

				{#if request.reason}
					<div class="mb-4 text-sm">
						<span class="text-surface-400">Reason:</span>
						<span class="ml-1 text-surface-300">{request.reason}</span>
					</div>
				{/if}

				<div class="mb-4 text-sm">
					<span class="text-surface-400">Requested:</span>
					<span class="ml-1 text-surface-300">
						{new Date(request.createdAt).toLocaleDateString('en-US', {
							month: 'long',
							day: 'numeric',
							year: 'numeric',
							hour: 'numeric',
							minute: '2-digit'
						})}
					</span>
				</div>

				{#if request.notes}
					<div class="mb-4 text-sm">
						<span class="text-surface-400">Notes:</span>
						<span class="ml-1 text-surface-300">{request.notes}</span>
					</div>
				{/if}

				{#if request.status !== 'completed'}
					<!-- Update Status -->
					<div class="space-y-4 border-t border-surface-700 pt-4">
						{#if request.status === 'pending'}
							<form
								method="POST"
								action="?/updateStatus"
								use:enhance={() => {
									return async ({ update }) => {
										await update();
									};
								}}
							>
								<input type="hidden" name="cancellationId" value={request.id} />
								<input type="hidden" name="status" value="in_progress" />
								<div class="mb-3">
									<label for="progressNotes" class="block text-sm font-medium text-surface-300">
										Add a note (optional)
									</label>
									<textarea
										id="progressNotes"
										name="notes"
										rows="2"
										bind:value={notes}
										placeholder="e.g., Called support, waiting on hold..."
										class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-sm text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
									></textarea>
								</div>
								<Button type="submit" variant="secondary">
									Mark as In Progress
								</Button>
							</form>
						{/if}

						{#if request.status === 'in_progress' || request.status === 'pending'}
							<form
								method="POST"
								action="?/confirmCancellation"
								use:enhance={() => {
									return async ({ update }) => {
										await update();
									};
								}}
								class="{request.status === 'pending' ? 'border-t border-surface-700 pt-4' : ''}"
							>
								<input type="hidden" name="cancellationId" value={request.id} />
								<div class="rounded-lg bg-green-900/20 border border-green-800/50 p-4 mb-3">
									<div class="flex gap-3">
										<svg class="h-5 w-5 flex-shrink-0 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
											<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
										</svg>
										<div>
											<p class="text-sm font-medium text-green-300">Confirm Cancellation</p>
											<p class="mt-1 text-xs text-green-400/80">
												Click below once you have successfully cancelled the subscription.
												This will mark the subscription as inactive in FinanceOwl.
											</p>
										</div>
									</div>
								</div>
								<Button type="submit" variant="primary">
									Confirm Subscription Cancelled
								</Button>
							</form>
						{/if}

						{#if request.status === 'in_progress'}
							<form
								method="POST"
								action="?/updateStatus"
								use:enhance={() => {
									return async ({ update }) => {
										await update();
									};
								}}
								class="border-t border-surface-700 pt-4"
							>
								<input type="hidden" name="cancellationId" value={request.id} />
								<input type="hidden" name="status" value="failed" />
								<input type="hidden" name="notes" value="Cancellation could not be completed" />
								<Button type="submit" variant="ghost" size="sm">
									Mark as Failed
								</Button>
							</form>
						{/if}
					</div>
				{:else}
					<!-- Completed State -->
					<div class="rounded-lg bg-green-900/20 border border-green-800/50 p-4">
						<div class="flex gap-3">
							<svg class="h-5 w-5 flex-shrink-0 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							<div>
								<p class="text-sm font-medium text-green-300">Cancellation Complete</p>
								<p class="mt-1 text-xs text-green-400/80">
									This subscription has been cancelled and marked as inactive.
									{#if request.cancellationConfirmedAt}
										Confirmed on {new Date(request.cancellationConfirmedAt).toLocaleDateString('en-US', {
											month: 'long',
											day: 'numeric',
											year: 'numeric'
										})}.
									{/if}
									You are saving an estimated {fmt(annualSavings)} per year.
								</p>
							</div>
						</div>
					</div>
				{/if}
			</Card>
		{/if}

		<!-- Savings summary across all cancellations -->
		{#if data.stats.totalCompleted > 0}
			<Card>
				<h3 class="mb-3 text-lg font-semibold text-white">Your Cancellation Savings</h3>
				<div class="grid gap-4 sm:grid-cols-3">
					<div>
						<p class="text-sm text-surface-400">Total Cancelled</p>
						<p class="mt-1 text-xl font-bold text-white">{data.stats.totalCompleted}</p>
					</div>
					<div>
						<p class="text-sm text-surface-400">Monthly Savings</p>
						<p class="mt-1 text-xl font-bold text-green-400">
							{fmt(data.stats.estimatedMonthlySavings)}
						</p>
					</div>
					<div>
						<p class="text-sm text-surface-400">Annual Savings</p>
						<p class="mt-1 text-xl font-bold text-green-400">
							{fmt(data.stats.estimatedAnnualSavings)}
						</p>
					</div>
				</div>
			</Card>
		{/if}
	{/if}
</div>
