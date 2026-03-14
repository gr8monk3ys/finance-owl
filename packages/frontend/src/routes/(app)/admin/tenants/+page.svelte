<script lang="ts">
	import type { PageData } from './$types';
	import { enhance } from '$app/forms';

	let { data } = $props<{ data: PageData }>();

	let showCreateModal = $state(false);
	let newTenantName = $state('');
	let newTenantSlug = $state('');

	function getStatusColor(status: string): string {
		switch (status) {
			case 'active':
				return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
			case 'trial':
				return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
			case 'suspended':
				return 'text-red-400 bg-red-400/10 border-red-400/20';
			default:
				return 'text-surface-400 bg-surface-400/10 border-surface-400/20';
		}
	}

	function getPlanColor(plan: string): string {
		switch (plan) {
			case 'enterprise':
				return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
			case 'pro':
				return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
			default:
				return 'text-surface-400 bg-surface-400/10 border-surface-400/20';
		}
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-white">Tenant Management</h1>
			<p class="mt-1 text-sm text-surface-400">Manage white-label tenants and their configurations</p>
		</div>
		<button
			onclick={() => (showCreateModal = true)}
			class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white
				hover:bg-primary-500 transition-colors duration-150"
		>
			Create Tenant
		</button>
	</div>

	<!-- Stats Cards -->
	<div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
		<div class="rounded-xl border border-surface-700/50 bg-surface-800/50 p-4">
			<p class="text-xs font-medium uppercase tracking-wider text-surface-500">Total Tenants</p>
			<p class="mt-1 text-2xl font-bold text-white">{data.stats.tenants.total}</p>
		</div>
		<div class="rounded-xl border border-surface-700/50 bg-surface-800/50 p-4">
			<p class="text-xs font-medium uppercase tracking-wider text-emerald-500">Active</p>
			<p class="mt-1 text-2xl font-bold text-emerald-400">{data.stats.tenants.active}</p>
		</div>
		<div class="rounded-xl border border-surface-700/50 bg-surface-800/50 p-4">
			<p class="text-xs font-medium uppercase tracking-wider text-amber-500">Trial</p>
			<p class="mt-1 text-2xl font-bold text-amber-400">{data.stats.tenants.trial}</p>
		</div>
		<div class="rounded-xl border border-surface-700/50 bg-surface-800/50 p-4">
			<p class="text-xs font-medium uppercase tracking-wider text-surface-500">Total Members</p>
			<p class="mt-1 text-2xl font-bold text-white">{data.stats.totalMembers}</p>
		</div>
	</div>

	<!-- Plan Breakdown -->
	{#if data.stats.planBreakdown.length > 0}
		<div class="rounded-xl border border-surface-700/50 bg-surface-800/50 p-4">
			<h3 class="text-sm font-medium text-surface-300 mb-3">Plan Distribution</h3>
			<div class="flex gap-4">
				{#each data.stats.planBreakdown as item}
					<div class="flex items-center gap-2">
						<span class="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize {getPlanColor(item.plan)}">
							{item.plan}
						</span>
						<span class="text-sm text-white font-medium">{item.count}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Tenant List -->
	<div class="rounded-xl border border-surface-700/50 bg-surface-800/50 overflow-hidden">
		<div class="border-b border-surface-700/50 px-4 py-3">
			<h3 class="text-sm font-medium text-surface-300">All Tenants</h3>
		</div>

		{#if data.tenants.length === 0}
			<div class="p-8 text-center">
				<p class="text-surface-400">No tenants yet. Create your first tenant to get started.</p>
			</div>
		{:else}
			<div class="divide-y divide-surface-700/50">
				{#each data.tenants as tenant}
					<div class="flex items-center gap-4 px-4 py-3 hover:bg-surface-700/20 transition-colors duration-150">
						<!-- Logo / Initial -->
						<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-surface-600/50 bg-surface-700/50">
							{#if tenant.logoUrl}
								<img src={tenant.logoUrl} alt={tenant.name} class="h-6 w-6 rounded object-contain" />
							{:else}
								<span class="text-sm font-bold text-surface-300">{tenant.name.charAt(0).toUpperCase()}</span>
							{/if}
						</div>

						<!-- Info -->
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<a href="/admin/tenants/{tenant.id}" class="text-sm font-medium text-white hover:text-primary-400 transition-colors truncate">
									{tenant.name}
								</a>
								<span class="inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium capitalize {getStatusColor(tenant.status)}">
									{tenant.status}
								</span>
								<span class="inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium capitalize {getPlanColor(tenant.plan)}">
									{tenant.plan}
								</span>
							</div>
							<p class="text-xs text-surface-500 truncate">
								{tenant.slug}.financeowl.com
								{#if tenant.domain}
									 | {tenant.domain}
								{/if}
							</p>
						</div>

						<!-- Actions -->
						<div class="flex items-center gap-2 shrink-0">
							{#if tenant.status === 'active'}
								<form method="POST" action="?/suspendTenant" use:enhance>
									<input type="hidden" name="tenantId" value={tenant.id} />
									<button
										type="submit"
										class="rounded-lg px-3 py-1.5 text-xs font-medium text-red-400
											border border-red-400/20 hover:bg-red-400/10 transition-colors duration-150"
									>
										Suspend
									</button>
								</form>
							{:else if tenant.status === 'suspended'}
								<form method="POST" action="?/activateTenant" use:enhance>
									<input type="hidden" name="tenantId" value={tenant.id} />
									<button
										type="submit"
										class="rounded-lg px-3 py-1.5 text-xs font-medium text-emerald-400
											border border-emerald-400/20 hover:bg-emerald-400/10 transition-colors duration-150"
									>
										Activate
									</button>
								</form>
							{/if}
							<a
								href="/admin/tenants/{tenant.id}"
								class="rounded-lg px-3 py-1.5 text-xs font-medium text-surface-300
									border border-surface-600/50 hover:bg-surface-700/50 transition-colors duration-150"
							>
								Manage
							</a>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<!-- Create Modal -->
{#if showCreateModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center">
		<button
			class="absolute inset-0 bg-black/60 backdrop-blur-sm"
			onclick={() => (showCreateModal = false)}
			aria-label="Close modal"
		></button>
		<div class="relative z-10 w-full max-w-md rounded-xl border border-surface-700/50 bg-surface-800 p-6 shadow-xl">
			<h2 class="text-lg font-semibold text-white mb-4">Create New Tenant</h2>

			<form
				method="POST"
				action="?/createTenant"
				class="space-y-4"
				use:enhance={() => {
					return async ({ update }) => {
						await update();
						showCreateModal = false;
						newTenantName = '';
						newTenantSlug = '';
					};
				}}
			>
				<div>
					<label for="name" class="block text-sm font-medium text-surface-300 mb-1.5">Name</label>
					<input
						id="name"
						name="name"
						type="text"
						bind:value={newTenantName}
						placeholder="Acme Corp"
						class="w-full rounded-lg border border-surface-600/50 bg-surface-700/50 px-3 py-2 text-sm text-white
							placeholder:text-surface-500 focus:border-primary-500/50 focus:outline-none focus:ring-1 focus:ring-primary-500/30"
					/>
				</div>

				<div>
					<label for="slug" class="block text-sm font-medium text-surface-300 mb-1.5">Slug</label>
					<div class="flex items-center rounded-lg border border-surface-600/50 bg-surface-700/50">
						<input
							id="slug"
							name="slug"
							type="text"
							bind:value={newTenantSlug}
							placeholder="acme"
							class="flex-1 bg-transparent px-3 py-2 text-sm text-white
								placeholder:text-surface-500 focus:outline-none"
						/>
						<span class="pr-3 text-xs text-surface-500">.financeowl.com</span>
					</div>
				</div>

				<div class="flex justify-end gap-3 pt-2">
					<button
						type="button"
						onclick={() => (showCreateModal = false)}
						class="rounded-lg px-4 py-2 text-sm font-medium text-surface-400
							hover:text-white transition-colors duration-150"
					>
						Cancel
					</button>
					<button
						type="submit"
						class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white
							hover:bg-primary-500 transition-colors duration-150"
					>
						Create Tenant
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
