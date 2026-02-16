<script lang="ts">
	import { onMount } from 'svelte';

	let activeSection = $state('');

	const sections = [
		{ id: 'acceptance', label: 'Acceptance of Terms' },
		{ id: 'description', label: 'Description of Service' },
		{ id: 'accounts', label: 'User Accounts' },
		{ id: 'billing', label: 'Subscription & Billing' },
		{ id: 'intellectual-property', label: 'Intellectual Property' },
		{ id: 'user-content', label: 'User Content' },
		{ id: 'prohibited', label: 'Prohibited Uses' },
		{ id: 'liability', label: 'Limitation of Liability' },
		{ id: 'disclaimer', label: 'Disclaimer' },
		{ id: 'termination', label: 'Termination' },
		{ id: 'governing-law', label: 'Governing Law' },
		{ id: 'changes', label: 'Changes to Terms' },
		{ id: 'contact', label: 'Contact' }
	];

	onMount(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						activeSection = entry.target.id;
					}
				}
			},
			{ threshold: 0.2, rootMargin: '-80px 0px -60% 0px' }
		);

		for (const section of sections) {
			const el = document.getElementById(section.id);
			if (el) observer.observe(el);
		}

		return () => observer.disconnect();
	});

	function scrollToSection(id: string) {
		document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
</script>

<svelte:head>
	<title>Terms of Service - Finance Owl</title>
	<meta name="description" content="Terms of Service for using the Finance Owl personal finance management platform." />
</svelte:head>

<div class="min-h-screen bg-surface-900">
	<!-- Header -->
	<div class="border-b border-surface-700/50 bg-surface-800/60 backdrop-blur-xl">
		<div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
			<div class="flex items-center gap-3">
				<a href="/" class="text-surface-400 transition hover:text-white" aria-label="Back to home">
					<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
					</svg>
				</a>
				<div>
					<h1 class="text-2xl font-bold text-white">Terms of Service</h1>
					<p class="mt-1 text-sm text-surface-400">Last updated: February 15, 2026</p>
				</div>
			</div>
		</div>
	</div>

	<div class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
		<div class="flex gap-8 lg:gap-12">
			<!-- Table of Contents Sidebar -->
			<aside class="hidden w-56 shrink-0 lg:block">
				<nav class="sticky top-8 space-y-1">
					<p class="mb-3 text-xs font-semibold uppercase tracking-wider text-surface-500">On this page</p>
					{#each sections as section}
						<button
							onclick={() => scrollToSection(section.id)}
							class="block w-full rounded-lg px-3 py-1.5 text-left text-sm transition-all duration-150
								{activeSection === section.id
									? 'bg-primary-600/15 text-primary-400 font-medium'
									: 'text-surface-400 hover:bg-surface-800 hover:text-surface-200'}"
						>
							{section.label}
						</button>
					{/each}
				</nav>
			</aside>

			<!-- Content -->
			<div class="min-w-0 flex-1">
				<div class="max-w-3xl space-y-12">

					<!-- Acceptance -->
					<section id="acceptance">
						<h2 class="text-xl font-semibold text-white">1. Acceptance of Terms</h2>
						<p class="mt-3 text-sm leading-relaxed text-surface-300">
							By creating an account or using Finance Owl (the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you must not use the Service.
						</p>
						<p class="mt-3 text-sm leading-relaxed text-surface-300">
							These Terms constitute a legally binding agreement between you and Finance Owl, Inc. ("Company," "we," "us," or "our"). You must be at least 18 years old to use the Service. By using the Service, you represent and warrant that you meet this age requirement.
						</p>
					</section>

					<!-- Description -->
					<section id="description">
						<h2 class="text-xl font-semibold text-white">2. Description of Service</h2>
						<p class="mt-3 text-sm leading-relaxed text-surface-300">
							Finance Owl is a personal finance management platform that provides tools to:
						</p>
						<ul class="mt-3 space-y-2">
							{#each [
								'Aggregate and view financial accounts from multiple institutions',
								'Track and categorize transactions automatically',
								'Detect and manage recurring subscriptions',
								'Create and monitor budgets using envelope-based budgeting',
								'Set and track savings goals with smart automation',
								'Receive AI-powered financial insights and recommendations',
								'Track investments and net worth across accounts',
								'Negotiate bills and find savings opportunities'
							] as item}
								<li class="flex items-start gap-2 text-sm text-surface-300">
									<svg class="mt-0.5 h-4 w-4 shrink-0 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
									{item}
								</li>
							{/each}
						</ul>
						<p class="mt-3 text-sm leading-relaxed text-surface-300">
							The Service connects to third-party financial institutions through Plaid to retrieve your financial data. Availability of connections may vary by institution and region.
						</p>
					</section>

					<!-- User Accounts -->
					<section id="accounts">
						<h2 class="text-xl font-semibold text-white">3. User Accounts and Responsibilities</h2>
						<div class="mt-4 space-y-4">
							<div class="rounded-xl border border-surface-700/50 bg-surface-800 p-5">
								<h3 class="text-base font-medium text-white">Account Registration</h3>
								<p class="mt-2 text-sm leading-relaxed text-surface-300">
									You must provide accurate, current, and complete information during registration. You are responsible for maintaining the accuracy of your account information and for all activity that occurs under your account.
								</p>
							</div>
							<div class="rounded-xl border border-surface-700/50 bg-surface-800 p-5">
								<h3 class="text-base font-medium text-white">Account Security</h3>
								<p class="mt-2 text-sm leading-relaxed text-surface-300">
									You are responsible for safeguarding your password and any other credentials used to access the Service. You must notify us immediately at <a href="mailto:security@financeowl.com" class="text-primary-400 underline hover:text-primary-300">security@financeowl.com</a> if you become aware of any unauthorized use of your account.
								</p>
							</div>
							<div class="rounded-xl border border-surface-700/50 bg-surface-800 p-5">
								<h3 class="text-base font-medium text-white">One Person Per Account</h3>
								<p class="mt-2 text-sm leading-relaxed text-surface-300">
									Each account is for a single individual. Sharing login credentials is prohibited. Family plans provide separate linked accounts for each member with shared budgets and views.
								</p>
							</div>
						</div>
					</section>

					<!-- Billing -->
					<section id="billing">
						<h2 class="text-xl font-semibold text-white">4. Subscription and Billing</h2>
						<div class="mt-4 space-y-4">
							<div class="rounded-xl border border-surface-700/50 bg-surface-800 p-5">
								<h3 class="text-base font-medium text-white">Free Plan</h3>
								<p class="mt-2 text-sm leading-relaxed text-surface-300">
									The free plan provides limited access to the Service at no cost. We reserve the right to modify the features available on the free plan at any time.
								</p>
							</div>
							<div class="rounded-xl border border-surface-700/50 bg-surface-800 p-5">
								<h3 class="text-base font-medium text-white">Paid Subscriptions</h3>
								<p class="mt-2 text-sm leading-relaxed text-surface-300">
									Premium and Family plans are billed on a recurring monthly or annual basis. By subscribing, you authorize us to charge your payment method on file at the beginning of each billing cycle. All fees are quoted in USD.
								</p>
							</div>
							<div class="rounded-xl border border-surface-700/50 bg-surface-800 p-5">
								<h3 class="text-base font-medium text-white">Cancellation and Refunds</h3>
								<p class="mt-2 text-sm leading-relaxed text-surface-300">
									You may cancel your subscription at any time through Settings &gt; Billing. Upon cancellation, you will retain access to paid features until the end of your current billing period. We do not provide prorated refunds for partial billing periods. Trial periods, if offered, are subject to their own terms.
								</p>
							</div>
							<div class="rounded-xl border border-surface-700/50 bg-surface-800 p-5">
								<h3 class="text-base font-medium text-white">Price Changes</h3>
								<p class="mt-2 text-sm leading-relaxed text-surface-300">
									We may adjust pricing with at least 30 days' notice. Continued use of the Service after a price change constitutes acceptance of the new pricing. Existing subscribers will be notified via email before any price increase takes effect.
								</p>
							</div>
						</div>
					</section>

					<!-- Intellectual Property -->
					<section id="intellectual-property">
						<h2 class="text-xl font-semibold text-white">5. Intellectual Property</h2>
						<p class="mt-3 text-sm leading-relaxed text-surface-300">
							The Service, including its original content, features, functionality, branding, and design, is and remains the exclusive property of Finance Owl, Inc. and its licensors. The Service is protected by copyright, trademark, and other laws of the United States and foreign countries.
						</p>
						<p class="mt-3 text-sm leading-relaxed text-surface-300">
							Our trademarks and trade dress may not be used in connection with any product or service without the prior written consent of Finance Owl, Inc.
						</p>
					</section>

					<!-- User Content -->
					<section id="user-content">
						<h2 class="text-xl font-semibold text-white">6. User Content</h2>
						<p class="mt-3 text-sm leading-relaxed text-surface-300">
							You retain ownership of any content you create within the Service, including budgets, categories, notes, and financial goals ("User Content"). By using the Service, you grant us a limited license to store, process, and display your User Content solely to provide the Service to you.
						</p>
						<p class="mt-3 text-sm leading-relaxed text-surface-300">
							You represent and warrant that you have the right to submit any User Content and that such content does not violate any third-party rights or applicable laws.
						</p>
					</section>

					<!-- Prohibited Uses -->
					<section id="prohibited">
						<h2 class="text-xl font-semibold text-white">7. Prohibited Uses</h2>
						<p class="mt-3 text-sm leading-relaxed text-surface-300">You agree not to:</p>
						<div class="mt-4 rounded-xl border border-red-500/20 bg-red-950/20 p-5">
							<ul class="space-y-2">
								{#each [
									'Use the Service for any unlawful purpose or in violation of any applicable laws',
									'Attempt to gain unauthorized access to the Service, other accounts, or computer systems',
									'Interfere with or disrupt the Service or servers connected to the Service',
									'Use automated means (bots, scrapers) to access the Service without our written permission',
									'Reverse engineer, decompile, or disassemble any aspect of the Service',
									'Impersonate any person or entity, or falsely represent your affiliation',
									'Use the Service to transmit viruses, malware, or other harmful code',
									'Resell, sublicense, or redistribute access to the Service'
								] as item}
									<li class="flex items-start gap-2 text-sm text-surface-300">
										<svg class="mt-0.5 h-4 w-4 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
										{item}
									</li>
								{/each}
							</ul>
						</div>
					</section>

					<!-- Limitation of Liability -->
					<section id="liability">
						<h2 class="text-xl font-semibold text-white">8. Limitation of Liability</h2>
						<div class="mt-4 rounded-xl border border-accent-500/20 bg-accent-950/20 p-5">
							<p class="text-sm leading-relaxed text-surface-300">
								TO THE MAXIMUM EXTENT PERMITTED BY LAW, FINANCE OWL, INC. AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM:
							</p>
							<ul class="mt-3 space-y-2">
								<li class="text-sm text-surface-300">(a) Your access to, use of, or inability to use the Service;</li>
								<li class="text-sm text-surface-300">(b) Any conduct or content of any third party on the Service;</li>
								<li class="text-sm text-surface-300">(c) Any financial decisions made based on information from the Service;</li>
								<li class="text-sm text-surface-300">(d) Unauthorized access, use, or alteration of your transmissions or content.</li>
							</ul>
							<p class="mt-3 text-sm leading-relaxed text-surface-300">
								Our total liability shall not exceed the amount you have paid us in the twelve (12) months preceding the claim.
							</p>
						</div>
					</section>

					<!-- Disclaimer -->
					<section id="disclaimer">
						<h2 class="text-xl font-semibold text-white">9. Disclaimer - Not Financial Advice</h2>
						<div class="mt-4 rounded-xl border border-accent-500/30 bg-surface-800 p-5">
							<div class="flex items-start gap-3">
								<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-600/20 text-accent-400">
									<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
									</svg>
								</div>
								<div>
									<h3 class="text-base font-semibold text-accent-400">Important Notice</h3>
									<p class="mt-2 text-sm leading-relaxed text-surface-300">
										THE SERVICE IS PROVIDED FOR INFORMATIONAL AND EDUCATIONAL PURPOSES ONLY. FINANCE OWL DOES NOT PROVIDE FINANCIAL, INVESTMENT, TAX, OR LEGAL ADVICE. The insights, recommendations, and information provided through the Service should not be relied upon as a substitute for professional financial advice.
									</p>
									<p class="mt-2 text-sm leading-relaxed text-surface-300">
										Always consult with qualified financial professionals before making financial decisions. We are not registered as investment advisors, broker-dealers, or financial planners. Past performance data shown in the Service does not guarantee future results.
									</p>
								</div>
							</div>
						</div>
					</section>

					<!-- Termination -->
					<section id="termination">
						<h2 class="text-xl font-semibold text-white">10. Termination</h2>
						<p class="mt-3 text-sm leading-relaxed text-surface-300">
							We may terminate or suspend your access to the Service immediately, without prior notice, for any reason, including breach of these Terms. Upon termination:
						</p>
						<ul class="mt-3 space-y-2">
							<li class="flex items-start gap-2 text-sm text-surface-300">
								<svg class="mt-0.5 h-4 w-4 shrink-0 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
								Your right to use the Service will immediately cease
							</li>
							<li class="flex items-start gap-2 text-sm text-surface-300">
								<svg class="mt-0.5 h-4 w-4 shrink-0 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
								You may request an export of your data within 30 days of termination
							</li>
							<li class="flex items-start gap-2 text-sm text-surface-300">
								<svg class="mt-0.5 h-4 w-4 shrink-0 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
								We will delete your data in accordance with our Privacy Policy
							</li>
						</ul>
						<p class="mt-3 text-sm leading-relaxed text-surface-300">
							You may terminate your account at any time by going to Settings &gt; Privacy &gt; Delete Account, or by contacting us at <a href="mailto:support@financeowl.com" class="text-primary-400 underline hover:text-primary-300">support@financeowl.com</a>.
						</p>
					</section>

					<!-- Governing Law -->
					<section id="governing-law">
						<h2 class="text-xl font-semibold text-white">11. Governing Law</h2>
						<p class="mt-3 text-sm leading-relaxed text-surface-300">
							These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to its conflict of law provisions. Any disputes arising out of or relating to these Terms or the Service shall be resolved in the state or federal courts located in Delaware.
						</p>
						<p class="mt-3 text-sm leading-relaxed text-surface-300">
							For any disputes that cannot be resolved informally, you agree to first attempt resolution through binding arbitration administered by the American Arbitration Association under its Commercial Arbitration Rules, before resorting to court litigation.
						</p>
					</section>

					<!-- Changes -->
					<section id="changes">
						<h2 class="text-xl font-semibold text-white">12. Changes to Terms</h2>
						<p class="mt-3 text-sm leading-relaxed text-surface-300">
							We reserve the right to modify these Terms at any time. When we make material changes, we will provide at least 30 days' notice via email and/or a prominent notice within the Service. Your continued use of the Service after the revised Terms take effect constitutes acceptance of the changes.
						</p>
						<p class="mt-3 text-sm leading-relaxed text-surface-300">
							If you do not agree to the revised Terms, you must stop using the Service and may request deletion of your account.
						</p>
					</section>

					<!-- Contact -->
					<section id="contact">
						<h2 class="text-xl font-semibold text-white">13. Contact</h2>
						<div class="mt-4 rounded-xl border border-surface-700/50 bg-surface-800 p-5">
							<p class="text-sm leading-relaxed text-surface-300">
								If you have questions about these Terms of Service, please contact us:
							</p>
							<div class="mt-4 space-y-2">
								<p class="flex items-center gap-2 text-sm text-surface-300">
									<svg class="h-4 w-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
									<a href="mailto:legal@financeowl.com" class="text-primary-400 hover:text-primary-300">legal@financeowl.com</a>
								</p>
								<p class="flex items-center gap-2 text-sm text-surface-300">
									<svg class="h-4 w-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
									Finance Owl, Inc.
								</p>
							</div>
						</div>
					</section>

					<!-- Footer links -->
					<div class="flex flex-wrap gap-4 border-t border-surface-700/50 pt-8 text-sm">
						<a href="/privacy" class="text-primary-400 underline hover:text-primary-300">Privacy Policy</a>
						<a href="/security" class="text-primary-400 underline hover:text-primary-300">Security</a>
						<a href="/" class="text-surface-400 hover:text-white">Back to Home</a>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
