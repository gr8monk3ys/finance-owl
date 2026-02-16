<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';
	import { Button, Card } from '$components/ui';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let updating = $state(false);
	let exporting = $state(false);
	let deleting = $state(false);
	let deletionReason = $state('');
	let showDeletionConfirm = $state(false);

	const consentTypes = [
		{
			key: 'data_processing',
			label: 'Data Processing',
			description: 'Allow us to process your financial data to provide core app functionality.'
		},
		{
			key: 'marketing',
			label: 'Marketing Communications',
			description:
				'Receive personalized offers, tips, and updates about new features via email.'
		},
		{
			key: 'analytics',
			label: 'Analytics & Improvements',
			description:
				'Help us improve the app by sharing anonymized usage data and crash reports.'
		},
		{
			key: 'third_party',
			label: 'Third-Party Sharing',
			description:
				'Allow sharing anonymized data with trusted partners for enhanced financial insights.'
		}
	];

	function isConsentGranted(consentType: string): boolean {
		const consent = data.dashboard.consents.find(
			(c: any) => c.consentType === consentType
		);
		return consent?.isGranted ?? false;
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'pending':
				return 'text-yellow-400';
			case 'processing':
				return 'text-blue-400';
			case 'completed':
				return 'text-green-400';
			case 'confirmed':
				return 'text-orange-400';
			case 'expired':
				return 'text-surface-400';
			default:
				return 'text-surface-400';
		}
	}

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return 'N/A';
		return new Date(dateStr).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<svelte:head>
	<title>Privacy Settings - FinanceOwl</title>
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
		<div>
			<h1 class="text-2xl font-bold text-white">Privacy & Data</h1>
			<p class="text-sm text-surface-400">Manage your data, consent preferences, and privacy rights</p>
		</div>
	</div>

	{#if form?.success}
		<div class="rounded-lg bg-green-900/50 px-4 py-3 text-sm text-green-300">
			{form.message || 'Settings updated successfully.'}
		</div>
	{/if}

	{#if form?.error}
		<div class="rounded-lg bg-red-900/50 px-4 py-3 text-sm text-red-300">
			{form.error}
		</div>
	{/if}

	<!-- Consent Toggles -->
	<Card padding="none">
		<div class="space-y-6 p-6">
			<div>
				<h2 class="text-lg font-semibold text-white">Consent Preferences</h2>
				<p class="mt-1 text-sm text-surface-400">
					Control how your data is used. Changes take effect immediately.
				</p>
			</div>

			<div class="space-y-4">
				{#each consentTypes as consent}
					<form
						method="POST"
						action="?/updateConsent"
						use:enhance={() => {
							updating = true;
							return async ({ update }) => {
								updating = false;
								await update();
							};
						}}
					>
						<input type="hidden" name="consentType" value={consent.key} />
						<input
							type="hidden"
							name="isGranted"
							value={isConsentGranted(consent.key) ? 'false' : 'true'}
						/>
						<div class="flex items-center justify-between">
							<div class="mr-4">
								<p class="text-sm font-medium text-white">{consent.label}</p>
								<p class="text-xs text-surface-400">{consent.description}</p>
							</div>
							<button
								type="submit"
								disabled={updating}
								class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-surface-800 disabled:cursor-not-allowed disabled:opacity-50 {isConsentGranted(consent.key) ? 'bg-primary-600' : 'bg-surface-600'}"
								aria-label="Toggle {consent.label}"
							>
								<span
									class="pointer-events-none inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition-transform {isConsentGranted(consent.key) ? 'translate-x-5' : 'translate-x-0.5'}"
								></span>
							</button>
						</div>
					</form>
				{/each}
			</div>
		</div>
	</Card>

	<!-- Data Export -->
	<Card padding="none">
		<div class="space-y-6 p-6">
			<div>
				<h2 class="text-lg font-semibold text-white">Export Your Data</h2>
				<p class="mt-1 text-sm text-surface-400">
					Download a complete copy of your personal data in JSON format. The export will be
					available for 7 days after processing.
				</p>
			</div>

			<form
				method="POST"
				action="?/requestExport"
				use:enhance={() => {
					exporting = true;
					return async ({ update }) => {
						exporting = false;
						await update();
					};
				}}
			>
				<Button type="submit" loading={exporting} class="w-full sm:w-auto">
					<svg class="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
						/>
					</svg>
					Request Data Export
				</Button>
			</form>

			{#if data.dashboard.exports.length > 0}
				<div class="space-y-3">
					<h3 class="text-sm font-medium text-surface-300">Recent Export Requests</h3>
					{#each data.dashboard.exports as exportReq}
						<div class="flex items-center justify-between rounded-lg bg-surface-700/50 px-4 py-3">
							<div>
								<p class="text-sm text-white">
									{exportReq.format.toUpperCase()} Export
								</p>
								<p class="text-xs text-surface-400">
									Requested {formatDate(exportReq.createdAt)}
								</p>
							</div>
							<span class="text-xs font-medium uppercase {getStatusColor(exportReq.status)}">
								{exportReq.status}
							</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</Card>

	<!-- Data Deletion -->
	<Card padding="none">
		<div class="space-y-6 p-6">
			<div>
				<h2 class="text-lg font-semibold text-white">Delete Your Data</h2>
				<p class="mt-1 text-sm text-surface-400">
					Request permanent deletion of your account and all associated data. This action is
					irreversible and will be processed within 30 days.
				</p>
			</div>

			{#if !showDeletionConfirm}
				<Button
					variant="danger"
					onclick={() => (showDeletionConfirm = true)}
					class="w-full sm:w-auto"
				>
					<svg class="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
						/>
					</svg>
					Request Account Deletion
				</Button>
			{:else}
				<div class="rounded-lg border border-red-800/50 bg-red-900/20 p-4">
					<p class="mb-3 text-sm font-medium text-red-300">
						Are you sure? This will permanently delete all your data including accounts,
						transactions, budgets, and settings.
					</p>
					<form
						method="POST"
						action="?/requestDeletion"
						use:enhance={() => {
							deleting = true;
							return async ({ update }) => {
								deleting = false;
								showDeletionConfirm = false;
								await update();
							};
						}}
					>
						<div class="mb-4">
							<label for="deletion-reason" class="mb-1 block text-xs font-medium text-surface-300">
								Reason for leaving (optional)
							</label>
							<textarea
								id="deletion-reason"
								name="reason"
								bind:value={deletionReason}
								rows="2"
								class="w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-sm text-white placeholder-surface-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
								placeholder="Help us improve by sharing why you're leaving..."
							></textarea>
						</div>
						<div class="flex gap-3">
							<Button type="submit" variant="danger" loading={deleting}>
								Confirm Deletion
							</Button>
							<Button
								variant="secondary"
								onclick={() => (showDeletionConfirm = false)}
							>
								Cancel
							</Button>
						</div>
					</form>
				</div>
			{/if}

			{#if data.dashboard.deletions.length > 0}
				<div class="space-y-3">
					<h3 class="text-sm font-medium text-surface-300">Deletion Requests</h3>
					{#each data.dashboard.deletions as deletion}
						<div class="flex items-center justify-between rounded-lg bg-surface-700/50 px-4 py-3">
							<div>
								<p class="text-sm text-white">Account Deletion</p>
								<p class="text-xs text-surface-400">
									Requested {formatDate(deletion.createdAt)}
									{#if deletion.scheduledAt}
										&middot; Scheduled for {formatDate(deletion.scheduledAt)}
									{/if}
								</p>
							</div>
							<span class="text-xs font-medium uppercase {getStatusColor(deletion.status)}">
								{deletion.status}
							</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</Card>

	<!-- Privacy Information -->
	<Card padding="none">
		<div class="space-y-4 p-6">
			<h2 class="text-lg font-semibold text-white">Your Privacy Rights</h2>
			<div class="space-y-3 text-sm text-surface-400">
				<div class="flex items-start gap-3">
					<svg class="mt-0.5 h-4 w-4 shrink-0 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
					</svg>
					<p><strong class="text-surface-300">Right to Access:</strong> You can export all your personal data at any time using the export feature above.</p>
				</div>
				<div class="flex items-start gap-3">
					<svg class="mt-0.5 h-4 w-4 shrink-0 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
					</svg>
					<p><strong class="text-surface-300">Right to Erasure:</strong> Request complete deletion of your account and all associated data.</p>
				</div>
				<div class="flex items-start gap-3">
					<svg class="mt-0.5 h-4 w-4 shrink-0 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
					</svg>
					<p><strong class="text-surface-300">Right to Withdraw Consent:</strong> Toggle any consent preference off at any time without affecting prior processing.</p>
				</div>
				<div class="flex items-start gap-3">
					<svg class="mt-0.5 h-4 w-4 shrink-0 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
					</svg>
					<p><strong class="text-surface-300">Data Portability:</strong> Your exported data is provided in standard JSON format for easy transfer.</p>
				</div>
			</div>
		</div>
	</Card>
</div>
