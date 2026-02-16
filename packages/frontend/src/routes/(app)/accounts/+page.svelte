<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Card, Button, Modal } from '$components/ui';
	import PlaidLink from '$lib/components/plaid/PlaidLink.svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form } = $props<{ data: PageData; form: ActionData }>();

	let showManualModal = $state(false);
	let linkToken = $state<string | null>(null);
	let updateLinkToken = $state<string | null>(null);
	let linking = $state(false);
	let syncing = $state<string | null>(null);
	let error = $state('');
	let syncResult = $state<{ added: number; modified: number; removed: number } | null>(null);
	let sandboxMode = $state(false);

	$effect(() => {
		if (form?.linkToken) {
			linkToken = form.linkToken;
		}
		if (form?.updateLinkToken) {
			updateLinkToken = form.updateLinkToken;
		}
		if (form?.success || form?.refreshSuccess) {
			invalidateAll();
			linkToken = null;
			updateLinkToken = null;
		}
		if (form?.syncSuccess && form?.syncResult) {
			syncResult = form.syncResult;
			syncing = null;
			invalidateAll();
		}
		if (form?.error) {
			error = form.error;
			linking = false;
			syncing = null;
		}
		// Sandbox: auto-exchange the sandbox public token
		if (form?.sandboxPublicToken) {
			handlePlaidSuccess(form.sandboxPublicToken);
		}
		// After successful exchange, auto-trigger initial sync
		if (form?.linkedPlaidItemId) {
			triggerSync(form.linkedPlaidItemId);
		}
	});

	async function handlePlaidSuccess(publicToken: string) {
		linking = true;
		error = '';

		const formData = new FormData();
		formData.set('publicToken', publicToken);

		const res = await fetch('?/exchange', {
			method: 'POST',
			body: formData
		});

		linking = false;
		linkToken = null;

		if (res.ok) {
			const result = await res.json();
			invalidateAll();
			// The server action returns linkedPlaidItemId - extract and sync
			const itemId =
				result?.data?.linkedPlaidItemId ??
				(typeof result === 'string' ? null : null);
			if (itemId) {
				triggerSync(itemId);
			}
		} else {
			error = 'Failed to link account';
		}
	}

	async function triggerSync(plaidItemId: string) {
		syncing = plaidItemId;
		syncResult = null;

		const formData = new FormData();
		formData.set('plaidItemId', plaidItemId);

		try {
			const res = await fetch('?/sync', {
				method: 'POST',
				body: formData
			});

			if (res.ok) {
				const result = await res.json();
				syncResult = result?.data?.syncResult ?? null;
				invalidateAll();
			} else {
				error = 'Transaction sync failed';
			}
		} catch {
			error = 'Transaction sync failed';
		} finally {
			syncing = null;
		}
	}

	function formatBalance(balance: number | null, type: string): string {
		if (balance === null) return '--';
		const val = ['credit_card', 'loan', 'mortgage'].includes(type) ? -balance : balance;
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(val);
	}

	function formatType(type: string): string {
		return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	}

	function statusColor(status: string): string {
		switch (status) {
			case 'active':
				return 'text-green-400';
			case 'error':
				return 'text-red-400';
			case 'login_required':
				return 'text-yellow-400';
			case 'pending_expiration':
				return 'text-orange-400';
			default:
				return 'text-surface-400';
		}
	}

	function statusLabel(status: string): string {
		switch (status) {
			case 'active':
				return 'Connected';
			case 'error':
				return 'Error';
			case 'login_required':
				return 'Login Required';
			case 'pending_expiration':
				return 'Expiring Soon';
			case 'revoked':
				return 'Revoked';
			default:
				return status;
		}
	}

	// Group accounts by institution
	function groupByInstitution(
		accounts: any[]
	): { institution: string; accounts: any[] }[] {
		const grouped = new Map<string, any[]>();
		for (const acct of accounts) {
			const key = acct.institutionName || (acct.isManual ? 'Manual Accounts' : 'Other');
			if (!grouped.has(key)) grouped.set(key, []);
			grouped.get(key)!.push(acct);
		}
		return Array.from(grouped.entries()).map(([institution, accounts]) => ({
			institution,
			accounts
		}));
	}

	// Find the plaidItem matching an institution name
	function findPlaidItemForInstitution(institutionName: string): any | null {
		return data.plaidItems.find((i: any) => i.institutionName === institutionName) ?? null;
	}
</script>

<svelte:head>
	<title>Accounts - FinanceOwl</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h2 class="text-2xl font-bold text-white">Accounts</h2>
		<div class="flex gap-2">
			<Button variant="secondary" onclick={() => (showManualModal = true)}>Add Manual</Button>
			{#if linkToken}
				<PlaidLink {linkToken} onSuccess={handlePlaidSuccess} onExit={() => (linkToken = null)} />
			{:else}
				<form method="POST" action="?/link" use:enhance>
					<Button type="submit">Link Bank Account</Button>
				</form>
			{/if}
		</div>
	</div>

	{#if error}
		<div class="flex items-center justify-between rounded-lg bg-red-900/50 p-3 text-sm text-red-300">
			{error}
			<button onclick={() => (error = '')} class="text-red-200 hover:text-white">Dismiss</button>
		</div>
	{/if}

	{#if linking}
		<div class="flex items-center gap-3 rounded-lg bg-primary-900/30 p-3 text-sm text-primary-300">
			<svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
				<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
			</svg>
			Linking account... Exchanging token and fetching account details.
		</div>
	{/if}

	{#if syncing}
		<div class="flex items-center gap-3 rounded-lg bg-blue-900/30 p-3 text-sm text-blue-300">
			<svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
				<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
			</svg>
			Syncing transactions...
		</div>
	{/if}

	{#if syncResult}
		<div class="flex items-center justify-between rounded-lg bg-green-900/30 p-3 text-sm text-green-300">
			<span>
				Sync complete: {syncResult.added} added, {syncResult.modified} modified, {syncResult.removed} removed
			</span>
			<button onclick={() => (syncResult = null)} class="text-green-200 hover:text-white">
				Dismiss
			</button>
		</div>
	{/if}

	<!-- Net worth summary -->
	<div class="grid gap-4 sm:grid-cols-3">
		<Card>
			<p class="text-sm text-surface-400">Total Assets</p>
			<p class="mt-1 text-xl font-bold text-green-400">
				{formatBalance(data.netWorth.assets, 'checking')}
			</p>
		</Card>
		<Card>
			<p class="text-sm text-surface-400">Total Liabilities</p>
			<p class="mt-1 text-xl font-bold text-red-400">
				{formatBalance(data.netWorth.liabilities, 'credit_card')}
			</p>
		</Card>
		<Card>
			<p class="text-sm text-surface-400">Net Worth</p>
			<p class="mt-1 text-xl font-bold text-white">
				{formatBalance(data.netWorth.netWorth, 'checking')}
			</p>
		</Card>
	</div>

	<!-- Linked institutions status -->
	{#if data.plaidItems.length > 0}
		<Card padding="none">
			<div class="border-b border-surface-700 px-6 py-4">
				<h3 class="font-semibold text-white">Linked Institutions</h3>
			</div>
			<div class="divide-y divide-surface-700">
				{#each data.plaidItems as item}
					<div class="flex items-center justify-between px-6 py-3">
						<div class="flex items-center gap-3">
							<div
								class="h-2 w-2 rounded-full {item.status === 'active'
									? 'bg-green-400'
									: item.status === 'login_required'
										? 'bg-yellow-400'
										: 'bg-red-400'}"
							></div>
							<div>
								<p class="font-medium text-white">{item.institutionName || 'Unknown Institution'}</p>
								<p class="text-xs {statusColor(item.status)}">
									{statusLabel(item.status)}
									{#if item.errorCode}
										<span class="text-surface-500">({item.errorCode})</span>
									{/if}
								</p>
							</div>
						</div>
						<div class="flex items-center gap-2">
							{#if item.status === 'login_required' || item.status === 'error'}
								<form method="POST" action="?/updateLink" use:enhance>
									<input type="hidden" name="plaidItemId" value={item.id} />
									<Button type="submit" variant="secondary" size="sm">Re-authenticate</Button>
								</form>
							{/if}
							{#if item.status === 'active'}
								<form method="POST" action="?/refresh" use:enhance>
									<input type="hidden" name="plaidItemId" value={item.id} />
									<Button type="submit" variant="ghost" size="sm">Refresh</Button>
								</form>
								<Button
									variant="ghost"
									size="sm"
									onclick={() => triggerSync(item.id)}
									disabled={syncing === item.id}
								>
									{syncing === item.id ? 'Syncing...' : 'Sync'}
								</Button>
							{/if}
							<form method="POST" action="?/unlink" use:enhance>
								<input type="hidden" name="plaidItemId" value={item.id} />
								<Button type="submit" variant="ghost" size="sm">Unlink</Button>
							</form>
						</div>
					</div>
				{/each}
			</div>
		</Card>
	{/if}

	<!-- Update mode Plaid Link -->
	{#if updateLinkToken}
		<PlaidLink
			linkToken={updateLinkToken}
			onSuccess={() => {
				updateLinkToken = null;
				invalidateAll();
			}}
			onExit={() => (updateLinkToken = null)}
			buttonText="Re-authenticate"
		/>
	{/if}

	<!-- Accounts grouped by institution -->
	{#if data.accounts.length === 0}
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
						d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
					/>
				</svg>
				<p class="mt-4 text-lg text-surface-300">No accounts linked yet</p>
				<p class="mt-1 text-sm text-surface-500">
					Link your bank accounts or add them manually to start tracking your finances.
				</p>
				<div class="mt-6 flex gap-3">
					<form method="POST" action="?/link" use:enhance>
						<Button type="submit">Link Bank Account</Button>
					</form>
					<Button variant="secondary" onclick={() => (showManualModal = true)}>
						Add Manual Account
					</Button>
				</div>
			</div>
		</Card>
	{:else}
		{#each groupByInstitution(data.accounts) as group}
			<Card padding="none">
				<div class="border-b border-surface-700 px-6 py-4">
					<h3 class="font-semibold text-white">{group.institution}</h3>
				</div>
				<div class="divide-y divide-surface-700">
					{#each group.accounts as account}
						<div class="flex items-center justify-between px-6 py-4">
							<div>
								<p class="font-medium text-white">
									{account.name}
									{#if account.mask}
										<span class="text-surface-500">...{account.mask}</span>
									{/if}
								</p>
								<p class="text-sm text-surface-400">{formatType(account.type)}</p>
							</div>
							<div class="text-right">
								<p
									class="font-semibold {(account.currentBalance ?? 0) < 0
										? 'text-red-400'
										: 'text-white'}"
								>
									{formatBalance(account.currentBalance, account.type)}
								</p>
								{#if account.availableBalance !== null && account.availableBalance !== account.currentBalance}
									<p class="text-xs text-surface-500">
										{formatBalance(account.availableBalance, account.type)} available
									</p>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</Card>
		{/each}
	{/if}

	<!-- Sandbox testing section -->
	<details class="rounded-lg border border-surface-700 bg-surface-800/50">
		<summary class="cursor-pointer px-6 py-3 text-sm text-surface-400 hover:text-surface-300">
			Sandbox Testing Tools
		</summary>
		<div class="space-y-3 border-t border-surface-700 px-6 py-4">
			<p class="text-xs text-surface-500">
				These tools are only available when the backend is running with PLAID_ENV=sandbox.
				They allow testing the full Plaid flow without the Link UI.
			</p>
			<form method="POST" action="?/sandboxTestLink" use:enhance>
				<Button type="submit" variant="secondary" size="sm">
					Create Sandbox Test Link (skip Plaid UI)
				</Button>
			</form>
			{#each data.plaidItems as item}
				<div class="flex items-center gap-2">
					<span class="text-xs text-surface-400">{item.institutionName}:</span>
					<Button
						variant="ghost"
						size="sm"
						onclick={() => triggerSync(item.id)}
						disabled={syncing === item.id}
					>
						Sync Transactions
					</Button>
				</div>
			{/each}
		</div>
	</details>
</div>

<!-- Manual Account Modal -->
<Modal open={showManualModal} onclose={() => (showManualModal = false)} title="Add Manual Account">
	<form
		method="POST"
		action="?/createManual"
		use:enhance={() => {
			return async ({ update }) => {
				await update();
				showManualModal = false;
			};
		}}
		class="space-y-4"
	>
		<div>
			<label for="name" class="block text-sm font-medium text-surface-300">Account Name</label>
			<input
				id="name"
				name="name"
				type="text"
				required
				class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				placeholder="e.g., Chase Checking"
			/>
		</div>

		<div>
			<label for="type" class="block text-sm font-medium text-surface-300">Account Type</label>
			<select
				id="type"
				name="type"
				required
				class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
			>
				<option value="checking">Checking</option>
				<option value="savings">Savings</option>
				<option value="credit_card">Credit Card</option>
				<option value="investment">Investment</option>
				<option value="loan">Loan</option>
				<option value="mortgage">Mortgage</option>
				<option value="other">Other</option>
			</select>
		</div>

		<div>
			<label for="institutionName" class="block text-sm font-medium text-surface-300"
				>Institution (optional)</label
			>
			<input
				id="institutionName"
				name="institutionName"
				type="text"
				class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
				placeholder="e.g., Chase"
			/>
		</div>

		<div>
			<label for="balance" class="block text-sm font-medium text-surface-300"
				>Current Balance</label
			>
			<input
				id="balance"
				name="balance"
				type="number"
				step="0.01"
				value="0"
				class="mt-1 block w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
			/>
		</div>

		<div class="flex justify-end gap-3 pt-2">
			<Button variant="ghost" type="button" onclick={() => (showManualModal = false)}>
				Cancel
			</Button>
			<Button type="submit">Add Account</Button>
		</div>
	</form>
</Modal>
