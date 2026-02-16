<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import type { LayoutData } from './$types';
	import OfflineBanner from '$components/layout/OfflineBanner.svelte';
	import BottomNav from '$components/layout/BottomNav.svelte';
	import PullToRefresh from '$components/layout/PullToRefresh.svelte';
	import InstallPrompt from '$components/layout/InstallPrompt.svelte';
	import { tenantBranding, initTenantBranding, appName } from '$lib/stores/tenant';

	let { data, children } = $props<{ data: LayoutData; children: any }>();
	let mobileMenuOpen = $state(false);

	// Initialize tenant branding from server data (graceful - works without tenant)
	onMount(() => {
		initTenantBranding(data.tenant ?? null);
	});

	// Reactive tenant branding values
	let currentAppName = $derived($appName);
	let currentLogo = $derived($tenantBranding.logoUrl);
	let currentPrimaryColor = $derived($tenantBranding.primaryColor);

	interface NavItem {
		href: string;
		label: string;
		icon: string;
		group: 'main' | 'finance' | 'insights' | 'tools';
	}

	const navItems: NavItem[] = [
		{ href: '/dashboard', label: 'Dashboard', icon: 'home', group: 'main' },
		{ href: '/accounts', label: 'Accounts', icon: 'wallet', group: 'main' },
		{ href: '/transactions', label: 'Transactions', icon: 'list', group: 'main' },
		{ href: '/budgets', label: 'Budgets', icon: 'target', group: 'finance' },
		{ href: '/envelopes', label: 'Envelopes', icon: 'inbox', group: 'finance' },
		{ href: '/bills', label: 'Bills', icon: 'calendar', group: 'finance' },
		{ href: '/subscriptions', label: 'Subscriptions', icon: 'repeat', group: 'finance' },
		{ href: '/savings', label: 'Savings Goals', icon: 'piggy-bank', group: 'finance' },
		{ href: '/investments', label: 'Investments', icon: 'trending-up', group: 'insights' },
		{ href: '/reports', label: 'Reports', icon: 'bar-chart', group: 'insights' },
		{ href: '/forecast', label: 'Forecast', icon: 'trending-up', group: 'insights' },
		{ href: '/credit', label: 'Credit Score', icon: 'shield', group: 'insights' },
		{ href: '/household', label: 'Household', icon: 'users', group: 'tools' },
		{ href: '/identity', label: 'Identity', icon: 'lock', group: 'tools' },
		{ href: '/smart-savings', label: 'Smart Savings', icon: 'zap', group: 'tools' },
		{ href: '/flagged', label: 'Flagged', icon: 'flag', group: 'tools' },
		{ href: '/discover', label: 'Discover', icon: 'sparkles', group: 'tools' },
		{ href: '/learn', label: 'Learn', icon: 'book', group: 'tools' },
		{ href: '/receipts', label: 'Receipts', icon: 'receipt', group: 'tools' },
		{ href: '/ask', label: 'Ask AI', icon: 'sparkles', group: 'tools' }
	];

	const groupLabels: Record<string, string> = {
		main: 'Overview',
		finance: 'Finance',
		insights: 'Insights',
		tools: 'Tools'
	};

	const groups = ['main', 'finance', 'insights', 'tools'] as const;

	function isActive(href: string): boolean {
		const path = $page.url.pathname;
		return path === href || path.startsWith(href + '/');
	}

	function getPageTitle(): string {
		const path = $page.url.pathname;
		const item = navItems.find((i) => isActive(i.href));
		return item?.label ?? currentAppName;
	}

	function openMobileMenu(): void {
		mobileMenuOpen = true;
	}

	function closeMobileMenu(): void {
		mobileMenuOpen = false;
	}
</script>

<OfflineBanner />
<InstallPrompt />

<div class="flex min-h-screen bg-surface-900">
	<!-- Mobile overlay -->
	{#if mobileMenuOpen}
		<button
			class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity duration-200"
			onclick={closeMobileMenu}
			aria-label="Close menu"
		></button>
	{/if}

	<!-- Sidebar -->
	<aside
		class="fixed inset-y-0 left-0 z-50 w-64 transform border-r border-surface-700/50
			transition-transform duration-300 ease-out
			lg:static lg:translate-x-0
			{mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}"
		style="background: rgba(30, 41, 59, 0.85); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);"
	>
		<!-- Logo -->
		<div class="flex h-16 items-center justify-between border-b border-surface-700/50 px-5">
			<a href="/dashboard" class="flex items-center gap-2.5 group">
				{#if currentLogo}
					<img src={currentLogo} alt={currentAppName} class="h-8 w-8 rounded-lg object-contain" />
				{:else}
					<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600/20 border border-primary-500/30 transition-all duration-200 group-hover:bg-primary-600/30 group-hover:border-primary-500/50">
						<svg class="h-4.5 w-4.5 text-primary-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l7 4.5-7 4.5z" />
						</svg>
					</div>
				{/if}
				<span class="text-lg font-bold text-white tracking-tight">{currentAppName}</span>
			</a>
			<button
				class="rounded-lg p-1.5 text-surface-400 hover:bg-surface-700/60 hover:text-white transition-all duration-150 lg:hidden"
				onclick={closeMobileMenu}
				aria-label="Close menu"
			>
				<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
					<path
						d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
					/>
				</svg>
			</button>
		</div>

		<!-- Navigation -->
		<nav class="overflow-y-auto px-3 py-3 space-y-1" style="max-height: calc(100vh - 4rem - 5.5rem);">
			{#each groups as group}
				<!-- Group label -->
				<div class="px-3 pt-4 pb-1.5 first:pt-1">
					<p class="text-[10px] font-semibold uppercase tracking-wider text-surface-500">
						{groupLabels[group]}
					</p>
				</div>

				{#each navItems.filter((i) => i.group === group) as item}
					{@const active = isActive(item.href)}
					<a
						href={item.href}
						class="group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium
							transition-all duration-150
							{active
								? 'text-white bg-primary-600/15'
								: 'text-surface-400 hover:bg-surface-700/50 hover:text-surface-200'}"
						onclick={closeMobileMenu}
					>
						<!-- Active indicator bar -->
						{#if active}
							<div class="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-0.5 rounded-full bg-primary-400 nav-indicator"></div>
						{/if}

						<!-- Icon -->
						<span class="flex h-5 w-5 shrink-0 items-center justify-center transition-colors duration-150
							{active ? 'text-primary-400' : 'text-surface-500 group-hover:text-surface-300'}">
							{#if item.icon === 'home'}
								<svg class="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
								</svg>
							{:else if item.icon === 'wallet'}
								<svg class="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
								</svg>
							{:else if item.icon === 'list'}
								<svg class="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
								</svg>
							{:else if item.icon === 'target'}
								<svg class="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
								</svg>
							{:else if item.icon === 'inbox'}
								<svg class="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
								</svg>
							{:else if item.icon === 'calendar'}
								<svg class="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
								</svg>
							{:else if item.icon === 'repeat'}
								<svg class="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 014-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 01-4 4H3" />
								</svg>
							{:else if item.icon === 'trending-up'}
								<svg class="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
								</svg>
							{:else if item.icon === 'bar-chart'}
								<svg class="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" />
								</svg>
							{:else if item.icon === 'users'}
								<svg class="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
								</svg>
							{:else if item.icon === 'piggy-bank'}
								<svg class="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z" /><path stroke-linecap="round" stroke-linejoin="round" d="M2 12h2m16 0h2M12 2v2m0 16v2" />
								</svg>
							{:else if item.icon === 'shield'}
								<svg class="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
								</svg>
							{:else if item.icon === 'lock'}
								<svg class="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
								</svg>
							{:else if item.icon === 'zap'}
								<svg class="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
								</svg>
							{:else if item.icon === 'flag'}
								<svg class="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" />
								</svg>
							{:else if item.icon === 'sparkles'}
								<svg class="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
								</svg>
							{:else if item.icon === 'book'}
								<svg class="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
								</svg>
							{:else if item.icon === 'receipt'}
								<svg class="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
								</svg>
							{:else}
								<svg class="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<circle cx="12" cy="12" r="10" />
								</svg>
							{/if}
						</span>

						<span class="truncate">{item.label}</span>

						<!-- Active glow dot -->
						{#if active}
							<span class="ml-auto h-1.5 w-1.5 rounded-full bg-primary-400 shrink-0"></span>
						{/if}
					</a>
				{/each}
			{/each}
		</nav>

		<!-- User section at bottom -->
		<div class="absolute bottom-0 left-0 right-0 border-t border-surface-700/50 p-3 bg-surface-800/50">
			<div class="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-700/40 transition-colors duration-150">
				<div
					class="flex h-8 w-8 items-center justify-center rounded-full
						bg-gradient-to-br from-primary-500 to-primary-700
						text-sm font-semibold text-white shadow-sm shadow-primary-900/30
						ring-2 ring-primary-500/20"
				>
					{data.user?.name?.charAt(0).toUpperCase() ?? '?'}
				</div>
				<div class="flex-1 min-w-0">
					<p class="truncate text-sm font-medium text-white leading-tight">{data.user?.name}</p>
					<p class="truncate text-xs text-surface-500 leading-tight">{data.user?.email}</p>
				</div>
			</div>
			<form method="POST" action="/auth/logout" class="mt-1.5">
				<button
					type="submit"
					class="w-full flex items-center gap-2 rounded-lg px-4 py-1.5 text-left text-sm text-surface-400
						transition-all duration-150
						hover:bg-surface-700/50 hover:text-surface-200"
				>
					<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
					</svg>
					Sign out
				</button>
			</form>
		</div>
	</aside>

	<!-- Main content -->
	<div class="flex flex-1 flex-col min-w-0">
		<!-- Top bar -->
		<header class="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-surface-700/50 px-4 lg:px-6
			bg-surface-800/80 backdrop-blur-xl"
		>
			<!-- Mobile menu button -->
			<button
				class="rounded-lg p-2 text-surface-400 hover:bg-surface-700/50 hover:text-white transition-all duration-150 lg:hidden"
				onclick={openMobileMenu}
				aria-label="Open menu"
			>
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
				</svg>
			</button>

			<!-- Page title / breadcrumb -->
			<div class="flex items-center gap-2 min-w-0">
				<h1 class="text-lg font-semibold text-white truncate">{getPageTitle()}</h1>
			</div>

			<div class="flex-1"></div>

			<!-- Header right actions -->
			<div class="flex items-center gap-2">
				<!-- Notifications placeholder -->
				<button
					class="relative rounded-lg p-2 text-surface-400 hover:bg-surface-700/50 hover:text-white transition-all duration-150"
					aria-label="Notifications"
				>
					<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
					</svg>
					<!-- Notification dot -->
					<span class="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary-400 ring-2 ring-surface-800"></span>
				</button>

				<!-- User avatar in header -->
				<div
					class="hidden sm:flex h-8 w-8 items-center justify-center rounded-full
						bg-gradient-to-br from-primary-500 to-primary-700
						text-xs font-semibold text-white
						ring-2 ring-surface-700/50
						cursor-pointer hover:ring-primary-500/30 transition-all duration-150"
					title={data.user?.name ?? 'User'}
				>
					{data.user?.name?.charAt(0).toUpperCase() ?? '?'}
				</div>
			</div>
		</header>

		<!-- Page content -->
		<main class="flex-1 overflow-auto p-4 pb-20 lg:p-6 lg:pb-6">
			<PullToRefresh />
			{@render children()}
		</main>
	</div>
</div>

<BottomNav currentPath={$page.url.pathname} onOpenMore={openMobileMenu} />
