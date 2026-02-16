<script lang="ts">
	import { Card } from '$components/ui';

	interface Account {
		name: string;
		officialName?: string;
		type: string;
		currentBalance: number;
		institutionName?: string;
	}

	interface Props {
		accounts: Account[];
	}

	let { accounts }: Props = $props();

	function fmt(amount: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount);
	}

	const typeIcons: Record<string, string> = {
		depository: 'M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z',
		credit: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z',
		investment: 'M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941',
		loan: 'M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
	};

	function getIcon(type: string): string {
		return typeIcons[type] || typeIcons.depository;
	}
</script>

<Card class="h-full">
	<div class="flex items-center justify-between">
		<h3 class="text-sm font-medium text-surface-400">Account Balances</h3>
		<a href="/accounts" class="text-xs text-primary-400 hover:text-primary-300">Manage</a>
	</div>

	{#if accounts.length > 0}
		<div class="mt-2 divide-y divide-surface-700">
			{#each accounts.slice(0, 6) as account}
				<div class="flex items-center justify-between py-2">
					<div class="flex items-center gap-2 min-w-0 flex-1">
						<div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-700">
							<svg
								class="h-3.5 w-3.5 text-surface-400"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="1.5"
							>
								<path stroke-linecap="round" stroke-linejoin="round" d={getIcon(account.type)} />
							</svg>
						</div>
						<div class="min-w-0">
							<p class="truncate text-xs font-medium text-white">{account.name}</p>
							{#if account.institutionName}
								<p class="truncate text-xs text-surface-500">{account.institutionName}</p>
							{/if}
						</div>
					</div>
					<span
						class="ml-2 text-xs font-semibold {account.currentBalance >= 0
							? 'text-white'
							: 'text-red-400'}"
					>
						{fmt(account.currentBalance)}
					</span>
				</div>
			{/each}
		</div>
		{#if accounts.length > 6}
			<p class="mt-2 text-center text-xs text-surface-500">
				+{accounts.length - 6} more accounts
			</p>
		{/if}
	{:else}
		<div class="flex flex-col items-center justify-center py-6 text-center">
			<svg
				class="h-8 w-8 text-surface-600"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="1.5"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z"
				/>
			</svg>
			<p class="mt-2 text-xs text-surface-500">
				<a href="/accounts" class="text-primary-400 hover:text-primary-300">Link your accounts</a>
			</p>
		</div>
	{/if}
</Card>
