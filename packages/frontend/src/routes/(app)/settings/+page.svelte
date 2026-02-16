<script lang="ts">
	import type { PageData } from './$types';
	import { Card } from '$components/ui';

	let { data }: { data: PageData } = $props();

	interface SettingsLink {
		title: string;
		description: string;
		href: string;
		icon: string;
		iconColor: string;
	}

	const settingsLinks: SettingsLink[] = [
		{
			title: 'Security',
			description: 'Passkeys, two-factor authentication, password, and sessions',
			href: '/settings/security',
			icon: 'shield',
			iconColor: 'text-primary-400 bg-primary-600/20'
		},
		{
			title: 'Categories',
			description: 'Manage transaction categories and auto-categorization rules',
			href: '/settings/categories',
			icon: 'tag',
			iconColor: 'text-purple-400 bg-purple-600/20'
		},
		{
			title: 'Notifications',
			description: 'Email alerts, bill reminders, and weekly digest settings',
			href: '/settings/notifications',
			icon: 'bell',
			iconColor: 'text-yellow-400 bg-yellow-600/20'
		},
		{
			title: 'Billing',
			description: 'Manage your subscription plan and payment details',
			href: '/settings/billing',
			icon: 'credit-card',
			iconColor: 'text-green-400 bg-green-600/20'
		},
		{
			title: 'Data & Privacy',
			description: 'Export data, delete account, and manage privacy settings',
			href: '/settings/data',
			icon: 'download',
			iconColor: 'text-cyan-400 bg-cyan-600/20'
		}
	];
</script>

<svelte:head>
	<title>Settings - FinanceOwl</title>
</svelte:head>

<div class="mx-auto max-w-2xl space-y-6">
	<h1 class="text-2xl font-bold text-white">Settings</h1>

	<!-- Account Info Card -->
	<Card>
		<div class="flex items-center gap-4">
			<div class="flex h-14 w-14 items-center justify-center rounded-full bg-primary-600/20 text-xl font-bold text-primary-400">
				{data.user?.name?.charAt(0)?.toUpperCase() || '?'}
			</div>
			<div class="flex-1">
				<h2 class="text-lg font-semibold text-white">{data.user?.name || 'User'}</h2>
				<p class="text-sm text-surface-400">{data.user?.email || ''}</p>
			</div>
		</div>
	</Card>

	<!-- Settings Navigation Grid -->
	<div class="grid gap-3 sm:grid-cols-2">
		{#each settingsLinks as link}
			<a
				href={link.href}
				class="group flex items-start gap-4 rounded-xl border border-surface-700 bg-surface-800 p-5 transition hover:border-surface-600 hover:bg-surface-800/80"
			>
				<div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg {link.iconColor}">
					{#if link.icon === 'shield'}
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
						</svg>
					{:else if link.icon === 'tag'}
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
							<path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6z" />
						</svg>
					{:else if link.icon === 'bell'}
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
						</svg>
					{:else if link.icon === 'credit-card'}
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
						</svg>
					{:else if link.icon === 'download'}
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
						</svg>
					{/if}
				</div>
				<div class="flex-1">
					<div class="flex items-center justify-between">
						<h3 class="text-sm font-semibold text-white group-hover:text-primary-400 transition">
							{link.title}
						</h3>
						<svg class="h-4 w-4 text-surface-500 transition group-hover:translate-x-0.5 group-hover:text-surface-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
						</svg>
					</div>
					<p class="mt-1 text-xs text-surface-400">{link.description}</p>
				</div>
			</a>
		{/each}
	</div>

	<!-- Additional Quick Links -->
	<Card padding="none">
		<div class="divide-y divide-surface-700">
			<a
				href="/settings/security"
				class="flex items-center justify-between px-6 py-4 transition hover:bg-surface-700/50"
			>
				<div class="flex items-center gap-3">
					<svg class="h-5 w-5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
					</svg>
					<div>
						<p class="text-sm font-medium text-white">Account</p>
						<p class="text-xs text-surface-400">Profile information and email</p>
					</div>
				</div>
				<svg class="h-4 w-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
				</svg>
			</a>

			<a
				href="/settings/data"
				class="flex items-center justify-between px-6 py-4 transition hover:bg-surface-700/50"
			>
				<div class="flex items-center gap-3">
					<svg class="h-5 w-5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
					</svg>
					<div>
						<p class="text-sm font-medium text-white">Data Export & Deletion</p>
						<p class="text-xs text-surface-400">Download or delete your financial data</p>
					</div>
				</div>
				<svg class="h-4 w-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
				</svg>
			</a>
		</div>
	</Card>
</div>
