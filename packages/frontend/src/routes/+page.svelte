<script lang="ts">
	import { publicRoutes } from '$lib/config/public';
	import { onMount } from 'svelte';

	// Intersection observer for scroll animations
	let sections: HTMLElement[] = $state([]);

	onMount(() => {
		// Tell the app.html bootstrap that hydration happened, so it stops its
		// failsafe from tearing the `js` class (and the animation) back off.
		window.__foHydrated?.();

		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						entry.target.classList.add('visible');
					}
				});
			},
			{ threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
		);

		document.querySelectorAll('.animate-on-scroll').forEach((el) => {
			observer.observe(el);
		});

		return () => observer.disconnect();
	});

	// Smooth scroll to section
	function scrollTo(id: string) {
		document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
	}

	// Mobile nav state
	let mobileNavOpen = $state(false);
	const currentYear = new Date().getFullYear();
</script>

<svelte:head>
	<title>Finance Owl - Take Control of Your Money</title>
	<meta
		name="description"
		content="Track spending, manage budgets, stay ahead of recurring bills, and build better money habits in one place. Start free."
	/>
</svelte:head>

<!-- =====================================================
     NAVIGATION
     ===================================================== -->
<a
	href="#main-content"
	class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-emerald-500 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
>
	Skip to content
</a>
<nav
	class="fixed top-0 z-50 w-full border-b border-white/5 bg-gray-950/80 backdrop-blur-xl"
>
	<div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
		<!-- Logo -->
		<a href="/" class="flex items-center gap-2.5 group">
			<div class="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-lg shadow-emerald-900/30 transition-transform duration-200 group-hover:scale-105">
				<svg class="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
					<path d="M12 2C9.5 2 7.5 3.5 7 5.5C5.5 5 3.5 5.5 2.5 7C1.5 8.5 2 10.5 3 11.5C2 12.5 1.5 14.5 2.5 16C3.5 17.5 5.5 18 7 17.5C7.5 19.5 9.5 21 12 21C14.5 21 16.5 19.5 17 17.5C18.5 18 20.5 17.5 21.5 16C22.5 14.5 22 12.5 21 11.5C22 10.5 22.5 8.5 21.5 7C20.5 5.5 18.5 5 17 5.5C16.5 3.5 14.5 2 12 2Z"/>
					<circle cx="9.5" cy="10" r="1.5" fill="#064e3b"/>
					<circle cx="14.5" cy="10" r="1.5" fill="#064e3b"/>
					<path d="M9 14.5C9 14.5 10 16 12 16C14 16 15 14.5 15 14.5" stroke="#064e3b" stroke-width="1.5" stroke-linecap="round" fill="none"/>
				</svg>
			</div>
			<span class="text-xl font-bold text-white tracking-tight">Finance <span class="text-emerald-400">Owl</span></span>
		</a>

		<!-- Desktop nav links -->
		<div class="hidden items-center gap-8 md:flex">
			<button type="button" onclick={() => scrollTo('features')} class="rounded-lg px-2 py-1 text-sm text-gray-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70">Features</button>
			<button type="button" onclick={() => scrollTo('how-it-works')} class="rounded-lg px-2 py-1 text-sm text-gray-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70">How It Works</button>
			<button type="button" onclick={() => scrollTo('pricing')} class="rounded-lg px-2 py-1 text-sm text-gray-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70">Pricing</button>
		</div>

		<!-- Desktop CTA -->
		<div class="hidden items-center gap-3 md:flex">
			<a href="/auth/login" class="rounded-lg px-4 py-2 text-sm font-medium text-gray-300 transition hover:text-white">
				Sign In
			</a>
			<a
				href="/auth/register"
				class="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-500 hover:shadow-emerald-900/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950"
			>
				Get Started Free
			</a>
		</div>

		<!-- Mobile menu button -->
		<button
			class="rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white md:hidden"
			onclick={() => (mobileNavOpen = !mobileNavOpen)}
			aria-label="Toggle menu"
			aria-expanded={mobileNavOpen}
			aria-controls="mobile-nav"
			type="button"
		>
			{#if mobileNavOpen}
				<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			{:else}
				<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
				</svg>
			{/if}
		</button>
	</div>

	<!-- Mobile menu -->
	{#if mobileNavOpen}
		<div id="mobile-nav" class="border-t border-white/5 bg-gray-950/95 backdrop-blur-xl md:hidden">
			<div class="space-y-1 px-4 pb-4 pt-2">
				<button type="button" onclick={() => { scrollTo('features'); mobileNavOpen = false; }} class="block w-full rounded-lg px-3 py-2.5 text-left text-sm text-gray-300 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70">Features</button>
				<button type="button" onclick={() => { scrollTo('how-it-works'); mobileNavOpen = false; }} class="block w-full rounded-lg px-3 py-2.5 text-left text-sm text-gray-300 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70">How It Works</button>
				<button type="button" onclick={() => { scrollTo('pricing'); mobileNavOpen = false; }} class="block w-full rounded-lg px-3 py-2.5 text-left text-sm text-gray-300 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70">Pricing</button>
				<div class="border-t border-white/5 pt-2">
					<a href="/auth/login" class="block rounded-lg px-3 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white">Sign In</a>
					<a href="/auth/register" class="mt-1 block rounded-lg bg-emerald-600 px-3 py-2.5 text-center text-sm font-semibold text-white">Get Started Free</a>
				</div>
			</div>
		</div>
	{/if}
</nav>

<main id="main-content">
<!-- =====================================================
     HERO SECTION
     ===================================================== -->
<section class="relative min-h-screen overflow-hidden bg-gray-950 pt-16">
	<!-- Background effects -->
	<div class="absolute inset-0">
		<div class="absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/8 blur-[120px]"></div>
		<div class="absolute bottom-0 left-0 h-[400px] w-[600px] -translate-x-1/3 rounded-full bg-emerald-600/5 blur-[100px]"></div>
		<div class="absolute right-0 top-1/3 h-[300px] w-[400px] translate-x-1/4 rounded-full bg-blue-500/5 blur-[80px]"></div>
		<!-- Grid pattern -->
		<div class="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]"></div>
	</div>

	<div class="relative mx-auto flex max-w-7xl flex-col items-center px-4 pb-20 pt-24 text-center sm:px-6 sm:pt-32 lg:px-8 lg:pt-40">
		<!-- Badge -->
		<div class="mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-sm text-emerald-400">
			<span class="relative flex h-2 w-2">
				<span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
				<span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-400"></span>
			</span>
			Budgets, spending, and savings in one place
		</div>

		<!-- Headline -->
		<h1 class="max-w-4xl text-5xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">
			Take Control of
			<span class="bg-gradient-to-r from-emerald-400 via-emerald-300 to-teal-400 bg-clip-text text-transparent">
				Your Money
			</span>
		</h1>

		<!-- Sub-headline -->
		<p class="mt-6 max-w-2xl text-lg leading-relaxed text-gray-400 sm:text-xl">
			Track spending, stay on top of recurring bills, and build a plan that
			actually fits your life. Your personal finance command center.
		</p>

		<!-- CTAs -->
		<div class="mt-10 flex flex-col items-center gap-4 sm:flex-row">
			<a
				href="/auth/register"
				class="group relative inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-8 py-4 text-base font-semibold text-white shadow-xl shadow-emerald-900/40 transition-all duration-200 hover:bg-emerald-500 hover:shadow-2xl hover:shadow-emerald-900/50 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950"
			>
				Get Started Free
				<svg class="h-5 w-5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
				</svg>
			</a>
			<button
				type="button"
				onclick={() => scrollTo('how-it-works')}
				class="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 py-4 text-base font-medium text-gray-300 transition-all duration-200 hover:border-white/20 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950"
			>
				<svg class="h-5 w-5 text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
					<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
				</svg>
				See How It Works
			</button>
		</div>

		<!-- Trust badges -->
		<div class="mt-14 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
			<div class="flex items-center gap-2 text-sm text-gray-500">
				<svg class="h-4 w-4 text-emerald-500/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
				</svg>
				Bank-level encryption
			</div>
			<div class="flex items-center gap-2 text-sm text-gray-500">
				<svg class="h-4 w-4 text-emerald-500/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
					<path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
				</svg>
				Read-only access
			</div>
			<div class="flex items-center gap-2 text-sm text-gray-500">
				<svg class="h-4 w-4 text-emerald-500/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
				Cancel anytime
			</div>
		</div>

		<!-- Hero illustration: Owl-themed CSS art dashboard mockup -->
		<div class="relative mt-16 w-full max-w-4xl animate-on-scroll visible">
			<div class="absolute -inset-4 rounded-3xl bg-gradient-to-b from-emerald-500/20 via-emerald-500/5 to-transparent blur-xl"></div>
			<div class="relative overflow-hidden rounded-2xl border border-white/10 bg-gray-900/80 shadow-2xl shadow-black/50">
				<!-- Mock browser chrome -->
				<div class="flex items-center gap-2 border-b border-white/5 bg-gray-900 px-4 py-3">
					<div class="flex gap-1.5">
						<div class="h-3 w-3 rounded-full bg-red-500/60"></div>
						<div class="h-3 w-3 rounded-full bg-yellow-500/60"></div>
						<div class="h-3 w-3 rounded-full bg-green-500/60"></div>
					</div>
					<div class="ml-4 flex-1 rounded-lg bg-gray-800/80 px-3 py-1 text-xs text-gray-500">app.financeowl.com/dashboard</div>
				</div>
				<!-- Mock dashboard content -->
				<div class="p-6">
					<div class="grid gap-4 sm:grid-cols-3">
						<!-- Net worth card -->
						<div class="rounded-xl border border-emerald-800/30 bg-gradient-to-br from-emerald-950/60 to-gray-800/50 p-4">
							<p class="text-xs text-emerald-400/70">Net Worth</p>
							<p class="mt-1 text-2xl font-bold text-white">$47,832</p>
							<p class="mt-1 text-xs text-emerald-400">+12.4% this year</p>
						</div>
						<!-- Monthly spend card -->
						<div class="rounded-xl border border-white/5 bg-gray-800/50 p-4">
							<p class="text-xs text-gray-500">Monthly Spending</p>
							<p class="mt-1 text-2xl font-bold text-white">$3,241</p>
							<p class="mt-1 text-xs text-emerald-400">-8.2% vs last month</p>
						</div>
						<!-- Savings card -->
						<div class="rounded-xl border border-white/5 bg-gray-800/50 p-4">
							<p class="text-xs text-gray-500">Saved This Month</p>
							<p class="mt-1 text-2xl font-bold text-emerald-400">$892</p>
							<div class="mt-2 h-1.5 rounded-full bg-gray-700">
								<div class="h-full w-3/4 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"></div>
							</div>
						</div>
					</div>
					<!-- Mock chart area -->
					<div class="mt-4 rounded-xl border border-white/5 bg-gray-800/30 p-4">
						<div class="flex items-end justify-between gap-1" style="height: 80px;">
							{#each [40, 55, 35, 65, 45, 70, 50, 80, 60, 75, 55, 85] as h}
								<div class="flex-1 rounded-t bg-gradient-to-t from-emerald-600/40 to-emerald-400/60 transition-all" style="height: {h}%"></div>
							{/each}
						</div>
						<div class="mt-2 flex justify-between text-[10px] text-gray-600">
							<span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span>
							<span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span><span>Dec</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</section>

<!-- =====================================================
     FEATURES SECTION
     ===================================================== -->
<section id="features" class="relative bg-gray-950 py-24">
	<div class="absolute inset-0">
		<div class="absolute left-0 top-1/4 h-[400px] w-[500px] -translate-x-1/2 rounded-full bg-emerald-500/5 blur-[100px]"></div>
	</div>

	<div class="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<!-- Section header -->
		<div class="animate-on-scroll mx-auto max-w-2xl text-center">
			<p class="text-sm font-semibold uppercase tracking-wider text-emerald-400">Everything You Need</p>
			<h2 class="mt-3 text-3xl font-bold text-white sm:text-4xl">Your Complete Financial Toolkit</h2>
			<p class="mt-4 text-lg text-gray-400">
				Stop juggling multiple apps. Finance Owl brings all your money management into one powerful dashboard.
			</p>
		</div>

		<!-- Feature grid -->
		<div class="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
			<!-- Subscription Tracker -->
			<div class="animate-on-scroll group rounded-2xl border border-white/5 bg-gray-900/50 p-6 transition-all duration-300 hover:border-emerald-500/20 hover:bg-gray-900/80">
				<div class="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 transition-colors group-hover:bg-emerald-500/15">
					<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
					</svg>
				</div>
				<h3 class="mt-4 text-lg font-semibold text-white">Subscription Tracker</h3>
				<p class="mt-2 text-sm leading-relaxed text-gray-400">
					Spot recurring charges, review subscription history, and understand what is quietly draining your budget each month.
				</p>
			</div>

			<!-- Bill Negotiation -->
			<div class="animate-on-scroll group rounded-2xl border border-white/5 bg-gray-900/50 p-6 transition-all duration-300 hover:border-emerald-500/20 hover:bg-gray-900/80">
				<div class="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 transition-colors group-hover:bg-amber-500/15">
					<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
					</svg>
				</div>
				<h3 class="mt-4 text-lg font-semibold text-white">Bill Negotiation</h3>
				<p class="mt-2 text-sm leading-relaxed text-gray-400">
					We help you lower your bills. Get guided scripts and tools to negotiate better rates on cable, internet, insurance, and more.
				</p>
			</div>

			<!-- Smart Savings -->
			<div class="animate-on-scroll group rounded-2xl border border-white/5 bg-gray-900/50 p-6 transition-all duration-300 hover:border-emerald-500/20 hover:bg-gray-900/80">
				<div class="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 transition-colors group-hover:bg-blue-500/15">
					<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
					</svg>
				</div>
				<h3 class="mt-4 text-lg font-semibold text-white">Smart Savings</h3>
				<p class="mt-2 text-sm leading-relaxed text-gray-400">
					Set up savings goals, round-up style rules, and progress tracking so it is easier to build momentum over time.
				</p>
			</div>

			<!-- Investment Tracking -->
			<div class="animate-on-scroll group rounded-2xl border border-white/5 bg-gray-900/50 p-6 transition-all duration-300 hover:border-emerald-500/20 hover:bg-gray-900/80">
				<div class="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400 transition-colors group-hover:bg-violet-500/15">
					<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
					</svg>
				</div>
				<h3 class="mt-4 text-lg font-semibold text-white">Investment Tracking</h3>
				<p class="mt-2 text-sm leading-relaxed text-gray-400">
					See all your investments in one place. Track performance, asset allocation, and fees across every brokerage account.
				</p>
			</div>

			<!-- Budget Envelopes -->
			<div class="animate-on-scroll group rounded-2xl border border-white/5 bg-gray-900/50 p-6 transition-all duration-300 hover:border-emerald-500/20 hover:bg-gray-900/80">
				<div class="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 transition-colors group-hover:bg-rose-500/15">
					<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839 2.51l-4.66-2.51m0 0l-1.023-.55a2.25 2.25 0 00-2.134 0l-1.022.55m0 0l-4.661 2.51m16.5 1.615a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V8.844a2.25 2.25 0 011.183-1.981l7.5-4.039a2.25 2.25 0 012.134 0l7.5 4.039a2.25 2.25 0 011.183 1.98V19.5z" />
					</svg>
				</div>
				<h3 class="mt-4 text-lg font-semibold text-white">Budget Envelopes</h3>
				<p class="mt-2 text-sm leading-relaxed text-gray-400">
					Zero-based budgeting made simple. Assign every dollar a job with our intuitive envelope system and stay on track.
				</p>
			</div>

			<!-- Spending Insights -->
			<div class="animate-on-scroll group rounded-2xl border border-white/5 bg-gray-900/50 p-6 transition-all duration-300 hover:border-emerald-500/20 hover:bg-gray-900/80">
				<div class="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 transition-colors group-hover:bg-cyan-500/15">
					<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
						<path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
					</svg>
				</div>
				<h3 class="mt-4 text-lg font-semibold text-white">Spending Insights</h3>
				<p class="mt-2 text-sm leading-relaxed text-gray-400">
					See trends, category changes, and practical recommendations that help you make better decisions with less guesswork.
				</p>
			</div>
		</div>
	</div>
</section>

<!-- =====================================================
     HOW IT WORKS SECTION
     ===================================================== -->
<section id="how-it-works" class="relative bg-gray-950 py-24">
	<div class="absolute inset-0">
		<div class="absolute right-0 top-1/3 h-[400px] w-[500px] translate-x-1/2 rounded-full bg-emerald-500/5 blur-[100px]"></div>
	</div>

	<div class="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="animate-on-scroll mx-auto max-w-2xl text-center">
			<p class="text-sm font-semibold uppercase tracking-wider text-emerald-400">Simple Setup</p>
			<h2 class="mt-3 text-3xl font-bold text-white sm:text-4xl">Get Set Up Quickly</h2>
			<p class="mt-4 text-lg text-gray-400">
				Start with manual tracking right away, then connect more pieces as your setup grows.
			</p>
		</div>

		<div class="mt-16 grid gap-8 lg:grid-cols-3">
			<!-- Step 1 -->
			<div class="animate-on-scroll relative">
				<div class="flex flex-col items-center text-center lg:items-start lg:text-left">
					<div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-2xl font-bold text-emerald-400 ring-1 ring-emerald-500/20">
						1
					</div>
					<!-- Connector line (desktop only) -->
					<div class="absolute left-[calc(50%+2rem)] top-7 hidden h-px w-[calc(100%-4rem)] bg-gradient-to-r from-emerald-500/30 to-transparent lg:block"></div>
					<h3 class="mt-6 text-xl font-semibold text-white">Link Your Accounts</h3>
					<p class="mt-3 text-sm leading-relaxed text-gray-400">
						Connect bank accounts, credit cards, and investments when account-linking is enabled for your workspace, or begin with manual accounts immediately.
					</p>
				</div>
			</div>

			<!-- Step 2 -->
			<div class="animate-on-scroll relative">
				<div class="flex flex-col items-center text-center lg:items-start lg:text-left">
					<div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-2xl font-bold text-emerald-400 ring-1 ring-emerald-500/20">
						2
					</div>
					<div class="absolute left-[calc(50%+2rem)] top-7 hidden h-px w-[calc(100%-4rem)] bg-gradient-to-r from-emerald-500/30 to-transparent lg:block"></div>
					<h3 class="mt-6 text-xl font-semibold text-white">See Your Full Picture</h3>
					<p class="mt-3 text-sm leading-relaxed text-gray-400">
						Instantly see your net worth, spending patterns, subscriptions, and upcoming bills. Everything organized and easy to understand.
					</p>
				</div>
			</div>

			<!-- Step 3 -->
			<div class="animate-on-scroll">
				<div class="flex flex-col items-center text-center lg:items-start lg:text-left">
					<div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-2xl font-bold text-emerald-400 ring-1 ring-emerald-500/20">
						3
					</div>
					<h3 class="mt-6 text-xl font-semibold text-white">Save Money Automatically</h3>
					<p class="mt-3 text-sm leading-relaxed text-gray-400">
						Use savings goals, recurring reminders, and smart rules to stay consistent and keep more of what you earn.
					</p>
				</div>
			</div>
		</div>
	</div>
</section>

<!-- =====================================================
     TRUST & POSITIONING SECTION
     ===================================================== -->
<section class="relative border-y border-white/5 bg-gray-950 py-20">
	<div class="absolute inset-0 bg-gradient-to-b from-emerald-500/[0.02] to-transparent"></div>

	<div class="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="animate-on-scroll mx-auto max-w-3xl text-center">
			<p class="text-sm font-semibold uppercase tracking-wider text-emerald-400">Why Finance Owl</p>
			<h2 class="mt-3 text-3xl font-bold text-white sm:text-4xl">
				Built for clarity, control, and follow-through
			</h2>
			<p class="mt-4 text-lg text-gray-400">
				Finance Owl focuses on the workflows people return to every week: reviewing spending,
				adjusting budgets, and keeping financial decisions organized in one place.
			</p>
		</div>

		<div class="mt-14 grid gap-6 lg:grid-cols-3">
			<div class="animate-on-scroll rounded-2xl border border-white/5 bg-gray-900/50 p-6">
				<p class="text-sm font-semibold text-emerald-400">One connected view</p>
				<h3 class="mt-3 text-xl font-semibold text-white">See balances, budgets, and transactions together.</h3>
				<p class="mt-3 text-sm leading-relaxed text-gray-300">
					Track the basics from one dashboard instead of bouncing between spreadsheets, banking apps,
					and manual notes.
				</p>
			</div>

			<div class="animate-on-scroll rounded-2xl border border-white/5 bg-gray-900/50 p-6">
				<p class="text-sm font-semibold text-blue-400">Fast weekly check-ins</p>
				<h3 class="mt-3 text-xl font-semibold text-white">Search, review, and adjust without friction.</h3>
				<p class="mt-3 text-sm leading-relaxed text-gray-300">
					The core experience is designed for quick decision-making: recent activity, budget progress,
					and recurring spend all stay easy to scan.
				</p>
			</div>

			<div class="animate-on-scroll rounded-2xl border border-white/5 bg-gray-900/50 p-6">
				<p class="text-sm font-semibold text-violet-400">Security-first posture</p>
				<h3 class="mt-3 text-xl font-semibold text-white">Use connected finance tools without giving up control.</h3>
				<p class="mt-3 text-sm leading-relaxed text-gray-300">
					Read-only account access, strong authentication options, and clear privacy controls are
					part of the product experience, not hidden footnotes.
				</p>
			</div>
		</div>
	</div>
</section>

<!-- =====================================================
     PRICING SECTION
     ===================================================== -->
<section id="pricing" class="relative bg-gray-950 py-24">
	<div class="absolute inset-0">
		<div class="absolute left-1/2 top-0 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-emerald-500/5 blur-[100px]"></div>
	</div>

	<div class="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
			<div class="animate-on-scroll mx-auto max-w-2xl text-center">
				<p class="text-sm font-semibold uppercase tracking-wider text-emerald-400">Simple Pricing</p>
				<h2 class="mt-3 text-3xl font-bold text-white sm:text-4xl">Start Free, Upgrade When Ready</h2>
				<p class="mt-4 text-lg text-gray-400">
					Choose the plan that fits how deeply you want to manage money, from a free account to
					shared household planning.
				</p>
			</div>

		<div class="mt-16 grid gap-6 lg:grid-cols-3">
			<!-- Free tier -->
			<div class="animate-on-scroll rounded-2xl border border-white/5 bg-gray-900/50 p-8">
				<h3 class="text-lg font-semibold text-white">Free</h3>
				<p class="mt-2 text-sm text-gray-400">Perfect for getting started</p>
				<div class="mt-6">
					<span class="text-4xl font-bold text-white">$0</span>
					<span class="text-gray-500">/month</span>
				</div>
				<ul class="mt-8 space-y-3">
					{#each ['Link up to 2 accounts', 'Basic budget tracking', 'Subscription detection', 'Monthly spending reports', 'Mobile app access'] as feature}
						<li class="flex items-center gap-3 text-sm text-gray-300">
							<svg class="h-5 w-5 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
								<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
							</svg>
							{feature}
						</li>
					{/each}
				</ul>
				<a
					href="/auth/register"
					class="mt-8 block rounded-xl border border-white/10 bg-white/5 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/10"
				>
					Get Started Free
				</a>
			</div>

				<!-- Pro tier -->
				<div class="animate-on-scroll relative rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-950/50 to-gray-900/50 p-8 shadow-xl shadow-emerald-900/20">
					<div class="absolute -top-3 left-1/2 -translate-x-1/2">
						<span class="rounded-full bg-emerald-500 px-4 py-1 text-xs font-semibold text-white shadow-lg shadow-emerald-900/40">
							Most Popular
						</span>
					</div>
					<h3 class="text-lg font-semibold text-white">Pro</h3>
					<p class="mt-2 text-sm text-gray-400">For people who want the full toolkit</p>
					<div class="mt-6">
						<span class="text-4xl font-bold text-white">$9.99</span>
						<span class="text-gray-500">/month</span>
					</div>
					<ul class="mt-8 space-y-3">
						{#each ['Unlimited linked accounts', 'AI spending insights', 'Subscription tracking', 'Bill negotiation tools', 'Smart savings automation', 'Investment tracking', 'Priority support'] as feature}
							<li class="flex items-center gap-3 text-sm text-gray-300">
								<svg class="h-5 w-5 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
							</svg>
							{feature}
						</li>
					{/each}
				</ul>
					<a
						href="/auth/register"
						class="mt-8 block rounded-xl bg-emerald-600 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-emerald-900/40 transition hover:bg-emerald-500"
					>
						Start with Pro
					</a>
				</div>

				<!-- Premium tier -->
				<div class="animate-on-scroll rounded-2xl border border-white/5 bg-gray-900/50 p-8">
					<h3 class="text-lg font-semibold text-white">Premium</h3>
					<p class="mt-2 text-sm text-gray-400">For households planning together</p>
					<div class="mt-6">
						<span class="text-4xl font-bold text-white">$19.99</span>
						<span class="text-gray-500">/month</span>
					</div>
					<ul class="mt-8 space-y-3">
						{#each ['Everything in Pro', 'Household sharing for up to 10 members', 'Shared budgets and goals', 'Advisor sharing', 'API access', 'Dedicated support'] as feature}
							<li class="flex items-center gap-3 text-sm text-gray-300">
								<svg class="h-5 w-5 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
									<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
							</svg>
							{feature}
						</li>
					{/each}
				</ul>
					<a
						href="/auth/register"
						class="mt-8 block rounded-xl border border-white/10 bg-white/5 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/10"
					>
						Explore Premium
					</a>
				</div>
		</div>
	</div>
</section>

<!-- =====================================================
     FINAL CTA SECTION
     ===================================================== -->
<section class="relative bg-gray-950 py-24">
	<div class="absolute inset-0">
		<div class="absolute left-1/2 top-1/2 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/8 blur-[120px]"></div>
	</div>

	<div class="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
		<div class="animate-on-scroll">
				<h2 class="text-3xl font-bold text-white sm:text-4xl">
					Ready to Take Control?
				</h2>
				<p class="mt-4 text-lg text-gray-400">
					Start with the core workflows that already matter most: understanding where money is going,
					what needs attention, and what to change next.
				</p>
			<div class="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
				<a
					href="/auth/register"
					class="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-8 py-4 text-base font-semibold text-white shadow-xl shadow-emerald-900/40 transition-all hover:bg-emerald-500 hover:shadow-2xl hover:-translate-y-0.5"
				>
					Get Started Free
					<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
					</svg>
				</a>
			</div>
			<p class="mt-6 text-sm text-gray-400">Free forever plan available. No credit card required.</p>
		</div>
	</div>
</section>

<!-- =====================================================
     FOOTER
     ===================================================== -->
<footer class="border-t border-white/5 bg-gray-950 py-12">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
			<!-- Brand -->
			<div class="sm:col-span-2 lg:col-span-1">
				<a href="/" class="flex items-center gap-2">
					<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700">
						<svg class="h-4.5 w-4.5 text-white" viewBox="0 0 24 24" fill="currentColor">
							<path d="M12 2C9.5 2 7.5 3.5 7 5.5C5.5 5 3.5 5.5 2.5 7C1.5 8.5 2 10.5 3 11.5C2 12.5 1.5 14.5 2.5 16C3.5 17.5 5.5 18 7 17.5C7.5 19.5 9.5 21 12 21C14.5 21 16.5 19.5 17 17.5C18.5 18 20.5 17.5 21.5 16C22.5 14.5 22 12.5 21 11.5C22 10.5 22.5 8.5 21.5 7C20.5 5.5 18.5 5 17 5.5C16.5 3.5 14.5 2 12 2Z"/>
							<circle cx="9.5" cy="10" r="1.5" fill="#064e3b"/>
							<circle cx="14.5" cy="10" r="1.5" fill="#064e3b"/>
						</svg>
					</div>
						<span class="text-lg font-bold text-white">Finance <span class="text-emerald-400">Owl</span></span>
				</a>
				<p class="mt-3 text-sm text-gray-400">
					Your personal finance command center for budgets, spending, and steadier money habits.
				</p>
			</div>

			<!-- Product -->
			<div>
				<h3 class="text-sm font-semibold text-white">Product</h3>
				<ul class="mt-4 space-y-2.5">
					<li><button onclick={() => scrollTo('features')} class="text-sm text-gray-300 transition hover:text-white">Features</button></li>
					<li><button onclick={() => scrollTo('pricing')} class="text-sm text-gray-300 transition hover:text-white">Pricing</button></li>
					<li><a href="/auth/register" class="text-sm text-gray-300 transition hover:text-white">Get Started</a></li>
				</ul>
			</div>

			<!-- Company -->
			<div>
				<h3 class="text-sm font-semibold text-white">Resources</h3>
				<ul class="mt-4 space-y-2.5">
					<li><a href="/security" class="text-sm text-gray-300 transition hover:text-white">Security</a></li>
					<li><a href="https://github.com/gr8monk3ys/finance-owl" class="text-sm text-gray-300 transition hover:text-white">GitHub</a></li>
					<li><a href={publicRoutes.support} class="text-sm text-gray-300 transition hover:text-white">Support</a></li>
				</ul>
			</div>

			<!-- Legal -->
			<div>
				<h3 class="text-sm font-semibold text-white">Legal</h3>
				<ul class="mt-4 space-y-2.5">
					<li><a href="/privacy" class="text-sm text-gray-300 transition hover:text-white">Privacy Policy</a></li>
					<li><a href="/terms" class="text-sm text-gray-300 transition hover:text-white">Terms of Service</a></li>
					<li><a href="/security" class="text-sm text-gray-300 transition hover:text-white">Security</a></li>
				</ul>
			</div>
		</div>

		<!-- Bottom bar -->
		<div class="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 sm:flex-row">
			<p class="text-sm text-gray-400">{currentYear} Finance Owl. All rights reserved.</p>
			<div class="flex gap-4">
				<!-- Support -->
				<a href={publicRoutes.support} class="text-gray-400 transition hover:text-white" aria-label="Support">
					<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M21.75 7.5v9A2.25 2.25 0 0119.5 18.75h-15A2.25 2.25 0 012.25 16.5v-9m19.5 0A2.25 2.25 0 0019.5 5.25h-15A2.25 2.25 0 002.25 7.5m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 9.659A2.25 2.25 0 012.25 7.743V7.5" />
					</svg>
				</a>
				<!-- GitHub -->
				<a href="https://github.com/gr8monk3ys/finance-owl" class="text-gray-400 transition hover:text-white" aria-label="GitHub">
					<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
						<path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
					</svg>
				</a>
			</div>
		</div>
	</div>
</footer>
</main>

<style>
	/*
	 * Scroll-reveal animation as a progressive enhancement.
	 *
	 * The settled (visible) state is the DEFAULT: `.animate-on-scroll` carries no
	 * opacity/transform of its own, so if JavaScript never runs, every section
	 * renders normally. The hidden-then-reveal rules only apply once the inline
	 * bootstrap in app.html has put `js` on <html> (and it removes that class
	 * again if the app fails to hydrate), which is what opts a page in.
	 */
	:global(html.js) .animate-on-scroll {
		opacity: 0;
		transform: translateY(24px);
		transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1),
			transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
	}

	:global(html.js) .animate-on-scroll.visible {
		opacity: 1;
		transform: translateY(0);
	}

	/* Stagger children in grids */
	:global(html.js) .animate-on-scroll:nth-child(2) { transition-delay: 80ms; }
	:global(html.js) .animate-on-scroll:nth-child(3) { transition-delay: 160ms; }
	:global(html.js) .animate-on-scroll:nth-child(4) { transition-delay: 240ms; }
	:global(html.js) .animate-on-scroll:nth-child(5) { transition-delay: 320ms; }
	:global(html.js) .animate-on-scroll:nth-child(6) { transition-delay: 400ms; }

	/* No motion for anyone who asked for none - the content is simply present. */
	@media (prefers-reduced-motion: reduce) {
		:global(html.js) .animate-on-scroll,
		:global(html.js) .animate-on-scroll.visible {
			opacity: 1;
			transform: none;
			transition: none;
			transition-delay: 0ms;
		}
	}
</style>
