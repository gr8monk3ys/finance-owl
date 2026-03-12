<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Card, Button, Modal } from '$components/ui';
	import type { PageData, ActionData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	let showCreateModal = $state(false);
	let viewingLogs = $state<any>(null);

	$effect(() => {
		if (form?.success) {
			invalidateAll();
			showCreateModal = false;
		}
	});

	function fmtDate(dateStr: string | null): string {
		if (!dateStr) return 'Never';
		return new Date(dateStr).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function isExpired(expiresAt: string | null): boolean {
		if (!expiresAt) return false;
		return new Date(expiresAt) < new Date();
	}

	function getPermissionColor(permission: string): string {
		switch (permission) {
			case 'accounts':
				return 'bg-blue-500/20 text-blue-300 border border-blue-500/30';
			case 'transactions':
				return 'bg-green-500/20 text-green-300 border border-green-500/30';
			case 'budgets':
				return 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30';
			case 'investments':
				return 'bg-purple-500/20 text-purple-300 border border-purple-500/30';
			case 'reports':
				return 'bg-orange-500/20 text-orange-300 border border-orange-500/30';
			default:
				return 'bg-surface-600 text-surface-300 border border-surface-500/30';
		}
	}

	const activeShares = $derived(
		data.shares.filter((s: any) => s.isActive && !isExpired(s.expiresAt))
	);
	const inactiveShares = $derived(
		data.shares.filter((s: any) => !s.isActive || isExpired(s.expiresAt))
	);

	const permissionOptions = [
		{ key: 'accounts', label: 'Accounts', description: 'View account names and balances' },
		{ key: 'transactions', label: 'Transactions', description: 'View transaction history' },
		{ key: 'budgets', label: 'Budgets', description: 'View budget categories and spending' },
		{ key: 'investments', label: 'Investments', description: 'View investment holdings and performance' },
		{ key: 'reports', label: 'Reports', description: 'Generate and view financial reports' }
	];
</script>

<svelte:head>
	<title>Advisor Sharing - Finance Owl</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-2xl font-bold text-white">Advisor Sharing</h2>
			<p class="mt-1 text-sm text-surface-400">
				Share your financial data securely with trusted advisors.
			</p>
		</div>
		<Button onclick={() => (showCreateModal = true)}>Share with Advisor</Button>
	</div>

	<!-- Error -->
	{#if form?.error}
		<div class="rounded-lg bg-red-900/50 p-3 text-sm text-red-300">{form.error}</div>
	{/if}

	<!-- Active Shares -->
	<Card>
		<div class="flex items-center justify-between">
			<h3 class="text-lg font-semibold text-white">Active Shares</h3>
			<span class="rounded-full bg-surface-700 px-2.5 py-1 text-xs font-medium text-surface-300">
				{activeShares.length}
			</span>
		</div>

		{#if activeShares.length === 0}
			<div class="flex flex-col items-center py-8 text-center">
				<svg
					class="h-12 w-12 text-surface-600"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="1"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
					/>
				</svg>
				<p class="mt-3 text-sm text-surface-400">
					No active shares. Share your financial data with a trusted advisor.
				</p>
			</div>
		{:else}
			<div class="mt-4 space-y-4">
				{#each activeShares as share}
					<div class="rounded-lg border border-surface-700 bg-surface-800 p-4">
						<div class="flex items-start justify-between">
							<div>
								<p class="font-medium text-white">{share.advisorName}</p>
								<p class="text-sm text-surface-400">{share.advisorEmail}</p>
							</div>
							<div class="flex items-center gap-2">
								<button
									class="rounded-lg p-1.5 text-surface-400 transition hover:bg-surface-700 hover:text-white"
									onclick={() => (viewingLogs = share)}
									title="View access logs"
								>
									<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
									</svg>
								</button>
								<form method="POST" action="?/revoke" use:enhance>
									<input type="hidden" name="id" value={share.id} />
									<button
										type="submit"
										class="rounded-lg p-1.5 text-surface-400 transition hover:bg-red-900/30 hover:text-red-400"
										title="Revoke access"
									>
										<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
											<path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
										</svg>
									</button>
								</form>
							</div>
						</div>

						<!-- Permissions -->
						<div class="mt-3 flex flex-wrap gap-1.5">
							{#each share.permissions as permission}
								<span class="rounded-full px-2 py-0.5 text-xs font-medium capitalize {getPermissionColor(permission)}">
									{permission}
								</span>
							{/each}
						</div>

						<!-- Meta -->
						<div class="mt-3 flex items-center gap-4 text-xs text-surface-500">
							<span>Shared {fmtDate(share.createdAt)}</span>
							{#if share.expiresAt}
								<span>Expires {fmtDate(share.expiresAt)}</span>
							{:else}
								<span>No expiration</span>
							{/if}
							{#if share.lastAccessedAt}
								<span>Last accessed {fmtDate(share.lastAccessedAt)}</span>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</Card>

	<!-- Inactive/Expired Shares -->
	{#if inactiveShares.length > 0}
		<Card>
			<h3 class="text-lg font-semibold text-white">Revoked / Expired</h3>
			<div class="mt-4 space-y-3">
				{#each inactiveShares as share}
					<div class="rounded-lg border border-surface-700 bg-surface-900/50 p-3 opacity-60">
						<div class="flex items-center justify-between">
							<div>
								<p class="text-sm font-medium text-surface-300">{share.advisorName}</p>
								<p class="text-xs text-surface-500">{share.advisorEmail}</p>
							</div>
							<span class="rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-300 border border-red-500/30">
								{isExpired(share.expiresAt) ? 'Expired' : 'Revoked'}
							</span>
						</div>
					</div>
				{/each}
			</div>
		</Card>
	{/if}
</div>

<!-- Create Share Modal -->
<Modal open={showCreateModal} onclose={() => (showCreateModal = false)} title="Share with Advisor">
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
			<label for="advisorName" class="block text-sm font-medium text-surface-300">
				Advisor Name
			</label>
			<input
				id="advisorName"
				name="advisorName"
				type="text"
				required
				class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				placeholder="Jane Smith"
			/>
		</div>

		<div>
			<label for="advisorEmail" class="block text-sm font-medium text-surface-300">
				Advisor Email
			</label>
			<input
				id="advisorEmail"
				name="advisorEmail"
				type="email"
				required
				class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white placeholder-surface-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				placeholder="advisor@example.com"
			/>
		</div>

		<div>
			<span class="block text-sm font-medium text-surface-300">Permissions</span>
			<p class="mt-1 text-xs text-surface-500">Select what data the advisor can access.</p>
			<div class="mt-3 space-y-2">
				{#each permissionOptions as option}
					<label class="flex cursor-pointer items-start gap-3 rounded-lg border border-surface-700 p-3 transition hover:border-surface-600 hover:bg-surface-800">
						<input
							type="checkbox"
							name="permission_{option.key}"
							class="mt-0.5 h-4 w-4 rounded border-surface-600 bg-surface-700 text-primary-500 focus:ring-primary-500"
						/>
						<div>
							<p class="text-sm font-medium text-white">{option.label}</p>
							<p class="text-xs text-surface-500">{option.description}</p>
						</div>
					</label>
				{/each}
			</div>
		</div>

		<div>
			<label for="expiresAt" class="block text-sm font-medium text-surface-300">
				Expiration Date (optional)
			</label>
			<input
				id="expiresAt"
				name="expiresAt"
				type="date"
				class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
			/>
			<p class="mt-1.5 text-xs text-surface-500">
				Leave blank for no expiration. The advisor link will remain active until revoked.
			</p>
		</div>

		<div class="flex justify-end gap-3 pt-2">
			<Button variant="ghost" type="button" onclick={() => (showCreateModal = false)}>
				Cancel
			</Button>
			<Button type="submit">Create Share Link</Button>
		</div>
	</form>
</Modal>

<!-- Access Logs Modal -->
<Modal
	open={viewingLogs !== null}
	onclose={() => (viewingLogs = null)}
	title="Access Logs"
>
	{#if viewingLogs}
		<div class="space-y-3">
			<div class="rounded-lg bg-surface-900 p-3">
				<p class="text-sm text-surface-400">Advisor</p>
				<p class="font-medium text-white">{viewingLogs.advisorName}</p>
				<p class="text-xs text-surface-500">{viewingLogs.advisorEmail}</p>
			</div>
			<p class="text-sm text-surface-400">
				Access logs are tracked when the advisor views your shared portal.
			</p>
			<div class="flex justify-end pt-2">
				<Button variant="ghost" onclick={() => (viewingLogs = null)}>Close</Button>
			</div>
		</div>
	{/if}
</Modal>
