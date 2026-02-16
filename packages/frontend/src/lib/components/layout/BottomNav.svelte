<script lang="ts">
	interface Props {
		currentPath: string;
		onOpenMore: () => void;
	}

	let { currentPath, onOpenMore }: Props = $props();

	const navItems = [
		{ href: '/dashboard', label: 'Dashboard', icon: 'home' },
		{ href: '/accounts', label: 'Accounts', icon: 'wallet' },
		{ href: '/transactions', label: 'Transactions', icon: 'list' },
		{ href: '/budgets', label: 'Budgets', icon: 'target' }
	] as const;

	function isActive(href: string): boolean {
		return currentPath === href || currentPath.startsWith(href + '/');
	}
</script>

<nav
	class="fixed bottom-0 left-0 right-0 z-40 border-t border-surface-700/50 lg:hidden
		bg-surface-800/90 backdrop-blur-xl"
	aria-label="Mobile navigation"
>
	<div class="flex items-stretch justify-around">
		{#each navItems as item}
			{@const active = isActive(item.href)}
			<a
				href={item.href}
				class="relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-all duration-150
					{active ? 'text-primary-400' : 'text-surface-400 hover:text-surface-200'}"
				aria-current={active ? 'page' : undefined}
			>
				<!-- Active indicator dot at top -->
				{#if active}
					<span class="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full bg-primary-400 nav-indicator"></span>
				{/if}

				{#if item.icon === 'home'}
					<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={active ? '2.5' : '2'}>
						<path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
					</svg>
				{:else if item.icon === 'wallet'}
					<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={active ? '2.5' : '2'}>
						<path stroke-linecap="round" stroke-linejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
					</svg>
				{:else if item.icon === 'list'}
					<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={active ? '2.5' : '2'}>
						<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
					</svg>
				{:else if item.icon === 'target'}
					<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={active ? '2.5' : '2'}>
						<circle cx="12" cy="12" r="10" />
						<circle cx="12" cy="12" r="6" />
						<circle cx="12" cy="12" r="2" />
					</svg>
				{/if}
				<span>{item.label}</span>
			</a>
		{/each}

		<!-- More button -->
		<button
			onclick={onOpenMore}
			class="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium text-surface-400 transition-all duration-150 hover:text-surface-200"
			aria-label="More navigation options"
		>
			<svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
				<circle cx="5" cy="12" r="2" />
				<circle cx="12" cy="12" r="2" />
				<circle cx="19" cy="12" r="2" />
			</svg>
			<span>More</span>
		</button>
	</div>
</nav>
