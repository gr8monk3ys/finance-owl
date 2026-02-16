<script lang="ts">
	import { onMount } from 'svelte';

	let activeSection = $state('');

	const sections = [
		{ id: 'overview', label: 'Our Commitment' },
		{ id: 'encryption', label: 'Encryption & Protection' },
		{ id: 'plaid-security', label: 'Plaid Security' },
		{ id: 'infrastructure', label: 'Infrastructure' },
		{ id: 'compliance', label: 'Compliance' },
		{ id: 'disclosure', label: 'Responsible Disclosure' },
		{ id: 'contact', label: 'Security Contact' }
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
	<title>Security - Finance Owl</title>
	<meta name="description" content="Learn how Finance Owl protects your financial data with bank-level encryption, secure infrastructure, and best-in-class security practices." />
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
					<h1 class="text-2xl font-bold text-white">Security</h1>
					<p class="mt-1 text-sm text-surface-400">How we protect your data</p>
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

					<!-- Hero banner -->
					<div class="rounded-2xl border border-primary-500/20 bg-gradient-to-br from-primary-950/60 to-surface-800 p-6 sm:p-8">
						<div class="flex items-start gap-4">
							<div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary-600/20 text-primary-400">
								<svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
									<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
								</svg>
							</div>
							<div>
								<h2 class="text-xl font-bold text-white">Your security is our top priority</h2>
								<p class="mt-2 text-sm leading-relaxed text-surface-300">
									Finance Owl employs bank-level encryption, industry-standard security protocols, and rigorous access controls to keep your financial data safe. We never store your bank credentials, and we operate with read-only access to your accounts.
								</p>
							</div>
						</div>
					</div>

					<!-- Overview -->
					<section id="overview">
						<h2 class="text-xl font-semibold text-white">Our Security Commitment</h2>
						<div class="mt-4 grid gap-4 sm:grid-cols-3">
							{#each [
								{ icon: 'lock', color: 'text-primary-400 bg-primary-600/20', title: 'Encrypted', desc: 'All data encrypted at rest and in transit using AES-256 and TLS 1.3' },
								{ icon: 'eye', color: 'text-blue-400 bg-blue-600/20', title: 'Read-Only', desc: 'We never initiate transactions or move money from your accounts' },
								{ icon: 'shield', color: 'text-violet-400 bg-violet-600/20', title: 'Audited', desc: 'Regular third-party security audits and penetration testing' }
							] as item}
								<div class="rounded-xl border border-surface-700/50 bg-surface-800 p-5 text-center">
									<div class="mx-auto flex h-12 w-12 items-center justify-center rounded-xl {item.color}">
										{#if item.icon === 'lock'}
											<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
												<rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
											</svg>
										{:else if item.icon === 'eye'}
											<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
												<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
												<path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
											</svg>
										{:else}
											<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
												<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
											</svg>
										{/if}
									</div>
									<h3 class="mt-3 text-sm font-semibold text-white">{item.title}</h3>
									<p class="mt-1.5 text-xs leading-relaxed text-surface-400">{item.desc}</p>
								</div>
							{/each}
						</div>
					</section>

					<!-- Encryption -->
					<section id="encryption">
						<h2 class="text-xl font-semibold text-white">Encryption and Data Protection</h2>
						<div class="mt-4 space-y-4">
							<div class="rounded-xl border border-surface-700/50 bg-surface-800 p-5">
								<h3 class="text-base font-medium text-white">Data in Transit</h3>
								<p class="mt-2 text-sm leading-relaxed text-surface-300">
									All communication between your device and our servers is encrypted using TLS 1.3 (Transport Layer Security). We enforce HTTPS on all connections and use HSTS (HTTP Strict Transport Security) to prevent downgrade attacks. API communications use certificate pinning for additional security.
								</p>
							</div>
							<div class="rounded-xl border border-surface-700/50 bg-surface-800 p-5">
								<h3 class="text-base font-medium text-white">Data at Rest</h3>
								<p class="mt-2 text-sm leading-relaxed text-surface-300">
									All stored data is encrypted using AES-256 encryption, the same standard used by banks and government agencies. Database encryption keys are managed through a dedicated key management service (KMS) with automatic rotation. Backups are also encrypted at rest.
								</p>
							</div>
							<div class="rounded-xl border border-surface-700/50 bg-surface-800 p-5">
								<h3 class="text-base font-medium text-white">Password Security</h3>
								<p class="mt-2 text-sm leading-relaxed text-surface-300">
									Passwords are hashed using bcrypt with unique per-user salts. We never store passwords in plain text. We support passkeys (WebAuthn/FIDO2) and two-factor authentication (TOTP) for additional account security. We recommend enabling 2FA in your security settings.
								</p>
							</div>
						</div>
					</section>

					<!-- Plaid Security -->
					<section id="plaid-security">
						<h2 class="text-xl font-semibold text-white">Plaid Security</h2>
						<div class="mt-4 rounded-xl border border-blue-500/20 bg-blue-950/20 p-6">
							<div class="flex items-start gap-4">
								<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600/20 text-blue-400">
									<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
										<path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
									</svg>
								</div>
								<div class="flex-1">
									<h3 class="text-base font-semibold text-white">How Plaid Protects Your Data</h3>
									<ul class="mt-3 space-y-3">
										<li class="flex items-start gap-2 text-sm text-surface-300">
											<svg class="mt-0.5 h-4 w-4 shrink-0 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
											<strong class="font-medium text-white">No credential storage:</strong> Your bank username and password are entered directly into Plaid's secure environment. Finance Owl never sees or stores your banking credentials.
										</li>
										<li class="flex items-start gap-2 text-sm text-surface-300">
											<svg class="mt-0.5 h-4 w-4 shrink-0 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
											<strong class="font-medium text-white">Read-only access:</strong> Plaid provides read-only access tokens. We can only view your transaction data and account balances -- we cannot move money or make changes to your accounts.
										</li>
										<li class="flex items-start gap-2 text-sm text-surface-300">
											<svg class="mt-0.5 h-4 w-4 shrink-0 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
											<strong class="font-medium text-white">SOC 2 Type II certified:</strong> Plaid undergoes regular third-party security audits and maintains SOC 2 Type II certification, demonstrating robust security controls.
										</li>
										<li class="flex items-start gap-2 text-sm text-surface-300">
											<svg class="mt-0.5 h-4 w-4 shrink-0 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
											<strong class="font-medium text-white">Revocable access:</strong> You can disconnect any linked account at any time through Settings &gt; Banking, which immediately revokes our access to that institution.
										</li>
									</ul>
								</div>
							</div>
						</div>
					</section>

					<!-- Infrastructure -->
					<section id="infrastructure">
						<h2 class="text-xl font-semibold text-white">Infrastructure Security</h2>
						<div class="mt-4 grid gap-4 sm:grid-cols-2">
							{#each [
								{ title: 'Cloud Hosting', desc: 'Hosted on enterprise-grade cloud infrastructure with geographic redundancy, automatic failover, and 99.9% uptime SLA.' },
								{ title: 'Network Security', desc: 'Multi-layer firewall protection, DDoS mitigation, intrusion detection systems, and network segmentation.' },
								{ title: 'Access Controls', desc: 'Role-based access control (RBAC), principle of least privilege, and mandatory multi-factor authentication for all team members.' },
								{ title: 'Monitoring', desc: 'Real-time security monitoring, automated anomaly detection, and 24/7 incident response capabilities.' },
								{ title: 'Backups', desc: 'Automated encrypted backups with point-in-time recovery. Backups are stored in geographically separate locations.' },
								{ title: 'Dependency Management', desc: 'Automated vulnerability scanning of all dependencies with immediate patching of critical security issues.' }
							] as item}
								<div class="rounded-xl border border-surface-700/50 bg-surface-800 p-5">
									<h3 class="text-sm font-semibold text-white">{item.title}</h3>
									<p class="mt-2 text-xs leading-relaxed text-surface-400">{item.desc}</p>
								</div>
							{/each}
						</div>
					</section>

					<!-- Compliance -->
					<section id="compliance">
						<h2 class="text-xl font-semibold text-white">Compliance</h2>
						<div class="mt-4 space-y-4">
							<div class="rounded-xl border border-surface-700/50 bg-surface-800 p-5">
								<div class="flex items-center gap-3">
									<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600/20 text-primary-400">
										<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
											<path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
										</svg>
									</div>
									<div>
										<h3 class="text-base font-medium text-white">SOC 2 Type II</h3>
										<span class="inline-block mt-1 rounded-full bg-accent-600/20 px-2.5 py-0.5 text-xs font-medium text-accent-400">In Progress</span>
									</div>
								</div>
								<p class="mt-3 text-sm leading-relaxed text-surface-300">
									We are actively pursuing SOC 2 Type II certification, which covers security, availability, processing integrity, confidentiality, and privacy controls. Our target completion date is Q3 2026. In the meantime, we follow SOC 2 standards in our internal security practices.
								</p>
							</div>
							<div class="rounded-xl border border-surface-700/50 bg-surface-800 p-5">
								<h3 class="text-base font-medium text-white">Additional Compliance</h3>
								<ul class="mt-3 space-y-2">
									<li class="flex items-start gap-2 text-sm text-surface-300">
										<svg class="mt-0.5 h-4 w-4 shrink-0 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
										<strong class="font-medium text-white">GDPR:</strong> Full compliance for EU/EEA users, including data portability and right to erasure.
									</li>
									<li class="flex items-start gap-2 text-sm text-surface-300">
										<svg class="mt-0.5 h-4 w-4 shrink-0 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
										<strong class="font-medium text-white">CCPA:</strong> Full compliance for California residents, including right to know and right to delete.
									</li>
									<li class="flex items-start gap-2 text-sm text-surface-300">
										<svg class="mt-0.5 h-4 w-4 shrink-0 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
										<strong class="font-medium text-white">PCI DSS:</strong> Payment processing is handled entirely by Stripe (PCI DSS Level 1 certified). We never handle card data directly.
									</li>
								</ul>
							</div>
						</div>
					</section>

					<!-- Responsible Disclosure -->
					<section id="disclosure">
						<h2 class="text-xl font-semibold text-white">Responsible Disclosure / Bug Bounty</h2>
						<div class="mt-4 rounded-xl border border-primary-500/20 bg-primary-950/20 p-6">
							<p class="text-sm leading-relaxed text-surface-300">
								We value the security research community and welcome responsible disclosure of vulnerabilities. If you discover a security issue, please report it to us rather than disclosing it publicly.
							</p>

							<div class="mt-6 space-y-4">
								<div class="rounded-lg border border-surface-700/50 bg-surface-800/50 p-4">
									<h3 class="text-sm font-semibold text-white">How to Report</h3>
									<p class="mt-1 text-sm text-surface-300">
										Email <a href="mailto:security@financeowl.com" class="text-primary-400 underline hover:text-primary-300">security@financeowl.com</a> with a detailed description of the vulnerability, steps to reproduce, and any supporting evidence. Please use our PGP key for sensitive reports.
									</p>
								</div>
								<div class="rounded-lg border border-surface-700/50 bg-surface-800/50 p-4">
									<h3 class="text-sm font-semibold text-white">What We Ask</h3>
									<ul class="mt-2 space-y-1.5">
										<li class="flex items-start gap-2 text-sm text-surface-300">
											<svg class="mt-0.5 h-4 w-4 shrink-0 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
											Give us reasonable time (90 days) to address the issue before public disclosure
										</li>
										<li class="flex items-start gap-2 text-sm text-surface-300">
											<svg class="mt-0.5 h-4 w-4 shrink-0 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
											Do not access or modify other users' data
										</li>
										<li class="flex items-start gap-2 text-sm text-surface-300">
											<svg class="mt-0.5 h-4 w-4 shrink-0 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
											Act in good faith and avoid disrupting the Service
										</li>
									</ul>
								</div>
								<div class="rounded-lg border border-surface-700/50 bg-surface-800/50 p-4">
									<h3 class="text-sm font-semibold text-white">Our Promise</h3>
									<p class="mt-1 text-sm text-surface-300">
										We will acknowledge your report within 48 hours, provide regular updates on our progress, credit you in our security acknowledgments (if desired), and will not take legal action against researchers who act in good faith.
									</p>
								</div>
							</div>
						</div>
					</section>

					<!-- Contact -->
					<section id="contact">
						<h2 class="text-xl font-semibold text-white">Security Contact</h2>
						<div class="mt-4 rounded-xl border border-surface-700/50 bg-surface-800 p-5">
							<p class="text-sm leading-relaxed text-surface-300">
								If you have security concerns or believe your account has been compromised:
							</p>
							<div class="mt-4 space-y-2">
								<p class="flex items-center gap-2 text-sm text-surface-300">
									<svg class="h-4 w-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
									<a href="mailto:security@financeowl.com" class="text-primary-400 hover:text-primary-300">security@financeowl.com</a>
								</p>
							</div>
							<p class="mt-3 text-xs text-surface-500">
								For urgent security incidents, include "URGENT" in the subject line for priority handling.
							</p>
						</div>
					</section>

					<!-- Footer links -->
					<div class="flex flex-wrap gap-4 border-t border-surface-700/50 pt-8 text-sm">
						<a href="/privacy" class="text-primary-400 underline hover:text-primary-300">Privacy Policy</a>
						<a href="/terms" class="text-primary-400 underline hover:text-primary-300">Terms of Service</a>
						<a href="/" class="text-surface-400 hover:text-white">Back to Home</a>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
