<script lang="ts">
	import { publicMailto, publicSite } from '$lib/config/public';
	import { onMount } from 'svelte';

	let activeSection = $state('');

	const sections = [
		{ id: 'overview', label: 'Overview' },
		{ id: 'data-collection', label: 'Data We Collect' },
		{ id: 'data-usage', label: 'How We Use Your Data' },
		{ id: 'third-party', label: 'Third-Party Services' },
		{ id: 'data-retention', label: 'Data Retention' },
		{ id: 'user-rights', label: 'Your Rights' },
		{ id: 'ccpa', label: 'CCPA Compliance' },
		{ id: 'gdpr', label: 'GDPR Compliance' },
		{ id: 'cookies', label: 'Cookie Policy' },
		{ id: 'children', label: 'Children\'s Privacy' },
		{ id: 'changes', label: 'Changes to This Policy' },
		{ id: 'contact', label: 'Contact Us' }
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
	<title>Privacy Policy - Finance Owl</title>
	<meta name="description" content="Learn how Finance Owl collects, uses, and protects your personal and financial data." />
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
					<h1 class="text-2xl font-bold text-white">Privacy Policy</h1>
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
				<div class="prose-dark max-w-3xl space-y-12">

					<!-- Overview -->
					<section id="overview">
						<h2 class="text-xl font-semibold text-white">Overview</h2>
						<p class="mt-3 text-sm leading-relaxed text-surface-300">
							Finance Owl ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy describes how we collect, use, disclose, and safeguard your information when you use our personal finance management platform, including our website, mobile applications, and related services (collectively, the "Service").
						</p>
						<p class="mt-3 text-sm leading-relaxed text-surface-300">
							By accessing or using the Service, you agree to this Privacy Policy. If you do not agree with the terms of this policy, please do not access the Service.
						</p>
					</section>

					<!-- Data We Collect -->
					<section id="data-collection">
						<h2 class="text-xl font-semibold text-white">Data We Collect</h2>

						<div class="mt-4 space-y-6">
							<div class="rounded-xl border border-surface-700/50 bg-surface-800 p-5">
								<h3 class="text-base font-medium text-white">Account Information</h3>
								<ul class="mt-3 space-y-2">
									<li class="flex items-start gap-2 text-sm text-surface-300">
										<svg class="mt-0.5 h-4 w-4 shrink-0 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
										Name, email address, and login credentials (password is hashed and never stored in plain text)
									</li>
									<li class="flex items-start gap-2 text-sm text-surface-300">
										<svg class="mt-0.5 h-4 w-4 shrink-0 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
										Profile preferences, currency settings, and notification preferences
									</li>
									<li class="flex items-start gap-2 text-sm text-surface-300">
										<svg class="mt-0.5 h-4 w-4 shrink-0 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
										Billing information when paid plans are enabled
									</li>
								</ul>
							</div>

							<div class="rounded-xl border border-surface-700/50 bg-surface-800 p-5">
								<h3 class="text-base font-medium text-white">Financial Data</h3>
								<ul class="mt-3 space-y-2">
									<li class="flex items-start gap-2 text-sm text-surface-300">
										<svg class="mt-0.5 h-4 w-4 shrink-0 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
										Bank account and card transaction data when you connect accounts through a supported provider
									</li>
									<li class="flex items-start gap-2 text-sm text-surface-300">
										<svg class="mt-0.5 h-4 w-4 shrink-0 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
										Account balances, institution names, and account types
									</li>
									<li class="flex items-start gap-2 text-sm text-surface-300">
										<svg class="mt-0.5 h-4 w-4 shrink-0 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
										Budgets, savings goals, categories, and financial plans you create
									</li>
									<li class="flex items-start gap-2 text-sm text-surface-300">
										<svg class="mt-0.5 h-4 w-4 shrink-0 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
										Subscription and recurring payment information
									</li>
								</ul>
							</div>

							<div class="rounded-xl border border-surface-700/50 bg-surface-800 p-5">
								<h3 class="text-base font-medium text-white">Usage and Device Data</h3>
								<ul class="mt-3 space-y-2">
									<li class="flex items-start gap-2 text-sm text-surface-300">
										<svg class="mt-0.5 h-4 w-4 shrink-0 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
										Browser type, device type, operating system, and IP address
									</li>
									<li class="flex items-start gap-2 text-sm text-surface-300">
										<svg class="mt-0.5 h-4 w-4 shrink-0 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
										Pages visited, features used, and time spent in the application
									</li>
									<li class="flex items-start gap-2 text-sm text-surface-300">
										<svg class="mt-0.5 h-4 w-4 shrink-0 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
										Error logs and performance metrics to improve service reliability
									</li>
								</ul>
							</div>
						</div>
					</section>

					<!-- How We Use Your Data -->
					<section id="data-usage">
						<h2 class="text-xl font-semibold text-white">How We Use Your Data</h2>
						<p class="mt-3 text-sm leading-relaxed text-surface-300">We use the information we collect to:</p>
						<div class="mt-4 grid gap-4 sm:grid-cols-2">
							{#each [
								{ title: 'Provide the Service', desc: 'Aggregate your financial accounts, categorize transactions, track subscriptions, and generate insights.' },
								{ title: 'Analytics & Insights', desc: 'Generate spending reports, budget recommendations, and personalized financial advice.' },
								{ title: 'Categorization', desc: 'Automatically categorize transactions using machine learning to help you understand spending patterns.' },
								{ title: 'Communication', desc: 'Send bill reminders, budget alerts, weekly digests, and important service updates.' },
								{ title: 'Improvement', desc: 'Analyze usage patterns to improve features, fix bugs, and develop new functionality.' },
								{ title: 'Security', desc: 'Detect and prevent fraud, unauthorized access, and other potentially illegal activities.' }
							] as item}
								<div class="rounded-lg border border-surface-700/50 bg-surface-800/50 p-4">
									<h3 class="text-sm font-medium text-white">{item.title}</h3>
									<p class="mt-1.5 text-xs leading-relaxed text-surface-400">{item.desc}</p>
								</div>
							{/each}
						</div>
					</section>

					<!-- Third-Party Services -->
					<section id="third-party">
						<h2 class="text-xl font-semibold text-white">Third-Party Services</h2>
						<p class="mt-3 text-sm leading-relaxed text-surface-300">
							We may integrate with the following third-party services when those features are enabled for your workspace:
						</p>

						<div class="mt-4 space-y-4">
							<div class="rounded-xl border border-surface-700/50 bg-surface-800 p-5">
								<div class="flex items-center gap-3">
									<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/20 text-blue-400">
										<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
											<path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
										</svg>
									</div>
									<div>
										<h3 class="text-base font-medium text-white">Connected account providers</h3>
										<p class="text-xs text-surface-400">Bank and card connectivity</p>
									</div>
								</div>
								<p class="mt-3 text-sm leading-relaxed text-surface-300">
									When account linking is enabled, Finance Owl may rely on a provider such as Plaid to connect external accounts. Provider-specific authentication, security, and retention details are governed by that vendor's terms and policies. See <a href="https://plaid.com/legal" target="_blank" rel="noopener noreferrer" class="text-primary-400 underline hover:text-primary-300">Plaid's legal resources</a> for an example of a supported provider policy.
								</p>
							</div>

							<div class="rounded-xl border border-surface-700/50 bg-surface-800 p-5">
								<div class="flex items-center gap-3">
									<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-600/20 text-violet-400">
										<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
											<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
										</svg>
									</div>
									<div>
										<h3 class="text-base font-medium text-white">Billing provider</h3>
										<p class="text-xs text-surface-400">Payment processing</p>
									</div>
								</div>
								<p class="mt-3 text-sm leading-relaxed text-surface-300">
									If you subscribe to a paid plan, billing is handled by the configured payment processor rather than storing full card details directly in Finance Owl. See <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" class="text-primary-400 underline hover:text-primary-300">Stripe's Privacy Policy</a> for an example of a supported billing provider.
								</p>
							</div>
						</div>
					</section>

					<!-- Data Retention -->
					<section id="data-retention">
						<h2 class="text-xl font-semibold text-white">Data Retention</h2>
						<div class="mt-4 rounded-xl border border-surface-700/50 bg-surface-800 p-5">
							<ul class="space-y-3">
								<li class="flex items-start gap-2 text-sm text-surface-300">
									<svg class="mt-0.5 h-4 w-4 shrink-0 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
									<strong class="font-medium text-white">Active account data</strong> is retained for as long as your account is active and you continue to use the Service.
								</li>
								<li class="flex items-start gap-2 text-sm text-surface-300">
									<svg class="mt-0.5 h-4 w-4 shrink-0 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
									<strong class="font-medium text-white">Transaction history</strong> is retained according to the product plan, connected providers, and any legal or accounting obligations that apply.
								</li>
								<li class="flex items-start gap-2 text-sm text-surface-300">
									<svg class="mt-0.5 h-4 w-4 shrink-0 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
									<strong class="font-medium text-white">Deleted account data</strong> is removed according to the deletion workflow and any retention period required by law, fraud prevention, or billing records.
								</li>
								<li class="flex items-start gap-2 text-sm text-surface-300">
									<svg class="mt-0.5 h-4 w-4 shrink-0 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
									<strong class="font-medium text-white">Anonymized analytics data</strong> may be retained indefinitely for service improvement and aggregate reporting.
								</li>
							</ul>
						</div>
					</section>

					<!-- Your Rights -->
					<section id="user-rights">
						<h2 class="text-xl font-semibold text-white">Your Rights</h2>
						<p class="mt-3 text-sm leading-relaxed text-surface-300">
							Depending on your location, you may have the following rights regarding your personal data:
						</p>
						<div class="mt-4 grid gap-3 sm:grid-cols-2">
							{#each [
								{ title: 'Access', desc: 'Request a copy of the personal data we hold about you.' },
								{ title: 'Correction', desc: 'Request correction of inaccurate or incomplete data.' },
								{ title: 'Deletion', desc: 'Request deletion of your personal data and account.' },
								{ title: 'Export', desc: 'Export your data in a machine-readable format (JSON/CSV).' },
								{ title: 'Restriction', desc: 'Request that we limit processing of your data.' },
								{ title: 'Objection', desc: 'Object to processing of your data for specific purposes.' }
							] as right}
								<div class="rounded-lg border border-surface-700/50 bg-surface-800/50 p-4">
									<h3 class="text-sm font-semibold text-primary-400">{right.title}</h3>
									<p class="mt-1 text-xs leading-relaxed text-surface-400">{right.desc}</p>
								</div>
							{/each}
						</div>
						<p class="mt-4 text-sm text-surface-300">
							To exercise any of these rights, visit <a href="/settings/privacy" class="text-primary-400 underline hover:text-primary-300">Settings &gt; Privacy</a> or contact us at <a href={publicMailto.privacy} class="text-primary-400 underline hover:text-primary-300">{publicSite.privacyEmail}</a>.
						</p>
					</section>

					<!-- CCPA -->
					<section id="ccpa">
						<h2 class="text-xl font-semibold text-white">CCPA Compliance (California Residents)</h2>
						<div class="mt-4 rounded-xl border border-surface-700/50 bg-surface-800 p-5">
							<p class="text-sm leading-relaxed text-surface-300">
								If you are a California resident, the California Consumer Privacy Act (CCPA) provides you with additional rights:
							</p>
							<ul class="mt-3 space-y-2">
								<li class="flex items-start gap-2 text-sm text-surface-300">
									<svg class="mt-0.5 h-4 w-4 shrink-0 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
									<strong class="font-medium text-white">Right to Know:</strong> You can request disclosure of the categories and specific pieces of personal information we have collected.
								</li>
								<li class="flex items-start gap-2 text-sm text-surface-300">
									<svg class="mt-0.5 h-4 w-4 shrink-0 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
									<strong class="font-medium text-white">Right to Delete:</strong> You can request that we delete the personal information we have collected from you.
								</li>
								<li class="flex items-start gap-2 text-sm text-surface-300">
									<svg class="mt-0.5 h-4 w-4 shrink-0 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
									<strong class="font-medium text-white">Right to Opt-Out:</strong> We do not sell your personal information. If this changes, we will provide a clear opt-out mechanism.
								</li>
								<li class="flex items-start gap-2 text-sm text-surface-300">
									<svg class="mt-0.5 h-4 w-4 shrink-0 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
									<strong class="font-medium text-white">Non-Discrimination:</strong> We will not discriminate against you for exercising your CCPA rights.
								</li>
							</ul>
						</div>
					</section>

					<!-- GDPR -->
					<section id="gdpr">
						<h2 class="text-xl font-semibold text-white">GDPR Compliance (EU/EEA Residents)</h2>
						<div class="mt-4 rounded-xl border border-surface-700/50 bg-surface-800 p-5">
							<p class="text-sm leading-relaxed text-surface-300">
								If you are located in the European Union or European Economic Area, GDPR provides additional protections:
							</p>
							<ul class="mt-3 space-y-2">
								<li class="flex items-start gap-2 text-sm text-surface-300">
									<svg class="mt-0.5 h-4 w-4 shrink-0 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
									<strong class="font-medium text-white">Legal Basis:</strong> We process your data based on your consent, contractual necessity, and legitimate interests.
								</li>
								<li class="flex items-start gap-2 text-sm text-surface-300">
									<svg class="mt-0.5 h-4 w-4 shrink-0 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
									<strong class="font-medium text-white">Data Portability:</strong> You may request your data in a structured, commonly used, machine-readable format.
								</li>
								<li class="flex items-start gap-2 text-sm text-surface-300">
									<svg class="mt-0.5 h-4 w-4 shrink-0 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
									<strong class="font-medium text-white">Data Transfers:</strong> When transferring data outside the EU/EEA, we use Standard Contractual Clauses and other approved mechanisms.
								</li>
								<li class="flex items-start gap-2 text-sm text-surface-300">
									<svg class="mt-0.5 h-4 w-4 shrink-0 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
									<strong class="font-medium text-white">Supervisory Authority:</strong> You have the right to lodge a complaint with your local data protection authority.
								</li>
							</ul>
						</div>
					</section>

					<!-- Cookie Policy -->
					<section id="cookies">
						<h2 class="text-xl font-semibold text-white">Cookie Policy</h2>
						<p class="mt-3 text-sm leading-relaxed text-surface-300">
							We use cookies and similar technologies to enhance your experience:
						</p>
						<div class="mt-4 overflow-hidden rounded-xl border border-surface-700/50">
							<table class="w-full text-sm">
								<thead>
									<tr class="border-b border-surface-700/50 bg-surface-800">
										<th class="px-4 py-3 text-left font-medium text-white">Type</th>
										<th class="px-4 py-3 text-left font-medium text-white">Purpose</th>
										<th class="px-4 py-3 text-left font-medium text-white">Duration</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-surface-700/50">
									<tr class="bg-surface-800/50">
										<td class="px-4 py-3 font-medium text-surface-200">Essential</td>
										<td class="px-4 py-3 text-surface-400">Authentication, security, and core functionality</td>
										<td class="px-4 py-3 text-surface-400">Session</td>
									</tr>
									<tr class="bg-surface-800/30">
										<td class="px-4 py-3 font-medium text-surface-200">Functional</td>
										<td class="px-4 py-3 text-surface-400">Preferences, language, and display settings</td>
										<td class="px-4 py-3 text-surface-400">1 year</td>
									</tr>
									<tr class="bg-surface-800/50">
										<td class="px-4 py-3 font-medium text-surface-200">Analytics</td>
										<td class="px-4 py-3 text-surface-400">Usage patterns and service improvement</td>
										<td class="px-4 py-3 text-surface-400">2 years</td>
									</tr>
								</tbody>
							</table>
						</div>
						<p class="mt-3 text-sm text-surface-300">
							You can manage cookie preferences through your browser settings. Disabling essential cookies may affect the functionality of the Service.
						</p>
					</section>

					<!-- Children -->
					<section id="children">
						<h2 class="text-xl font-semibold text-white">Children's Privacy</h2>
						<p class="mt-3 text-sm leading-relaxed text-surface-300">
							The Service is not intended for users under the age of 18. We do not knowingly collect personal information from children. If we become aware that we have collected data from a child under 18, we will take steps to delete that information promptly. If you believe we have collected information from a minor, please contact us at <a href={publicMailto.privacy} class="text-primary-400 underline hover:text-primary-300">{publicSite.privacyEmail}</a>.
						</p>
					</section>

					<!-- Changes -->
					<section id="changes">
						<h2 class="text-xl font-semibold text-white">Changes to This Policy</h2>
						<p class="mt-3 text-sm leading-relaxed text-surface-300">
							We may update this Privacy Policy from time to time. When we make material changes, we will notify you via email and/or a prominent notice within the Service at least 30 days before the changes take effect. Your continued use of the Service after the effective date constitutes acceptance of the updated policy.
						</p>
					</section>

					<!-- Contact -->
					<section id="contact">
						<h2 class="text-xl font-semibold text-white">Contact Us</h2>
						<div class="mt-4 rounded-xl border border-surface-700/50 bg-surface-800 p-5">
							<p class="text-sm leading-relaxed text-surface-300">
								If you have any questions about this Privacy Policy or our data practices, please contact us:
							</p>
							<div class="mt-4 space-y-2">
								<p class="flex items-center gap-2 text-sm text-surface-300">
									<svg class="h-4 w-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
									<a href={publicMailto.privacy} class="text-primary-400 hover:text-primary-300">{publicSite.privacyEmail}</a>
								</p>
								<p class="flex items-center gap-2 text-sm text-surface-300">
									<svg class="h-4 w-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
									{publicSite.legalEntityName}
								</p>
								{#if publicSite.companyAddress}
									<p class="flex items-center gap-2 text-sm text-surface-300">
										<svg class="h-4 w-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.243-4.243a8 8 0 1111.313 0z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
										{publicSite.companyAddress}
									</p>
								{/if}
							</div>
						</div>
					</section>

					<!-- Footer links -->
					<div class="flex flex-wrap gap-4 border-t border-surface-700/50 pt-8 text-sm">
						<a href="/terms" class="text-primary-400 underline hover:text-primary-300">Terms of Service</a>
						<a href="/security" class="text-primary-400 underline hover:text-primary-300">Security</a>
						<a href="/" class="text-surface-400 hover:text-white">Back to Home</a>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
